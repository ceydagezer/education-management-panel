-- TEST VERİSİ TEMİZLİĞİ — 1. ADIM: ÖNİZLEME (hiçbir şey silmez)
--
-- Supabase SQL Editor'de çalıştırın ve listeyi kontrol edin.
-- Listede gerçek bir kayıt görürseniz 2. adımı ÇALIŞTIRMAYIN.
--
-- Test verisi tanımı (2. adımdaki betikle birebir aynıdır):
--   * Branş: "Deneme"
--   * Paket / grup: Deneme branşındakiler veya adı "Deneme" ile başlayanlar
--   * Öğretmen: Deneme1, Deneme2
--   * Öğrenci: Deneme paketi veya Deneme grubu olanlar
--     (silinip "Silinmiş Öğrenci #..." olanlar dahil)
--     ve adı "Deneme" ile başlayanlar

with
test_specialties as (
  select id from public.specialties
  where lower(btrim(name)) = 'deneme'
),
test_packages as (
  select id from public.packages
  where specialty_id in (select id from test_specialties)
     or lower(btrim(name)) like 'deneme%'
),
test_groups as (
  select id from public.lesson_groups
  where specialty_id in (select id from test_specialties)
     or lower(btrim(name)) like 'deneme%'
),
test_teachers as (
  select id from public.teachers
  where lower(btrim(full_name)) in ('deneme1', 'deneme2')
),
test_students as (
  select student_id as id from public.student_packages
  where package_id in (select id from test_packages)
  union
  select student_id from public.lesson_group_students
  where group_id in (select id from test_groups)
  union
  select id from public.students
  where lower(btrim(full_name)) like 'deneme%'
)

select 'Branş' as tur, s.name as ad, s.id::text as kimlik
from public.specialties s where s.id in (select id from test_specialties)

union all
select 'Paket', p.name, p.id::text
from public.packages p where p.id in (select id from test_packages)

union all
select 'Grup', g.name, g.id::text
from public.lesson_groups g where g.id in (select id from test_groups)

union all
select 'Öğretmen', t.full_name, t.id::text
from public.teachers t where t.id in (select id from test_teachers)

union all
select 'Öğrenci', st.full_name, st.id::text
from public.students st where st.id in (select id from test_students)

union all
select 'Ders kaydı (adet)', count(*)::text, ''
from public.lesson_occurrences lo
where lo.teacher_id in (select id from test_teachers)
   or lo.student_id in (select id from test_students)
   or lo.package_id in (select id from test_packages)

union all
select 'Ders planı (adet)', count(*)::text, ''
from public.lesson_plans lp
where lp.teacher_id in (select id from test_teachers)
   or lp.student_id in (select id from test_students)
   or lp.package_id in (select id from test_packages)
   or lp.group_id in (select id from test_groups)

union all
select 'Öğrenci tahsilatı (adet / toplam)', count(*)::text, coalesce(sum(amount), 0)::text
from public.payments pay
where pay.student_id in (select id from test_students)

union all
select 'Öğretmen ödemesi (adet / toplam)', count(*)::text, coalesce(sum(amount), 0)::text
from public.teacher_payments tp
where tp.teacher_id in (select id from test_teachers)

order by 1, 2;
