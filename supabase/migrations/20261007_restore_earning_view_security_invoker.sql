-- 2026-10-07
-- Hakediş view'larında security_invoker ayarını geri getirir.
--
-- Sorun: 20261004 ve 20261006 migration'ları bu iki view'ı
-- "create or replace view" ile yeniden oluşturduğu için
-- security_invoker = true ayarı düştü. Diğer tüm view'larda bu ayar açık.
-- Ayar kapalıyken view, sahibinin (postgres) yetkisiyle çalışır ve
-- tabloların RLS kurallarını atlar.
--
-- Şu an anon rolünün bu view'larda SELECT yetkisi olmadığı için veri
-- sızıntısı yok; bu migration ileride bir yetki değişikliğinde açık
-- oluşmasını önler ve view'ları diğerleriyle aynı kurala getirir.

alter view public.teacher_earning_lessons_view
  set (security_invoker = true);

alter view public.teacher_earnings_summary_view
  set (security_invoker = true);
