-- 2026-10-03
-- Ayrılan öğrenci için paket hesap kapatma (alacak / iade takibi)
--
-- Canlı sürümü etkilemez: yalnız yeni sütun ve fonksiyon ekler,
-- delete_student_safely fonksiyonunu ek kontrollerle günceller.
-- 20261003_simplify_student_lifecycle_delete.sql dosyasından SONRA çalıştırın.
--
-- Mantık:
-- * Öğrenci pasife alınırken (veya pasif öğrencinin hesabı kapatılırken)
--   açık paketleri "Sonlandırıldı" yapılır; aylık ödeme takvimi durur.
-- * Her paket için "alınması gereken toplam" (settlement_amount) kaydedilir.
--   Sistem yapılan ders × ders ücreti olarak önerir, kullanıcı düzeltebilir.
-- * Bakiye = settlement_amount − paket için alınan tahsilatlar.
--   > 0 ise öğrenciden alacak, < 0 ise öğrenciye iade.
-- * Öğretmen hakedişi zaten yalnız yapılan derslerden hesaplandığı için
--   yapılmayan dersler hakedişe hiç girmez.

begin;

alter table public.student_packages
  add column if not exists settlement_amount numeric(12, 2),
  add column if not exists settled_at date,
  add column if not exists settlement_note text,
  add column if not exists settlement_resolved_at date,
  add column if not exists settlement_resolution text;

comment on column public.student_packages.settlement_amount is
'Öğrenci ayrılırken bu paket için alınması gereken toplam tutar. Bakiye = bu tutar − paket tahsilatları.';

/*
 * Hesap kapatma önizlemesi: öğrencinin açık paketleri için
 * yapılan ders, ödenen tutar ve önerilen toplam.
 */
drop function if exists public.get_student_settlement_preview(uuid);

create function public.get_student_settlement_preview(
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
      sp.package_id,
      pk.name as package_name,
      t.full_name as teacher_name,
      coalesce(sp.agreed_price, 0)::numeric as agreed_price,
      pk.lesson_count::integer as package_lesson_count,
      coalesce(sp.total_lesson_count, pk.lesson_count)::integer
        as total_lesson_count,
      round(
        coalesce(
          sp.agreed_price / nullif(pk.lesson_count, 0),
          pk.unit_price,
          0
        )::numeric,
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
    round(coalesce(done.lesson_count, 0) * pr.unit_price, 2)
  from package_rows pr
  left join lateral (
    select count(*) as lesson_count
    from public.lesson_occurrences lo
    where
      lo.student_id = p_student_id
      and lo.package_id = pr.package_id
      and lo.is_active = true
      and lo.status in (
        'Yapıldı',
        'Telafi yapıldı',
        'Telafi Yapıldı'
      )
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
 * Açık paketleri kapatır ve hesap tutarlarını kaydeder.
 * p_settlements: [{"student_package_id": "...", "amount": 2500, "note": "..."}]
 * Öğrencinin TÜM açık paketleri listede olmalıdır.
 */
drop function if exists public.settle_student_packages(uuid, jsonb);

create function public.settle_student_packages(
  p_student_id uuid,
  p_settlements jsonb
)
returns integer
language plpgsql
set search_path = ''
as $function$
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
$function$;

/*
 * Pasife alma + hesap kapatma tek işlemde.
 */
drop function if exists public.set_student_passive_with_settlement(uuid, text, date, jsonb);

create function public.set_student_passive_with_settlement(
  p_student_id uuid,
  p_passive_reason text,
  p_passive_date date,
  p_settlements jsonb
)
returns integer
language plpgsql
set search_path = ''
as $function$
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
$function$;

/*
 * Açık alacak / iade listesi.
 */
drop function if exists public.get_open_student_settlements();

create function public.get_open_student_settlements()
returns table(
  student_package_id uuid,
  student_id uuid,
  student_name text,
  package_id uuid,
  package_name text,
  teacher_id uuid,
  settlement_amount numeric,
  paid_amount numeric,
  balance numeric,
  settled_at date,
  settlement_note text
)
language sql
stable
set search_path = ''
as $function$
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
$function$;

/*
 * Alacaktan vazgeçme veya iadenin yapıldığını işaretleme.
 */
drop function if exists public.resolve_student_settlement(uuid, text);

create function public.resolve_student_settlement(
  p_student_package_id uuid,
  p_resolution text
)
returns void
language plpgsql
set search_path = ''
as $function$
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
$function$;

/*
 * Silme: açık paket veya kapanmamış alacak/iade varsa engellenir.
 */
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

  if exists (
    select 1
    from public.get_open_student_settlements() os
    where os.student_id = p_student_id
  ) then
    raise exception
      'Öğrencinin kapanmamış alacak veya iade kaydı var. Tahsilatlar sayfasındaki "Ayrılan Öğrenci Hesapları" bölümünden kapatınız.'
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

revoke all on function public.get_student_settlement_preview(uuid) from public, anon;
revoke all on function public.settle_student_packages(uuid, jsonb) from public, anon;
revoke all on function public.set_student_passive_with_settlement(uuid, text, date, jsonb) from public, anon;
revoke all on function public.get_open_student_settlements() from public, anon;
revoke all on function public.resolve_student_settlement(uuid, text) from public, anon;
revoke all on function public.delete_student_safely(uuid) from public, anon;

grant execute on function public.get_student_settlement_preview(uuid) to authenticated;
grant execute on function public.settle_student_packages(uuid, jsonb) to authenticated;
grant execute on function public.set_student_passive_with_settlement(uuid, text, date, jsonb) to authenticated;
grant execute on function public.get_open_student_settlements() to authenticated;
grant execute on function public.resolve_student_settlement(uuid, text) to authenticated;
grant execute on function public.delete_student_safely(uuid) to authenticated;

commit;
