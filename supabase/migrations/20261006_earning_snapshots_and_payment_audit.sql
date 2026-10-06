-- 2026-10-06
-- 1) Hakediş geçmişe dönük değişmesin (ders anındaki ücret ve yüzde sabitlenir)
-- 2) Paket ücreti / ders sayısı değişince geçmiş dersler yeniden fiyatlanmasın
-- 3) Aylık üst sınır: bir öğrenci paketinde ayda en fazla "paketteki ders
--    sayısı" kadar ders hakedişe girer
-- 6) Tahsilatlar kalıcı silinemez; iptal edilir ve her değişiklik loglanır
--
-- 20261005_backdated_group_lesson_participants.sql dosyasından SONRA çalıştırın.
--
-- ÖNEMLİ: Mevcut "Yapıldı" dersler bu migration çalıştığı andaki ücret ve
-- yüzdeyle sabitlenir. Bundan sonra öğretmen yüzdesi, anlaşma ücreti veya
-- paket ders sayısı değişirse yalnız yeni işaretlenen dersler etkilenir.

begin;

-- ============================================================
-- A) DERS HAKEDİŞ ANLIK GÖRÜNTÜSÜ (snapshot)
-- ============================================================

create table if not exists public.lesson_earning_snapshots (
  id uuid primary key default gen_random_uuid(),

  lesson_id uuid not null
    references public.lesson_occurrences(id)
    on delete cascade,

  -- Grup dersinde lesson_plan_students.id; bireysel derste null
  participant_id uuid,

  student_id uuid not null,
  student_package_id uuid,
  package_id uuid,

  agreed_price numeric not null default 0,
  lesson_count integer not null default 1,
  unit_price numeric not null default 0,
  commission_rate numeric not null default 0,

  created_at timestamptz not null default now()
);

create unique index if not exists lesson_earning_snapshots_lesson_participant_key
  on public.lesson_earning_snapshots (
    lesson_id,
    coalesce(participant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists lesson_earning_snapshots_package_idx
  on public.lesson_earning_snapshots (student_package_id);

alter table public.lesson_earning_snapshots
  enable row level security;

revoke all on table public.lesson_earning_snapshots
  from anon, authenticated;

grant select on table public.lesson_earning_snapshots
  to authenticated;

drop policy if exists "lesson_earning_snapshots_select"
  on public.lesson_earning_snapshots;

create policy "lesson_earning_snapshots_select"
  on public.lesson_earning_snapshots
  for select
  to authenticated
  using (true);

/*
 * Bir dersin hakediş satırlarını o anki ücret ve yüzdeyle yeniden yazar.
 * Ders yapılmadıysa (veya pasifse) satırlar silinir.
 * Katılımcı kuralları 20261005 migration'ıyla aynıdır.
 */
create or replace function private.refresh_lesson_earning_snapshot(
  p_lesson_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
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
$function$;

revoke all on function private.refresh_lesson_earning_snapshot(uuid)
  from public, anon, authenticated;

/*
 * Ders yapıldı/yapılmadı durumuna geçince veya dersin kendisi
 * (öğretmen, öğrenci, paket, tarih) değişince snapshot yenilenir.
 * Yalnız "Yapıldı" -> "Telafi yapıldı" gibi tamamlanmış durumlar
 * arası geçişte ücret yeniden hesaplanmaz.
 */
create or replace function private.lesson_occurrence_earning_snapshot_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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
$function$;

revoke all on function private.lesson_occurrence_earning_snapshot_trigger()
  from public, anon, authenticated;

drop trigger if exists lesson_occurrence_earning_snapshot
  on public.lesson_occurrences;

create trigger lesson_occurrence_earning_snapshot
  after insert or update
  on public.lesson_occurrences
  for each row
  execute function private.lesson_occurrence_earning_snapshot_trigger();

-- Mevcut yapılmış dersler bugünkü değerlerle sabitlenir.
do $backfill$
declare
  v_lesson_id uuid;
begin
  for v_lesson_id in
    select lo.id
    from public.lesson_occurrences lo
    where
      lo.is_active = true
      and lo.status in ('Yapıldı', 'Telafi yapıldı')
  loop
    perform private.refresh_lesson_earning_snapshot(v_lesson_id);
  end loop;
end;
$backfill$;

/*
 * Hakediş görünümü artık snapshot'tan okunur.
 * Kolonlar aynı sırada korunur; yeni kolonlar sona eklenir.
 *
 * Aylık üst sınır: aynı öğrenci paketi için takvim ayı içinde tarih/saat
 * sırasıyla ilk "paket ders sayısı" kadar ders hakedişe girer. Fazlası
 * listede görünür (is_over_package_limit = true) ama ücret eklemez.
 * Önceki bir ders iptal edilirse sıradaki ders otomatik olarak sınır
 * içine girer.
 */
create or replace view public.teacher_earning_lessons_view as
with snap as (
  select
    les.*,
    lo.teacher_id,
    lo.day,
    lo.start_time,
    lo.status,
    lo.created_at as lesson_created_at,
    lo.updated_at as lesson_updated_at,
    lo.lesson_date,
    lp.group_id,
    lp.group_name,
    row_number() over (
      partition by
        coalesce(
          les.student_package_id::text,
          les.student_id::text || ':' || coalesce(les.package_id::text, '')
        ),
        date_trunc('month', lo.lesson_date)
      order by
        lo.lesson_date,
        lo.start_time,
        lo.created_at,
        les.lesson_id
    ) as month_sequence
  from public.lesson_earning_snapshots les
  join public.lesson_occurrences lo
    on lo.id = les.lesson_id
  left join public.lesson_plans lp
    on lp.id = lo.lesson_plan_id
  where
    lo.is_active = true
    and lo.status = any (array['Yapıldı'::text, 'Telafi yapıldı'::text])
),

limited as (
  select
    snap.*,
    (
      snap.lesson_date is not null
      and snap.month_sequence > snap.lesson_count
    ) as is_over_limit
  from snap
)

select
  l.lesson_id,
  l.teacher_id,
  t.full_name as teacher_name,
  l.student_id,
  s.full_name as student_name,
  l.student_package_id,
  l.package_id,
  p.name as package_name,
  coalesce(spec.name, ''::text) as instrument,
  l.day,
  l.start_time,
  l.status,
  l.agreed_price,
  l.lesson_count,
  case
    when l.is_over_limit then 0::numeric
    else l.unit_price
  end as unit_price,
  l.commission_rate,
  case
    when l.is_over_limit then 0::numeric
    else l.unit_price * (l.commission_rate / 100::numeric)
  end as teacher_earning,
  l.lesson_created_at as created_at,
  l.lesson_updated_at as updated_at,
  l.lesson_date,
  l.group_id,
  l.group_name,
  case
    when l.participant_id is null then l.lesson_id::text
    else l.lesson_id::text || ':' || l.participant_id::text
  end as earning_row_id,
  l.is_over_limit as is_over_package_limit,
  l.unit_price as full_unit_price
from limited l
join public.teachers t
  on t.id = l.teacher_id
join public.students s
  on s.id = l.student_id
left join public.packages p
  on p.id = l.package_id
left join public.specialties spec
  on spec.id = p.specialty_id;


-- ============================================================
-- B) TAHSİLAT: KALICI SİLME YOK, İPTAL + DEĞİŞİKLİK LOGU
-- ============================================================

/*
 * Güvenlik kontrolü: tahsilat toplayan bir view iptal edilen
 * (is_active = false) kayıtları da sayıyorsa iptal edilen tahsilat
 * rakamlara karışır. Böyle bir view varsa migration durur.
 */
do $check$
declare
  v_views text;
begin
  select string_agg(v.viewname, ', ')
  into v_views
  from pg_views v
  where
    v.schemaname = 'public'
    and v.definition ~* '\mpayments\M'
    and v.definition !~* 'is_active';

  if v_views is not null then
    raise exception
      'Şu view(lar) tahsilatları is_active filtresi olmadan okuyor: %. Bu mesajı geliştiriciye iletin; migration uygulanmadı.',
      v_views;
  end if;
end;
$check$;

alter table public.payments
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancel_reason text;

create table if not exists public.payment_audit_log (
  id bigint generated always as identity primary key,
  payment_id uuid not null,
  action text not null
    check (action in ('insert', 'update', 'cancel', 'delete')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index if not exists payment_audit_log_payment_idx
  on public.payment_audit_log (payment_id, changed_at desc);

alter table public.payment_audit_log
  enable row level security;

revoke all on table public.payment_audit_log
  from anon, authenticated;

grant select on table public.payment_audit_log
  to authenticated;

drop policy if exists "payment_audit_log_select_admin"
  on public.payment_audit_log;

-- Log yalnız admin tarafından okunur; kimse elle yazamaz/silemez.
create policy "payment_audit_log_select_admin"
  on public.payment_audit_log
  for select
  to authenticated
  using ((select private.is_current_user_admin()));

create or replace function private.payment_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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
$function$;

revoke all on function private.payment_audit_trigger()
  from public, anon, authenticated;

drop trigger if exists payment_audit
  on public.payments;

create trigger payment_audit
  after insert or update or delete
  on public.payments
  for each row
  execute function private.payment_audit_trigger();

-- Tarayıcıdan tahsilat kalıcı olarak silinemez (yalnız iptal).
revoke delete on table public.payments
  from anon, authenticated;

/*
 * Tahsilat iptali: kaydı silmez, pasife alır; kim/ne zaman/neden
 * bilgisi tutulur.
 */
create or replace function public.cancel_payment(
  p_payment_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
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
$function$;

revoke all on function public.cancel_payment(uuid, text)
  from public, anon;

grant execute on function public.cancel_payment(uuid, text)
  to authenticated;

commit;
