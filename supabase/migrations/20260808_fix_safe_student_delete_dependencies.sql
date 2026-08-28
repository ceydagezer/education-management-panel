begin;

drop function if exists public.delete_student_permanently_safely(uuid);

create function public.delete_student_permanently_safely(
  p_student_id uuid
)
returns table(
  deleted boolean,
  package_count bigint,
  payment_count bigint,
  lesson_plan_count bigint,
  lesson_occurrence_count bigint,
  lesson_plan_student_count bigint,
  lesson_group_student_count bigint
)
language plpgsql
set search_path = ''
as $function$
declare
  v_package_count bigint := 0;
  v_payment_count bigint := 0;
  v_lesson_plan_count bigint := 0;
  v_lesson_occurrence_count bigint := 0;
  v_lesson_plan_student_count bigint := 0;
  v_lesson_group_student_count bigint := 0;
begin
  if not exists (
    select 1
    from public.students s
    where s.id = p_student_id
  ) then
    raise exception
      'Öğrenci bulunamadı.'
      using errcode = 'P0002';
  end if;

  select count(*)
  into v_package_count
  from public.student_packages sp
  where sp.student_id = p_student_id;

  select count(*)
  into v_payment_count
  from public.payments p
  where p.student_id = p_student_id;

  select count(*)
  into v_lesson_plan_count
  from public.lesson_plans lp
  where lp.student_id = p_student_id;

  select count(*)
  into v_lesson_occurrence_count
  from public.lesson_occurrences lo
  where lo.student_id = p_student_id;

  select count(*)
  into v_lesson_plan_student_count
  from public.lesson_plan_students lps
  where lps.student_id = p_student_id;

  select count(*)
  into v_lesson_group_student_count
  from public.lesson_group_students lgs
  where lgs.student_id = p_student_id;

  if
    v_package_count > 0 or
    v_payment_count > 0 or
    v_lesson_plan_count > 0 or
    v_lesson_occurrence_count > 0 or
    v_lesson_plan_student_count > 0 or
    v_lesson_group_student_count > 0
  then
    return query
    select
      false,
      v_package_count,
      v_payment_count,
      v_lesson_plan_count,
      v_lesson_occurrence_count,
      v_lesson_plan_student_count,
      v_lesson_group_student_count;

    return;
  end if;

  delete from public.students s
  where s.id = p_student_id;

  return query
  select
    true,
    v_package_count,
    v_payment_count,
    v_lesson_plan_count,
    v_lesson_occurrence_count,
    v_lesson_plan_student_count,
    v_lesson_group_student_count;
end;
$function$;

revoke all on function public.delete_student_permanently_safely(uuid) from public;
revoke all on function public.delete_student_permanently_safely(uuid) from anon;
grant execute on function public.delete_student_permanently_safely(uuid) to authenticated;

comment on function public.delete_student_permanently_safely(uuid) is
'Öğrenciyi yalnızca bağlı iş verisi yoksa kalıcı siler. Paket, tahsilat, ders planı, ders geçmişi, grup dersi katılımcısı ve ders grubu üyeliği bağlantılarını kontrol eder. student_guardians ON DELETE CASCADE ile temizlenir.';

commit;