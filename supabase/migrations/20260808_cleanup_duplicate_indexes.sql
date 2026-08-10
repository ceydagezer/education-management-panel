-- 2026-08-08
-- Kesin duplicate index temizliği.
-- payments_active_date_idx ve payments_active_date_created_idx
-- aynı kolonlar ve aynı sıralama ile oluşturulmuştu.
-- Daha açıklayıcı olan payments_active_date_created_idx korunur.

drop index if exists public.payments_active_date_idx;