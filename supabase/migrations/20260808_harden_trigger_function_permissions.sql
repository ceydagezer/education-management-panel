-- 2026-08-08
-- Trigger / event-trigger helper function permission hardening.
-- These functions are invoked by PostgreSQL triggers/event triggers and are
-- not intended to be callable directly from the Data API.

revoke execute on function public.create_occurrence_from_lesson_plan()
from public, anon, authenticated;

revoke execute on function public.set_lesson_occurrence_updated_at()
from public, anon, authenticated;

revoke execute on function public.set_lesson_plans_updated_at()
from public, anon, authenticated;

revoke execute on function public.set_updated_at()
from public, anon, authenticated;

revoke execute on function public.handle_new_user()
from public, anon, authenticated;

revoke execute on function public.rls_auto_enable()
from public, anon, authenticated;

-- Keep the auth-internal role explicitly able to reference the new-user
-- handler if needed by Supabase Auth/infrastructure.
grant execute on function public.handle_new_user()
to supabase_auth_admin;