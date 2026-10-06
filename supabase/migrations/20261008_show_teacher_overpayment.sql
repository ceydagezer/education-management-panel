-- 2026-10-08
-- Öğretmene fazla ödeme görünür hale gelir.
--
-- * teacher_earnings_summary_view.remaining_payment artık 0'da kesilmez:
--   öğretmene hakedişinden fazla ödendiyse değer eksi olur
--   (ör. -500 = öğretmene 500 TL fazla ödendi).
-- * get_dashboard_summary.teacher_remaining öğretmen bazında hesaplanır:
--   önceden tüm öğretmenlerin toplamından hesaplandığı için bir öğretmene
--   yapılan fazla ödeme, diğer öğretmenlere olan borcu düşürüyordu.
--   Artık yalnız alacaklı öğretmenlerin kalanları toplanır.
--
-- Fonksiyon ve view gövdesi canlı veritabanının yedeğinden
-- (supabase/schema.sql) alınmıştır; yalnız yukarıdaki satırlar değişir.

begin;

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
    (COALESCE(lt.total_earning, (0)::numeric) - COALESCE(pt.total_paid, (0)::numeric)) AS remaining_payment
   FROM (((public.teachers t
     LEFT JOIN lesson_totals lt ON ((lt.teacher_id = t.id)))
     LEFT JOIN payment_totals pt ON ((pt.teacher_id = t.id)))
     LEFT JOIN teacher_branches tb ON ((tb.teacher_id = t.id)));

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_today date, p_current_day text, p_upcoming_days integer DEFAULT 7, p_grace_days integer DEFAULT 3) RETURNS TABLE(active_student_count bigint, active_teacher_count bigint, monthly_student_income numeric, monthly_other_income numeric, monthly_income numeric, total_income numeric, total_institution_expense numeric, total_teacher_paid numeric, total_expense numeric, net_cash numeric, total_outstanding numeric, overdue_count bigint, upcoming_count bigint, teacher_remaining numeric, completed_lesson_count bigint, today_lesson_count bigint)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
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
      count(distinct tel.lesson_id)::bigint as lesson_count,
      /*
       * Kalan hakediş öğretmen bazında toplanır: bir öğretmene yapılan
       * fazla ödeme, diğer öğretmenlere olan borcu gizlememeli.
       */
      (
        select coalesce(
          sum(greatest(tes.remaining_payment, 0)),
          0
        )
        from public.teacher_earnings_summary_view tes
      )::numeric as remaining_amount
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

    te.remaining_amount,

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
$$;

commit;
