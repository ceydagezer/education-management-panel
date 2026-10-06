-- 2026-10-05
-- Geçmiş tarihli grup dersi: katılımcılar hakedişe dahil edilir
--
-- Sorun:
-- * Ders Durum Takibi > Aylık Kontrol ekranından, programda olmayan geçmiş
--   tarihli bir ders eklenebilir. Grup dersinde bu kayıt grubun planına
--   (lesson_plan_id) bağlanır.
-- * teacher_earning_lessons_view katılımcıyı yalnız joined_at <= ders
--   tarihi ise sayıyordu. Plan (ve katılımcıları) sistemde sonradan
--   oluşturulduysa, plandan önceki bir tarihe eklenen derste hiçbir
--   katılımcı sayılmıyor, hakediş yalnız ana öğrenciden hesaplanıyordu.
--
-- Çözüm:
-- * Planla birlikte (plan oluşturulduğu gün) gruba eklenen katılımcılar,
--   plandan önceki tarihler için de grubun üyesi kabul edilir.
-- * Gruba sonradan katılan öğrenci yine yalnız katıldığı tarihten sonraki
--   derslerde sayılır; ayrılma kuralı aynen korunur.
-- * Normal (programdan işaretlenen) dersler plan oluşturulduktan sonra
--   olduğu için mevcut hakediş rakamları değişmez.
--
-- 20261004_group_lesson_teacher_earnings.sql dosyasından SONRA çalıştırın.

begin;

create or replace view public.teacher_earning_lessons_view as
with completed as (
  select
    lo.*,
    lp.lesson_type,
    lp.group_id,
    lp.group_name,
    lp.created_at as plan_created_at
  from public.lesson_occurrences lo
  left join public.lesson_plans lp
    on lp.id = lo.lesson_plan_id
  where
    lo.is_active = true
    and lo.status = any (array['Yapıldı'::text, 'Telafi yapıldı'::text])
),

group_participants as (
  select
    c.id as lesson_id,
    lps.student_id,
    lps.student_package_id,
    lps.id as participant_id
  from completed c
  join public.lesson_plan_students lps
    on lps.lesson_plan_id = c.lesson_plan_id
  where
    c.lesson_type = 'group'
    and (
      c.lesson_date is null
      or lps.joined_at is null
      or lps.joined_at::date <= greatest(
        c.lesson_date,
        coalesce(c.plan_created_at::date, c.lesson_date)
      )
    )
    and (
      lps.is_active = true
      or c.lesson_date is null
      or lps.updated_at::date >= c.lesson_date
    )
),
earning_rows as (
  -- Grup dersleri: katılımcı başına satır
  select
    c.id as lesson_id,
    gp.student_id,
    gp.student_package_id,
    sp.package_id,
    sp.agreed_price,
    c.id::text || ':' || gp.participant_id::text as earning_row_id
  from completed c
  join group_participants gp
    on gp.lesson_id = c.id
  left join public.student_packages sp
    on sp.id = gp.student_package_id

  union all

  -- Bireysel dersler (ve katılımcı kaydı bulunamayan eski grup dersleri)
  select
    c.id,
    c.student_id,
    selected_sp.id,
    c.package_id,
    selected_sp.agreed_price,
    c.id::text
  from completed c
  left join lateral (
    select
      sp.id,
      sp.agreed_price
    from public.student_packages sp
    where
      sp.student_id = c.student_id
      and sp.package_id = c.package_id
    order by
      case
        when coalesce(sp.is_active, true) = true then 0
        else 1
      end,
      sp.created_at desc
    limit 1
  ) selected_sp on true
  where not exists (
    select 1
    from group_participants gp
    where gp.lesson_id = c.id
  )
)

select
  c.id as lesson_id,
  c.teacher_id,
  t.full_name as teacher_name,
  er.student_id,
  s.full_name as student_name,
  er.student_package_id,
  coalesce(er.package_id, c.package_id) as package_id,
  p.name as package_name,
  coalesce(spec.name, ''::text) as instrument,
  c.day,
  c.start_time,
  c.status,
  coalesce(er.agreed_price, p.total_price, 0::numeric) as agreed_price,
  greatest(coalesce(p.lesson_count::integer, 1), 1) as lesson_count,
  coalesce(er.agreed_price, p.total_price, 0::numeric) /
    greatest(coalesce(p.lesson_count::integer, 1), 1)::numeric
    as unit_price,
  coalesce(t.commission_rate, 0::numeric) as commission_rate,
  coalesce(er.agreed_price, p.total_price, 0::numeric) /
    greatest(coalesce(p.lesson_count::integer, 1), 1)::numeric *
    (coalesce(t.commission_rate, 0::numeric) / 100::numeric)
    as teacher_earning,
  c.created_at,
  c.updated_at,
  c.lesson_date,
  c.group_id,
  c.group_name,
  er.earning_row_id
from earning_rows er
join completed c
  on c.id = er.lesson_id
join public.teachers t
  on t.id = c.teacher_id
join public.students s
  on s.id = er.student_id
left join public.packages p
  on p.id = coalesce(er.package_id, c.package_id)
left join public.specialties spec
  on spec.id = p.specialty_id;

commit;
