-- 2026-10-03
-- Öğrenci yaşam döngüsü sadeleştirmesi: Aktif → Pasif → Sil
--
-- 1. ADIM: Yeni silme fonksiyonunu ekler. Canlı sürümü etkilemez,
-- yeni frontend yayına alınmadan önce çalıştırılabilir.
-- 2. adım için: 20261005_simplify_student_lifecycle_cleanup.sql
--
-- * Pasif öğrenci silinebilir:
--   - Tahsilatı ve ders geçmişi yoksa tüm bağlı kayıtlarıyla kalıcı silinir.
--   - Varsa kişisel verileri silinir (anonimleştirilir), öğrenci listelerden
--     kalkar; geçmiş tahsilat ve dersler raporlarda "Silinmiş Öğrenci"
--     olarak kalır, böylece gelir ve hakediş rakamları bozulmaz.

begin;

drop function if exists public.delete_student_safely(uuid);

create function public.delete_student_safely(
  p_student_id uuid
)
returns table(
  result text,
  payment_count bigint,
  lesson_occurrence_count bigint
)
language plpgsql
set search_path = ''
as $function$
declare
  v_student record;
  v_payment_count bigint := 0;
  v_lesson_occurrence_count bigint := 0;
  v_anonymous_tc_no text;
begin
  select
    s.id,
    s.is_active,
    coalesce(s.is_anonymized, false) as is_anonymized
  into v_student
  from public.students s
  where s.id = p_student_id
  for update;

  if not found then
    raise exception
      'Öğrenci bulunamadı.'
      using errcode = 'P0002';
  end if;

  if v_student.is_anonymized then
    raise exception
      'Bu öğrenci zaten silinmiş.'
      using errcode = '22023';
  end if;

  if v_student.is_active is distinct from false then
    raise exception
      'Yalnızca pasif öğrenciler silinebilir. Önce öğrenciyi pasife alınız.'
      using errcode = '22023';
  end if;

  select count(*)
  into v_payment_count
  from public.payments p
  where p.student_id = p_student_id;

  select count(*)
  into v_lesson_occurrence_count
  from public.lesson_occurrences lo
  where lo.student_id = p_student_id;

  /*
   * Geçmişi olmayan kayıt: tamamen sil.
   * Beklenmeyen bir bağlantı (FK) çıkarsa alt işlem geri alınır ve
   * anonimleştirmeye düşülür; böylece silme işlemi hiçbir zaman yarım kalmaz.
   */
  if v_payment_count = 0 and v_lesson_occurrence_count = 0 then
    begin
      delete from public.lesson_plan_students lps
      where lps.student_id = p_student_id;

      delete from public.lesson_group_students lgs
      where lgs.student_id = p_student_id;

      delete from public.lesson_plans lp
      where lp.student_id = p_student_id;

      delete from public.student_packages sp
      where sp.student_id = p_student_id;

      delete from public.student_guardians sg
      where sg.student_id = p_student_id;

      delete from public.students s
      where s.id = p_student_id;

      return query
      select
        'deleted'::text,
        v_payment_count,
        v_lesson_occurrence_count;

      return;
    exception
      when foreign_key_violation then
        null;
    end;
  end if;

  /*
   * Geçmişi olan kayıt: kişisel verileri sil, rakamları koru.
   */
  v_anonymous_tc_no := left(
    regexp_replace(p_student_id::text, '[^0-9]', '', 'g') ||
      '00000000000',
    11
  );

  while exists (
    select 1
    from public.students s
    where
      s.tc_no = v_anonymous_tc_no
      and s.id <> p_student_id
  ) loop
    v_anonymous_tc_no := lpad(
      floor(random() * 100000000000)::bigint::text,
      11,
      '0'
    );
  end loop;

  delete from public.student_guardians sg
  where sg.student_id = p_student_id;

  update public.lesson_plan_students lps
  set
    is_active = false,
    updated_at = now()
  where
    lps.student_id = p_student_id
    and lps.is_active = true;

  update public.lesson_group_students lgs
  set
    is_active = false,
    left_at = coalesce(lgs.left_at, now()),
    updated_at = now()
  where
    lgs.student_id = p_student_id
    and lgs.is_active = true;

  update public.student_packages sp
  set
    is_active = false,
    status = 'Sonlandırıldı',
    ended_at = coalesce(sp.ended_at, current_date),
    end_reason = coalesce(sp.end_reason, 'Öğrenci silindi')
  where
    sp.student_id = p_student_id
    and sp.is_active = true;

  update public.students s
  set
    tc_no = v_anonymous_tc_no,
    full_name =
      'Silinmiş Öğrenci #' || left(p_student_id::text, 8),
    gender = null,
    birth_date = null,
    phone = null,
    email = null,
    address = null,
    mother_name = null,
    mother_phone = null,
    father_name = null,
    father_phone = null,
    notes = null,
    passive_reason = null,
    is_active = false,
    status = 'Pasif',
    is_archived = false,
    archived_at = null,
    archive_reason = null,
    retention_review_date = null,
    retention_status = 'Anonimleştirildi',
    is_anonymized = true,
    anonymized_at = current_date
  where s.id = p_student_id;

  return query
  select
    'anonymized'::text,
    v_payment_count,
    v_lesson_occurrence_count;
end;
$function$;

revoke all on function public.delete_student_safely(uuid)
from public, anon;

grant execute on function public.delete_student_safely(uuid)
to authenticated;

comment on function public.delete_student_safely(uuid) is
'Pasif öğrenciyi siler. Tahsilat ve ders geçmişi yoksa tüm bağlı kayıtlarıyla kalıcı siler; varsa kişisel verileri anonimleştirip öğrenciyi listelerden kaldırır, geçmiş finans ve ders kayıtlarını isimsiz korur.';

commit;
