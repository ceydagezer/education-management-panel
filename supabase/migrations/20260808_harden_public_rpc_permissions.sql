-- 2026-08-08
-- Public RPC execution hardening.
-- Removes anonymous/PUBLIC execution from app-facing RPCs while preserving
-- authenticated access required by the current application.
--
-- NOTE:
-- The destructive RPCs remain executable by authenticated users for now
-- so the current app does not break. When admin/staff roles are added,
-- restrict those functions further according to the final authorization model.

-- Destructive / lifecycle RPCs
revoke execute on function public.delete_lesson_plan_safely(uuid)
from public, anon;

grant execute on function public.delete_lesson_plan_safely(uuid)
to authenticated;

revoke execute on function public.delete_student_permanently_safely(uuid)
from public, anon;

grant execute on function public.delete_student_permanently_safely(uuid)
to authenticated;

revoke execute on function public.set_student_passive_safely(uuid, text, date)
from public, anon;

grant execute on function public.set_student_passive_safely(uuid, text, date)
to authenticated;

-- Dashboard / finance read RPCs
revoke execute on function public.get_dashboard_receivables(date, integer, integer, integer)
from public, anon;

grant execute on function public.get_dashboard_receivables(date, integer, integer, integer)
to authenticated;

revoke execute on function public.get_dashboard_summary(date, text, integer, integer)
from public, anon;

grant execute on function public.get_dashboard_summary(date, text, integer, integer)
to authenticated;

revoke execute on function public.get_finance_expense_summary()
from public, anon;

grant execute on function public.get_finance_expense_summary()
to authenticated;

revoke execute on function public.get_finance_income_summary()
from public, anon;

grant execute on function public.get_finance_income_summary()
to authenticated;

-- Safer default for future functions created by the current migration owner.
-- New functions will not automatically be executable by every role.
alter default privileges in schema public
revoke execute on functions from public;