--
-- PostgreSQL database dump
--

\restrict 5DocaWzODCx47YRTv8hr2czGDdLDggHQbNrbfdmIaNfo20CyI4VBa1VFyxW0dGx

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA private;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: is_current_user_admin(); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.is_current_user_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where
      ur.user_id = (select auth.uid())
      and ur.role = 'admin'
  );
$$;


--
-- Name: FUNCTION is_current_user_admin(); Type: COMMENT; Schema: private; Owner: -
--

COMMENT ON FUNCTION private.is_current_user_admin() IS 'Giriş yapan kullanıcının user_roles kaydında admin olup olmadığını RLS için güvenli biçimde kontrol eder.';


--
-- Name: lesson_occurrence_earning_snapshot_trigger(); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.lesson_occurrence_earning_snapshot_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if tg_op = 'UPDATE'
    and old.status in ('Yapıldı', 'Telafi yapıldı')
    and new.status in ('Yapıldı', 'Telafi yapıldı')
    and old.is_active is not distinct from new.is_active
    and old.teacher_id is not distinct from new.teacher_id
    and old.student_id is not distinct from new.student_id
    and old.package_id is not distinct from new.package_id
    and old.lesson_plan_id is not distinct from new.lesson_plan_id
    and old.lesson_date is not distinct from new.lesson_date
  then
    return new;
  end if;

  perform private.refresh_lesson_earning_snapshot(new.id);

  return new;
end;
$$;


--
-- Name: payment_audit_trigger(); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.payment_audit_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    insert into public.payment_audit_log (
      payment_id, action, new_data, changed_by
    )
    values (
      new.id, 'insert', to_jsonb(new), auth.uid()
    );

    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_action := case
      when old.is_active is distinct from false
        and new.is_active = false
        then 'cancel'
      else 'update'
    end;

    insert into public.payment_audit_log (
      payment_id, action, old_data, new_data, changed_by
    )
    values (
      new.id, v_action, to_jsonb(old), to_jsonb(new), auth.uid()
    );

    return new;
  end if;

  insert into public.payment_audit_log (
    payment_id, action, old_data, changed_by
  )
  values (
    old.id, 'delete', to_jsonb(old), auth.uid()
  );

  return old;
end;
$$;


--
-- Name: refresh_lesson_earning_snapshot(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.refresh_lesson_earning_snapshot(p_lesson_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_lesson record;
begin
  delete from public.lesson_earning_snapshots les
  where les.lesson_id = p_lesson_id;

  select
    lo.id,
    lo.student_id,
    lo.package_id,
    lo.teacher_id,
    lo.lesson_plan_id,
    lo.lesson_date,
    lo.status,
    lo.is_active,
    lp.lesson_type,
    lp.created_at as plan_created_at,
    coalesce(t.commission_rate, 0)::numeric as commission_rate
  into v_lesson
  from public.lesson_occurrences lo
  left join public.lesson_plans lp
    on lp.id = lo.lesson_plan_id
  left join public.teachers t
    on t.id = lo.teacher_id
  where lo.id = p_lesson_id;

  if not found
    or v_lesson.is_active is distinct from true
    or v_lesson.status not in ('Yapıldı', 'Telafi yapıldı')
  then
    return;
  end if;

  -- Grup dersi: dersin tarihinde grupta olan her katılımcı
  if v_lesson.lesson_type = 'group' then
    insert into public.lesson_earning_snapshots (
      lesson_id,
      participant_id,
      student_id,
      student_package_id,
      package_id,
      agreed_price,
      lesson_count,
      unit_price,
      commission_rate
    )
    select
      v_lesson.id,
      lps.id,
      lps.student_id,
      lps.student_package_id,
      coalesce(sp.package_id, v_lesson.package_id),
      coalesce(sp.agreed_price, p.total_price, 0),
      greatest(coalesce(p.lesson_count::integer, 1), 1),
      coalesce(sp.agreed_price, p.total_price, 0) /
        greatest(coalesce(p.lesson_count::integer, 1), 1)::numeric,
      v_lesson.commission_rate
    from public.lesson_plan_students lps
    left join public.student_packages sp
      on sp.id = lps.student_package_id
    left join public.packages p
      on p.id = coalesce(sp.package_id, v_lesson.package_id)
    where
      lps.lesson_plan_id = v_lesson.lesson_plan_id
      and (
        v_lesson.lesson_date is null
        or lps.joined_at is null
        or lps.joined_at::date <= greatest(
          v_lesson.lesson_date,
          coalesce(
            v_lesson.plan_created_at::date,
            v_lesson.lesson_date
          )
        )
      )
      and (
        lps.is_active = true
        or v_lesson.lesson_date is null
        or lps.updated_at::date >= v_lesson.lesson_date
      );

    if found then
      return;
    end if;
  end if;

  -- Bireysel ders (ve katılımcı kaydı bulunamayan eski grup dersleri)
  insert into public.lesson_earning_snapshots (
    lesson_id,
    participant_id,
    student_id,
    student_package_id,
    package_id,
    agreed_price,
    lesson_count,
    unit_price,
    commission_rate
  )
  select
    v_lesson.id,
    null,
    v_lesson.student_id,
    selected_sp.id,
    v_lesson.package_id,
    coalesce(selected_sp.agreed_price, p.total_price, 0),
    greatest(coalesce(p.lesson_count::integer, 1), 1),
    coalesce(selected_sp.agreed_price, p.total_price, 0) /
      greatest(coalesce(p.lesson_count::integer, 1), 1)::numeric,
    v_lesson.commission_rate
  from (select 1) as one_row
  left join lateral (
    select
      sp.id,
      sp.agreed_price
    from public.student_packages sp
    where
      sp.student_id = v_lesson.student_id
      and sp.package_id = v_lesson.package_id
    order by
      case
        when coalesce(sp.is_active, true) = true then 0
        else 1
      end,
      sp.created_at desc
    limit 1
  ) selected_sp on true
  left join public.packages p
    on p.id = v_lesson.package_id
  where v_lesson.student_id is not null;
end;
$$;


--
-- Name: cancel_payment(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_payment(p_payment_id uuid, p_reason text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadı.'
      using errcode = '42501';
  end if;

  update public.payments p
  set
    is_active = false,
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancel_reason = nullif(trim(coalesce(p_reason, '')), '')
  where
    p.id = p_payment_id
    and p.is_active is distinct from false;

  if not found then
    raise exception 'Tahsilat bulunamadı veya zaten iptal edilmiş.'
      using errcode = 'P0002';
  end if;
end;
$$;


--
-- Name: create_occurrence_from_lesson_plan(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_occurrence_from_lesson_plan() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  insert into public.lesson_occurrences (
    lesson_plan_id,
    student_id,
    package_id,
    teacher_id,
    lesson_date,
    day,
    start_time,
    duration_minutes,
    status,
    note,
    is_makeup,
    is_active
  )
  values (
    new.id,
    new.student_id,
    new.package_id,
    new.teacher_id,
    null,
    new.day,
    new.start_time,
    new.duration_minutes,
    coalesce(
      new.status,
      'Planlandı'
    ),
    new.note,
    coalesce(
      new.is_makeup,
      false
    ),
    coalesce(
      new.is_active,
      true
    )
  )
  on conflict do nothing;

  return new;
end;
$$;


--
-- Name: delete_lesson_plan_safely(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_lesson_plan_safely(p_lesson_plan_id uuid) RETURNS TABLE(deleted_plan_id uuid, deleted_pending_occurrence_count bigint, preserved_history_count bigint)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_plan_exists boolean;
  v_deleted_pending bigint := 0;
  v_preserved_history bigint := 0;
begin
  select exists(
    select 1
    from public.lesson_plans lp
    where lp.id = p_lesson_plan_id
  )
  into v_plan_exists;

  if not v_plan_exists then
    raise exception
      'Ders planı bulunamadı.'
      using errcode = 'P0002';
  end if;

  select count(*)
  into v_preserved_history
  from public.lesson_occurrences lo
  where
    lo.lesson_plan_id =
      p_lesson_plan_id
    and lo.status in (
      'Yapıldı',
      'Telafi yapıldı',
      'İptal edildi'
    );

  delete from public.lesson_occurrences lo
  where
    lo.lesson_plan_id =
      p_lesson_plan_id
    and lo.status in (
      'Planlandı',
      'Telafi yapılacak'
    );

  get diagnostics
    v_deleted_pending =
      row_count;

  delete from public.lesson_plans lp
  where lp.id =
    p_lesson_plan_id;

  return query
  select
    p_lesson_plan_id,
    v_deleted_pending,
    v_preserved_history;
end;
$$;


--
-- Name: delete_student_safely(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_student_safely(p_student_id uuid) RETURNS TABLE(result text, payment_count bigint, lesson_occurrence_count bigint)
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: FUNCTION delete_student_safely(p_student_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_student_safely(p_student_id uuid) IS 'Pasif öğrenciyi siler. Tahsilat ve ders geçmişi yoksa tüm bağlı kayıtlarıyla kalıcı siler; varsa kişisel verileri anonimleştirip öğrenciyi listelerden kaldırır, geçmiş finans ve ders kayıtlarını isimsiz korur.';


--
-- Name: get_dashboard_lesson_plan_health(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dashboard_lesson_plan_health() RETURNS TABLE(waiting_makeup_count bigint, conflict_count bigint)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with active_plans as (
    select
      student_id,
      teacher_id,
      lower(btrim(coalesce(day, ''))) as normalized_day,
      start_time,
      lower(btrim(coalesce(status, ''))) as normalized_status
    from public.lesson_plans
    where is_active = true
  ),
  teacher_conflicts as (
    select
      teacher_id,
      normalized_day,
      start_time
    from active_plans
    where teacher_id is not null
    group by
      teacher_id,
      normalized_day,
      start_time
    having count(*) > 1
  ),
  student_conflicts as (
    select
      student_id,
      normalized_day,
      start_time
    from active_plans
    where student_id is not null
    group by
      student_id,
      normalized_day,
      start_time
    having count(*) > 1
  )
  select
    (
      select count(*)
      from active_plans
      where normalized_status = 'telafi yapılacak'
    )::bigint as waiting_makeup_count,
    (
      (select count(*) from teacher_conflicts) +
      (select count(*) from student_conflicts)
    )::bigint as conflict_count;
$$;


--
-- Name: get_dashboard_receivables(date, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dashboard_receivables(p_today date, p_upcoming_days integer DEFAULT 7, p_grace_days integer DEFAULT 3, p_limit integer DEFAULT 30) RETURNS TABLE(student_package_id uuid, student_id uuid, student_name text, package_id uuid, package_name text, instrument text, teacher_id uuid, teacher_name text, agreed_price numeric, lesson_count integer, unit_price numeric, due_date date, payment_period text, collected_amount numeric, remaining_debt numeric, days_until_due integer, days_late integer, receivable_status text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with package_rows as (
    select
      sp.id as student_package_id,
      sp.student_id,
      s.full_name as student_name,
      sp.package_id,
      p.name as package_name,
      coalesce(spec.name, '') as instrument,
      sp.default_teacher_id as teacher_id,
      coalesce(t.full_name, '') as teacher_name,
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
      )::integer as lesson_count,
      (
        coalesce(
          sp.agreed_price,
          p.total_price,
          0
        ) /
        greatest(
          coalesce(
            p.lesson_count,
            1
          ),
          1
        )
      )::numeric as unit_price,
      sp.next_payment_date as due_date,
      to_char(
        sp.next_payment_date,
        'YYYY-MM'
      ) as payment_period,
      coalesce(
        (
          select sum(pay.amount)
          from public.payments pay
          where
            pay.student_package_id =
              sp.id
            and pay.is_active = true
            and (
              pay.due_date =
                sp.next_payment_date
              or pay.payment_period =
                to_char(
                  sp.next_payment_date,
                  'YYYY-MM'
                )
            )
        ),
        0
      )::numeric as collected_amount
    from public.student_packages sp
    join public.students s
      on s.id = sp.student_id
    left join public.packages p
      on p.id = sp.package_id
    left join public.specialties spec
      on spec.id = p.specialty_id
    left join public.teachers t
      on t.id = sp.default_teacher_id
    where
      coalesce(sp.is_active, true) = true
      and coalesce(s.is_active, true) = true
      and coalesce(s.status, 'Aktif') <> 'Arşiv'
  ),
  calculated as (
    select
      pr.*,
      greatest(
        pr.agreed_price -
        pr.collected_amount,
        0
      )::numeric as remaining_debt,
      case
        when pr.due_date is null
          then null
        else
          (pr.due_date - p_today)
      end::integer as days_until_due,
      case
        when pr.due_date is null
          then 0
        else
          greatest(
            p_today - pr.due_date,
            0
          )
      end::integer as days_late
    from package_rows pr
  )
  select
    c.student_package_id,
    c.student_id,
    c.student_name,
    c.package_id,
    c.package_name,
    c.instrument,
    c.teacher_id,
    c.teacher_name,
    c.agreed_price,
    c.lesson_count,
    c.unit_price,
    c.due_date,
    c.payment_period,
    c.collected_amount,
    c.remaining_debt,
    c.days_until_due,
    c.days_late,
    case
      when c.due_date is null
        then 'Tarih Eksik'
      when
        c.remaining_debt > 0
        and c.days_late >
          p_grace_days
        then 'Gecikmiş'
      when
        c.remaining_debt > 0
        and c.days_until_due <=
          p_upcoming_days
        and c.days_late <=
          p_grace_days
        then 'Yaklaşıyor'
      else 'Normal'
    end as receivable_status
  from calculated c
  where
    c.remaining_debt > 0
    or c.due_date is null
  order by
    case
      when c.due_date is null
        then 2
      when c.days_late >
        p_grace_days
        then 0
      else 1
    end,
    c.due_date asc nulls last,
    c.student_name asc
  limit greatest(
    p_limit,
    1
  );
$$;


--
-- Name: get_dashboard_student_package_lesson_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dashboard_student_package_lesson_usage() RETURNS TABLE(student_package_id uuid, student_id uuid, student_name text, package_id uuid, package_name text, total_lesson_count integer, used_lesson_count bigint, remaining_lesson_count bigint, lesson_rights_status text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with completed_lesson_counts as (
    select
      lo.student_id,
      lo.package_id,
      count(*)::bigint as used_lesson_count
    from public.lesson_occurrences lo
    where lo.is_active = true
      and lo.status in ('Yapıldı', 'Telafi yapıldı')
    group by lo.student_id, lo.package_id
  ),
  package_usage as (
    select
      sp.id as student_package_id,
      sp.student_id,
      s.full_name as student_name,
      sp.package_id,
      p.name as package_name,
      coalesce(sp.total_lesson_count, 0)::integer as total_lesson_count,
      coalesce(clc.used_lesson_count, 0)::bigint as used_lesson_count,
      greatest(
        coalesce(sp.total_lesson_count, 0)::bigint -
        coalesce(clc.used_lesson_count, 0)::bigint,
        0::bigint
      ) as remaining_lesson_count
    from public.student_packages sp
    left join public.students s
      on s.id = sp.student_id
    left join public.packages p
      on p.id = sp.package_id
    left join completed_lesson_counts clc
      on clc.student_id = sp.student_id
     and clc.package_id = sp.package_id
    where sp.is_active = true
  )
  select
    pu.student_package_id,
    pu.student_id,
    coalesce(pu.student_name, '')::text as student_name,
    pu.package_id,
    coalesce(pu.package_name, '')::text as package_name,
    pu.total_lesson_count,
    pu.used_lesson_count,
    pu.remaining_lesson_count,
    case
      when pu.remaining_lesson_count = 0 then 'Ders Hakkı Bitti'
      when pu.remaining_lesson_count = 1 then 'Bitmek Üzere'
      else 'Devam Ediyor'
    end::text as lesson_rights_status
  from package_usage pu
  order by pu.student_name asc, pu.package_name asc;
$$;


--
-- Name: get_dashboard_summary(date, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dashboard_summary(p_today date, p_current_day text, p_upcoming_days integer DEFAULT 7, p_grace_days integer DEFAULT 3) RETURNS TABLE(active_student_count bigint, active_teacher_count bigint, monthly_student_income numeric, monthly_other_income numeric, monthly_income numeric, total_income numeric, total_institution_expense numeric, total_teacher_paid numeric, total_expense numeric, net_cash numeric, total_outstanding numeric, overdue_count bigint, upcoming_count bigint, teacher_remaining numeric, completed_lesson_count bigint, today_lesson_count bigint)
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
$$;


--
-- Name: get_finance_expense_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_finance_expense_summary() RETURNS TABLE(total_expense numeric, record_count bigint)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select
    coalesce(
      sum(e.amount),
      0
    )::numeric as total_expense,

    count(*)::bigint as record_count

  from public.expenses e

  where e.status = 'Aktif';
$$;


--
-- Name: get_finance_income_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_finance_income_summary() RETURNS TABLE(student_income numeric, other_income numeric, total_income numeric, record_count bigint)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select
    coalesce(
      sum(amount) filter (
        where source_type = 'student-payment'
          and status = 'Aktif'
      ),
      0
    ) as student_income,
    coalesce(
      sum(amount) filter (
        where source_type = 'other-income'
          and status = 'Aktif'
      ),
      0
    ) as other_income,
    coalesce(
      sum(amount) filter (
        where status = 'Aktif'
      ),
      0
    ) as total_income,
    count(*) filter (
      where status = 'Aktif'
    ) as record_count
  from public.finance_income_view;
$$;


--
-- Name: get_open_student_settlements(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_open_student_settlements() RETURNS TABLE(student_package_id uuid, student_id uuid, student_name text, package_id uuid, package_name text, teacher_id uuid, settlement_amount numeric, paid_amount numeric, balance numeric, settled_at date, settlement_note text)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select *
  from (
    select
      sp.id,
      sp.student_id,
      s.full_name,
      sp.package_id,
      coalesce(pk.name, 'Tanımsız Paket'),
      sp.default_teacher_id,
      sp.settlement_amount,
      coalesce(paid.amount, 0) as paid_amount,
      sp.settlement_amount - coalesce(paid.amount, 0) as balance,
      sp.settled_at,
      sp.settlement_note
    from public.student_packages sp
    join public.students s
      on s.id = sp.student_id
    left join public.packages pk
      on pk.id = sp.package_id
    left join lateral (
      select sum(p.amount) as amount
      from public.payments p
      where
        p.student_package_id = sp.id
        and p.is_active = true
    ) paid on true
    where
      sp.settlement_amount is not null
      and sp.settlement_resolved_at is null
  ) x
  where x.balance <> 0
  order by x.settled_at desc, x.full_name;
$$;


--
-- Name: get_panel_admin_context(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_panel_admin_context() RETURNS TABLE(user_id uuid, role text, is_admin boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    auth.uid() as user_id,
    ur.role,
    (ur.role = 'admin') as is_admin
  from public.user_roles ur
  where
    ur.user_id = auth.uid();
$$;


--
-- Name: FUNCTION get_panel_admin_context(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_panel_admin_context() IS 'Edge Function kullanıcı yönetimi işlemleri için auth.uid() tabanlı mevcut kullanıcı/admin bağlamını döndürür.';


--
-- Name: get_student_settlement_preview(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_student_settlement_preview(p_student_id uuid) RETURNS TABLE(student_package_id uuid, package_name text, teacher_name text, agreed_price numeric, package_lesson_count integer, total_lesson_count integer, completed_lesson_count bigint, unit_price numeric, paid_amount numeric, suggested_amount numeric)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into public.profiles (
    id,
    email,
    full_name
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(
        new.raw_user_meta_data ->> 'full_name',
        ''
      ),
      nullif(
        new.raw_user_meta_data ->> 'name',
        ''
      ),
      ''
    )
  )
  on conflict (id)
  do update
  set
    email = excluded.email,
    full_name = case
      when nullif(
        public.profiles.full_name,
        ''
      ) is null
      then excluded.full_name
      else public.profiles.full_name
    end,
    updated_at = now();

  insert into public.user_roles (
    user_id,
    role
  )
  values (
    new.id,
    'staff'
  )
  on conflict (user_id)
  do nothing;

  return new;
end;
$$;


--
-- Name: resolve_student_settlement(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_student_settlement(p_student_package_id uuid, p_resolution text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_balance numeric;
begin
  if p_resolution not in ('Vazgeçildi', 'İade edildi') then
    raise exception
      'Geçersiz işlem.'
      using errcode = '22023';
  end if;

  select
    sp.settlement_amount - coalesce((
      select sum(p.amount)
      from public.payments p
      where
        p.student_package_id = sp.id
        and p.is_active = true
    ), 0)
  into v_balance
  from public.student_packages sp
  where
    sp.id = p_student_package_id
    and sp.settlement_amount is not null
    and sp.settlement_resolved_at is null
  for update;

  if v_balance is null then
    raise exception
      'Açık hesap kaydı bulunamadı.'
      using errcode = 'P0002';
  end if;

  if p_resolution = 'Vazgeçildi' and v_balance <= 0 then
    raise exception
      'Bu kayıtta vazgeçilecek bir alacak yok.'
      using errcode = '22023';
  end if;

  if p_resolution = 'İade edildi' and v_balance >= 0 then
    raise exception
      'Bu kayıtta yapılacak bir iade yok.'
      using errcode = '22023';
  end if;

  update public.student_packages sp
  set
    settlement_resolved_at = current_date,
    settlement_resolution = p_resolution
  where sp.id = p_student_package_id;
end;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: set_lesson_occurrence_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_lesson_occurrence_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_lesson_plans_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_lesson_plans_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: set_panel_user_role_safely(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_panel_user_role_safely(p_user_id uuid, p_role text) RETURNS TABLE(user_id uuid, role text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_current_user_id uuid;
  v_current_user_role text;
  v_target_role text;
  v_admin_count bigint;
begin
  v_current_user_id :=
    auth.uid();

  if v_current_user_id is null then
    raise exception
      'Oturum doğrulanamadı.'
      using errcode = '42501';
  end if;

  select ur.role
  into v_current_user_role
  from public.user_roles ur
  where
    ur.user_id =
      v_current_user_id;

  if
    v_current_user_role is distinct from
    'admin'
  then
    raise exception
      'Bu işlem için admin yetkisi gereklidir.'
      using errcode = '42501';
  end if;

  if
    p_role not in (
      'admin',
      'staff'
    )
  then
    raise exception
      'Geçersiz kullanıcı rolü.'
      using errcode = '22023';
  end if;

  select ur.role
  into v_target_role
  from public.user_roles ur
  where
    ur.user_id =
      p_user_id;

  if v_target_role is null then
    raise exception
      'Kullanıcı rolü bulunamadı.'
      using errcode = 'P0002';
  end if;

  /*
   * Admin kendi yetkisini yanlışlıkla kaldıramaz.
   * Başka bir admin onu daha sonra personel yapabilir.
   */
  if
    p_user_id =
      v_current_user_id
    and p_role <> 'admin'
  then
    raise exception
      'Kendi admin yetkinizi kaldıramazsınız.'
      using errcode = '42501';
  end if;

  /*
   * Sistemde her zaman en az bir admin kalsın.
   */
  if
    v_target_role = 'admin'
    and p_role = 'staff'
  then
    select count(*)
    into v_admin_count
    from public.user_roles ur
    where
      ur.role = 'admin';

    if
      v_admin_count <= 1
    then
      raise exception
        'Sistemde en az bir admin bulunmalıdır. Son admin personel yapılamaz.'
        using errcode = '23514';
    end if;
  end if;

  update public.user_roles ur
  set
    role = p_role
  where
    ur.user_id =
      p_user_id;

  return query
  select
    p_user_id,
    p_role;
end;
$$;


--
-- Name: FUNCTION set_panel_user_role_safely(p_user_id uuid, p_role text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_panel_user_role_safely(p_user_id uuid, p_role text) IS 'Adminin başka kullanıcıların admin/staff rolünü güvenli biçimde değiştirmesini sağlar. Kendi admin yetkisini kaldırmayı ve son adminin personel yapılmasını engeller.';


--
-- Name: set_student_passive_safely(uuid, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_student_passive_safely(p_student_id uuid, p_passive_reason text, p_passive_date date) RETURNS TABLE(student_id uuid, deleted_plan_count bigint, deleted_pending_occurrence_count bigint, preserved_history_count bigint)
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: FUNCTION set_student_passive_safely(p_student_id uuid, p_passive_reason text, p_passive_date date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_student_passive_safely(p_student_id uuid, p_passive_reason text, p_passive_date date) IS 'Öğrenciyi pasife alır; geçmiş dersleri korur, bireysel gelecek derslerini kaldırır, grup üyeliklerini pasifleştirir ve grup legacy ana öğrencisi pasife alınırsa başka aktif katılımcıya güvenli biçimde devreder.';


--
-- Name: set_student_passive_with_settlement(uuid, text, date, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_student_passive_with_settlement(p_student_id uuid, p_passive_reason text, p_passive_date date, p_settlements jsonb) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  perform public.set_student_passive_safely(
    p_student_id,
    p_passive_reason,
    p_passive_date
  );

  return public.settle_student_packages(
    p_student_id,
    p_settlements
  );
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: settle_student_packages(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_student_packages(p_student_id uuid, p_settlements jsonb) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_item jsonb;
  v_package_id uuid;
  v_amount numeric;
  v_closed integer := 0;
  v_affected integer := 0;
begin
  if p_settlements is null
     or jsonb_typeof(p_settlements) <> 'array'
  then
    raise exception
      'Hesap kapatma bilgileri geçersiz.'
      using errcode = '22023';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_settlements)
  loop
    v_package_id := (v_item ->> 'student_package_id')::uuid;
    v_amount := round((v_item ->> 'amount')::numeric, 2);

    if v_amount is null or v_amount < 0 then
      raise exception
        'Alınması gereken tutar 0 veya daha büyük olmalıdır.'
        using errcode = '22023';
    end if;

    update public.student_packages sp
    set
      is_active = false,
      status = 'Sonlandırıldı',
      ended_at = coalesce(sp.ended_at, current_date),
      end_reason = coalesce(sp.end_reason, 'Öğrenci ayrıldı'),
      settlement_amount = v_amount,
      settled_at = current_date,
      settlement_note =
        nullif(trim(coalesce(v_item ->> 'note', '')), ''),
      settlement_resolved_at = null,
      settlement_resolution = null
    where
      sp.id = v_package_id
      and sp.student_id = p_student_id
      and sp.is_active = true;

    get diagnostics v_affected = row_count;
    v_closed := v_closed + v_affected;
  end loop;

  if exists (
    select 1
    from public.student_packages sp
    where
      sp.student_id = p_student_id
      and sp.is_active = true
  ) then
    raise exception
      'Öğrencinin tüm açık paketleri için hesap kapatma tutarı girilmelidir.'
      using errcode = '22023';
  end if;

  return v_closed;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    amount numeric(12,2) NOT NULL,
    date date NOT NULL,
    payment_method text,
    payee text,
    document_number text,
    note text,
    status text DEFAULT 'Aktif'::text NOT NULL,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expenses_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: other_incomes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.other_incomes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    amount numeric(12,2) NOT NULL,
    date date NOT NULL,
    payment_method text,
    related_party text,
    document_number text,
    note text,
    status text DEFAULT 'Aktif'::text NOT NULL,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT other_incomes_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    specialty_id uuid NOT NULL,
    duration_minutes smallint DEFAULT 60 NOT NULL,
    lesson_count smallint NOT NULL,
    total_price numeric(12,2) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    teacher_share_rate numeric(5,2),
    status text DEFAULT 'Aktif'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT packages_duration_minutes_check CHECK ((duration_minutes > 0)),
    CONSTRAINT packages_lesson_count_check CHECK ((lesson_count > 0)),
    CONSTRAINT packages_name_check CHECK ((btrim(name) <> ''::text)),
    CONSTRAINT packages_status_check CHECK ((status = ANY (ARRAY['Aktif'::text, 'Pasif'::text]))),
    CONSTRAINT packages_teacher_share_rate_check CHECK (((teacher_share_rate IS NULL) OR ((teacher_share_rate >= (0)::numeric) AND (teacher_share_rate <= (100)::numeric)))),
    CONSTRAINT packages_total_price_check CHECK ((total_price >= (0)::numeric)),
    CONSTRAINT packages_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    student_package_id uuid NOT NULL,
    package_id uuid,
    teacher_id uuid,
    amount numeric(12,2) NOT NULL,
    payment_period text NOT NULL,
    due_date date,
    payment_date date NOT NULL,
    payment_method text NOT NULL,
    reference_number text,
    note text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    cancel_reason text,
    CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tc_no text,
    full_name text NOT NULL,
    gender text,
    birth_date date,
    register_date date NOT NULL,
    phone text,
    email text,
    address text,
    mother_name text,
    mother_phone text,
    father_name text,
    father_phone text,
    notes text,
    status text DEFAULT 'Aktif'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    passive_date date,
    passive_reason text,
    is_archived boolean DEFAULT false NOT NULL,
    archived_at date,
    archive_reason text,
    retention_review_date date,
    retention_status text DEFAULT 'Aktif Kayıt'::text NOT NULL,
    is_anonymized boolean DEFAULT false NOT NULL,
    anonymized_at date,
    reactivated_at date,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT students_full_name_check CHECK ((btrim(full_name) <> ''::text)),
    CONSTRAINT students_gender_check CHECK (((gender IS NULL) OR (gender = ANY (ARRAY['Kadın'::text, 'Erkek'::text, 'Diğer'::text])))),
    CONSTRAINT students_status_check CHECK ((status = ANY (ARRAY['Aktif'::text, 'Pasif'::text, 'Arşiv'::text]))),
    CONSTRAINT students_tc_no_check CHECK (((tc_no IS NULL) OR (tc_no ~ '^[0-9]{11}$'::text)))
);


--
-- Name: finance_income_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.finance_income_view WITH (security_invoker='true') AS
 SELECT ('student-payment-'::text || (p.id)::text) AS id,
    p.id AS source_id,
    'student-payment'::text AS source_type,
    COALESCE(s.full_name, 'Öğrenci tahsilatı'::text) AS title,
    'Öğrenci Tahsilatı'::text AS category,
    COALESCE(pkg.name, ''::text) AS description,
    p.amount,
    p.payment_date AS date,
    COALESCE(p.payment_method, ''::text) AS payment_method,
    COALESCE(s.full_name, ''::text) AS related_party,
    COALESCE(p.reference_number, ''::text) AS document_number,
    COALESCE(p.note, ''::text) AS note,
        CASE
            WHEN p.is_active THEN 'Aktif'::text
            ELSE 'İptal'::text
        END AS status,
    p.created_at,
    p.updated_at
   FROM ((public.payments p
     LEFT JOIN public.students s ON ((s.id = p.student_id)))
     LEFT JOIN public.packages pkg ON ((pkg.id = p.package_id)))
UNION ALL
 SELECT ('other-income-'::text || (oi.id)::text) AS id,
    oi.id AS source_id,
    'other-income'::text AS source_type,
    oi.title,
    oi.category,
    ''::text AS description,
    oi.amount,
    oi.date,
    COALESCE(oi.payment_method, ''::text) AS payment_method,
    COALESCE(oi.related_party, ''::text) AS related_party,
    COALESCE(oi.document_number, ''::text) AS document_number,
    COALESCE(oi.note, ''::text) AS note,
    COALESCE(oi.status, 'Aktif'::text) AS status,
    oi.created_at,
    oi.updated_at
   FROM public.other_incomes oi;


--
-- Name: staff_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_name text NOT NULL,
    role_title text NOT NULL,
    payment_type text NOT NULL,
    payment_period text,
    amount numeric(12,2) NOT NULL,
    payment_date date NOT NULL,
    payment_method text NOT NULL,
    reference_number text,
    note text,
    status text DEFAULT 'Aktif'::text NOT NULL,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT staff_payments_payment_method_check CHECK ((payment_method = ANY (ARRAY['Nakit'::text, 'Havale / EFT'::text, 'Kredi Kartı'::text, 'Banka Kartı'::text]))),
    CONSTRAINT staff_payments_payment_type_check CHECK ((payment_type = ANY (ARRAY['Maaş'::text, 'Avans'::text, 'Prim'::text, 'Fazla Mesai'::text, 'Yol / Yemek'::text, 'Diğer'::text]))),
    CONSTRAINT staff_payments_role_title_check CHECK ((btrim(role_title) <> ''::text)),
    CONSTRAINT staff_payments_staff_name_check CHECK ((btrim(staff_name) <> ''::text)),
    CONSTRAINT staff_payments_status_check CHECK ((status = ANY (ARRAY['Aktif'::text, 'İptal'::text])))
);


--
-- Name: teacher_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    teacher_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_date date NOT NULL,
    payment_method text NOT NULL,
    reference_number text,
    note text,
    status text DEFAULT 'Aktif'::text NOT NULL,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT teacher_payments_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: teachers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teachers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    phone text,
    email text,
    birth_date date,
    gender text,
    commission_rate numeric(5,2) DEFAULT 50 NOT NULL,
    payment_day smallint,
    photo_path text,
    cv_file_path text,
    cv_file_name text,
    notes text,
    status text DEFAULT 'Aktif'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    passive_date date,
    passive_reason text,
    reactivated_at date,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT teachers_commission_rate_check CHECK (((commission_rate >= (0)::numeric) AND (commission_rate <= (100)::numeric))),
    CONSTRAINT teachers_full_name_check CHECK ((btrim(full_name) <> ''::text)),
    CONSTRAINT teachers_gender_check CHECK (((gender IS NULL) OR (gender = ANY (ARRAY['Kadın'::text, 'Erkek'::text, 'Diğer'::text])))),
    CONSTRAINT teachers_payment_day_check CHECK (((payment_day IS NULL) OR ((payment_day >= 1) AND (payment_day <= 31)))),
    CONSTRAINT teachers_status_check CHECK ((status = ANY (ARRAY['Aktif'::text, 'Pasif'::text])))
);


--
-- Name: teacher_payment_history_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.teacher_payment_history_view WITH (security_invoker='true') AS
 SELECT tp.id,
    tp.teacher_id,
    t.full_name AS teacher_name,
    tp.amount,
    tp.payment_date,
    tp.payment_method,
    tp.reference_number,
    tp.note,
    tp.status,
    tp.cancelled_at,
    tp.created_at,
    tp.updated_at
   FROM (public.teacher_payments tp
     LEFT JOIN public.teachers t ON ((t.id = tp.teacher_id)))
  WHERE (tp.status <> 'İptal'::text);


--
-- Name: finance_income_expense_report_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.finance_income_expense_report_view WITH (security_invoker='true') AS
 SELECT ((('income:'::text || COALESCE(income.source_type, 'income'::text)) || ':'::text) || income.id) AS record_id,
    'income'::text AS direction,
    income.source_type,
        CASE
            WHEN (income.source_type = 'student-payment'::text) THEN 'Öğrenci Tahsilatı'::text
            WHEN (income.source_type = 'other-income'::text) THEN 'Ek Gelir'::text
            ELSE 'Gelir'::text
        END AS source_label,
    COALESCE(income.title, ''::text) AS title,
    COALESCE(income.category, ''::text) AS category,
    COALESCE(income.description, ''::text) AS description,
    COALESCE(income.amount, (0)::numeric) AS amount,
    income.date AS transaction_date,
    COALESCE(income.payment_method, ''::text) AS payment_method,
    COALESCE(income.related_party, ''::text) AS related_party,
    COALESCE(income.document_number, ''::text) AS document_number,
    COALESCE(income.note, ''::text) AS note,
    income.created_at
   FROM public.finance_income_view income
  WHERE (income.status = 'Aktif'::text)
UNION ALL
 SELECT ('expense:institution-expense:'::text || (expense.id)::text) AS record_id,
    'expense'::text AS direction,
    'institution-expense'::text AS source_type,
    'Kurum Gideri'::text AS source_label,
    COALESCE(expense.title, ''::text) AS title,
    COALESCE(expense.category, ''::text) AS category,
    ''::text AS description,
    COALESCE(expense.amount, (0)::numeric) AS amount,
    expense.date AS transaction_date,
    COALESCE(expense.payment_method, ''::text) AS payment_method,
    COALESCE(expense.payee, ''::text) AS related_party,
    COALESCE(expense.document_number, ''::text) AS document_number,
    COALESCE(expense.note, ''::text) AS note,
    expense.created_at
   FROM public.expenses expense
  WHERE (expense.status <> 'İptal'::text)
UNION ALL
 SELECT ('expense:teacher-payment:'::text || (payment.id)::text) AS record_id,
    'expense'::text AS direction,
    'teacher-payment'::text AS source_type,
    'Öğretmen Ödemesi'::text AS source_label,
    'Öğretmen Ödemesi'::text AS title,
    'Öğretmen'::text AS category,
    COALESCE(payment.teacher_name, ''::text) AS description,
    COALESCE(payment.amount, (0)::numeric) AS amount,
    payment.payment_date AS transaction_date,
    COALESCE(payment.payment_method, ''::text) AS payment_method,
    COALESCE(payment.teacher_name, ''::text) AS related_party,
    COALESCE(payment.reference_number, ''::text) AS document_number,
    COALESCE(payment.note, ''::text) AS note,
    payment.created_at
   FROM public.teacher_payment_history_view payment
UNION ALL
 SELECT ('expense:staff-payment:'::text || (payment.id)::text) AS record_id,
    'expense'::text AS direction,
    'staff-payment'::text AS source_type,
    'Personel Ödemesi'::text AS source_label,
    COALESCE(payment.payment_type, 'Personel Ödemesi'::text) AS title,
    'Personel'::text AS category,
    TRIM(BOTH FROM concat_ws(' • '::text, NULLIF(payment.role_title, ''::text), NULLIF(payment.payment_period, ''::text))) AS description,
    COALESCE(payment.amount, (0)::numeric) AS amount,
    payment.payment_date AS transaction_date,
    COALESCE(payment.payment_method, ''::text) AS payment_method,
    COALESCE(payment.staff_name, ''::text) AS related_party,
    COALESCE(payment.reference_number, ''::text) AS document_number,
    COALESCE(payment.note, ''::text) AS note,
    payment.created_at
   FROM public.staff_payments payment
  WHERE (payment.status = 'Aktif'::text);


--
-- Name: lesson_earning_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_earning_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lesson_id uuid NOT NULL,
    participant_id uuid,
    student_id uuid NOT NULL,
    student_package_id uuid,
    package_id uuid,
    agreed_price numeric DEFAULT 0 NOT NULL,
    lesson_count integer DEFAULT 1 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    commission_rate numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lesson_group_students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_group_students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    student_id uuid NOT NULL,
    student_package_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    left_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lesson_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    specialty_id uuid NOT NULL,
    default_teacher_id uuid,
    default_duration_minutes integer DEFAULT 60 NOT NULL,
    capacity integer DEFAULT 6 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lesson_groups_capacity_positive CHECK ((capacity > 0)),
    CONSTRAINT lesson_groups_duration_positive CHECK ((default_duration_minutes > 0)),
    CONSTRAINT lesson_groups_name_not_empty CHECK ((length(TRIM(BOTH FROM name)) > 0))
);


--
-- Name: lesson_occurrences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_occurrences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lesson_plan_id uuid,
    student_id uuid NOT NULL,
    package_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    lesson_date date,
    day text NOT NULL,
    start_time time without time zone NOT NULL,
    duration_minutes integer DEFAULT 60 NOT NULL,
    status text DEFAULT 'Planlandı'::text NOT NULL,
    note text,
    is_makeup boolean DEFAULT false NOT NULL,
    related_occurrence_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lesson_occurrences_duration_minutes_check CHECK ((duration_minutes > 0))
);


--
-- Name: lesson_plan_students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_plan_students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lesson_plan_id uuid NOT NULL,
    student_id uuid NOT NULL,
    student_package_id uuid,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lesson_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    package_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    day text NOT NULL,
    start_time time without time zone NOT NULL,
    duration_minutes integer DEFAULT 60 NOT NULL,
    status text DEFAULT 'Planlandı'::text NOT NULL,
    note text,
    is_makeup boolean DEFAULT false NOT NULL,
    related_lesson_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lesson_type text DEFAULT 'individual'::text NOT NULL,
    group_name text,
    capacity integer,
    group_id uuid,
    CONSTRAINT lesson_plans_capacity_check CHECK (((capacity IS NULL) OR (capacity > 0))),
    CONSTRAINT lesson_plans_lesson_type_check CHECK ((lesson_type = ANY (ARRAY['individual'::text, 'group'::text])))
);


--
-- Name: payment_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_audit_log (
    id bigint NOT NULL,
    payment_id uuid NOT NULL,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_audit_log_action_check CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text, 'cancel'::text, 'delete'::text])))
);


--
-- Name: payment_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.payment_audit_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.payment_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: specialties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.specialties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT specialties_name_check CHECK ((btrim(name) <> ''::text))
);


--
-- Name: student_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    package_id uuid NOT NULL,
    default_teacher_id uuid NOT NULL,
    agreed_price numeric(12,2) NOT NULL,
    payment_period text DEFAULT 'Aylık'::text NOT NULL,
    payment_day smallint NOT NULL,
    first_payment_date date NOT NULL,
    next_payment_date date NOT NULL,
    status text DEFAULT 'Aktif'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    ended_at date,
    end_reason text,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    total_lesson_count integer NOT NULL,
    settlement_amount numeric(12,2),
    settled_at date,
    settlement_note text,
    settlement_resolved_at date,
    settlement_resolution text,
    CONSTRAINT student_packages_agreed_price_check CHECK ((agreed_price > (0)::numeric)),
    CONSTRAINT student_packages_payment_day_check CHECK (((payment_day >= 1) AND (payment_day <= 31))),
    CONSTRAINT student_packages_status_check CHECK ((status = ANY (ARRAY['Aktif'::text, 'Sonlandırıldı'::text]))),
    CONSTRAINT student_packages_total_lesson_count_positive CHECK ((total_lesson_count > 0))
);


--
-- Name: COLUMN student_packages.settlement_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.student_packages.settlement_amount IS 'Öğrenci ayrılırken bu paket için alınması gereken toplam tutar. Bakiye = bu tutar − paket tahsilatları.';


--
-- Name: payment_movements_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.payment_movements_view WITH (security_invoker='true') AS
 SELECT p.id,
    p.student_id,
    p.student_package_id,
    p.package_id,
    p.teacher_id,
    p.amount,
    p.payment_period,
    p.due_date,
    p.payment_date,
    p.payment_method,
    p.reference_number,
    p.note,
    p.is_active,
    p.created_at,
    p.updated_at,
    s.full_name AS student_name,
    pk.name AS package_name,
    sp.agreed_price AS package_price,
    t.full_name AS teacher_name,
    specialty.name AS instrument,
    COALESCE(sum(p.amount) OVER (PARTITION BY p.student_package_id, p.payment_period), (0)::numeric) AS period_collected_amount,
    GREATEST((COALESCE(sp.agreed_price, (0)::numeric) - COALESCE(sum(p.amount) OVER (PARTITION BY p.student_package_id, p.payment_period), (0)::numeric)), (0)::numeric) AS remaining_amount,
        CASE
            WHEN (COALESCE(sum(p.amount) OVER (PARTITION BY p.student_package_id, p.payment_period), (0)::numeric) >= COALESCE(sp.agreed_price, (0)::numeric)) THEN 'Tamamlandı'::text
            ELSE 'Kısmi Ödeme'::text
        END AS collection_status
   FROM (((((public.payments p
     LEFT JOIN public.students s ON ((s.id = p.student_id)))
     LEFT JOIN public.student_packages sp ON ((sp.id = p.student_package_id)))
     LEFT JOIN public.packages pk ON ((pk.id = p.package_id)))
     LEFT JOIN public.specialties specialty ON ((specialty.id = pk.specialty_id)))
     LEFT JOIN public.teachers t ON ((t.id = p.teacher_id)))
  WHERE (p.is_active = true);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: student_guardians; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_guardians (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    full_name text NOT NULL,
    relationship text NOT NULL,
    phone text,
    email text,
    address text,
    same_address_as_student boolean DEFAULT false NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    notes text,
    sort_order smallint DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_guardians_full_name_check CHECK ((btrim(full_name) <> ''::text)),
    CONSTRAINT student_guardians_relationship_check CHECK ((btrim(relationship) <> ''::text)),
    CONSTRAINT student_guardians_sort_order_check CHECK (((sort_order >= 1) AND (sort_order <= 10)))
);


--
-- Name: student_list_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.student_list_view WITH (security_invoker='true') AS
 SELECT s.id,
    s.tc_no,
    s.full_name,
    s.phone,
    s.email,
    s.status,
    s.is_active,
    s.is_archived,
    s.is_anonymized,
    s.retention_status,
    s.retention_review_date,
    s.created_at,
    s.updated_at,
        CASE
            WHEN ((s.is_anonymized = true) OR (lower(COALESCE(s.retention_status, ''::text)) = 'anonimleştirildi'::text)) THEN 'archived'::text
            WHEN ((s.is_archived = true) AND (s.retention_review_date IS NOT NULL) AND (s.retention_review_date <= CURRENT_DATE)) THEN 'review'::text
            WHEN ((s.is_archived = true) OR (lower(COALESCE(s.status, ''::text)) = 'arşiv'::text)) THEN 'archived'::text
            WHEN ((s.is_active = false) OR (lower(COALESCE(s.status, ''::text)) = 'pasif'::text)) THEN 'passive'::text
            ELSE 'active'::text
        END AS list_status,
    COALESCE(string_agg(DISTINCT p.name, ', '::text ORDER BY p.name) FILTER (WHERE ((sp.is_active = true) AND (lower(COALESCE(sp.status, ''::text)) <> ALL (ARRAY['pasif'::text, 'sonlandırıldı'::text])))), ''::text) AS package_names,
    COALESCE(string_agg(DISTINCT specialty.name, ', '::text ORDER BY specialty.name) FILTER (WHERE ((sp.is_active = true) AND (lower(COALESCE(sp.status, ''::text)) <> ALL (ARRAY['pasif'::text, 'sonlandırıldı'::text])))), ''::text) AS instrument_names,
    COALESCE(string_agg(DISTINCT t.full_name, ', '::text ORDER BY t.full_name) FILTER (WHERE ((sp.is_active = true) AND (lower(COALESCE(sp.status, ''::text)) <> ALL (ARRAY['pasif'::text, 'sonlandırıldı'::text])))), ''::text) AS teacher_names,
    COALESCE(sum(sp.agreed_price) FILTER (WHERE ((sp.is_active = true) AND (lower(COALESCE(sp.status, ''::text)) <> ALL (ARRAY['pasif'::text, 'sonlandırıldı'::text])))), (0)::numeric) AS total_fee,
    min(sp.next_payment_date) FILTER (WHERE ((sp.is_active = true) AND (lower(COALESCE(sp.status, ''::text)) <> ALL (ARRAY['pasif'::text, 'sonlandırıldı'::text])))) AS nearest_payment_date,
    COALESCE(array_agg(DISTINCT sp.package_id) FILTER (WHERE ((sp.package_id IS NOT NULL) AND (sp.is_active = true) AND (lower(COALESCE(sp.status, ''::text)) <> ALL (ARRAY['pasif'::text, 'sonlandırıldı'::text])))), ARRAY[]::uuid[]) AS package_ids,
    COALESCE(array_agg(DISTINCT sp.default_teacher_id) FILTER (WHERE ((sp.default_teacher_id IS NOT NULL) AND (sp.is_active = true) AND (lower(COALESCE(sp.status, ''::text)) <> ALL (ARRAY['pasif'::text, 'sonlandırıldı'::text])))), ARRAY[]::uuid[]) AS teacher_ids
   FROM ((((public.students s
     LEFT JOIN public.student_packages sp ON ((sp.student_id = s.id)))
     LEFT JOIN public.packages p ON ((p.id = sp.package_id)))
     LEFT JOIN public.specialties specialty ON ((specialty.id = p.specialty_id)))
     LEFT JOIN public.teachers t ON ((t.id = sp.default_teacher_id)))
  GROUP BY s.id, s.tc_no, s.full_name, s.phone, s.email, s.status, s.is_active, s.is_archived, s.is_anonymized, s.retention_status, s.retention_review_date, s.created_at, s.updated_at;


--
-- Name: student_payment_report_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.student_payment_report_view WITH (security_invoker='true') AS
 SELECT sp.id AS student_package_id,
    s.id AS student_id,
    s.full_name AS student_name,
    s.is_active AS student_is_active,
    p.id AS package_id,
    p.name AS package_name,
    t.id AS teacher_id,
    t.full_name AS teacher_name,
    sp.payment_period,
    sp.payment_day,
    sp.first_payment_date,
    sp.next_payment_date,
    COALESCE(sp.agreed_price, (0)::numeric) AS agreed_price,
    COALESCE(sum(pay.amount) FILTER (WHERE (pay.is_active = true)), (0)::numeric) AS paid_amount,
    GREATEST((COALESCE(sp.agreed_price, (0)::numeric) - COALESCE(sum(pay.amount) FILTER (WHERE (pay.is_active = true)), (0)::numeric)), (0)::numeric) AS remaining_amount,
    max(pay.payment_date) FILTER (WHERE (pay.is_active = true)) AS last_payment_date,
        CASE
            WHEN (COALESCE(sp.agreed_price, (0)::numeric) <= (0)::numeric) THEN 'Ücret Girilmedi'::text
            WHEN (COALESCE(sum(pay.amount) FILTER (WHERE (pay.is_active = true)), (0)::numeric) >= COALESCE(sp.agreed_price, (0)::numeric)) THEN 'Ödendi'::text
            WHEN ((COALESCE(sum(pay.amount) FILTER (WHERE (pay.is_active = true)), (0)::numeric) > (0)::numeric) AND (sp.next_payment_date < CURRENT_DATE)) THEN 'Kısmi ve Gecikmiş'::text
            WHEN (COALESCE(sum(pay.amount) FILTER (WHERE (pay.is_active = true)), (0)::numeric) > (0)::numeric) THEN 'Kısmi'::text
            WHEN (sp.next_payment_date < CURRENT_DATE) THEN 'Gecikmiş'::text
            WHEN (sp.next_payment_date = CURRENT_DATE) THEN 'Ödeme Günü Bugün'::text
            WHEN (sp.next_payment_date IS NULL) THEN 'Tarih Girilmedi'::text
            ELSE 'Bekliyor'::text
        END AS payment_status,
    sp.status AS package_status,
    sp.is_active AS package_is_active,
    sp.created_at
   FROM ((((public.student_packages sp
     JOIN public.students s ON ((s.id = sp.student_id)))
     JOIN public.packages p ON ((p.id = sp.package_id)))
     LEFT JOIN public.teachers t ON ((t.id = sp.default_teacher_id)))
     LEFT JOIN public.payments pay ON (((pay.student_package_id = sp.id) AND (pay.is_active = true))))
  WHERE (COALESCE(s.is_anonymized, false) = false)
  GROUP BY sp.id, s.id, s.full_name, s.is_active, p.id, p.name, t.id, t.full_name, sp.payment_period, sp.payment_day, sp.first_payment_date, sp.next_payment_date, sp.agreed_price, sp.status, sp.is_active, sp.created_at;


--
-- Name: student_tracking_report_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.student_tracking_report_view WITH (security_invoker='true') AS
 SELECT s.id AS student_id,
    s.full_name AS student_name,
    s.gender,
    s.register_date,
    s.status AS student_status,
    s.is_active AS student_is_active,
    COALESCE(string_agg(DISTINCT t.full_name, ', '::text ORDER BY t.full_name) FILTER (WHERE ((sp.is_active = true) AND (t.id IS NOT NULL))), '-'::text) AS teacher_names,
    COALESCE(string_agg(DISTINCT p.name, ', '::text ORDER BY p.name) FILTER (WHERE ((sp.is_active = true) AND (p.id IS NOT NULL))), '-'::text) AS package_names,
    COALESCE(string_agg(DISTINCT lg.name, ', '::text ORDER BY lg.name) FILTER (WHERE ((lgs.is_active = true) AND (lg.is_active = true) AND (lg.id IS NOT NULL))), '-'::text) AS group_names
   FROM (((((public.students s
     LEFT JOIN public.student_packages sp ON (((sp.student_id = s.id) AND (sp.is_active = true))))
     LEFT JOIN public.packages p ON ((p.id = sp.package_id)))
     LEFT JOIN public.teachers t ON ((t.id = sp.default_teacher_id)))
     LEFT JOIN public.lesson_group_students lgs ON (((lgs.student_id = s.id) AND (lgs.is_active = true))))
     LEFT JOIN public.lesson_groups lg ON (((lg.id = lgs.group_id) AND (lg.is_active = true))))
  WHERE (COALESCE(s.is_anonymized, false) = false)
  GROUP BY s.id, s.full_name, s.gender, s.register_date, s.status, s.is_active;


--
-- Name: teacher_earning_lessons_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.teacher_earning_lessons_view AS
 WITH snap AS (
         SELECT les.id,
            les.lesson_id,
            les.participant_id,
            les.student_id,
            les.student_package_id,
            les.package_id,
            les.agreed_price,
            les.lesson_count,
            les.unit_price,
            les.commission_rate,
            les.created_at,
            lo.teacher_id,
            lo.day,
            lo.start_time,
            lo.status,
            lo.created_at AS lesson_created_at,
            lo.updated_at AS lesson_updated_at,
            lo.lesson_date,
            lp.group_id,
            lp.group_name,
            row_number() OVER (PARTITION BY COALESCE((les.student_package_id)::text, (((les.student_id)::text || ':'::text) || COALESCE((les.package_id)::text, ''::text))), (date_trunc('month'::text, (lo.lesson_date)::timestamp with time zone)) ORDER BY lo.lesson_date, lo.start_time, lo.created_at, les.lesson_id) AS month_sequence
           FROM ((public.lesson_earning_snapshots les
             JOIN public.lesson_occurrences lo ON ((lo.id = les.lesson_id)))
             LEFT JOIN public.lesson_plans lp ON ((lp.id = lo.lesson_plan_id)))
          WHERE ((lo.is_active = true) AND (lo.status = ANY (ARRAY['Yapıldı'::text, 'Telafi yapıldı'::text])))
        ), limited AS (
         SELECT snap.id,
            snap.lesson_id,
            snap.participant_id,
            snap.student_id,
            snap.student_package_id,
            snap.package_id,
            snap.agreed_price,
            snap.lesson_count,
            snap.unit_price,
            snap.commission_rate,
            snap.created_at,
            snap.teacher_id,
            snap.day,
            snap.start_time,
            snap.status,
            snap.lesson_created_at,
            snap.lesson_updated_at,
            snap.lesson_date,
            snap.group_id,
            snap.group_name,
            snap.month_sequence,
            ((snap.lesson_date IS NOT NULL) AND (snap.month_sequence > snap.lesson_count)) AS is_over_limit
           FROM snap
        )
 SELECT l.lesson_id,
    l.teacher_id,
    t.full_name AS teacher_name,
    l.student_id,
    s.full_name AS student_name,
    l.student_package_id,
    l.package_id,
    p.name AS package_name,
    COALESCE(spec.name, ''::text) AS instrument,
    l.day,
    l.start_time,
    l.status,
    l.agreed_price,
    l.lesson_count,
        CASE
            WHEN l.is_over_limit THEN (0)::numeric
            ELSE l.unit_price
        END AS unit_price,
    l.commission_rate,
        CASE
            WHEN l.is_over_limit THEN (0)::numeric
            ELSE (l.unit_price * (l.commission_rate / (100)::numeric))
        END AS teacher_earning,
    l.lesson_created_at AS created_at,
    l.lesson_updated_at AS updated_at,
    l.lesson_date,
    l.group_id,
    l.group_name,
        CASE
            WHEN (l.participant_id IS NULL) THEN (l.lesson_id)::text
            ELSE (((l.lesson_id)::text || ':'::text) || (l.participant_id)::text)
        END AS earning_row_id,
    l.is_over_limit AS is_over_package_limit,
    l.unit_price AS full_unit_price
   FROM ((((limited l
     JOIN public.teachers t ON ((t.id = l.teacher_id)))
     JOIN public.students s ON ((s.id = l.student_id)))
     LEFT JOIN public.packages p ON ((p.id = l.package_id)))
     LEFT JOIN public.specialties spec ON ((spec.id = p.specialty_id)));


--
-- Name: teacher_specialties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_specialties (
    teacher_id uuid NOT NULL,
    specialty_id uuid NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: teacher_earnings_summary_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.teacher_earnings_summary_view AS
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
    GREATEST((COALESCE(lt.total_earning, (0)::numeric) - COALESCE(pt.total_paid, (0)::numeric)), (0)::numeric) AS remaining_payment
   FROM (((public.teachers t
     LEFT JOIN lesson_totals lt ON ((lt.teacher_id = t.id)))
     LEFT JOIN payment_totals pt ON ((pt.teacher_id = t.id)))
     LEFT JOIN teacher_branches tb ON ((tb.teacher_id = t.id)));


--
-- Name: teacher_tracking_detail_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.teacher_tracking_detail_view WITH (security_invoker='true') AS
 SELECT sp.id AS detail_id,
    sp.default_teacher_id AS teacher_id,
    'individual'::text AS record_type,
    'Bireysel'::text AS record_type_label,
    s.id AS student_id,
    s.full_name AS student_name,
    s.register_date AS student_register_date,
    s.is_active AS student_is_active,
    NULL::uuid AS group_id,
    NULL::text AS group_name,
    p.id AS package_id,
    p.name AS package_name,
    sp.id AS student_package_id,
    sp.created_at AS assignment_created_at,
    sp.is_active AS assignment_is_active
   FROM ((public.student_packages sp
     JOIN public.students s ON ((s.id = sp.student_id)))
     JOIN public.packages p ON ((p.id = sp.package_id)))
  WHERE ((sp.default_teacher_id IS NOT NULL) AND (sp.is_active = true) AND (s.is_active = true) AND (COALESCE(s.is_anonymized, false) = false) AND (NOT (EXISTS ( SELECT 1
           FROM public.lesson_group_students lgs
          WHERE ((lgs.student_package_id = sp.id) AND (lgs.is_active = true))))))
UNION ALL
 SELECT lgs.id AS detail_id,
    lg.default_teacher_id AS teacher_id,
    'group'::text AS record_type,
    'Grup'::text AS record_type_label,
    s.id AS student_id,
    s.full_name AS student_name,
    s.register_date AS student_register_date,
    s.is_active AS student_is_active,
    lg.id AS group_id,
    lg.name AS group_name,
    p.id AS package_id,
    p.name AS package_name,
    sp.id AS student_package_id,
    lgs.joined_at AS assignment_created_at,
    ((lgs.is_active = true) AND (lg.is_active = true) AND (sp.is_active = true)) AS assignment_is_active
   FROM ((((public.lesson_group_students lgs
     JOIN public.lesson_groups lg ON ((lg.id = lgs.group_id)))
     JOIN public.students s ON ((s.id = lgs.student_id)))
     JOIN public.student_packages sp ON ((sp.id = lgs.student_package_id)))
     JOIN public.packages p ON ((p.id = sp.package_id)))
  WHERE ((lg.default_teacher_id IS NOT NULL) AND (lgs.is_active = true) AND (lg.is_active = true) AND (sp.is_active = true) AND (s.is_active = true) AND (COALESCE(s.is_anonymized, false) = false));


--
-- Name: teacher_tracking_report_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.teacher_tracking_report_view WITH (security_invoker='true') AS
 WITH teacher_specialty_summary AS (
         SELECT ts.teacher_id,
            COALESCE(string_agg(DISTINCT specialty.name, ', '::text ORDER BY specialty.name), '-'::text) AS specialty_names
           FROM (public.teacher_specialties ts
             JOIN public.specialties specialty ON ((specialty.id = ts.specialty_id)))
          GROUP BY ts.teacher_id
        ), teacher_detail_summary AS (
         SELECT detail.teacher_id,
            (count(DISTINCT detail.student_id) FILTER (WHERE (detail.assignment_is_active = true)))::integer AS total_student_count,
            (count(DISTINCT detail.student_id) FILTER (WHERE ((detail.record_type = 'individual'::text) AND (detail.assignment_is_active = true))))::integer AS individual_student_count,
            (count(DISTINCT detail.student_id) FILTER (WHERE ((detail.record_type = 'group'::text) AND (detail.assignment_is_active = true))))::integer AS group_student_count,
            (count(DISTINCT detail.group_id) FILTER (WHERE ((detail.record_type = 'group'::text) AND (detail.assignment_is_active = true))))::integer AS group_count,
            COALESCE(string_agg(DISTINCT detail.package_name, ', '::text ORDER BY detail.package_name) FILTER (WHERE ((detail.assignment_is_active = true) AND (detail.package_name IS NOT NULL))), '-'::text) AS package_names
           FROM public.teacher_tracking_detail_view detail
          GROUP BY detail.teacher_id
        ), teacher_weekly_lesson_summary AS (
         SELECT lesson.teacher_id,
            (count(DISTINCT lesson.id))::integer AS weekly_lesson_count
           FROM public.lesson_plans lesson
          WHERE ((lesson.teacher_id IS NOT NULL) AND (lesson.is_active = true))
          GROUP BY lesson.teacher_id
        )
 SELECT teacher.id AS teacher_id,
    teacher.full_name AS teacher_name,
    teacher.gender,
    teacher.phone,
    teacher.email,
    teacher.status AS teacher_status,
    teacher.is_active AS teacher_is_active,
    teacher.created_at AS teacher_created_at,
    COALESCE(specialty_summary.specialty_names, '-'::text) AS specialty_names,
    COALESCE(detail_summary.total_student_count, 0) AS total_student_count,
    COALESCE(detail_summary.individual_student_count, 0) AS individual_student_count,
    COALESCE(detail_summary.group_student_count, 0) AS group_student_count,
    COALESCE(detail_summary.group_count, 0) AS group_count,
    COALESCE(weekly_summary.weekly_lesson_count, 0) AS weekly_lesson_count,
    COALESCE(detail_summary.package_names, '-'::text) AS package_names
   FROM (((public.teachers teacher
     LEFT JOIN teacher_specialty_summary specialty_summary ON ((specialty_summary.teacher_id = teacher.id)))
     LEFT JOIN teacher_detail_summary detail_summary ON ((detail_summary.teacher_id = teacher.id)))
     LEFT JOIN teacher_weekly_lesson_summary weekly_summary ON ((weekly_summary.teacher_id = teacher.id)));


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role text DEFAULT 'staff'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_roles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'staff'::text])))
);


--
-- Name: TABLE user_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_roles IS 'Kullanıcı yönetimi rolü. admin kullanıcı yönetebilir; staff dahil tüm authenticated kullanıcıların business modül erişimi mevcut RLS politikalarıyla aynıdır.';


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: lesson_earning_snapshots lesson_earning_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_earning_snapshots
    ADD CONSTRAINT lesson_earning_snapshots_pkey PRIMARY KEY (id);


--
-- Name: lesson_group_students lesson_group_students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_group_students
    ADD CONSTRAINT lesson_group_students_pkey PRIMARY KEY (id);


--
-- Name: lesson_group_students lesson_group_students_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_group_students
    ADD CONSTRAINT lesson_group_students_unique UNIQUE (group_id, student_id);


--
-- Name: lesson_groups lesson_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_groups
    ADD CONSTRAINT lesson_groups_pkey PRIMARY KEY (id);


--
-- Name: lesson_occurrences lesson_occurrences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_occurrences
    ADD CONSTRAINT lesson_occurrences_pkey PRIMARY KEY (id);


--
-- Name: lesson_occurrences lesson_occurrences_plan_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_occurrences
    ADD CONSTRAINT lesson_occurrences_plan_date_key UNIQUE (lesson_plan_id, lesson_date);


--
-- Name: lesson_plan_students lesson_plan_students_lesson_plan_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plan_students
    ADD CONSTRAINT lesson_plan_students_lesson_plan_id_student_id_key UNIQUE (lesson_plan_id, student_id);


--
-- Name: lesson_plan_students lesson_plan_students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plan_students
    ADD CONSTRAINT lesson_plan_students_pkey PRIMARY KEY (id);


--
-- Name: lesson_plans lesson_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plans
    ADD CONSTRAINT lesson_plans_pkey PRIMARY KEY (id);


--
-- Name: other_incomes other_incomes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.other_incomes
    ADD CONSTRAINT other_incomes_pkey PRIMARY KEY (id);


--
-- Name: packages packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_pkey PRIMARY KEY (id);


--
-- Name: payment_audit_log payment_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_audit_log
    ADD CONSTRAINT payment_audit_log_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: specialties specialties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialties
    ADD CONSTRAINT specialties_pkey PRIMARY KEY (id);


--
-- Name: staff_payments staff_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_payments
    ADD CONSTRAINT staff_payments_pkey PRIMARY KEY (id);


--
-- Name: student_guardians student_guardians_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_guardians
    ADD CONSTRAINT student_guardians_pkey PRIMARY KEY (id);


--
-- Name: student_packages student_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_packages
    ADD CONSTRAINT student_packages_pkey PRIMARY KEY (id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: students students_tc_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_tc_no_key UNIQUE (tc_no);


--
-- Name: teacher_payments teacher_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_payments
    ADD CONSTRAINT teacher_payments_pkey PRIMARY KEY (id);


--
-- Name: teacher_specialties teacher_specialties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_specialties
    ADD CONSTRAINT teacher_specialties_pkey PRIMARY KEY (teacher_id, specialty_id);


--
-- Name: teachers teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id);


--
-- Name: expenses_active_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_active_date_idx ON public.expenses USING btree (status, date DESC, created_at DESC);


--
-- Name: expenses_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_category_idx ON public.expenses USING btree (category);


--
-- Name: expenses_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_date_idx ON public.expenses USING btree (date);


--
-- Name: expenses_payment_method_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_payment_method_idx ON public.expenses USING btree (payment_method);


--
-- Name: expenses_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_status_idx ON public.expenses USING btree (status);


--
-- Name: lesson_earning_snapshots_lesson_participant_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lesson_earning_snapshots_lesson_participant_key ON public.lesson_earning_snapshots USING btree (lesson_id, COALESCE(participant_id, '00000000-0000-0000-0000-000000000000'::uuid));


--
-- Name: lesson_earning_snapshots_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_earning_snapshots_package_idx ON public.lesson_earning_snapshots USING btree (student_package_id);


--
-- Name: lesson_group_students_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_group_students_group_id_idx ON public.lesson_group_students USING btree (group_id);


--
-- Name: lesson_group_students_student_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_group_students_student_id_idx ON public.lesson_group_students USING btree (student_id);


--
-- Name: lesson_group_students_student_package_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_group_students_student_package_id_idx ON public.lesson_group_students USING btree (student_package_id);


--
-- Name: lesson_occurrences_day_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_occurrences_day_time_idx ON public.lesson_occurrences USING btree (day, start_time);


--
-- Name: lesson_occurrences_plan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_occurrences_plan_idx ON public.lesson_occurrences USING btree (lesson_plan_id);


--
-- Name: lesson_occurrences_student_package_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_occurrences_student_package_idx ON public.lesson_occurrences USING btree (student_id, package_id);


--
-- Name: lesson_occurrences_teacher_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_occurrences_teacher_status_idx ON public.lesson_occurrences USING btree (teacher_id, status, is_active);


--
-- Name: lesson_plan_students_lesson_plan_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_plan_students_lesson_plan_id_idx ON public.lesson_plan_students USING btree (lesson_plan_id);


--
-- Name: lesson_plan_students_student_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_plan_students_student_id_idx ON public.lesson_plan_students USING btree (student_id);


--
-- Name: lesson_plan_students_student_package_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_plan_students_student_package_id_idx ON public.lesson_plan_students USING btree (student_package_id);


--
-- Name: lesson_plans_active_student_slot_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lesson_plans_active_student_slot_unique ON public.lesson_plans USING btree (student_id, day, start_time) WHERE (is_active = true);


--
-- Name: lesson_plans_active_teacher_slot_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lesson_plans_active_teacher_slot_unique ON public.lesson_plans USING btree (teacher_id, day, start_time) WHERE (is_active = true);


--
-- Name: lesson_plans_dashboard_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_plans_dashboard_day_idx ON public.lesson_plans USING btree (day, is_active, status);


--
-- Name: lesson_plans_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_plans_group_id_idx ON public.lesson_plans USING btree (group_id);


--
-- Name: lesson_plans_teacher_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lesson_plans_teacher_status_idx ON public.lesson_plans USING btree (teacher_id, status, is_active);


--
-- Name: other_incomes_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX other_incomes_date_idx ON public.other_incomes USING btree (date);


--
-- Name: other_incomes_method_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX other_incomes_method_date_idx ON public.other_incomes USING btree (payment_method, date DESC) WHERE (status = 'Aktif'::text);


--
-- Name: other_incomes_status_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX other_incomes_status_date_idx ON public.other_incomes USING btree (status, date DESC, created_at DESC);


--
-- Name: other_incomes_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX other_incomes_status_idx ON public.other_incomes USING btree (status);


--
-- Name: packages_specialty_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX packages_specialty_id_idx ON public.packages USING btree (specialty_id);


--
-- Name: payment_audit_log_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_audit_log_payment_idx ON public.payment_audit_log USING btree (payment_id, changed_at DESC);


--
-- Name: payments_active_date_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_active_date_created_idx ON public.payments USING btree (is_active, payment_date DESC, created_at DESC);


--
-- Name: payments_method_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_method_date_idx ON public.payments USING btree (payment_method, payment_date DESC) WHERE (is_active = true);


--
-- Name: payments_payment_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_payment_date_idx ON public.payments USING btree (payment_date);


--
-- Name: payments_payment_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_payment_period_idx ON public.payments USING btree (payment_period);


--
-- Name: payments_student_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_student_id_idx ON public.payments USING btree (student_id);


--
-- Name: payments_student_package_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_student_package_id_idx ON public.payments USING btree (student_package_id);


--
-- Name: payments_student_package_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_student_package_period_idx ON public.payments USING btree (student_package_id, payment_period) WHERE (is_active = true);


--
-- Name: specialties_name_unique_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX specialties_name_unique_ci ON public.specialties USING btree (lower(btrim(name)));


--
-- Name: staff_payments_payment_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_payments_payment_date_idx ON public.staff_payments USING btree (payment_date DESC);


--
-- Name: staff_payments_staff_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_payments_staff_name_idx ON public.staff_payments USING btree (staff_name);


--
-- Name: staff_payments_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_payments_status_idx ON public.staff_payments USING btree (status);


--
-- Name: student_guardians_one_primary_per_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX student_guardians_one_primary_per_student_idx ON public.student_guardians USING btree (student_id) WHERE ((is_primary = true) AND (is_active = true));


--
-- Name: student_guardians_student_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_guardians_student_id_idx ON public.student_guardians USING btree (student_id);


--
-- Name: student_packages_dashboard_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_packages_dashboard_due_idx ON public.student_packages USING btree (is_active, next_payment_date);


--
-- Name: student_packages_next_payment_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_packages_next_payment_date_idx ON public.student_packages USING btree (next_payment_date);


--
-- Name: student_packages_package_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_packages_package_active_idx ON public.student_packages USING btree (package_id, is_active);


--
-- Name: student_packages_package_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_packages_package_id_idx ON public.student_packages USING btree (package_id);


--
-- Name: student_packages_student_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_packages_student_active_idx ON public.student_packages USING btree (student_id, is_active);


--
-- Name: student_packages_student_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_packages_student_id_idx ON public.student_packages USING btree (student_id);


--
-- Name: student_packages_student_package_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_packages_student_package_active_idx ON public.student_packages USING btree (student_id, package_id, is_active);


--
-- Name: student_packages_teacher_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_packages_teacher_active_idx ON public.student_packages USING btree (default_teacher_id, is_active);


--
-- Name: student_packages_teacher_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_packages_teacher_id_idx ON public.student_packages USING btree (default_teacher_id);


--
-- Name: student_packages_unique_active_package; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX student_packages_unique_active_package ON public.student_packages USING btree (student_id, package_id) WHERE (is_active = true);


--
-- Name: students_dashboard_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_dashboard_status_idx ON public.students USING btree (is_active, status);


--
-- Name: students_full_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_full_name_idx ON public.students USING btree (full_name);


--
-- Name: students_retention_review_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_retention_review_idx ON public.students USING btree (retention_review_date) WHERE (is_archived = true);


--
-- Name: students_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_status_created_idx ON public.students USING btree (is_active, is_archived, created_at DESC);


--
-- Name: students_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_status_idx ON public.students USING btree (status);


--
-- Name: teacher_payments_method_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teacher_payments_method_date_idx ON public.teacher_payments USING btree (payment_method, payment_date DESC) WHERE (status <> 'İptal'::text);


--
-- Name: teacher_payments_payment_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teacher_payments_payment_date_idx ON public.teacher_payments USING btree (payment_date);


--
-- Name: teacher_payments_status_date_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teacher_payments_status_date_created_idx ON public.teacher_payments USING btree (status, payment_date DESC, created_at DESC);


--
-- Name: teacher_payments_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teacher_payments_status_idx ON public.teacher_payments USING btree (status);


--
-- Name: teacher_payments_teacher_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teacher_payments_teacher_date_idx ON public.teacher_payments USING btree (teacher_id, payment_date DESC) WHERE (status <> 'İptal'::text);


--
-- Name: teacher_payments_teacher_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teacher_payments_teacher_id_idx ON public.teacher_payments USING btree (teacher_id);


--
-- Name: teacher_payments_teacher_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teacher_payments_teacher_status_idx ON public.teacher_payments USING btree (teacher_id, status, payment_date DESC);


--
-- Name: teacher_specialties_specialty_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teacher_specialties_specialty_id_idx ON public.teacher_specialties USING btree (specialty_id);


--
-- Name: teacher_specialties_teacher_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teacher_specialties_teacher_id_idx ON public.teacher_specialties USING btree (teacher_id);


--
-- Name: teachers_dashboard_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teachers_dashboard_status_idx ON public.teachers USING btree (is_active, status);


--
-- Name: lesson_occurrences lesson_occurrence_earning_snapshot; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lesson_occurrence_earning_snapshot AFTER INSERT OR UPDATE ON public.lesson_occurrences FOR EACH ROW EXECUTE FUNCTION private.lesson_occurrence_earning_snapshot_trigger();


--
-- Name: lesson_occurrences lesson_occurrences_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lesson_occurrences_updated_at_trigger BEFORE UPDATE ON public.lesson_occurrences FOR EACH ROW EXECUTE FUNCTION public.set_lesson_occurrence_updated_at();


--
-- Name: lesson_plans lesson_plan_create_occurrence_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lesson_plan_create_occurrence_trigger AFTER INSERT ON public.lesson_plans FOR EACH ROW EXECUTE FUNCTION public.create_occurrence_from_lesson_plan();


--
-- Name: lesson_plans lesson_plans_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lesson_plans_set_updated_at BEFORE UPDATE ON public.lesson_plans FOR EACH ROW EXECUTE FUNCTION public.set_lesson_plans_updated_at();


--
-- Name: packages packages_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER packages_set_updated_at BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: payments payment_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payment_audit AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION private.payment_audit_trigger();


--
-- Name: profiles profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: expenses set_expenses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: other_incomes set_other_incomes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_other_incomes_updated_at BEFORE UPDATE ON public.other_incomes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: payments set_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: teacher_payments set_teacher_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_teacher_payments_updated_at BEFORE UPDATE ON public.teacher_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_roles set_user_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_user_roles_updated_at BEFORE UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: specialties specialties_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER specialties_set_updated_at BEFORE UPDATE ON public.specialties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: staff_payments staff_payments_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER staff_payments_set_updated_at BEFORE UPDATE ON public.staff_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: student_guardians student_guardians_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER student_guardians_set_updated_at BEFORE UPDATE ON public.student_guardians FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: student_packages student_packages_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER student_packages_set_updated_at BEFORE UPDATE ON public.student_packages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: students students_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER students_set_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: teachers teachers_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER teachers_set_updated_at BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lesson_earning_snapshots lesson_earning_snapshots_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_earning_snapshots
    ADD CONSTRAINT lesson_earning_snapshots_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lesson_occurrences(id) ON DELETE CASCADE;


--
-- Name: lesson_group_students lesson_group_students_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_group_students
    ADD CONSTRAINT lesson_group_students_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.lesson_groups(id) ON DELETE CASCADE;


--
-- Name: lesson_group_students lesson_group_students_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_group_students
    ADD CONSTRAINT lesson_group_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;


--
-- Name: lesson_group_students lesson_group_students_student_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_group_students
    ADD CONSTRAINT lesson_group_students_student_package_id_fkey FOREIGN KEY (student_package_id) REFERENCES public.student_packages(id) ON DELETE RESTRICT;


--
-- Name: lesson_groups lesson_groups_default_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_groups
    ADD CONSTRAINT lesson_groups_default_teacher_id_fkey FOREIGN KEY (default_teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;


--
-- Name: lesson_groups lesson_groups_specialty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_groups
    ADD CONSTRAINT lesson_groups_specialty_id_fkey FOREIGN KEY (specialty_id) REFERENCES public.specialties(id) ON DELETE RESTRICT;


--
-- Name: lesson_occurrences lesson_occurrences_lesson_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_occurrences
    ADD CONSTRAINT lesson_occurrences_lesson_plan_id_fkey FOREIGN KEY (lesson_plan_id) REFERENCES public.lesson_plans(id) ON DELETE SET NULL;


--
-- Name: lesson_occurrences lesson_occurrences_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_occurrences
    ADD CONSTRAINT lesson_occurrences_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE RESTRICT;


--
-- Name: lesson_occurrences lesson_occurrences_related_occurrence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_occurrences
    ADD CONSTRAINT lesson_occurrences_related_occurrence_id_fkey FOREIGN KEY (related_occurrence_id) REFERENCES public.lesson_occurrences(id) ON DELETE SET NULL;


--
-- Name: lesson_occurrences lesson_occurrences_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_occurrences
    ADD CONSTRAINT lesson_occurrences_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;


--
-- Name: lesson_occurrences lesson_occurrences_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_occurrences
    ADD CONSTRAINT lesson_occurrences_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE RESTRICT;


--
-- Name: lesson_plan_students lesson_plan_students_lesson_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plan_students
    ADD CONSTRAINT lesson_plan_students_lesson_plan_id_fkey FOREIGN KEY (lesson_plan_id) REFERENCES public.lesson_plans(id) ON DELETE CASCADE;


--
-- Name: lesson_plan_students lesson_plan_students_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plan_students
    ADD CONSTRAINT lesson_plan_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;


--
-- Name: lesson_plan_students lesson_plan_students_student_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plan_students
    ADD CONSTRAINT lesson_plan_students_student_package_id_fkey FOREIGN KEY (student_package_id) REFERENCES public.student_packages(id) ON DELETE SET NULL;


--
-- Name: lesson_plans lesson_plans_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plans
    ADD CONSTRAINT lesson_plans_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.lesson_groups(id) ON DELETE SET NULL;


--
-- Name: lesson_plans lesson_plans_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plans
    ADD CONSTRAINT lesson_plans_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: lesson_plans lesson_plans_related_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plans
    ADD CONSTRAINT lesson_plans_related_lesson_id_fkey FOREIGN KEY (related_lesson_id) REFERENCES public.lesson_plans(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: lesson_plans lesson_plans_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plans
    ADD CONSTRAINT lesson_plans_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: lesson_plans lesson_plans_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_plans
    ADD CONSTRAINT lesson_plans_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: packages packages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: packages packages_specialty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_specialty_id_fkey FOREIGN KEY (specialty_id) REFERENCES public.specialties(id) ON DELETE RESTRICT;


--
-- Name: payments payments_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE SET NULL;


--
-- Name: payments payments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;


--
-- Name: payments payments_student_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_student_package_id_fkey FOREIGN KEY (student_package_id) REFERENCES public.student_packages(id) ON DELETE RESTRICT;


--
-- Name: payments payments_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: specialties specialties_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialties
    ADD CONSTRAINT specialties_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: student_guardians student_guardians_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_guardians
    ADD CONSTRAINT student_guardians_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: student_packages student_packages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_packages
    ADD CONSTRAINT student_packages_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: student_packages student_packages_default_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_packages
    ADD CONSTRAINT student_packages_default_teacher_id_fkey FOREIGN KEY (default_teacher_id) REFERENCES public.teachers(id) ON DELETE RESTRICT;


--
-- Name: student_packages student_packages_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_packages
    ADD CONSTRAINT student_packages_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE RESTRICT;


--
-- Name: student_packages student_packages_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_packages
    ADD CONSTRAINT student_packages_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;


--
-- Name: students students_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: teacher_payments teacher_payments_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_payments
    ADD CONSTRAINT teacher_payments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE RESTRICT;


--
-- Name: teacher_specialties teacher_specialties_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_specialties
    ADD CONSTRAINT teacher_specialties_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: teacher_specialties teacher_specialties_specialty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_specialties
    ADD CONSTRAINT teacher_specialties_specialty_id_fkey FOREIGN KEY (specialty_id) REFERENCES public.specialties(id) ON DELETE RESTRICT;


--
-- Name: teacher_specialties teacher_specialties_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_specialties
    ADD CONSTRAINT teacher_specialties_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;


--
-- Name: teachers teachers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: lesson_group_students Authenticated users can delete lesson group students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete lesson group students" ON public.lesson_group_students FOR DELETE TO authenticated USING (true);


--
-- Name: lesson_groups Authenticated users can delete lesson groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete lesson groups" ON public.lesson_groups FOR DELETE TO authenticated USING (true);


--
-- Name: lesson_occurrences Authenticated users can delete lesson occurrences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete lesson occurrences" ON public.lesson_occurrences FOR DELETE TO authenticated USING (true);


--
-- Name: lesson_plan_students Authenticated users can delete lesson plan students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete lesson plan students" ON public.lesson_plan_students FOR DELETE TO authenticated USING (true);


--
-- Name: lesson_plans Authenticated users can delete lesson plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete lesson plans" ON public.lesson_plans FOR DELETE TO authenticated USING (true);


--
-- Name: payments Authenticated users can delete payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete payments" ON public.payments FOR DELETE TO authenticated USING (true);


--
-- Name: staff_payments Authenticated users can delete staff payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete staff payments" ON public.staff_payments FOR DELETE TO authenticated USING (true);


--
-- Name: student_guardians Authenticated users can delete student guardians; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete student guardians" ON public.student_guardians FOR DELETE TO authenticated USING (true);


--
-- Name: lesson_group_students Authenticated users can insert lesson group students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert lesson group students" ON public.lesson_group_students FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: lesson_groups Authenticated users can insert lesson groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert lesson groups" ON public.lesson_groups FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: lesson_occurrences Authenticated users can insert lesson occurrences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert lesson occurrences" ON public.lesson_occurrences FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: lesson_plan_students Authenticated users can insert lesson plan students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert lesson plan students" ON public.lesson_plan_students FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: lesson_plans Authenticated users can insert lesson plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert lesson plans" ON public.lesson_plans FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: payments Authenticated users can insert payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: staff_payments Authenticated users can insert staff payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert staff payments" ON public.staff_payments FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: student_guardians Authenticated users can insert student guardians; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert student guardians" ON public.student_guardians FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: expenses Authenticated users can manage expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage expenses" ON public.expenses TO authenticated USING (true) WITH CHECK (true);


--
-- Name: other_incomes Authenticated users can manage other incomes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage other incomes" ON public.other_incomes TO authenticated USING (true) WITH CHECK (true);


--
-- Name: teacher_payments Authenticated users can manage teacher payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can manage teacher payments" ON public.teacher_payments TO authenticated USING (true) WITH CHECK (true);


--
-- Name: lesson_group_students Authenticated users can read lesson group students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read lesson group students" ON public.lesson_group_students FOR SELECT TO authenticated USING (true);


--
-- Name: lesson_groups Authenticated users can read lesson groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read lesson groups" ON public.lesson_groups FOR SELECT TO authenticated USING (true);


--
-- Name: lesson_occurrences Authenticated users can read lesson occurrences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read lesson occurrences" ON public.lesson_occurrences FOR SELECT TO authenticated USING (true);


--
-- Name: lesson_plan_students Authenticated users can read lesson plan students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read lesson plan students" ON public.lesson_plan_students FOR SELECT TO authenticated USING (true);


--
-- Name: lesson_plans Authenticated users can read lesson plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read lesson plans" ON public.lesson_plans FOR SELECT TO authenticated USING (true);


--
-- Name: staff_payments Authenticated users can read staff payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read staff payments" ON public.staff_payments FOR SELECT TO authenticated USING (true);


--
-- Name: student_guardians Authenticated users can read student guardians; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read student guardians" ON public.student_guardians FOR SELECT TO authenticated USING (true);


--
-- Name: lesson_group_students Authenticated users can update lesson group students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update lesson group students" ON public.lesson_group_students FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: lesson_groups Authenticated users can update lesson groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update lesson groups" ON public.lesson_groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: lesson_occurrences Authenticated users can update lesson occurrences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update lesson occurrences" ON public.lesson_occurrences FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: lesson_plan_students Authenticated users can update lesson plan students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update lesson plan students" ON public.lesson_plan_students FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: lesson_plans Authenticated users can update lesson plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update lesson plans" ON public.lesson_plans FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: payments Authenticated users can update payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update payments" ON public.payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: staff_payments Authenticated users can update staff payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update staff payments" ON public.staff_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: student_guardians Authenticated users can update student guardians; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update student guardians" ON public.student_guardians FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: payments Authenticated users can view payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view payments" ON public.payments FOR SELECT TO authenticated USING (true);


--
-- Name: profiles Authenticated users can view profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: packages Authenticated users have full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users have full access" ON public.packages TO authenticated USING (true) WITH CHECK (true);


--
-- Name: specialties Authenticated users have full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users have full access" ON public.specialties TO authenticated USING (true) WITH CHECK (true);


--
-- Name: student_packages Authenticated users have full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users have full access" ON public.student_packages TO authenticated USING (true) WITH CHECK (true);


--
-- Name: students Authenticated users have full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users have full access" ON public.students TO authenticated USING (true) WITH CHECK (true);


--
-- Name: teacher_specialties Authenticated users have full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users have full access" ON public.teacher_specialties TO authenticated USING (true) WITH CHECK (true);


--
-- Name: teachers Authenticated users have full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users have full access" ON public.teachers TO authenticated USING (true) WITH CHECK (true);


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));


--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_earning_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson_earning_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_earning_snapshots lesson_earning_snapshots_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lesson_earning_snapshots_select ON public.lesson_earning_snapshots FOR SELECT TO authenticated USING (true);


--
-- Name: lesson_group_students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson_group_students ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_occurrences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson_occurrences ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_plan_students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson_plan_students ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: other_incomes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.other_incomes ENABLE ROW LEVEL SECURITY;

--
-- Name: packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_audit_log payment_audit_log_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_audit_log_select_admin ON public.payment_audit_log FOR SELECT TO authenticated USING (( SELECT private.is_current_user_admin() AS is_current_user_admin));


--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: specialties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: student_guardians; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;

--
-- Name: student_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

--
-- Name: teacher_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teacher_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: teacher_specialties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teacher_specialties ENABLE ROW LEVEL SECURITY;

--
-- Name: teachers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_select_own_or_admin ON public.user_roles FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_current_user_admin() AS is_current_user_admin)));


--
-- Name: SCHEMA private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA private TO authenticated;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION is_current_user_admin(); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.is_current_user_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_current_user_admin() TO authenticated;


--
-- Name: FUNCTION lesson_occurrence_earning_snapshot_trigger(); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.lesson_occurrence_earning_snapshot_trigger() FROM PUBLIC;


--
-- Name: FUNCTION payment_audit_trigger(); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.payment_audit_trigger() FROM PUBLIC;


--
-- Name: FUNCTION refresh_lesson_earning_snapshot(p_lesson_id uuid); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.refresh_lesson_earning_snapshot(p_lesson_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION cancel_payment(p_payment_id uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancel_payment(p_payment_id uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancel_payment(p_payment_id uuid, p_reason text) TO authenticated;


--
-- Name: FUNCTION create_occurrence_from_lesson_plan(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_occurrence_from_lesson_plan() FROM PUBLIC;


--
-- Name: FUNCTION delete_lesson_plan_safely(p_lesson_plan_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_lesson_plan_safely(p_lesson_plan_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_lesson_plan_safely(p_lesson_plan_id uuid) TO authenticated;


--
-- Name: FUNCTION delete_student_safely(p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_student_safely(p_student_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_student_safely(p_student_id uuid) TO authenticated;


--
-- Name: FUNCTION get_dashboard_lesson_plan_health(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_dashboard_lesson_plan_health() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_dashboard_lesson_plan_health() TO authenticated;


--
-- Name: FUNCTION get_dashboard_receivables(p_today date, p_upcoming_days integer, p_grace_days integer, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_dashboard_receivables(p_today date, p_upcoming_days integer, p_grace_days integer, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_dashboard_receivables(p_today date, p_upcoming_days integer, p_grace_days integer, p_limit integer) TO authenticated;


--
-- Name: FUNCTION get_dashboard_student_package_lesson_usage(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_dashboard_student_package_lesson_usage() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_dashboard_student_package_lesson_usage() TO authenticated;


--
-- Name: FUNCTION get_dashboard_summary(p_today date, p_current_day text, p_upcoming_days integer, p_grace_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_dashboard_summary(p_today date, p_current_day text, p_upcoming_days integer, p_grace_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_dashboard_summary(p_today date, p_current_day text, p_upcoming_days integer, p_grace_days integer) TO authenticated;


--
-- Name: FUNCTION get_finance_expense_summary(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_finance_expense_summary() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_finance_expense_summary() TO authenticated;


--
-- Name: FUNCTION get_finance_income_summary(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_finance_income_summary() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_finance_income_summary() TO authenticated;


--
-- Name: FUNCTION get_open_student_settlements(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_open_student_settlements() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_open_student_settlements() TO authenticated;


--
-- Name: FUNCTION get_panel_admin_context(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_panel_admin_context() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_panel_admin_context() TO authenticated;


--
-- Name: FUNCTION get_student_settlement_preview(p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_student_settlement_preview(p_student_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_student_settlement_preview(p_student_id uuid) TO authenticated;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO supabase_auth_admin;


--
-- Name: FUNCTION resolve_student_settlement(p_student_package_id uuid, p_resolution text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolve_student_settlement(p_student_package_id uuid, p_resolution text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolve_student_settlement(p_student_package_id uuid, p_resolution text) TO authenticated;


--
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;


--
-- Name: FUNCTION set_lesson_occurrence_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_lesson_occurrence_updated_at() FROM PUBLIC;


--
-- Name: FUNCTION set_lesson_plans_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_lesson_plans_updated_at() FROM PUBLIC;


--
-- Name: FUNCTION set_panel_user_role_safely(p_user_id uuid, p_role text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_panel_user_role_safely(p_user_id uuid, p_role text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_panel_user_role_safely(p_user_id uuid, p_role text) TO authenticated;


--
-- Name: FUNCTION set_student_passive_safely(p_student_id uuid, p_passive_reason text, p_passive_date date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_student_passive_safely(p_student_id uuid, p_passive_reason text, p_passive_date date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_student_passive_safely(p_student_id uuid, p_passive_reason text, p_passive_date date) TO authenticated;


--
-- Name: FUNCTION set_student_passive_with_settlement(p_student_id uuid, p_passive_reason text, p_passive_date date, p_settlements jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_student_passive_with_settlement(p_student_id uuid, p_passive_reason text, p_passive_date date, p_settlements jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_student_passive_with_settlement(p_student_id uuid, p_passive_reason text, p_passive_date date, p_settlements jsonb) TO authenticated;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;


--
-- Name: FUNCTION settle_student_packages(p_student_id uuid, p_settlements jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.settle_student_packages(p_student_id uuid, p_settlements jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.settle_student_packages(p_student_id uuid, p_settlements jsonb) TO authenticated;


--
-- Name: TABLE expenses; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.expenses TO anon;
GRANT ALL ON TABLE public.expenses TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.expenses TO service_role;


--
-- Name: TABLE other_incomes; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.other_incomes TO anon;
GRANT ALL ON TABLE public.other_incomes TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.other_incomes TO service_role;


--
-- Name: TABLE packages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.packages TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.packages TO service_role;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.payments TO anon;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.payments TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.payments TO service_role;


--
-- Name: TABLE students; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.students TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.students TO service_role;


--
-- Name: TABLE finance_income_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.finance_income_view TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.finance_income_view TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.finance_income_view TO service_role;


--
-- Name: TABLE staff_payments; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.staff_payments TO anon;
GRANT ALL ON TABLE public.staff_payments TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.staff_payments TO service_role;


--
-- Name: TABLE teacher_payments; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_payments TO anon;
GRANT ALL ON TABLE public.teacher_payments TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_payments TO service_role;


--
-- Name: TABLE teachers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.teachers TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teachers TO service_role;


--
-- Name: TABLE teacher_payment_history_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_payment_history_view TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_payment_history_view TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_payment_history_view TO service_role;


--
-- Name: TABLE finance_income_expense_report_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.finance_income_expense_report_view TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.finance_income_expense_report_view TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.finance_income_expense_report_view TO service_role;


--
-- Name: TABLE lesson_earning_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.lesson_earning_snapshots TO service_role;
GRANT SELECT ON TABLE public.lesson_earning_snapshots TO authenticated;


--
-- Name: TABLE lesson_group_students; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.lesson_group_students TO anon;
GRANT ALL ON TABLE public.lesson_group_students TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.lesson_group_students TO service_role;


--
-- Name: TABLE lesson_groups; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.lesson_groups TO anon;
GRANT ALL ON TABLE public.lesson_groups TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.lesson_groups TO service_role;


--
-- Name: TABLE lesson_occurrences; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.lesson_occurrences TO anon;
GRANT ALL ON TABLE public.lesson_occurrences TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.lesson_occurrences TO service_role;


--
-- Name: TABLE lesson_plan_students; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.lesson_plan_students TO anon;
GRANT ALL ON TABLE public.lesson_plan_students TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.lesson_plan_students TO service_role;


--
-- Name: TABLE lesson_plans; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.lesson_plans TO anon;
GRANT ALL ON TABLE public.lesson_plans TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.lesson_plans TO service_role;


--
-- Name: TABLE payment_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.payment_audit_log TO service_role;
GRANT SELECT ON TABLE public.payment_audit_log TO authenticated;


--
-- Name: TABLE specialties; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.specialties TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.specialties TO service_role;


--
-- Name: TABLE student_packages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.student_packages TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.student_packages TO service_role;


--
-- Name: TABLE payment_movements_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.payment_movements_view TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.payment_movements_view TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.payment_movements_view TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.profiles TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO service_role;


--
-- Name: TABLE student_guardians; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.student_guardians TO anon;
GRANT ALL ON TABLE public.student_guardians TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.student_guardians TO service_role;


--
-- Name: TABLE student_list_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.student_list_view TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.student_list_view TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.student_list_view TO service_role;


--
-- Name: TABLE student_payment_report_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.student_payment_report_view TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.student_payment_report_view TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.student_payment_report_view TO service_role;


--
-- Name: TABLE student_tracking_report_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.student_tracking_report_view TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.student_tracking_report_view TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.student_tracking_report_view TO service_role;


--
-- Name: TABLE teacher_earning_lessons_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_earning_lessons_view TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_earning_lessons_view TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_earning_lessons_view TO service_role;


--
-- Name: TABLE teacher_specialties; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.teacher_specialties TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_specialties TO service_role;


--
-- Name: TABLE teacher_earnings_summary_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_earnings_summary_view TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_earnings_summary_view TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_earnings_summary_view TO service_role;


--
-- Name: TABLE teacher_tracking_detail_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_tracking_detail_view TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_tracking_detail_view TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_tracking_detail_view TO service_role;


--
-- Name: TABLE teacher_tracking_report_view; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_tracking_report_view TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_tracking_report_view TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.teacher_tracking_report_view TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO service_role;
GRANT SELECT ON TABLE public.user_roles TO authenticated;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict 5DocaWzODCx47YRTv8hr2czGDdLDggHQbNrbfdmIaNfo20CyI4VBa1VFyxW0dGx

