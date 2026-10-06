/*
 * ORTAK DERS DURUMU YARDIMCI FONKSİYONLARI
 *
 * Dashboard, Schedule ve LessonStatusTracking
 * sayfalarında tekrar eden ders durumu mantığı
 * buradan yönetilir.
 */

const KNOWN_LESSON_STATUSES = [
  'Planlandı',
  'Yapıldı',
  'İptal edildi',
  'Telafi yapılacak',
  'Telafi yapıldı'
]

/*
 * Farklı biçimlerde gelebilen ders durumlarını
 * uygulamada kullanılan standart değerlere çevirir.
 *
 * Örnekler:
 * "İptal" -> "İptal edildi"
 * "Telafi" -> "Telafi yapılacak"
 * boş değer -> "Planlandı"
 */
export const normalizeLessonStatus = (
  status
) => {
  const originalStatus = String(
    status || ''
  ).trim()

  const cleanStatus =
    originalStatus
      .toLocaleLowerCase(
        'tr-TR'
      )

  switch (cleanStatus) {
    case '':
    case 'planlandı':
    case 'planlandi':
    case 'normal':
    case 'düzenli ders':
    case 'duzenli ders':
      return 'Planlandı'

    case 'yapıldı':
    case 'yapildi':
    case 'tamamlandı':
    case 'tamamlandi':
      return 'Yapıldı'

    case 'iptal':
    case 'iptal edildi':
    case 'iptal edıldı':
    case 'cancelled':
    case 'canceled':
      return 'İptal edildi'

    case 'telafi':
    case 'telafi yapılacak':
    case 'telafi yapilacak':
    case 'telafi bekliyor':
      return 'Telafi yapılacak'

    case 'telafi yapıldı':
    case 'telafi yapildi':
    case 'telafi tamamlandı':
    case 'telafi tamamlandi':
      return 'Telafi yapıldı'

    default:
      return (
        originalStatus ||
        'Planlandı'
      )
  }
}

/*
 * Ders durumu geçerli mi kontrol eder.
 */
export const isKnownLessonStatus = (
  status
) =>
  KNOWN_LESSON_STATUSES.includes(
    normalizeLessonStatus(status)
  )

/*
 * Ekranda gösterilecek uzun ders durumu etiketi.
 *
 * "Planlandı" yerine kullanıcıya
 * "Düzenli Ders" gösterilir.
 */
export const getLessonStatusLabel = (
  status
) => {
  const normalized =
    normalizeLessonStatus(status)

  if (normalized === 'Planlandı') {
    return 'Düzenli Ders'
  }

  return normalized
}

/*
 * Haftalık programdaki kartlarda kullanılacak
 * daha kısa durum etiketi.
 */
export const getCompactLessonStatusLabel = (
  status
) => {
  const normalized =
    normalizeLessonStatus(status)

  switch (normalized) {
    case 'Yapıldı':
      return 'Yapıldı'

    case 'İptal edildi':
      return 'İptal'

    case 'Telafi yapılacak':
      return 'Telafi'

    case 'Telafi yapıldı':
      return 'Telafi yapıldı'

    default:
      return ''
  }
}

/*
 * Ders kartı için duruma göre CSS sınıfı üretir.
 *
 * prefix farklı component'lerin kendi temel sınıfını
 * kullanabilmesi için parametre olarak alınır.
 */
export const getLessonStatusClass = (
  status,
  prefix = 'status-lesson-card'
) => {
  const normalized =
    normalizeLessonStatus(status)

  switch (normalized) {
    case 'Yapıldı':
      return `${prefix} completed`

    case 'İptal edildi':
      return `${prefix} cancelled`

    case 'Telafi yapılacak':
      return `${prefix} makeup-waiting`

    case 'Telafi yapıldı':
      return `${prefix} makeup-completed`

    default:
      return `${prefix} planned`
  }
}

/*
 * Ders durumu rozeti için CSS sınıfı üretir.
 */
export const getLessonStatusBadgeClass = (
  status
) => {
  const normalized =
    normalizeLessonStatus(status)

  switch (normalized) {
    case 'Yapıldı':
      return 'status-pill completed'

    case 'İptal edildi':
      return 'status-pill cancelled'

    case 'Telafi yapılacak':
      return 'status-pill makeup-waiting'

    case 'Telafi yapıldı':
      return 'status-pill makeup-completed'

    default:
      return 'status-pill planned'
  }
}

/*
 * Dersin telafi dersi olup olmadığını kontrol eder.
 */
export const isMakeupLesson = (
  lesson
) => {
  if (!lesson) {
    return false
  }

  const normalized =
    normalizeLessonStatus(
      lesson.status
    )

  return (
    lesson.isMakeup === true ||
    lesson.is_makeup === true ||
    normalized ===
      'Telafi yapılacak' ||
    normalized ===
      'Telafi yapıldı'
  )
}

/*
 * Ders tamamlanmış ve öğretmen hakedişine
 * dahil edilebilir mi kontrol eder.
 */
export const isCompletedLesson = (
  lesson
) => {
  if (!lesson) {
    return false
  }

  const normalized =
    normalizeLessonStatus(
      lesson.status
    )

  return (
    normalized === 'Yapıldı' ||
    normalized ===
      'Telafi yapıldı'
  )
}

/*
 * Ders iptal edilmiş mi kontrol eder.
 */
export const isCancelledLesson = (
  lesson
) => {
  if (!lesson) {
    return false
  }

  return (
    normalizeLessonStatus(
      lesson.status
    ) === 'İptal edildi'
  )
}

/*
 * Ders hâlâ aktif bir zaman dilimini işgal ediyor mu
 * kontrol eder.
 *
 * Pasif veya iptal edilen dersler çakışma
 * kontrolünde aktif kabul edilmez.
 */
export const isActiveLesson = (
  lesson
) => {
  if (!lesson) {
    return false
  }

  if (
    lesson.isActive === false ||
    lesson.is_active === false
  ) {
    return false
  }

  return !isCancelledLesson(
    lesson
  )
}

/*
 * Ders normal planlanmış ders mi kontrol eder.
 */
export const isPlannedLesson = (
  lesson
) => {
  if (!lesson) {
    return false
  }

  return (
    normalizeLessonStatus(
      lesson.status
    ) === 'Planlandı'
  )
}
/*
 * DERS SAATİ / SÜRE YARDIMCILARI
 *
 * Ders saatleri elle yazıldığı için (ör. 14:30) çakışma kontrolü
 * saatin birebir eşleşmesine değil, dersin başlangıç ve bitişine
 * (başlangıç + süre) göre yapılır.
 */
const DEFAULT_LESSON_DURATION_MINUTES = 60

/*
 * "HH:MM" veya "HH:MM:SS" biçimindeki saati günün dakikasına çevirir.
 * Geçersiz değerde null döner.
 */
export const timeToMinutes = (value) => {
  const match = String(value || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})/)

  if (!match) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (
    hours > 23 ||
    minutes > 59
  ) {
    return null
  }

  return hours * 60 + minutes
}

/*
 * Günün dakikasını "HH:MM" biçimine çevirir.
 */
export const minutesToTime = (totalMinutes) => {
  const safeMinutes = Math.max(
    0,
    Math.round(Number(totalMinutes) || 0)
  )

  const hours = Math.floor(safeMinutes / 60)
  const minutes = safeMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(
    minutes
  ).padStart(2, '0')}`
}

/*
 * "45 dk", "45" veya 45 gibi değerlerden süreyi dakika olarak okur.
 */
export const parseDurationMinutes = (
  value,
  fallback = DEFAULT_LESSON_DURATION_MINUTES
) => {
  const numericValue = Number(value)

  if (
    Number.isFinite(numericValue) &&
    numericValue > 0
  ) {
    return Math.round(numericValue)
  }

  const match = String(value || '').match(/\d+/)

  return match && Number(match[0]) > 0
    ? Number(match[0])
    : fallback
}

/*
 * Ders kaydının süresini dakika olarak okur.
 */
export const getLessonDurationMinutes = (lesson) =>
  parseDurationMinutes(
    lesson?.durationMinutes ||
      lesson?.duration_minutes ||
      lesson?.duration
  )

/*
 * İki zaman aralığı çakışıyor mu?
 * Bir ders biterken diğeri başlıyorsa (14:00-14:45 ve 14:45) çakışma sayılmaz.
 */
export const doTimeRangesOverlap = (
  firstStart,
  firstDuration,
  secondStart,
  secondDuration
) => {
  const firstStartMinutes = timeToMinutes(firstStart)
  const secondStartMinutes = timeToMinutes(secondStart)

  if (
    firstStartMinutes === null ||
    secondStartMinutes === null
  ) {
    return false
  }

  const firstEndMinutes =
    firstStartMinutes +
    parseDurationMinutes(firstDuration)

  const secondEndMinutes =
    secondStartMinutes +
    parseDurationMinutes(secondDuration)

  return (
    firstStartMinutes < secondEndMinutes &&
    secondStartMinutes < firstEndMinutes
  )
}

/*
 * Ders kaydının saat aralığı: "14:30–15:15"
 */
export const getLessonTimeRange = (lesson) => {
  const startMinutes = timeToMinutes(lesson?.time)

  if (startMinutes === null) {
    return lesson?.time || '-'
  }

  return `${minutesToTime(startMinutes)}–${minutesToTime(
    startMinutes + getLessonDurationMinutes(lesson)
  )}`
}

/*
 * Saatin ait olduğu tam saat satırı: "14:30" -> "14:00"
 */
export const getHourSlotKey = (time) => {
  const minutes = timeToMinutes(time)

  return minutes === null
    ? ''
    : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`
}

/*
 * Haftalık tablo satırları: varsayılan saatler + varsayılan aralığın
 * dışında kalan derslerin saatleri (ör. 08:30 veya 23:00).
 */
export const buildHourSlots = (
  defaultSlots = [],
  lessons = []
) => {
  const slots = new Set(defaultSlots)

  lessons.forEach((lesson) => {
    const slot = getHourSlotKey(lesson?.time)

    if (slot) {
      slots.add(slot)
    }
  })

  return [...slots].sort()
}

/*
 * Gün sütunundaki dersleri başlangıç saatine göre gruplar.
 * Aynı saatte başlayan dersler tek grupta toplanır.
 * Girdi saat sırasına göre sıralı olmalıdır.
 */
export const groupLessonsByStartTime = (lessons = []) => {
  const groups = []

  lessons.forEach((lesson) => {
    const time = String(lesson?.time || '').slice(0, 5)
    const lastGroup = groups[groups.length - 1]

    if (lastGroup && lastGroup.time === time) {
      lastGroup.lessons.push(lesson)
      return
    }

    groups.push({
      time,
      lessons: [lesson]
    })
  })

  return groups
}
