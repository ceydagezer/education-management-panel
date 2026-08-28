begin;

-- ============================================================
-- 1) Korumalı kullanıcı rol tablosu
--    Business tablolarındaki mevcut authenticated erişimi değişmez.
--    Bu tablo yalnızca kullanıcı yönetimi yetkisini ayırır.
-- ============================================================

create table if not exists public.user_roles (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  role text not null
    default 'staff'
    check (role in ('admin', 'staff')),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

alter table public.user_roles
enable row level security;

-- Browser tarafında rol yazma yetkisi yok.
revoke all on table public.user_roles
from anon, authenticated;

grant select on table public.user_roles
to authenticated;

-- Güvenilir server/Edge Function işlemleri için.
grant select, insert, update, delete
on table public.user_roles
to service_role;


-- ============================================================
-- 2) RLS içinde rol kontrolü için private helper
--    SECURITY DEFINER exposed public şemaya konulmaz.
-- ============================================================

create schema if not exists private;

revoke all on schema private
from public;

grant usage on schema private
to authenticated;

create or replace function private.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.user_roles ur
    where
      ur.user_id = (select auth.uid())
      and ur.role = 'admin'
  );
$function$;

revoke all
on function private.is_current_user_admin()
from public, anon;

grant execute
on function private.is_current_user_admin()
to authenticated;


-- ============================================================
-- 3) Rol okuma politikası
--    staff: yalnız kendi rolünü görür
--    admin: bütün rol satırlarını görür
-- ============================================================

drop policy if exists
  "user_roles_select_own_or_admin"
on public.user_roles;

create policy
  "user_roles_select_own_or_admin"
on public.user_roles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or
  (select private.is_current_user_admin())
);


-- ============================================================
-- 4) updated_at trigger
-- ============================================================

drop trigger if exists
  set_user_roles_updated_at
on public.user_roles;

create trigger
  set_user_roles_updated_at
before update
on public.user_roles
for each row
execute function public.set_updated_at();


-- ============================================================
-- 5) Mevcut auth kullanıcılarını staff olarak backfill et.
--    Var olan roller yeniden çalıştırıldığında ezilmez.
-- ============================================================

insert into public.user_roles (
  user_id,
  role
)
select
  au.id,
  'staff'
from auth.users au
on conflict (user_id)
do nothing;


-- ============================================================
-- 6) İlk admin hesabı
-- ============================================================

insert into public.user_roles (
  user_id,
  role
)
values (
  'cf2a9b17-499a-4370-995b-11ba06479705',
  'admin'
)
on conflict (user_id)
do update
set
  role = 'admin',
  updated_at = now();


-- ============================================================
-- 7) Yeni Auth kullanıcısı oluşunca:
--    - profiles kaydı oluştur/güncelle
--    - varsayılan rolü staff olarak oluştur
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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
$function$;

-- Trigger function doğrudan browser RPC'i olarak çağrılamaz.
revoke all
on function public.handle_new_user()
from public, anon, authenticated;

grant execute
on function public.handle_new_user()
to supabase_auth_admin;


-- ============================================================
-- 8) Açıklamalar
-- ============================================================

comment on table public.user_roles is
'Kullanıcı yönetimi rolü. admin kullanıcı yönetebilir; staff dahil tüm authenticated kullanıcıların business modül erişimi mevcut RLS politikalarıyla aynıdır.';

comment on function private.is_current_user_admin() is
'Giriş yapan kullanıcının user_roles kaydında admin olup olmadığını RLS için güvenli biçimde kontrol eder.';

commit;