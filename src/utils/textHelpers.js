/*
 * ORTAK METİN / ARAMA YARDIMCI FONKSİYONLARI
 *
 * Öğrenci, öğretmen, paket ve ders arama alanlarında
 * tekrar eden metin normalizasyonu ve karşılaştırma
 * işlemleri buradan yönetilir.
 */

/*
 * Bir değeri güvenli biçimde string'e çevirir
 * ve baştaki/sondaki boşlukları temizler.
 */
export const cleanText = (value) =>
  String(value ?? '').trim()

/*
 * Durum, kategori ve sabit metin karşılaştırmalarında
 * kullanılacak basit normalizasyon.
 *
 * Örnek:
 * "  Aktif " -> "aktif"
 */
export const normalizeStatusText = (value) =>
  cleanText(value).toLocaleLowerCase('tr-TR')

/*
 * Arama kutuları için gelişmiş normalizasyon.
 *
 * - Küçük harfe çevirir
 * - Türkçe karakterleri sadeleştirir
 * - Aksan işaretlerini kaldırır
 * - Birden fazla boşluğu teke indirir
 *
 * Örnek:
 * "  Şule  IŞIK  " -> "sule isik"
 */
export const normalizeSearchText = (value) =>
  cleanText(value)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/\s+/g, ' ')

/*
 * İki metnin normalize edildikten sonra
 * tamamen eşit olup olmadığını kontrol eder.
 *
 * Durum, isim ve sabit alan karşılaştırmalarında
 * kullanılabilir.
 */
export const areTextsEqual = (
  firstValue,
  secondValue
) =>
  normalizeSearchText(firstValue) ===
  normalizeSearchText(secondValue)

/*
 * Bir metnin arama ifadesini içerip içermediğini
 * Türkçe karakter duyarsız biçimde kontrol eder.
 *
 * Boş arama ifadesi her zaman true döner.
 */
export const includesSearchText = (
  sourceValue,
  searchValue
) => {
  const normalizedSearch =
    normalizeSearchText(searchValue)

  if (!normalizedSearch) {
    return true
  }

  return normalizeSearchText(
    sourceValue
  ).includes(normalizedSearch)
}

/*
 * Birden fazla alan içinde arama yapar.
 *
 * Örnek kullanım:
 *
 * matchesSearchQuery(
 *   [student.fullName, student.phone],
 *   searchTerm
 * )
 */
export const matchesSearchQuery = (
  values,
  searchValue
) => {
  const normalizedSearch =
    normalizeSearchText(searchValue)

  if (!normalizedSearch) {
    return true
  }

  const safeValues = Array.isArray(values)
    ? values
    : [values]

  return safeValues.some((value) =>
    normalizeSearchText(value).includes(
      normalizedSearch
    )
  )
}

/*
 * Ad-soyad gibi değerlerden baş harf üretir.
 *
 * Örnek:
 * "Ayşe Yılmaz" -> "AY"
 */
export const getInitials = (
  value,
  maximumLength = 2
) => {
  const words = cleanText(value)
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) {
    return ''
  }

  return words
    .slice(0, Math.max(1, maximumLength))
    .map((word) => word.charAt(0))
    .join('')
    .toLocaleUpperCase('tr-TR')
}

/*
 * Metnin ilk harfini büyük yapar.
 *
 * Örnek:
 * "piyano" -> "Piyano"
 */
export const capitalizeFirstLetter = (
  value
) => {
  const text = cleanText(value)

  if (!text) {
    return ''
  }

  return (
    text.charAt(0).toLocaleUpperCase('tr-TR') +
    text.slice(1)
  )
}

/*
 * Metindeki her kelimenin ilk harfini büyütür.
 *
 * Örnek:
 * "ayşe yılmaz" -> "Ayşe Yılmaz"
 */
export const toTitleCaseTr = (value) =>
  cleanText(value)
    .toLocaleLowerCase('tr-TR')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word.charAt(0).toLocaleUpperCase('tr-TR') +
      word.slice(1)
    )
    .join(' ')

/*
 * UUID veya benzeri ID değerlerini
 * güvenli biçimde karşılaştırır.
 *
 * Sayı-string farkını tolere eder:
 * 5 ve "5" eşit kabul edilir.
 */
export const areIdsEqual = (
  firstId,
  secondId
) => {
  if (
    firstId === null ||
    firstId === undefined ||
    secondId === null ||
    secondId === undefined
  ) {
    return false
  }

  return String(firstId) === String(secondId)
}

/*
 * Telefon, TC No veya yalnızca rakam içermesi gereken
 * değerlerden rakam olmayan karakterleri temizler.
 *
 * Örnek:
 * "(0532) 123 45 67" -> "05321234567"
 */
export const keepOnlyDigits = (value) =>
  String(value ?? '').replace(/\D/g, '')