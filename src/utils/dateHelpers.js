/*
 * ORTAK TARİH YARDIMCI FONKSİYONLARI
 *
 * Dashboard, Finance, Payments, Schedule ve LessonStatusTracking
 * sayfalarında tekrar eden tarih ve fiyat işlemleri buradan yönetilir.
 * Bir formül değişirse yalnızca bu dosya güncellenir.
 */

const DATE_KEY_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/

function isValidDateParts(
  year,
  month,
  day
) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false
  }

  const utcValue = Date.UTC(
    year,
    month - 1,
    day
  )

  const validationDate =
    new Date(utcValue)

  return (
    validationDate.getUTCFullYear() ===
      year &&
    validationDate.getUTCMonth() ===
      month - 1 &&
    validationDate.getUTCDate() ===
      day
  )
}

function parseDateKey(value) {
  const dateKey = String(
    value || ''
  ).slice(0, 10)

  if (
    !DATE_KEY_PATTERN.test(dateKey)
  ) {
    return null
  }

  const [
    year,
    month,
    day
  ] = dateKey
    .split('-')
    .map(Number)

  if (
    !isValidDateParts(
      year,
      month,
      day
    )
  ) {
    return null
  }

  return {
    dateKey,
    year,
    month,
    day
  }
}

/*
 * Bir tarih değerini "YYYY-MM-DD" biçimine çevirir.
 *
 * Desteklenen değerler:
 * - "2026-07-25"
 * - "2026-07-25T10:00:00"
 * - Geçerli bir Date nesnesi
 */
export const getDateKey = (value) => {
  if (!value) {
    return ''
  }

  if (value instanceof Date) {
    if (
      Number.isNaN(
        value.getTime()
      )
    ) {
      return ''
    }

    return [
      value.getFullYear(),
      String(
        value.getMonth() + 1
      ).padStart(2, '0'),
      String(
        value.getDate()
      ).padStart(2, '0')
    ].join('-')
  }

  return (
    parseDateKey(value)
      ?.dateKey || ''
  )
}

/*
 * Bugünün tarihini yerel saate göre
 * "YYYY-MM-DD" biçiminde döndürür.
 */
export const getTodayKey = () =>
  getDateKey(
    new Date()
  )

/*
 * "YYYY-MM-DD" biçimindeki tarihi UTC milisaniyeye çevirir.
 * Tarih farkı hesaplamalarında saat dilimi kaynaklı
 * bir gün kayma problemini önler.
 */
export const dateKeyToUtc = (
  dateKey
) => {
  const parsed =
    parseDateKey(dateKey)

  if (!parsed) {
    return null
  }

  return Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day
  )
}

/*
 * İki tarih arasındaki gün farkını hesaplar.
 *
 * Sonuç:
 * toDateKey - fromDateKey
 *
 * Örnek:
 * 2026-07-25 -> 2026-07-28 = 3
 */
export const getDayDifference = (
  fromDateKey,
  toDateKey
) => {
  const fromUtc =
    dateKeyToUtc(
      fromDateKey
    )

  const toUtc =
    dateKeyToUtc(
      toDateKey
    )

  if (
    fromUtc === null ||
    toUtc === null
  ) {
    return null
  }

  return Math.round(
    (toUtc - fromUtc) /
      86400000
  )
}

/*
 * Belirli bir ayın kaç gün çektiğini döndürür.
 *
 * monthIndex JavaScript ay indeksidir:
 * Ocak = 0
 * Şubat = 1
 * Aralık = 11
 */
export const getDaysInMonth = (
  year,
  monthIndex
) => {
  const numericYear =
    Number(year)

  const numericMonthIndex =
    Number(monthIndex)

  if (
    !Number.isInteger(
      numericYear
    ) ||
    !Number.isInteger(
      numericMonthIndex
    ) ||
    numericMonthIndex < 0 ||
    numericMonthIndex > 11
  ) {
    return 0
  }

  return new Date(
    numericYear,
    numericMonthIndex + 1,
    0
  ).getDate()
}

/*
 * Belirli bir yıl ve ay için ödeme tarihi oluşturur.
 *
 * Örneğin ödeme günü 31 ise fakat hedef ay Şubat ise
 * ayın son geçerli günü kullanılır.
 */
export const createDueDate = (
  year,
  monthIndex,
  paymentDay
) => {
  const numericYear =
    Number(year)

  const numericMonthIndex =
    Number(monthIndex)

  const numericPaymentDay =
    Number(paymentDay)

  if (
    !Number.isInteger(
      numericYear
    ) ||
    !Number.isInteger(
      numericMonthIndex
    ) ||
    numericMonthIndex < 0 ||
    numericMonthIndex > 11
  ) {
    return ''
  }

  const daysInMonth =
    getDaysInMonth(
      numericYear,
      numericMonthIndex
    )

  if (!daysInMonth) {
    return ''
  }

  const safePaymentDay =
    Number.isInteger(
      numericPaymentDay
    ) &&
    numericPaymentDay > 0
      ? numericPaymentDay
      : 1

  const safeDay = Math.min(
    safePaymentDay,
    daysInMonth
  )

  return [
    numericYear,
    String(
      numericMonthIndex + 1
    ).padStart(2, '0'),
    String(
      safeDay
    ).padStart(2, '0')
  ].join('-')
}

/*
 * Verilen tarihin bir sonraki ayındaki
 * ödeme tarihini hesaplar.
 *
 * Örnek:
 * addOneMonth("2026-01-31", 31)
 * sonucunda "2026-02-28" döner.
 */
export const addOneMonth = (
  dateKey,
  paymentDay
) => {
  const parsed =
    parseDateKey(dateKey)

  if (!parsed) {
    return ''
  }

  const nextMonthDate =
    new Date(
      parsed.year,
      parsed.month,
      1
    )

  return createDueDate(
    nextMonthDate.getFullYear(),
    nextMonthDate.getMonth(),
    paymentDay
  )
}

/*
 * Bir tarihe belirtilen sayıda ay ekler.
 *
 * Ayın günü hedef ayda yoksa hedef ayın
 * son geçerli günü kullanılır.
 *
 * Örnek:
 * 31 Ocak + 1 ay = 28/29 Şubat
 */
export const addMonthsToDate = (
  dateValue,
  monthCount
) => {
  const parsed =
    parseDateKey(
      getDateKey(
        dateValue
      )
    )

  const numericMonthCount =
    Number(monthCount)

  if (
    !parsed ||
    !Number.isInteger(
      numericMonthCount
    )
  ) {
    return ''
  }

  const sourceDate =
    new Date(
      parsed.year,
      parsed.month - 1,
      1
    )

  sourceDate.setMonth(
    sourceDate.getMonth() +
      numericMonthCount
  )

  const lastDayOfTargetMonth =
    getDaysInMonth(
      sourceDate.getFullYear(),
      sourceDate.getMonth()
    )

  sourceDate.setDate(
    Math.min(
      parsed.day,
      lastDayOfTargetMonth
    )
  )

  return getDateKey(
    sourceDate
  )
}

/*
 * Bir tarihe belirtilen sayıda yıl ekler.
 *
 * Örneğin 29 Şubat tarihine bir yıl eklendiğinde
 * hedef yılda 29 Şubat yoksa 28 Şubat kullanılır.
 */
export const addYearsToDate = (
  dateValue,
  yearCount
) => {
  const numericYearCount =
    Number(yearCount)

  if (
    !Number.isInteger(
      numericYearCount
    )
  ) {
    return ''
  }

  return addMonthsToDate(
    dateValue,
    numericYearCount * 12
  )
}

/*
 * Sayıyı Türkçe sayı biçiminde gösterir.
 *
 * Örnek:
 * 5000 -> "5.000"
 * 1250.5 -> "1.250,5"
 */
export const formatPrice = (
  value
) => {
  const numericValue =
    Number(value)

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return '0'
  }

  return numericValue
    .toLocaleString(
      'tr-TR',
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }
    )
}

/*
 * Tarihi Türkçe biçimde gösterir.
 *
 * Örnek:
 * "2026-07-25" -> "25.07.2026"
 */
export const formatDate = (
  dateValue
) => {
  const parsed =
    parseDateKey(
      getDateKey(
        dateValue
      )
    )

  if (!parsed) {
    return '-'
  }

  const date = new Date(
    parsed.year,
    parsed.month - 1,
    parsed.day
  )

  return date.toLocaleDateString(
    'tr-TR'
  )
}

/*
 * Dönem değerini Türkçe ay ve yıl biçiminde gösterir.
 *
 * Örnek:
 * "2026-07" -> "Temmuz 2026"
 */
export const formatPeriod = (
  periodValue
) => {
  const periodKey = String(
    periodValue || ''
  ).slice(0, 7)

  if (
    !/^\d{4}-\d{2}$/.test(
      periodKey
    )
  ) {
    return '-'
  }

  const [
    year,
    month
  ] = periodKey
    .split('-')
    .map(Number)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return '-'
  }

  return new Date(
    year,
    month - 1,
    1
  ).toLocaleDateString(
    'tr-TR',
    {
      month: 'long',
      year: 'numeric'
    }
  )
}