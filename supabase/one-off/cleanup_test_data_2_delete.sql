-- TEST VERİSİ TEMİZLİĞİ — 2. ADIM: KALICI SİLME
--
-- ÖNCE 1. adımı (cleanup_test_data_1_preview.sql) çalıştırıp listeyi
-- kontrol edin. Bu betik GERİ ALINAMAZ.
--
-- Güvenlik: Test kayıtları gerçek bir kayda bağlıysa (ör. Deneme
-- öğretmeninin gerçek öğrenciyle dersi, gerçek öğretmenin Deneme
-- öğrencisiyle dersi, Deneme öğrencisinin gerçek paketi) betik hata
-- verip durur ve HİÇBİR ŞEY silinmez.
--
-- Tahsilat silmeleri payment_audit_log tablosuna "delete" olarak
-- yazılır; bu kayıt temizliğin izi olarak bırakılır.

begin;

create temp table tmp_test_specialties on commit drop as
select id from public.specialties
where lower(btrim(name)) = 'deneme';

create temp table tmp_test_packages on commit drop as
select id from public.packages
where specialty_id in (select id from tmp_test_specialties)
   or lower(btrim(name)) like 'deneme%';

create temp table tmp_test_groups on commit drop as
select id from public.lesson_groups
where specialty_id in (select id from tmp_test_specialties)
   or lower(btrim(name)) like 'deneme%';

create temp table tmp_test_teachers on commit drop as
select id from public.teachers
where lower(btrim(full_name)) in ('deneme1', 'deneme2');

create temp table tmp_test_students on commit drop as
select student_id as id from public.student_packages
where package_id in (select id from tmp_test_packages)
union
select student_id from public.lesson_group_students
where group_id in (select id from tmp_test_groups)
union
select id from public.students
where lower(btrim(full_name)) like 'deneme%';

create temp table tmp_test_plans on commit drop as
select id from public.lesson_plans lp
where lp.teacher_id in (select id from tmp_test_teachers)
   or lp.student_id in (select id from tmp_test_students)
   or lp.package_id in (select id from tmp_test_packages)
   or lp.group_id in (select id from tmp_test_groups);

create temp table tmp_test_occurrences on commit drop as
select id from public.lesson_occurrences lo
where lo.teacher_id in (select id from tmp_test_teachers)
   or lo.student_id in (select id from tmp_test_students)
   or lo.package_id in (select id from tmp_test_packages)
   or lo.lesson_plan_id in (select id from tmp_test_plans);

/*
 * GÜVENLİK KONTROLLERİ
 */
do $checks$
declare
  v_count bigint;
begin
  -- Deneme öğrencisinin Deneme olmayan bir paketi var mı?
  select count(*) into v_count
  from public.student_packages sp
  where sp.student_id in (select id from tmp_test_students)
    and sp.package_id not in (select id from tmp_test_packages);

  if v_count > 0 then
    raise exception
      'DURDURULDU: Test öğrencilerinden birinin gerçek (Deneme olmayan) % paketi var. Hiçbir şey silinmedi.',
      v_count;
  end if;

  -- Silinecek ders planlarında gerçek öğretmen var mı?
  select count(*) into v_count
  from public.lesson_plans lp
  where lp.id in (select id from tmp_test_plans)
    and lp.teacher_id not in (select id from tmp_test_teachers);

  if v_count > 0 then
    raise exception
      'DURDURULDU: Silinecek % ders planı gerçek bir öğretmene ait. Hiçbir şey silinmedi.',
      v_count;
  end if;

  -- Silinecek derslerde gerçek öğretmen veya gerçek öğrenci var mı?
  select count(*) into v_count
  from public.lesson_occurrences lo
  where lo.id in (select id from tmp_test_occurrences)
    and (
      lo.teacher_id not in (select id from tmp_test_teachers)
      or (
        lo.student_id is not null
        and lo.student_id not in (select id from tmp_test_students)
      )
    );

  if v_count > 0 then
    raise exception
      'DURDURULDU: Silinecek % ders kaydı gerçek bir öğretmen veya öğrenciyle ilişkili. Hiçbir şey silinmedi.',
      v_count;
  end if;

  -- Silinecek grup derslerinde gerçek öğrenci var mı?
  select count(*) into v_count
  from public.lesson_plan_students lps
  where lps.lesson_plan_id in (select id from tmp_test_plans)
    and lps.student_id not in (select id from tmp_test_students);

  select v_count + count(*) into v_count
  from public.lesson_group_students lgs
  where lgs.group_id in (select id from tmp_test_groups)
    and lgs.student_id not in (select id from tmp_test_students);

  if v_count > 0 then
    raise exception
      'DURDURULDU: Test gruplarında/derslerinde % gerçek öğrenci kaydı var. Hiçbir şey silinmedi.',
      v_count;
  end if;

  -- Deneme öğretmeninin gerçek öğrenciye atanmış paketi var mı?
  select count(*) into v_count
  from public.student_packages sp
  where sp.default_teacher_id in (select id from tmp_test_teachers)
    and sp.student_id not in (select id from tmp_test_students);

  if v_count > 0 then
    raise exception
      'DURDURULDU: Deneme öğretmenleri % gerçek öğrenci paketinde atanmış. Hiçbir şey silinmedi.',
      v_count;
  end if;

  -- Gerçek bir öğretmende Deneme branşı tanımlı mı?
  select count(*) into v_count
  from public.teacher_specialties ts
  where ts.specialty_id in (select id from tmp_test_specialties)
    and ts.teacher_id not in (select id from tmp_test_teachers);

  if v_count > 0 then
    raise exception
      'DURDURULDU: % gerçek öğretmende Deneme branşı tanımlı. Önce o öğretmenden bu branşı kaldırın. Hiçbir şey silinmedi.',
      v_count;
  end if;
end;
$checks$;

/*
 * SİLME (bağımlılık sırasıyla)
 */

-- Hakediş kayıtları ders silinince CASCADE ile gider.
delete from public.lesson_occurrences
where id in (select id from tmp_test_occurrences);

delete from public.lesson_plan_students
where lesson_plan_id in (select id from tmp_test_plans)
   or student_id in (select id from tmp_test_students);

delete from public.lesson_plans
where id in (select id from tmp_test_plans);

delete from public.lesson_group_students
where group_id in (select id from tmp_test_groups)
   or student_id in (select id from tmp_test_students);

delete from public.lesson_groups
where id in (select id from tmp_test_groups);

delete from public.payments
where student_id in (select id from tmp_test_students);

delete from public.teacher_payments
where teacher_id in (select id from tmp_test_teachers);

delete from public.student_packages
where student_id in (select id from tmp_test_students);

-- Veli kayıtları CASCADE ile gider.
delete from public.students
where id in (select id from tmp_test_students);

-- Branş bağlantıları CASCADE ile gider.
delete from public.teachers
where id in (select id from tmp_test_teachers);

delete from public.packages
where id in (select id from tmp_test_packages);

delete from public.specialties
where id in (select id from tmp_test_specialties);

commit;

select 'Test verisi temizlendi.' as sonuc;
