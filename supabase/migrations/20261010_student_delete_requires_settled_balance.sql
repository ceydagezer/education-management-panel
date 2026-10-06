-- 2026-10-10
-- Öğrenci silme: alacak / iade kapanmadan silinemez
--
-- Neden: 20261003_student_package_settlement.sql bu kontrolleri
-- delete_student_safely fonksiyonuna eklemişti; ancak ardından çalışan
-- 20261003_simplify_student_lifecycle_delete.sql fonksiyonu baştan
-- oluşturduğu için kontroller canlı veritabanında kaybolmuştu.
--
-- Silme artık şu durumlarda engellenir:
-- 1. Öğrencinin açık (aktif) paketi var.
-- 2. Hesabı kapatılmış bir pakette kapanmamış alacak veya iade var
--    (get_open_student_settlements).
-- 3. Hesabı hiç kapatılmadan sonlandırılmış bir pakette yapılan
--    derslerin tutarı alınan tahsilattan fazla (ödenmemiş ders).
--
-- Fonksiyonun geri kalanı (silme / anonimleştirme) canlı sürümle aynıdır.

begin;

create or replace function public.delete_student_safely(
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
  v_unpaid_amount numeric := 0;
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

  -- 1. Açık paket
  if exists (
    select 1
    from public.student_packages sp
    where
      sp.student_id = p_student_id
      and sp.is_active = true
  ) then
    raise exception
      'Öğrencinin açık paketleri var. Silmeden önce "Hesabı Kapat" ile paketlerini kapatınız.'
      using errcode = '22023';
  end if;

  -- 2. Hesabı kapatılmış ama alacak / iadesi kapanmamış paket
  if exists (
    select 1
    from public.get_open_student_settlements() os
    where os.student_id = p_student_id
  ) then
    raise exception
      'Öğrencinin kapanmamış alacak veya iade kaydı var. Tahsilatlar sayfasındaki "Ayrılan Öğrenci Hesapları" bölümünden kapatınız.'
      using errcode = '22023';
  end if;

  -- 3. Hesabı kapatılmadan sonlandırılmış pakette ödenmemiş ders
  select coalesce(sum(greatest(x.lesson_amount - x.paid_amount, 0)), 0)
  into v_unpaid_amount
  from (
    select
      sp.id,
      coalesce((
        select sum(tel.unit_price)
        from public.teacher_earning_lessons_view tel
        where tel.student_package_id = sp.id
      ), 0) as lesson_amount,
      coalesce((
        select sum(p.amount)
        from public.payments p
        where
          p.student_package_id = sp.id
          and p.is_active = true
      ), 0) as paid_amount
    from public.student_packages sp
    where
      sp.student_id = p_student_id
      and sp.settlement_amount is null
  ) x;

  if v_unpaid_amount > 0.009 then
    raise exception
      'Öğrencinin ödenmemiş % TL ders tutarı var. Alacak tahsil edilmeden veya hesabı kapatılmadan öğrenci silinemez.',
      round(v_unpaid_amount, 2)
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
'Pasif ve alacağı kapanmış öğrenciyi siler. Tahsilat ve ders geçmişi yoksa tüm bağlı kayıtlarıyla kalıcı siler; varsa kişisel verileri anonimleştirip öğrenciyi listelerden kaldırır, geçmiş finans ve ders kayıtlarını isimsiz korur.';

commit;
