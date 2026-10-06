-- 2026-10-03
-- Grup dersi öğretmen hakedişi: her katılımcının kendi paket ücreti
--
-- Sorun:
-- * Grup dersinde lesson_occurrences tek kayıttır ve yalnız grubun "ana
--   öğrencisini" (lesson_plans.student_id) taşır. Hakediş görünümü bu yüzden
--   yalnız ana öğrencinin ücretini sayıyordu; diğer katılımcıların
--   (her birinin kendi agreed_price değeri) payı hakedişe girmiyordu.
-- * Uygulama görünümden lesson_date, group_id, group_name kolonlarını
--   istiyordu ancak görünümde yoktu.
-- * Dashboard özeti hakedişi eski lesson_plans.status alanından ve yalnız
--   ana öğrencinin aktif paket ücretinden hesaplıyordu; Finans ile
--   farklı sonuç veriyordu.
--
-- Çözüm:
-- * teacher_earning_lessons_view: grup derslerinde katılımcı başına bir satır
--   (o derste grupta olan her öğrenci, kendi student_package ücretiyle).
--   Bireysel derslerde davranış aynen korunur. Kolonlar aynı sırada
--   korunur; yeni kolonlar sona eklenir (mevcut yetkiler korunur).
-- * teacher_earnings_summary_view: ders sayısı benzersiz ders olarak sayılır.
-- * get_dashboard_summary: hakediş ve tamamlanan ders sayısı aynı
--   görünümden hesaplanır.
-- * get_student_settlement_preview: yapılan ders ve önerilen tutar aynı
--   görünümden hesaplanır (grup dersleri dahil).
--
-- 20261003_student_package_settlement.sql dosyasından SONRA çalıştırın.
-- Canlı sürümü bozmaz; canlıdaki hakediş rakamları grup dersleri için
-- (doğru şekilde) artar.

begin;

create or replace view public.teacher_earning_lessons_view as
with completed as (
  select
    lo.*,
    lp.lesson_type,
    lp.group_id,
    lp.group_name
  from public.lesson_occurrences lo
  left join public.lesson_plans lp
    on lp.id = lo.lesson_plan_id
  where
    lo.is_active = true
    and lo.status = any (array['Yapıldı'::text, 'Telafi yapıldı'::text])
),

/*
 * Grup dersi: dersin tarihinde grupta olan her katılımcı.
 * - joined_at: gruba katılma zamanı
 * - is_active = false ise updated_at, gruptan ayrılma zamanı kabul edilir
 *   (pasife alma fonksiyonu katılımı kapatırken updated_at = now() yazar).
 */
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
      or lps.joined_at::date <= c.lesson_date
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

/*
 * Özet: grup dersi katılımcı sayısı kadar satır ürettiği için
 * ders sayısı benzersiz ders olarak sayılır.
 */
create or replace view public.teacher_earnings_summary_view as
with lesson_totals as (
  select
    tel.teacher_id,
    count(distinct tel.lesson_id) as completed_lesson_count,
    coalesce(sum(tel.unit_price), 0::numeric) as total_lesson_amount,
    coalesce(sum(tel.teacher_earning), 0::numeric) as total_earning
  from public.teacher_earning_lessons_view tel
  group by tel.teacher_id
),
payment_totals as (
  select
    tp.teacher_id,
    coalesce(sum(tp.amount), 0::numeric) as total_paid
  from public.teacher_payments tp
  where tp.status = 'Aktif'::text
  group by tp.teacher_id
),
teacher_branches as (
  select
    ts.teacher_id,
    string_agg(distinct spec.name, ', '::text order by spec.name) as branch
  from public.teacher_specialties ts
  join public.specialties spec
    on spec.id = ts.specialty_id
  group by ts.teacher_id
)
select
  t.id as teacher_id,
  t.full_name as teacher_name,
  coalesce(tb.branch, ''::text) as branch,
  coalesce(t.commission_rate, 0::numeric) as commission_rate,
  t.is_active as teacher_is_active,
  t.status as teacher_status,
  coalesce(lt.completed_lesson_count, 0::bigint) as completed_lesson_count,
  coalesce(lt.total_lesson_amount, 0::numeric) as total_lesson_amount,
  coalesce(lt.total_earning, 0::numeric) as total_earning,
  coalesce(pt.total_paid, 0::numeric) as total_paid,
  greatest(
    coalesce(lt.total_earning, 0::numeric) -
      coalesce(pt.total_paid, 0::numeric),
    0::numeric
  ) as remaining_payment
from public.teachers t
left join lesson_totals lt
  on lt.teacher_id = t.id
left join payment_totals pt
  on pt.teacher_id = t.id
left join teacher_branches tb
  on tb.teacher_id = t.id;

/*
 * Hesap kapatma önizlemesi: yapılan ders ve önerilen tutar,
 * hakedişle aynı kaynaktan (grup dersleri dahil) hesaplanır.
 */
create or replace function public.get_student_settlement_preview(
  p_student_id uuid
)
returns table(
  student_package_id uuid,
  package_name text,
  teacher_name text,
  agreed_price numeric,
  package_lesson_count integer,
  total_lesson_count integer,
  completed_lesson_count bigint,
  unit_price numeric,
  paid_amount numeric,
  suggested_amount numeric
)
language sql
stable
set search_path = ''
as $function$
  with package_rows as (
    select
      sp.id,
      pk.name as package_name,
      t.full_name as teacher_name,
      coalesce(sp.agreed_price, pk.total_price, 0)::numeric
        as agreed_price,
      pk.lesson_count::integer as package_lesson_count,
      coalesce(sp.total_lesson_count, pk.lesson_count)::integer
        as total_lesson_count,
      round(
        coalesce(sp.agreed_price, pk.total_price, 0)::numeric /
          greatest(coalesce(pk.lesson_count::integer, 1), 1),
        2
      ) as unit_price,
      sp.created_at
    from public.student_packages sp
    left join public.packages pk
      on pk.id = sp.package_id
    left join public.teachers t
      on t.id = sp.default_teacher_id
    where
      sp.student_id = p_student_id
      and sp.is_active = true
  )
  select
    pr.id,
    coalesce(pr.package_name, 'Tanımsız Paket'),
    coalesce(pr.teacher_name, ''),
    pr.agreed_price,
    pr.package_lesson_count,
    pr.total_lesson_count,
    coalesce(done.lesson_count, 0),
    pr.unit_price,
    coalesce(paid.amount, 0),
    round(coalesce(done.lesson_value, 0), 2)
  from package_rows pr
  left join lateral (
    select
      count(distinct tel.lesson_id) as lesson_count,
      sum(tel.unit_price) as lesson_value
    from public.teacher_earning_lessons_view tel
    where
      tel.student_id = p_student_id
      and tel.student_package_id = pr.id
  ) done on true
  left join lateral (
    select sum(p.amount) as amount
    from public.payments p
    where
      p.student_package_id = pr.id
      and p.is_active = true
  ) paid on true
  order by pr.created_at;
$function$;

/*
 * Dashboard özeti: hakediş ve tamamlanan ders sayısı artık
 * teacher_earning_lessons_view üzerinden hesaplanır (Finans ile aynı).
 * Önceden eski lesson_plans.status alanından ve yalnız ana öğrencinin
 * aktif paket ücretinden hesaplanıyordu. Diğer tüm hesaplar canlıdaki
 * sürümle (20260808_fix_dashboard_staff_payments.sql) aynıdır.
 */
create or replace function public.get_dashboard_summary(
  p_today date,
  p_current_day text,
  p_upcoming_days integer default 7,
  p_grace_days integer default 3
)
returns table(
  active_student_count bigint,
  active_teacher_count bigint,
  monthly_student_income numeric,
  monthly_other_income numeric,
  monthly_income numeric,
  total_income numeric,
  total_institution_expense numeric,
  total_teacher_paid numeric,
  total_expense numeric,
  net_cash numeric,
  total_outstanding numeric,
  overdue_count bigint,
  upcoming_count bigint,
  teacher_remaining numeric,
  completed_lesson_count bigint,
  today_lesson_count bigint
)
language sql
stable
set search_path to 'public'
as $function$
  with
  student_income as (
    select
      coalesce(
        sum(
          case
            when
              pay.is_active = true
              and date_trunc('month', pay.payment_date) =
                  date_trunc('month', p_today)
              then pay.amount
            else 0
          end
        ),
        0
      )::numeric as monthly_amount,
      coalesce(
        sum(
          case
            when pay.is_active = true
              then pay.amount
            else 0
          end
        ),
        0
      )::numeric as total_amount
    from public.payments pay
  ),

  other_income as (
    select
      coalesce(
        sum(
          case
            when
              oi.status = 'Aktif'
              and date_trunc('month', oi.date) =
                  date_trunc('month', p_today)
              then oi.amount
            else 0
          end
        ),
        0
      )::numeric as monthly_amount,
      coalesce(
        sum(
          case
            when oi.status = 'Aktif'
              then oi.amount
            else 0
          end
        ),
        0
      )::numeric as total_amount
    from public.other_incomes oi
  ),

  institution_expense as (
    select
      coalesce(
        sum(
          case
            when e.status = 'Aktif'
              then e.amount
            else 0
          end
        ),
        0
      )::numeric as total_amount
    from public.expenses e
  ),

  teacher_paid as (
    select
      coalesce(
        sum(
          case
            when tp.status = 'Aktif'
              then tp.amount
            else 0
          end
        ),
        0
      )::numeric as total_amount
    from public.teacher_payments tp
  ),

  staff_paid as (
    select
      coalesce(
        sum(
          case
            when spay.status = 'Aktif'
              then spay.amount
            else 0
          end
        ),
        0
      )::numeric as total_amount
    from public.staff_payments spay
  ),

  receivables as (
    select *
    from public.get_dashboard_receivables(
      p_today,
      p_upcoming_days,
      p_grace_days,
      100000
    )
  ),

  /*
   * Hakediş, Finans ekranıyla aynı kaynaktan hesaplanır:
   * yapılan dersler (lesson_occurrences), grup derslerinde her
   * katılımcının kendi paket ücreti.
   */
  teacher_earning as (
    select
      coalesce(
        sum(tel.teacher_earning),
        0
      )::numeric as total_amount,
      count(distinct tel.lesson_id)::bigint as lesson_count
    from public.teacher_earning_lessons_view tel
  )

  select
    (
      select count(*)
      from public.students s
      where
        coalesce(s.is_active, true) = true
        and coalesce(s.status, 'Aktif') not in ('Pasif', 'Arşiv')
    )::bigint,

    (
      select count(*)
      from public.teachers t
      where
        coalesce(t.is_active, true) = true
        and coalesce(t.status, 'Aktif') <> 'Pasif'
    )::bigint,

    si.monthly_amount,
    oi.monthly_amount,

    (
      si.monthly_amount +
      oi.monthly_amount
    )::numeric,

    (
      si.total_amount +
      oi.total_amount
    )::numeric,

    ie.total_amount,
    tp.total_amount,

    (
      ie.total_amount +
      tp.total_amount +
      stp.total_amount
    )::numeric,

    (
      si.total_amount +
      oi.total_amount -
      ie.total_amount -
      tp.total_amount -
      stp.total_amount
    )::numeric,

    coalesce(
      (
        select sum(r.remaining_debt)
        from receivables r
      ),
      0
    )::numeric,

    (
      select count(*)
      from receivables r
      where r.receivable_status = 'Gecikmiş'
    )::bigint,

    (
      select count(*)
      from receivables r
      where r.receivable_status = 'Yaklaşıyor'
    )::bigint,

    greatest(
      te.total_amount -
      tp.total_amount,
      0
    )::numeric,

    te.lesson_count,

    (
      select count(*)
      from public.lesson_plans lp
      where
        lp.is_active = true
        and lower(lp.day) = lower(p_current_day)
    )::bigint

  from student_income si
  cross join other_income oi
  cross join institution_expense ie
  cross join teacher_paid tp
  cross join staff_paid stp
  cross join teacher_earning te;
$function$;

commit;
