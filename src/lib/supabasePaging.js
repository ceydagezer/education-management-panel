/*
 * Supabase tek istekte en fazla 1000 satır döndürür ve fazlasını
 * sessizce keser. Uzun tarih aralıklarında tüm satırlar 1000'lik
 * sayfalarla alınır. buildQuery her çağrıda yeni bir sorgu
 * üretmeli ve sıralaması sabit (benzersiz kolonla biten) olmalıdır.
 */
const SUPABASE_PAGE_SIZE = 1000

export async function fetchAllRows(buildQuery) {
  const rows = []

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await buildQuery().range(
      from,
      from + SUPABASE_PAGE_SIZE - 1
    )

    if (error) {
      return { data: null, error }
    }

    rows.push(...(data || []))

    if (!data || data.length < SUPABASE_PAGE_SIZE) {
      return { data: rows, error: null }
    }
  }
}
