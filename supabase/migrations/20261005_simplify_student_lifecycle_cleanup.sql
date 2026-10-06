-- 2026-10-03
-- 2. ADIM: Öğrenci yaşam döngüsü sadeleştirmesi temizliği.
--
-- YALNIZCA yeni frontend (Aktif → Pasif → Sil akışı) yayına alındığında
-- çalıştırın. Eski sürüm hâlâ canlıdaysa arşiv ekranları ve
-- "Bağlantısız Test Kaydını Sil" butonu bozulur.
--
-- * Arşivdeki (anonim olmayan) kayıtlar pasif öğrenciye çevrilir.
-- * Eski delete_student_permanently_safely fonksiyonu kaldırılır.

begin;

/*
 * Mevcut arşiv kayıtlarını pasife çevir.
 */
update public.students s
set
  is_archived = false,
  status = 'Pasif',
  passive_reason = coalesce(
    nullif(trim(s.passive_reason), ''),
    nullif(trim(s.archive_reason), ''),
    'Belirtilmedi'
  ),
  passive_date = coalesce(
    s.passive_date,
    s.archived_at::date
  ),
  archived_at = null,
  archive_reason = null,
  retention_review_date = null
where
  s.is_archived = true
  and coalesce(s.is_anonymized, false) = false;

drop function if exists public.delete_student_permanently_safely(uuid);

commit;
