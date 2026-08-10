begin;

create or replace function public.set_student_passive_safely(
  p_student_id uuid,
  p_passive_reason text,
  p_passive_date date
)
returns table(
  student_id uuid,
  deleted_plan_count bigint,
  deleted_pending_occurrence_count bigint,
  preserved_history_count bigint
)
language plpgsql
set search_path = ''
as $function$
declare
  v_clean_reason text;

  v_deleted_plan_count bigint := 0;
  v_deleted_pending_count bigint := 0;
  v_preserved_history_count bigint := 0;

  v_group_plan_id uuid;
  v_replacement_student_id uuid;
  v_replacement_package_id uuid;

  v_affected_count bigint := 0;
begin
  v_clean_reason :=
    nullif(trim(p_passive_reason), '');

  if v_clean_reason is null then
    raise exception
      'Pasife alma nedeni zorunludur.'
      using errcode = '22023';
  end if;

  if p_passive_date is null then
    raise exception
      'Pasife alma tarihi zorunludur.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.students s
    where s.id = p_student_id
  ) then
    raise exception
      'Öğrenci bulunamadı.'
      using errcode = 'P0002';
  end if;

  /*
   * Geçmiş kayıtlar hiçbir zaman silinmez.
   * Bu sayaç, eski fonksiyonun dönüş sözleşmesini korur.
   */
  select count(*)
  into v_preserved_history_count
  from public.lesson_occurrences lo
  where
    lo.student_id = p_student_id
    and lo.status in (
      'Yapıldı',
      'Telafi yapıldı',
      'Telafi Yapıldı',
      'İptal edildi',
      'İptal Edildi'
    );

  /*
   * Grup dersinde lesson_plans.student_id / package_id alanları
   * eski ekranlarla uyumluluk için "legacy ana öğrenci" olarak tutuluyor.
   *
   * Pasife alınan öğrenci grubun ana öğrencisiyse:
   * - başka aktif bir katılımcı varsa onu ana öğrenci yap,
   * - gelecekteki/bekleyen occurrence kayıtlarını da yeni ana öğrenciye taşı,
   * - başka geçerli katılımcı yoksa yalnız o grup planını kaldır.
   *
   * Böylece bir öğrenciyi pasife almak diğer öğrencilerin grup dersini silmez.
   */
  for v_group_plan_id in
    select lp.id
    from public.lesson_plans lp
    where
      lp.lesson_type = 'group'
      and lp.is_active = true
      and lp.student_id = p_student_id
  loop
    v_replacement_student_id := null;
    v_replacement_package_id := null;

    select
      lps.student_id,
      sp.package_id
    into
      v_replacement_student_id,
      v_replacement_package_id
    from public.lesson_plan_students lps
    join public.students replacement_student
      on replacement_student.id = lps.student_id
    join public.student_packages sp
      on sp.id = lps.student_package_id
    where
      lps.lesson_plan_id = v_group_plan_id
      and lps.student_id <> p_student_id
      and lps.is_active = true
      and replacement_student.is_active = true
      and coalesce(replacement_student.is_archived, false) = false
      and coalesce(replacement_student.is_anonymized, false) = false
      and sp.is_active = true
    order by
      lps.joined_at,
      lps.created_at,
      lps.id
    limit 1;

    if v_replacement_student_id is not null
       and v_replacement_package_id is not null
    then
      update public.lesson_plans lp
      set
        student_id = v_replacement_student_id,
        package_id = v_replacement_package_id
      where lp.id = v_group_plan_id;

      /*
       * Tamamlanmış/iptal edilmiş geçmiş dersler eski öğrenci bilgisiyle
       * korunur. Yalnız gelecekteki/bekleyen kayıtların legacy ana öğrencisi
       * yeni aktif katılımcıya taşınır.
       */
      update public.lesson_occurrences lo
      set
        student_id = v_replacement_student_id,
        package_id = v_replacement_package_id
      where
        lo.lesson_plan_id = v_group_plan_id
        and lo.student_id = p_student_id
        and lo.status in (
          'Planlandı',
          'Telafi yapılacak'
        );
    else
      /*
       * Grupta ana öğrenci olarak kullanılabilecek başka aktif ve
       * geçerli paketli katılımcı kalmadıysa plan açık bırakılmaz.
       * Geçmiş occurrence kayıtları FK SET NULL sayesinde korunur.
       */
      delete from public.lesson_occurrences lo
      where
        lo.lesson_plan_id = v_group_plan_id
        and lo.status in (
          'Planlandı',
          'Telafi yapılacak'
        );

      get diagnostics
        v_affected_count = row_count;

      v_deleted_pending_count :=
        v_deleted_pending_count +
        v_affected_count;

      delete from public.lesson_plans lp
      where lp.id = v_group_plan_id;

      get diagnostics
        v_affected_count = row_count;

      v_deleted_plan_count :=
        v_deleted_plan_count +
        v_affected_count;
    end if;
  end loop;

  /*
   * Öğrenciyi kalan grup ders planlarındaki katılımcı listesinden pasifleştir.
   * lesson_plan_students tablosunda left_at olmadığı için is_active kullanılır.
   */
  update public.lesson_plan_students lps
  set
    is_active = false,
    updated_at = now()
  where
    lps.student_id = p_student_id
    and lps.is_active = true
    and exists (
      select 1
      from public.lesson_plans lp
      where
        lp.id = lps.lesson_plan_id
        and lp.lesson_type = 'group'
    );

  /*
   * Kalıcı ders grubu üyeliklerinden de çıkar.
   */
  update public.lesson_group_students lgs
  set
    is_active = false,
    left_at = coalesce(lgs.left_at, now()),
    updated_at = now()
  where
    lgs.student_id = p_student_id
    and lgs.is_active = true;

  /*
   * Bireysel derslerin bekleyen occurrence kayıtlarını kaldır.
   * Grup occurrence kayıtlarına burada dokunulmaz.
   */
  delete from public.lesson_occurrences lo
  where
    lo.student_id = p_student_id
    and lo.status in (
      'Planlandı',
      'Telafi yapılacak'
    )
    and (
      lo.lesson_plan_id is null
      or not exists (
        select 1
        from public.lesson_plans lp
        where
          lp.id = lo.lesson_plan_id
          and lp.lesson_type = 'group'
      )
    );

  get diagnostics
    v_affected_count = row_count;

  v_deleted_pending_count :=
    v_deleted_pending_count +
    v_affected_count;

  /*
   * Yalnız bireysel (group olmayan) planları kaldır.
   * Grup planları yukarıda güvenli biçimde ele alındı.
   */
  delete from public.lesson_plans lp
  where
    lp.student_id = p_student_id
    and lp.lesson_type <> 'group';

  get diagnostics
    v_affected_count = row_count;

  v_deleted_plan_count :=
    v_deleted_plan_count +
    v_affected_count;

  update public.students s
  set
    is_active = false,
    status = 'Pasif',
    passive_date = p_passive_date,
    passive_reason = v_clean_reason,
    is_archived = false,
    archived_at = null,
    archive_reason = null,
    retention_review_date = null,
    retention_status = 'Saklama Süresi Devam Ediyor'
  where s.id = p_student_id;

  return query
  select
    p_student_id,
    v_deleted_plan_count,
    v_deleted_pending_count,
    v_preserved_history_count;
end;
$function$;

revoke all on function public.set_student_passive_safely(uuid, text, date)
from public;

revoke all on function public.set_student_passive_safely(uuid, text, date)
from anon;

grant execute on function public.set_student_passive_safely(uuid, text, date)
to authenticated;

comment on function public.set_student_passive_safely(uuid, text, date) is
'Öğrenciyi pasife alır; geçmiş dersleri korur, bireysel gelecek derslerini kaldırır, grup üyeliklerini pasifleştirir ve grup legacy ana öğrencisi pasife alınırsa başka aktif katılımcıya güvenli biçimde devreder.';

commit;