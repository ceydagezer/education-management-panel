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