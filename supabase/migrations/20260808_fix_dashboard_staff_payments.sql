-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
$function$;), 0)
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
$function$; kurum_gideri,
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
$function$;), 0)
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
$function$;ts
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
$function$; ogretmen_odemeleri,
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
$function$;), 0)
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
$function$; personel_odemeleri,
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
$function$;nt), 0)
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
$function$;nt), 0)
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
$function$;ents
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
$function$;nt), 0)
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
$function$;ts
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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
-- 2026-08-08
-- Dashboard gider hesabına aktif personel ödemelerini dahil eder.
-- Fonksiyonun dönüş kolonları değiştirilmez; frontend uyumluluğu korunur.

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

  completed_lessons as (
    select
      lp.id,
      lp.teacher_id,
      lp.student_id,
      lp.package_id,
      coalesce(
        sp.agreed_price,
        p.total_price,
        0
      )::numeric as agreed_price,
      greatest(
        coalesce(
          p.lesson_count,
          1
        ),
        1
      )::numeric as lesson_count,
      coalesce(
        t.commission_rate,
        0
      )::numeric as commission_rate
    from public.lesson_plans lp
    left join public.student_packages sp
      on sp.student_id = lp.student_id
      and sp.package_id = lp.package_id
      and coalesce(sp.is_active, true) = true
    left join public.packages p
      on p.id = lp.package_id
    left join public.teachers t
      on t.id = lp.teacher_id
    where
      lp.is_active = true
      and lp.status in (
        'Yapıldı',
        'Telafi yapıldı'
      )
  ),

  teacher_earning as (
    select
      coalesce(
        sum(
          (cl.agreed_price / cl.lesson_count) *
          (cl.commission_rate / 100)
        ),
        0
      )::numeric as total_amount,
      count(*)::bigint as lesson_count
    from completed_lessons cl
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