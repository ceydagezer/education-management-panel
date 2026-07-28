/*
 * ORTAK ÖDEME / TAHSİLAT YARDIMCI FONKSİYONLARI
 *
 * Dashboard, Finance ve Payments sayfalarında tekrar eden:
 * - ödeme tutarı okuma
 * - ödeme dönemi bulma
 * - dönemlik tahsilat toplama
 * - güncel vade kaydı bulma
 * - ödeme durumunu hesaplama
 *
 * işlemleri buradan yönetilir.
 */

import {
  addOneMonth,
  getDateKey,
  getDayDifference
} from './dateHelpers'

const UPCOMING_DAYS = 7
const GRACE_DAYS = 3

/*
 * Ödeme kaydının aktif olup olmadığını kontrol eder.
 *
 * İptal edilmiş, silinmiş veya pasif olarak işaretlenmiş
 * tahsilatlar toplam hesaba dahil edilmez.
 */
export const isActivePayment = (
  payment
) => {
  if (!payment) {
    return false
  }

  if (
    payment.isActive === false ||
    payment.is_active === false ||
    payment.isCancelled === true ||
    payment.is_cancelled === true ||
    payment.isDeleted === true ||
    payment.is_deleted === true
  ) {
    return false
  }

  const status = String(
    payment.status || ''
  )
    .trim()
    .toLocaleLowerCase('tr-TR')

  return ![
    'iptal',
    'iptal edildi',
    'cancelled',
    'canceled',
    'silindi',
    'deleted',
    'pasif'
  ].includes(status)
}

/*
 * Ödeme kaydından tutarı okur.
 *
 * Geçiş sürecinde eski ve yeni alan adlarını
 * birlikte destekler.
 */
export const getPaymentAmount = (
  payment
) => {
  const amount = Number(
    payment?.amount ??
      payment?.transactionAmount ??
      payment?.paidAmount ??
      payment?.paid_amount ??
      0
  )

  return Number.isFinite(amount)
    ? amount
    : 0
}

/*
 * Ödeme kaydından tarihi "YYYY-MM-DD"
 * biçiminde okur.
 */
export const getPaymentDate = (
  payment
) =>
  getDateKey(
    payment?.paymentDate ??
      payment?.payment_date ??
      payment?.collectionDate ??
      payment?.collection_date ??
      payment?.date ??
      ''
  )

/*
 * Ödemenin hangi döneme ait olduğunu okur.
 *
 * Sonuç biçimi:
 * YYYY-MM
 */
export const getPaymentPeriod = (
  payment
) => {
  const explicitPeriod = String(
    payment?.paymentPeriod ??
      payment?.payment_period ??
      payment?.period ??
      ''
  ).slice(0, 7)

  if (
    /^\d{4}-\d{2}$/.test(
      explicitPeriod
    )
  ) {
    const month = Number(
      explicitPeriod.slice(5, 7)
    )

    if (
      month >= 1 &&
      month <= 12
    ) {
      return explicitPeriod
    }
  }

  const dueDate = getDateKey(
    payment?.dueDate ??
      payment?.due_date ??
      ''
  )

  if (dueDate) {
    return dueDate.slice(0, 7)
  }

  return getPaymentDate(
    payment
  ).slice(0, 7)
}

/*
 * Ödemenin hangi öğrenci-paket kaydına
 * ait olduğunu bulur.
 *
 * Supabase yapısında esas alan studentPackageId'dir.
 * Eski veriler için öğrenci + paket birleşimi
 * geçici fallback olarak korunur.
 */
export const getPaymentStudentPackageId = (
  payment
) => {
  const directId =
    payment?.studentPackageId ??
    payment?.student_package_id

  if (directId) {
    return String(
      directId
    ).trim()
  }

  const studentId = String(
    payment?.studentId ??
      payment?.student_id ??
      ''
  ).trim()

  const packageId = String(
    payment?.packageId ??
      payment?.package_id ??
      ''
  ).trim()

  if (
    !studentId &&
    !packageId
  ) {
    return ''
  }

  return `${studentId}-${packageId}`
}

/*
 * Belirli bir öğrenci-paket ve dönem için
 * toplam tahsil edilen tutarı hesaplar.
 *
 * İptal edilmiş ödemeler dahil edilmez.
 * Düzenleme sırasında mevcut ödeme excludedPaymentId
 * ile hesaptan çıkarılabilir.
 */
export const getCollectedAmountForPeriod = (
  studentPackageId,
  period,
  paymentList = [],
  excludedPaymentId = null
) => {
  const cleanStudentPackageId =
    String(
      studentPackageId || ''
    ).trim()

  const cleanPeriod = String(
    period || ''
  ).trim()

  return paymentList
    .filter((payment) => {
      if (!isActivePayment(payment)) {
        return false
      }

      const sameStudentPackage =
        getPaymentStudentPackageId(
          payment
        ) === cleanStudentPackageId

      const samePeriod =
        getPaymentPeriod(
          payment
        ) === cleanPeriod

      const isExcluded =
        excludedPaymentId !== null &&
        excludedPaymentId !== undefined &&
        String(
          payment.id
        ) ===
          String(
            excludedPaymentId
          )

      return (
        sameStudentPackage &&
        samePeriod &&
        !isExcluded
      )
    })
    .reduce(
      (total, payment) =>
        total +
        getPaymentAmount(
          payment
        ),
      0
    )
}

/*
 * Öğrenci-paket kaydından aylık beklenen
 * ödeme tutarını bulur.
 */
export const getExpectedPaymentAmount = (
  packageRecord
) => {
  const amount = Number(
    packageRecord?.monthlyFee ??
      packageRecord?.monthly_fee ??
      packageRecord?.agreedPrice ??
      packageRecord?.agreed_price ??
      0
  )

  return Number.isFinite(amount)
    ? amount
    : 0
}

/*
 * Öğrenci-paket kaydının kimliğini bulur.
 *
 * Supabase student_packages.id değeri
 * studentPackageId olarak map edilmelidir.
 */
export const getStudentPackageRecordId = (
  packageRecord
) => {
  const id =
    packageRecord?.studentPackageId ??
    packageRecord?.student_package_id ??
    packageRecord?.id

  return id
    ? String(id).trim()
    : ''
}

/*
 * Öğrenci-paket kaydındaki ilk ödeme tarihini okur.
 */
export const getFirstPaymentDate = (
  packageRecord
) =>
  getDateKey(
    packageRecord?.firstPaymentDate ??
      packageRecord?.first_payment_date ??
      packageRecord?.nextPaymentDate ??
      packageRecord?.next_payment_date ??
      ''
  )

/*
 * Öğrenci-paket kaydındaki ödeme gününü okur.
 */
export const getPaymentDay = (
  packageRecord
) => {
  const paymentDay = Number(
    packageRecord?.paymentDay ??
      packageRecord?.payment_day ??
      1
  )

  if (
    !Number.isInteger(
      paymentDay
    ) ||
    paymentDay < 1 ||
    paymentDay > 31
  ) {
    return 1
  }

  return paymentDay
}

/*
 * Bir öğrenci paketi için henüz tamamen
 * ödenmemiş ilk dönemi bulur.
 *
 * İlk ödeme tarihinden başlanır.
 * Bir dönem tamamen ödenmişse bir sonraki aya geçilir.
 * En fazla 120 ay ileri bakılır.
 */
export const findCurrentDueRecord = (
  packageRecord,
  paymentList = []
) => {
  const expectedAmount =
    getExpectedPaymentAmount(
      packageRecord
    )

  const firstPaymentDate =
    getFirstPaymentDate(
      packageRecord
    )

  const studentPackageId =
    getStudentPackageRecordId(
      packageRecord
    )

  const paymentDay =
    getPaymentDay(
      packageRecord
    )

  if (
    !firstPaymentDate ||
    expectedAmount <= 0 ||
    !studentPackageId
  ) {
    return {
      dueDate:
        firstPaymentDate,

      period:
        firstPaymentDate
          ? firstPaymentDate.slice(
              0,
              7
            )
          : '',

      expectedAmount,

      collectedAmount: 0,

      remainingAmount:
        Math.max(
          0,
          expectedAmount
        )
    }
  }

  let dueDate =
    firstPaymentDate

  for (
    let index = 0;
    index < 120;
    index += 1
  ) {
    const period =
      dueDate.slice(0, 7)

    const collectedAmount =
      getCollectedAmountForPeriod(
        studentPackageId,
        period,
        paymentList
      )

    if (
      collectedAmount <
      expectedAmount
    ) {
      return {
        dueDate,
        period,
        expectedAmount,
        collectedAmount,

        remainingAmount:
          Math.max(
            0,
            expectedAmount -
              collectedAmount
          )
      }
    }

    const nextDueDate =
      addOneMonth(
        dueDate,
        paymentDay
      )

    if (!nextDueDate) {
      break
    }

    dueDate =
      nextDueDate
  }

  return {
    dueDate,

    period:
      dueDate
        ? dueDate.slice(0, 7)
        : '',

    expectedAmount,

    collectedAmount: 0,

    remainingAmount:
      Math.max(
        0,
        expectedAmount
      )
  }
}

/*
 * Bir ödeme döneminin:
 * - ödendi
 * - bekliyor
 * - yaklaşıyor
 * - bugün
 * - tolerans süresinde
 * - gecikti
 *
 * durumlarından hangisinde olduğunu hesaplar.
 */
export const getDueStatus = ({
  dueDate,
  expectedAmount,
  collectedAmount,
  todayKey
}) => {
  const cleanDueDate =
    getDateKey(dueDate)

  const cleanTodayKey =
    getDateKey(todayKey)

  const expected = Number(
    expectedAmount ?? 0
  )

  const collected = Number(
    collectedAmount ?? 0
  )

  const safeExpected =
    Number.isFinite(expected)
      ? expected
      : 0

  const safeCollected =
    Number.isFinite(collected)
      ? collected
      : 0

  const remaining = Math.max(
    0,
    safeExpected -
      safeCollected
  )

  if (
    safeExpected > 0 &&
    remaining <= 0
  ) {
    return {
      label: 'Ödendi',
      className: 'paid',
      filterValue: 'Ödendi',

      detail:
        'Bu dönemin ödemesi tamamlandı.',

      daysUntilDue: null,
      daysLate: 0
    }
  }

  if (!cleanDueDate) {
    return {
      label:
        safeCollected > 0
          ? 'Kısmi Ödendi'
          : 'Tarih Eksik',

      className:
        safeCollected > 0
          ? 'partial'
          : 'pending',

      filterValue:
        safeCollected > 0
          ? 'Kısmi Ödendi'
          : 'Tarih Eksik',

      detail:
        'Ödeme tarihi tanımlanmalıdır.',

      daysUntilDue: null,
      daysLate: 0
    }
  }

  if (!cleanTodayKey) {
    return {
      label: 'Tarih Eksik',
      className: 'pending',
      filterValue: 'Tarih Eksik',

      detail:
        'Bugünün tarihi geçerli değildir.',

      daysUntilDue: null,
      daysLate: 0
    }
  }

  const daysUntilDue =
    getDayDifference(
      cleanTodayKey,
      cleanDueDate
    )

  if (
    daysUntilDue === null
  ) {
    return {
      label: 'Tarih Eksik',
      className: 'pending',
      filterValue: 'Tarih Eksik',

      detail:
        'Ödeme tarihi geçerli değildir.',

      daysUntilDue: null,
      daysLate: 0
    }
  }

  if (
    daysUntilDue >
    UPCOMING_DAYS
  ) {
    return {
      label:
        safeCollected > 0
          ? 'Kısmi Ödendi'
          : 'Bekliyor',

      className:
        safeCollected > 0
          ? 'partial'
          : 'pending',

      filterValue:
        safeCollected > 0
          ? 'Kısmi Ödendi'
          : 'Bekliyor',

      detail:
        `${daysUntilDue} gün sonra ödeme günü.`,

      daysUntilDue,
      daysLate: 0
    }
  }

  if (daysUntilDue > 0) {
    return {
      label:
        safeCollected > 0
          ? 'Kısmi · Yaklaşıyor'
          : 'Yaklaşıyor',

      className: 'upcoming',
      filterValue: 'Yaklaşıyor',

      detail:
        `${daysUntilDue} gün kaldı.`,

      daysUntilDue,
      daysLate: 0
    }
  }

  if (daysUntilDue === 0) {
    return {
      label:
        safeCollected > 0
          ? 'Kısmi · Bugün'
          : 'Bugün',

      className: 'today',
      filterValue: 'Bugün',

      detail:
        'Ödeme günü bugün.',

      daysUntilDue: 0,
      daysLate: 0
    }
  }

  const daysLate =
    Math.abs(
      daysUntilDue
    )

  if (
    daysLate <=
    GRACE_DAYS
  ) {
    return {
      label:
        `${daysLate} Gün Gecikti`,

      className: 'grace',

      filterValue:
        'Tolerans Süresinde',

      detail:
        `Tolerans süresinde · ${
          GRACE_DAYS -
          daysLate
        } gün kaldı.`,

      daysUntilDue,
      daysLate
    }
  }

  return {
    label:
      safeCollected > 0
        ? 'Kısmi · Gecikti'
        : 'Gecikti',

    className: 'overdue',
    filterValue: 'Gecikti',

    detail:
      `${daysLate} gün gecikti.`,

    daysUntilDue,
    daysLate
  }
}

/*
 * Ödeme dönemi tamamen karşılanmış mı
 * kontrol eder.
 */
export const isPaymentPeriodCompleted = ({
  expectedAmount,
  collectedAmount
}) => {
  const expected = Number(
    expectedAmount ?? 0
  )

  const collected = Number(
    collectedAmount ?? 0
  )

  if (
    !Number.isFinite(expected) ||
    !Number.isFinite(collected) ||
    expected <= 0
  ) {
    return false
  }

  return collected >= expected
}

/*
 * Dönem için kalan tutarı hesaplar.
 */
export const getRemainingPaymentAmount = (
  expectedAmount,
  collectedAmount
) => {
  const expected = Number(
    expectedAmount ?? 0
  )

  const collected = Number(
    collectedAmount ?? 0
  )

  const safeExpected =
    Number.isFinite(expected)
      ? expected
      : 0

  const safeCollected =
    Number.isFinite(collected)
      ? collected
      : 0

  return Math.max(
    0,
    safeExpected -
      safeCollected
  )
}