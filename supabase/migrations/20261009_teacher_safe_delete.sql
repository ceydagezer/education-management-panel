-- 2026-10-09
-- Öğretmen silme: Aktif → Pasif → Sil
--
-- * Yalnız pasif öğretmen silinebilir.
-- * Ders programında aktif dersi veya aktif öğrenci paketi olan
--   öğretmen silinemez (önce başka öğretmene aktarılmalı).
-- * Hakedişi tamamen ödenmemiş (veya fazla ödeme yapılmış) öğretmen
--   silinemez.
-- * Ders / ödeme geçmişi yoksa kayıt tamamen silinir.
-- * Geçmişi varsa kişisel verileri (telefon, e-posta, fotoğraf, CV...)
--   temizlenir ve öğretmen listelerden kalkar; adı geçmiş ders ve
--   ödeme kayıtlarında kalır, böylece hakediş ve gider rakamları bozulmaz.

begin;

alter table public.teachers
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

/*
 * Hakediş özetine silinme bilgisi eklenir (yeni kolon en sonda).
 * Gövde 20261008_show_teacher_overpayment.sql ile aynıdır.
 */
CREATE OR REPLACE VIEW public.teacher_earnings_summary_view WITH (security_invoker = true) AS
 WITH lesson_totals AS (
         SELECT tel.teacher_id,
            count(DISTINCT tel.lesson_id) AS completed_lesson_count,
            COALESCE(sum(tel.unit_price), (0)::numeric) AS total_lesson_amount,
            COALESCE(sum(tel.teacher_earning), (0)::numeric) AS total_earning
           FROM public.teacher_earning_lessons_view tel
          GROUP BY tel.teacher_id
        ), payment_totals AS (
         SELECT tp.teacher_id,
            COALESCE(sum(tp.amount), (0)::numeric) AS total_paid
           FROM public.teacher_payments tp
          WHERE (tp.status = 'Aktif'::text)
          GROUP BY tp.teacher_id
        ), teacher_branches AS (
         SELECT ts.teacher_id,
            string_agg(DISTINCT spec.name, ', '::text ORDER BY spec.name) AS branch
           FROM (public.teacher_specialties ts
             JOIN public.specialties spec ON ((spec.id = ts.specialty_id)))
          GROUP BY ts.teacher_id
        )
 SELECT t.id AS teacher_id,
    t.full_name AS teacher_name,
    COALESCE(tb.branch, ''::text) AS branch,
    COALESCE(t.commission_rate, (0)::numeric) AS commission_rate,
    t.is_active AS teacher_is_active,
    t.status AS teacher_status,
    COALESCE(lt.completed_lesson_count, (0)::bigint) AS completed_lesson_count,
    COALESCE(lt.total_lesson_amount, (0)::numeric) AS total_lesson_amount,
    COALESCE(lt.total_earning, (0)::numeric) AS total_earning,
    COALESCE(pt.total_paid, (0)::numeric) AS total_paid,
    (COALESCE(lt.total_earning, (0)::numeric) - COALESCE(pt.total_paid, (0)::numeric)) AS remaining_payment,
    t.is_deleted AS teacher_is_deleted
   FROM (((public.teachers t
     LEFT JOIN lesson_totals lt ON ((lt.teacher_id = t.id)))
     LEFT JOIN payment_totals pt ON ((pt.teacher_id = t.id)))
     LEFT JOIN teacher_branches tb ON ((tb.teacher_id = t.id)));

drop function if exists public.delete_teacher_safely(uuid);

create function public.delete_teacher_safely(
  p_teacher_id uuid
)
returns table(
  result text,
  photo_path text,
  cv_file_path text
)
language plpgsql
set search_path = ''
as $function$
declare
  v_teacher record;
  v_remaining numeric := 0;
  v_active_plan_count bigint := 0;
  v_active_package_count bigint := 0;
  v_has_history boolean := false;
begin
  select
    t.id,
    t.is_active,
    t.is_deleted,
    t.photo_path,
    t.cv_file_path
  into v_teacher
  from public.teachers t
  where t.id = p_teacher_id
  for update;

  if not found then
    raise exception
      'Öğretmen bulunamadı.'
      using errcode = 'P0002';
  end if;

  if v_teacher.is_deleted then
    raise exception
      'Bu öğretmen zaten silinmiş.'
      using errcode = '22023';
  end if;

  if v_teacher.is_active is distinct from false then
    raise exception
      'Yalnızca pasif öğretmenler silinebilir. Önce öğretmeni pasife alınız.'
      using errcode = '22023';
  end if;

  select count(*)
  into v_active_plan_count
  from public.lesson_plans lp
  where
    lp.teacher_id = p_teacher_id
    and lp.is_active = true;

  if v_active_plan_count > 0 then
    raise exception
      'Öğretmenin ders programında % aktif dersi var. Önce bu dersleri silin veya başka bir öğretmene aktarın.',
      v_active_plan_count
      using errcode = '22023';
  end if;

  select count(*)
  into v_active_package_count
  from public.student_packages sp
  where
    sp.default_teacher_id = p_teacher_id
    and sp.is_active = true;

  if v_active_package_count > 0 then
    raise exception
      'Öğretmen % aktif öğrenci paketinde atanmış öğretmen olarak görünüyor. Önce bu paketlere başka bir öğretmen atayın.',
      v_active_package_count
      using errcode = '22023';
  end if;

  select coalesce(tes.remaining_payment, 0)
  into v_remaining
  from public.teacher_earnings_summary_view tes
  where tes.teacher_id = p_teacher_id;

  v_remaining := coalesce(v_remaining, 0);

  if v_remaining > 0 then
    raise exception
      'Öğretmenin % TL ödenmemiş hakedişi var. Hakediş tamamen ödenmeden öğretmen silinemez.',
      round(v_remaining, 2)
      using errcode = '22023';
  end if;

  if v_remaining < 0 then
    raise exception
      'Öğretmene hakedişinden % TL fazla ödeme yapılmış. Bu fark kapatılmadan öğretmen silinemez.',
      round(abs(v_remaining), 2)
      using errcode = '22023';
  end if;

  select
    exists (
      select 1 from public.lesson_occurrences lo
      where lo.teacher_id = p_teacher_id
    )
    or exists (
      select 1 from public.lesson_plans lp
      where lp.teacher_id = p_teacher_id
    )
    or exists (
      select 1 from public.student_packages sp
      where sp.default_teacher_id = p_teacher_id
    )
    or exists (
      select 1 from public.teacher_payments tp
      where tp.teacher_id = p_teacher_id
    )
    or exists (
      select 1 from public.payments pay
      where pay.teacher_id = p_teacher_id
    )
  into v_has_history;

  /*
   * Geçmişi olmayan kayıt: tamamen sil.
   * teacher_specialties CASCADE ile, lesson_groups.default_teacher_id
   * SET NULL ile temizlenir. Beklenmeyen bir FK çıkarsa
   * kişisel veri temizliğine düşülür.
   */
  if not v_has_history then
    begin
      delete from public.teachers t
      where t.id = p_teacher_id;

      return query
      select
        'deleted'::text,
        v_teacher.photo_path,
        v_teacher.cv_file_path;

      return;
    exception
      when foreign_key_violation then
        null;
    end;
  end if;

  /*
   * Geçmişi olan kayıt: kişisel verileri sil, adı ve rakamları koru.
   * Branşlar raporlarda görünmeye devam etsin diye silinmez.
   */
  update public.lesson_groups lg
  set default_teacher_id = null
  where lg.default_teacher_id = p_teacher_id;

  update public.teachers t
  set
    phone = null,
    email = null,
    birth_date = null,
    gender = null,
    notes = null,
    photo_path = null,
    cv_file_path = null,
    cv_file_name = null,
    payment_day = null,
    is_active = false,
    status = 'Pasif',
    is_deleted = true,
    deleted_at = now()
  where t.id = p_teacher_id;

  return query
  select
    'anonymized'::text,
    v_teacher.photo_path,
    v_teacher.cv_file_path;
end;
$function$;

revoke all on function public.delete_teacher_safely(uuid)
from public, anon;

grant execute on function public.delete_teacher_safely(uuid)
to authenticated;

comment on function public.delete_teacher_safely(uuid) is
'Pasif ve hakedişi tamamen ödenmiş öğretmeni siler. Geçmişi yoksa kalıcı siler; varsa kişisel verilerini temizleyip listelerden kaldırır, geçmiş ders ve ödeme kayıtlarını korur.';

commit;
