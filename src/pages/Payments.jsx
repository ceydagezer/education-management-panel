import { useMemo, useState } from 'react'
import RequiredStar from '../components/RequiredStar'

const UPCOMING_DAYS = 7
const GRACE_DAYS = 3

const toDateKey = (value) => String(value || '').slice(0, 10)

const getTodayKey = () => {
  const now = new Date()

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-')
}

const dateKeyToUtc = (dateKey) => {
  const [year, month, day] = String(dateKey || '')
    .split('-')
    .map(Number)

  if (!year || !month || !day) {
    return null
  }

  return Date.UTC(year, month - 1, day)
}

const getDayDifference = (fromDateKey, toDateKeyValue) => {
  const fromUtc = dateKeyToUtc(fromDateKey)
  const toUtc = dateKeyToUtc(toDateKeyValue)

  if (fromUtc === null || toUtc === null) {
    return null
  }

  return Math.round((toUtc - fromUtc) / 86400000)
}

const getDaysInMonth = (year, monthIndex) =>
  new Date(year, monthIndex + 1, 0).getDate()

const createDueDate = (year, monthIndex, paymentDay) => {
  const safeDay = Math.min(
    Number(paymentDay || 1),
    getDaysInMonth(year, monthIndex)
  )

  return [
    year,
    String(monthIndex + 1).padStart(2, '0'),
    String(safeDay).padStart(2, '0')
  ].join('-')
}

const addOneMonth = (dateKey, paymentDay) => {
  const [year, month] = String(dateKey || '')
    .split('-')
    .map(Number)

  if (!year || !month) {
    return ''
  }

  const nextMonthDate = new Date(year, month, 1)

  return createDueDate(
    nextMonthDate.getFullYear(),
    nextMonthDate.getMonth(),
    paymentDay
  )
}

const formatPrice = (value) =>
  Number(value || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })

const formatDate = (dateValue) => {
  const dateKey = toDateKey(dateValue)

  if (!dateKey) {
    return '-'
  }

  const date = new Date(`${dateKey}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return dateKey
  }

  return date.toLocaleDateString('tr-TR')
}

const formatPeriod = (periodValue) => {
  const [year, month] = String(periodValue || '')
    .split('-')
    .map(Number)

  if (!year || !month) {
    return '-'
  }

  return new Date(year, month - 1, 1).toLocaleDateString(
    'tr-TR',
    {
      month: 'long',
      year: 'numeric'
    }
  )
}

const getPaymentAmount = (payment) =>
  Number(
    payment?.amount ??
      payment?.transactionAmount ??
      payment?.paidAmount ??
      0
  )

const getPaymentDate = (payment) =>
  toDateKey(
    payment?.paymentDate ??
      payment?.collectionDate ??
      payment?.date ??
      ''
  )

const getPaymentPeriod = (payment) => {
  const explicitPeriod =
    payment?.paymentPeriod || payment?.period

  if (explicitPeriod) {
    return String(explicitPeriod).slice(0, 7)
  }

  const duePeriod = toDateKey(payment?.dueDate).slice(0, 7)

  if (duePeriod) {
    return duePeriod
  }

  return getPaymentDate(payment).slice(0, 7)
}

const getPaymentStudentPackageId = (payment) => {
  if (payment?.studentPackageId) {
    return String(payment.studentPackageId)
  }

  return `${payment?.studentId}-${payment?.packageId}`
}

const getDueStatus = ({
  dueDate,
  expectedAmount,
  collectedAmount,
  todayKey
}) => {
  const expected = Number(expectedAmount || 0)
  const collected = Number(collectedAmount || 0)
  const remaining = Math.max(0, expected - collected)

  if (expected > 0 && remaining <= 0) {
    return {
      label: 'Ödendi',
      className: 'paid',
      filterValue: 'Ödendi',
      detail: 'Bu dönemin ödemesi tamamlandı.',
      daysUntilDue: null,
      daysLate: 0
    }
  }

  if (!dueDate) {
    return {
      label: collected > 0 ? 'Kısmi Ödendi' : 'Tarih Eksik',
      className: collected > 0 ? 'partial' : 'pending',
      filterValue: collected > 0 ? 'Kısmi Ödendi' : 'Tarih Eksik',
      detail: 'Ödeme tarihi tanımlanmalıdır.',
      daysUntilDue: null,
      daysLate: 0
    }
  }

  const daysUntilDue = getDayDifference(todayKey, dueDate)

  if (daysUntilDue === null) {
    return {
      label: 'Tarih Eksik',
      className: 'pending',
      filterValue: 'Tarih Eksik',
      detail: 'Ödeme tarihi geçerli değildir.',
      daysUntilDue: null,
      daysLate: 0
    }
  }

  if (daysUntilDue > UPCOMING_DAYS) {
    return {
      label: collected > 0 ? 'Kısmi Ödendi' : 'Bekliyor',
      className: collected > 0 ? 'partial' : 'pending',
      filterValue: collected > 0 ? 'Kısmi Ödendi' : 'Bekliyor',
      detail: `${daysUntilDue} gün sonra ödeme günü.`,
      daysUntilDue,
      daysLate: 0
    }
  }

  if (daysUntilDue > 0) {
    return {
      label: collected > 0 ? 'Kısmi · Yaklaşıyor' : 'Yaklaşıyor',
      className: 'upcoming',
      filterValue: 'Yaklaşıyor',
      detail: `${daysUntilDue} gün kaldı.`,
      daysUntilDue,
      daysLate: 0
    }
  }

  if (daysUntilDue === 0) {
    return {
      label: collected > 0 ? 'Kısmi · Bugün' : 'Bugün',
      className: 'today',
      filterValue: 'Bugün',
      detail: 'Ödeme günü bugün.',
      daysUntilDue: 0,
      daysLate: 0
    }
  }

  const daysLate = Math.abs(daysUntilDue)

  if (daysLate <= GRACE_DAYS) {
    return {
      label: `${daysLate} Gün Gecikti`,
      className: 'grace',
      filterValue: 'Tolerans Süresinde',
      detail: `Tolerans süresinde · ${GRACE_DAYS - daysLate} gün kaldı.`,
      daysUntilDue,
      daysLate
    }
  }

  return {
    label: collected > 0 ? 'Kısmi · Gecikti' : 'Gecikti',
    className: 'overdue',
    filterValue: 'Gecikti',
    detail: `${daysLate} gün gecikti.`,
    daysUntilDue,
    daysLate
  }
}

function Payments({
  students = [],
  setStudents = () => {},
  payments = [],
  setPayments,
  unsavedChanges
}) {
  const today = getTodayKey()

  const emptyPaymentForm = {
    studentId: '',
    studentPackageId: '',
    amount: '',
    paymentDate: today,
    paymentMethod: '',
    referenceNumber: '',
    note: ''
  }

  const emptyFilters = {
    searchText: '',
    status: '',
    paymentMethod: '',
    startDate: '',
    endDate: ''
  }

  const [paymentForm, setPaymentForm] =
    useState(emptyPaymentForm)
  const [filters, setFilters] = useState(emptyFilters)
  const [sortOption, setSortOption] = useState('newest')
  const [editingPaymentId, setEditingPaymentId] =
    useState(null)
  const [editForm, setEditForm] = useState(null)

  /*
   * Aynı sayfada iki farklı taslak bulunabilir:
   * 1) Yeni tahsilat formu
   * 2) Tablo içindeki tahsilat düzenleme formu
   */
  const [
    paymentFormHasUnsavedChanges,
    setPaymentFormHasUnsavedChanges
  ] = useState(false)

  const [
    editFormHasUnsavedChanges,
    setEditFormHasUnsavedChanges
  ] = useState(false)

  const syncUnsavedChanges = (
    nextPaymentFormDirty,
    nextEditFormDirty
  ) => {
    if (
      nextPaymentFormDirty ||
      nextEditFormDirty
    ) {
      unsavedChanges?.markDirty?.()
      return
    }

    unsavedChanges?.markClean?.()
  }

  const updatePaymentFormDirty = (isDirty) => {
    setPaymentFormHasUnsavedChanges(isDirty)
    syncUnsavedChanges(
      isDirty,
      editFormHasUnsavedChanges
    )
  }

  const updateEditFormDirty = (isDirty) => {
    setEditFormHasUnsavedChanges(isDirty)
    syncUnsavedChanges(
      paymentFormHasUnsavedChanges,
      isDirty
    )
  }

  /*
   * Sadece tablo içi düzenleme kapatılırken kullanılır.
   * Üstteki yeni tahsilat taslağı varsa uyarı durumu korunur.
   */
  const runProtectedEditAction = (action) => {
    if (!editFormHasUnsavedChanges) {
      action()
      return
    }

    if (unsavedChanges?.requestAction) {
      unsavedChanges.requestAction(() => {
        setEditFormHasUnsavedChanges(false)

        if (paymentFormHasUnsavedChanges) {
          unsavedChanges?.markDirty?.()
        } else {
          unsavedChanges?.markClean?.()
        }

        action()
      })
      return
    }

    action()
  }

  const normalizeStudentPackages = (student) => {
    if (
      Array.isArray(student?.enrolledPackages) &&
      student.enrolledPackages.length > 0
    ) {
      return student.enrolledPackages.map(
        (packageItem, index) => {
          const packageId =
            packageItem.packageId ??
            packageItem.id ??
            `package-${index}`

          const studentPackageId =
            packageItem.studentPackageId ??
            packageItem.enrollmentId ??
            packageItem.assignmentId ??
            `${student.id}-${packageId}-${index}`

          const firstPaymentDate = toDateKey(
            packageItem.firstPaymentDate ??
              packageItem.nextPaymentDate ??
              packageItem.dueDate ??
              ''
          )

          const paymentDay = Number(
            packageItem.paymentDay ||
              (firstPaymentDate
                ? firstPaymentDate.slice(8, 10)
                : 1)
          )

          const teacherName =
            packageItem.teacherName ??
            (typeof packageItem.teacher === 'string'
              ? packageItem.teacher
              : packageItem.teacher?.fullName ??
                packageItem.teacher?.name ??
                '')

          return {
            ...packageItem,
            studentPackageId: String(studentPackageId),
            packageId: String(packageId),
            packageName:
              packageItem.packageName ??
              packageItem.name ??
              'Tanımsız Paket',
            instrument:
              packageItem.instrument ??
              packageItem.branch ??
              '',
            teacher: teacherName,
            teacherName,
            lessonDuration:
              packageItem.lessonDuration ??
              packageItem.duration ??
              '',
            lessonCount:
              packageItem.lessonCount ?? 0,
            agreedPrice: Number(
              packageItem.agreedPrice ??
                packageItem.monthlyFee ??
                packageItem.totalPrice ??
                packageItem.packagePrice ??
                0
            ),
            monthlyFee: Number(
              packageItem.monthlyFee ??
                packageItem.agreedPrice ??
                packageItem.totalPrice ??
                packageItem.packagePrice ??
                0
            ),
            paymentDay,
            firstPaymentDate,
            nextPaymentDate: toDateKey(
              packageItem.nextPaymentDate ??
                firstPaymentDate
            )
          }
        }
      )
    }

    if (student?.packageId) {
      const firstPaymentDate = toDateKey(
        student.firstPaymentDate ??
          student.nextPaymentDate ??
          ''
      )

      const teacherName =
        student.teacherName ??
        (typeof student.teacher === 'string'
          ? student.teacher
          : '')

      return [
        {
          studentPackageId: String(
            student.studentPackageId ??
              `${student.id}-${student.packageId}`
          ),
          packageId: String(student.packageId),
          packageName:
            student.packageName || 'Tanımsız Paket',
          instrument: student.instrument || '',
          teacher: teacherName,
          teacherName,
          lessonDuration:
            student.lessonDuration || '',
          lessonCount: student.lessonCount || 0,
          agreedPrice: Number(
            student.agreedPrice ??
              student.monthlyFee ??
              student.totalPrice ??
              0
          ),
          monthlyFee: Number(
            student.monthlyFee ??
              student.agreedPrice ??
              student.totalPrice ??
              0
          ),
          paymentDay: Number(
            student.paymentDay ||
              (firstPaymentDate
                ? firstPaymentDate.slice(8, 10)
                : 1)
          ),
          firstPaymentDate,
          nextPaymentDate: toDateKey(
            student.nextPaymentDate ?? firstPaymentDate
          )
        }
      ]
    }

    return []
  }

  const studentPackageRecords = useMemo(
    () =>
      students.flatMap((student) =>
        normalizeStudentPackages(student).map(
          (packageItem) => ({
            ...packageItem,
            studentId: String(student.id),
            studentName: student.fullName || student.name || 'Öğrenci'
          })
        )
      ),
    [students]
  )

  const getCollectedAmountForPeriod = (
    studentPackageId,
    period,
    paymentList = payments,
    excludedPaymentId = null
  ) =>
    paymentList
      .filter(
        (payment) =>
          getPaymentStudentPackageId(payment) ===
            String(studentPackageId) &&
          getPaymentPeriod(payment) === String(period) &&
          payment.id !== excludedPaymentId
      )
      .reduce(
        (total, payment) =>
          total + getPaymentAmount(payment),
        0
      )

  const findCurrentDueRecord = (
    packageRecord,
    paymentList = payments
  ) => {
    const expectedAmount = Number(
      packageRecord.monthlyFee ??
        packageRecord.agreedPrice ??
        0
    )

    const firstPaymentDate = toDateKey(
      packageRecord.firstPaymentDate ??
        packageRecord.nextPaymentDate ??
        ''
    )

    if (!firstPaymentDate) {
      return {
        dueDate: '',
        period: '',
        expectedAmount,
        collectedAmount: 0,
        remainingAmount: expectedAmount
      }
    }

    let dueDate = firstPaymentDate

    for (let index = 0; index < 120; index += 1) {
      const period = dueDate.slice(0, 7)
      const collectedAmount =
        getCollectedAmountForPeriod(
          packageRecord.studentPackageId,
          period,
          paymentList
        )

      if (collectedAmount < expectedAmount) {
        return {
          dueDate,
          period,
          expectedAmount,
          collectedAmount,
          remainingAmount: Math.max(
            0,
            expectedAmount - collectedAmount
          )
        }
      }

      dueDate = addOneMonth(
        dueDate,
        packageRecord.paymentDay
      )
    }

    return {
      dueDate,
      period: dueDate.slice(0, 7),
      expectedAmount,
      collectedAmount: 0,
      remainingAmount: expectedAmount
    }
  }

  const packageFinancialRecords = useMemo(
    () =>
      studentPackageRecords.map((packageRecord) => {
        const dueRecord = findCurrentDueRecord(
          packageRecord,
          payments
        )

        const dueStatus = getDueStatus({
          dueDate: dueRecord.dueDate,
          expectedAmount: dueRecord.expectedAmount,
          collectedAmount: dueRecord.collectedAmount,
          todayKey: today
        })

        return {
          ...packageRecord,
          ...dueRecord,
          dueStatus
        }
      }),
    [studentPackageRecords, payments, today]
  )

  const selectedStudent = students.find(
    (student) =>
      String(student.id) ===
      String(paymentForm.studentId)
  )

  const selectedStudentPackages = selectedStudent
    ? normalizeStudentPackages(selectedStudent)
    : []

  const selectedStudentPackage =
    selectedStudentPackages.find(
      (packageItem) =>
        String(packageItem.studentPackageId) ===
        String(paymentForm.studentPackageId)
    )

  const selectedPackageRecord =
    packageFinancialRecords.find(
      (record) =>
        String(record.studentPackageId) ===
        String(paymentForm.studentPackageId)
    )

  const selectedPackagePrice = Number(
    selectedPackageRecord?.expectedAmount || 0
  )
  const selectedCollectedAmount = Number(
    selectedPackageRecord?.collectedAmount || 0
  )
  const selectedRemainingDebt = Number(
    selectedPackageRecord?.remainingAmount || 0
  )
  const enteredAmount = Number(paymentForm.amount || 0)
  const remainingAfterPayment = Math.max(
    0,
    selectedRemainingDebt - enteredAmount
  )

  const updateStoredNextPaymentDate = (
    studentPackageId,
    updatedPayments
  ) => {
    const currentPackage = studentPackageRecords.find(
      (item) =>
        String(item.studentPackageId) ===
        String(studentPackageId)
    )

    if (!currentPackage) {
      return
    }

    const nextDueRecord = findCurrentDueRecord(
      currentPackage,
      updatedPayments
    )

    setStudents((currentStudents) =>
      currentStudents.map((student) => {
        const enrolledPackages = Array.isArray(
          student.enrolledPackages
        )
          ? student.enrolledPackages
          : []

        let matchedFirstPackage = false

        const updatedPackages = enrolledPackages.map(
          (packageItem, index) => {
            const normalizedId = String(
              packageItem.studentPackageId ??
                packageItem.enrollmentId ??
                packageItem.assignmentId ??
                `${student.id}-${
                  packageItem.packageId ??
                  packageItem.id
                }-${index}`
            )

            if (
              normalizedId !== String(studentPackageId)
            ) {
              return packageItem
            }

            if (index === 0) {
              matchedFirstPackage = true
            }

            return {
              ...packageItem,
              nextPaymentDate: nextDueRecord.dueDate,
              paymentDay: currentPackage.paymentDay,
              firstPaymentDate:
                packageItem.firstPaymentDate ||
                currentPackage.firstPaymentDate
            }
          }
        )

        const legacyId = String(
          student.studentPackageId ??
            `${student.id}-${student.packageId}`
        )

        const legacyMatches =
          legacyId === String(studentPackageId)

        if (
          !updatedPackages.some(
            (item, index) =>
              String(
                item.studentPackageId ??
                  item.enrollmentId ??
                  item.assignmentId ??
                  `${student.id}-${
                    item.packageId ?? item.id
                  }-${index}`
              ) === String(studentPackageId)
          ) &&
          !legacyMatches
        ) {
          return student
        }

        return {
          ...student,
          enrolledPackages: updatedPackages,
          ...(matchedFirstPackage || legacyMatches
            ? {
                nextPaymentDate:
                  nextDueRecord.dueDate,
                paymentDay:
                  currentPackage.paymentDay,
                firstPaymentDate:
                  student.firstPaymentDate ||
                  currentPackage.firstPaymentDate
              }
            : {})
        }
      })
    )
  }

  const handlePaymentChange = (event) => {
    const { name, value } = event.target

    updatePaymentFormDirty(true)

    if (name === 'studentId') {
      setPaymentForm((current) => ({
        ...current,
        studentId: value,
        studentPackageId: '',
        amount: ''
      }))
      return
    }

    if (name === 'studentPackageId') {
      setPaymentForm((current) => ({
        ...current,
        studentPackageId: value,
        amount: ''
      }))
      return
    }

    setPaymentForm((current) => ({
      ...current,
      [name]: value
    }))
  }

  const validatePaymentForm = () => {
    if (!paymentForm.studentId) {
      alert('Öğrenci seçiniz.')
      return false
    }

    if (!paymentForm.studentPackageId) {
      alert('Öğrenci paketi seçiniz.')
      return false
    }

    if (!selectedStudentPackage || !selectedPackageRecord) {
      alert('Seçilen öğrenci paketi bulunamadı.')
      return false
    }

    if (!selectedPackageRecord.dueDate) {
      alert(
        'Bu paket için ödeme tarihi tanımlanmamıştır. Öğrenci detayından ödeme tarihi ekleyiniz.'
      )
      return false
    }

    if (selectedPackagePrice <= 0) {
      alert('Paketin aylık ücreti geçerli değildir.')
      return false
    }

    if (selectedRemainingDebt <= 0) {
      alert('Bu döneme ait kalan ödeme bulunmamaktadır.')
      return false
    }

    if (!paymentForm.amount || enteredAmount <= 0) {
      alert('Alınan tutar 0’dan büyük olmalıdır.')
      return false
    }

    if (enteredAmount > selectedRemainingDebt) {
      alert(
        `Bu dönem için en fazla ₺${formatPrice(
          selectedRemainingDebt
        )} tahsil edilebilir.`
      )
      return false
    }

    if (!paymentForm.paymentDate) {
      alert('Tahsilat tarihi seçiniz.')
      return false
    }

    if (!paymentForm.paymentMethod) {
      alert('Ödeme yöntemi seçiniz.')
      return false
    }

    return true
  }

  const handlePaymentSubmit = (event) => {
    event.preventDefault()

    if (!validatePaymentForm()) {
      return
    }

    const newPayment = {
      id: Date.now(),
      studentId: String(selectedStudent.id),
      studentName: selectedStudent.fullName,
      studentPackageId: String(
        selectedStudentPackage.studentPackageId
      ),
      packageId: String(
        selectedStudentPackage.packageId
      ),
      packageName:
        selectedStudentPackage.packageName,
      instrument:
        selectedStudentPackage.instrument || '',
      teacher:
        selectedStudentPackage.teacher || '',
      packagePrice: selectedPackagePrice,
      amount: enteredAmount,
      paymentPeriod: selectedPackageRecord.period,
      dueDate: selectedPackageRecord.dueDate,
      paymentDate: paymentForm.paymentDate,
      paymentMethod: paymentForm.paymentMethod,
      referenceNumber:
        paymentForm.referenceNumber.trim(),
      note: paymentForm.note.trim(),
      createdAt: new Date().toISOString()
    }

    const updatedPayments = [...payments, newPayment]

    setPayments(updatedPayments)
    updateStoredNextPaymentDate(
      selectedStudentPackage.studentPackageId,
      updatedPayments
    )

    setPaymentForm({
      ...emptyPaymentForm,
      paymentDate: today
    })

    /*
     * Yeni tahsilat başarıyla kaydedildi.
     * Tablo içi başka bir düzenleme taslağı varsa
     * global uyarı açık kalmaya devam eder.
     */
    updatePaymentFormDirty(false)
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target

    setFilters((current) => ({
      ...current,
      [name]: value
    }))
  }

  const clearFilters = () => setFilters(emptyFilters)

  const performStartEditPayment = (payment) => {
    setEditingPaymentId(payment.id)
    setEditForm({
      amount: getPaymentAmount(payment),
      paymentDate: getPaymentDate(payment),
      paymentMethod: payment.paymentMethod || '',
      referenceNumber:
        payment.referenceNumber || '',
      note: payment.note || ''
    })

    updateEditFormDirty(false)
  }

  const startEditPayment = (payment) => {
    if (editingPaymentId === payment.id) {
      return
    }

    runProtectedEditAction(() =>
      performStartEditPayment(payment)
    )
  }

  const performCancelEditPayment = () => {
    setEditingPaymentId(null)
    setEditForm(null)
    updateEditFormDirty(false)
  }

  const cancelEditPayment = () => {
    runProtectedEditAction(
      performCancelEditPayment
    )
  }

  const handleEditChange = (event) => {
    const { name, value } = event.target

    updateEditFormDirty(true)

    setEditForm((current) => ({
      ...current,
      [name]: value
    }))
  }

  const saveEditPayment = (payment) => {
    const amount = Number(editForm.amount)
    const studentPackageId =
      getPaymentStudentPackageId(payment)
    const period = getPaymentPeriod(payment)

    if (!editForm.amount || amount <= 0) {
      alert('Alınan tutar 0’dan büyük olmalıdır.')
      return
    }

    if (!editForm.paymentDate) {
      alert('Tahsilat tarihi seçiniz.')
      return
    }

    if (!editForm.paymentMethod) {
      alert('Ödeme yöntemi seçiniz.')
      return
    }

    const packageRecord = studentPackageRecords.find(
      (item) =>
        String(item.studentPackageId) ===
        String(studentPackageId)
    )

    const expectedAmount = Number(
      packageRecord?.monthlyFee ??
        packageRecord?.agreedPrice ??
        payment.packagePrice ??
        0
    )

    const otherCollectedAmount =
      getCollectedAmountForPeriod(
        studentPackageId,
        period,
        payments,
        payment.id
      )

    const maximumAllowed = Math.max(
      0,
      expectedAmount - otherCollectedAmount
    )

    if (amount > maximumAllowed) {
      alert(
        `Bu dönem için en fazla ₺${formatPrice(
          maximumAllowed
        )} girilebilir.`
      )
      return
    }

    const updatedPayment = {
      ...payment,
      amount,
      transactionAmount: undefined,
      paidAmount: undefined,
      paymentDate: editForm.paymentDate,
      collectionDate: undefined,
      paymentMethod: editForm.paymentMethod,
      referenceNumber:
        editForm.referenceNumber.trim(),
      note: editForm.note.trim(),
      updatedAt: new Date().toISOString()
    }

    const updatedPayments = payments.map((item) =>
      item.id === payment.id ? updatedPayment : item
    )

    setPayments(updatedPayments)
    updateStoredNextPaymentDate(
      studentPackageId,
      updatedPayments
    )

    /*
     * Düzenleme başarıyla kaydedildiği için
     * uyarı göstermeden düzenleme satırı kapatılır.
     */
    performCancelEditPayment()
  }

  const deletePayment = (payment) => {
    const confirmed = window.confirm(
      'Bu tahsilat kaydını silmek istediğinize emin misiniz?'
    )

    if (!confirmed) {
      return
    }

    const updatedPayments = payments.filter(
      (item) => item.id !== payment.id
    )

    setPayments(updatedPayments)
    updateStoredNextPaymentDate(
      getPaymentStudentPackageId(payment),
      updatedPayments
    )
  }

  const getFinancialRecordForPayment = (payment) => {
    const studentPackageId =
      getPaymentStudentPackageId(payment)
    const packageRecord = studentPackageRecords.find(
      (item) =>
        String(item.studentPackageId) ===
        String(studentPackageId)
    )

    if (!packageRecord) {
      return null
    }

    const period = getPaymentPeriod(payment)
    const expectedAmount = Number(
      packageRecord.monthlyFee ??
        packageRecord.agreedPrice ??
        payment.packagePrice ??
        0
    )
    const collectedAmount =
      getCollectedAmountForPeriod(
        studentPackageId,
        period
      )
    const dueDate =
      toDateKey(payment.dueDate) ||
      createDueDate(
        Number(period.slice(0, 4)),
        Number(period.slice(5, 7)) - 1,
        packageRecord.paymentDay
      )

    return {
      ...packageRecord,
      period,
      dueDate,
      expectedAmount,
      collectedAmount,
      remainingAmount: Math.max(
        0,
        expectedAmount - collectedAmount
      ),
      dueStatus: getDueStatus({
        dueDate,
        expectedAmount,
        collectedAmount,
        todayKey: today
      })
    }
  }

  const getCollectionStatus = (record) => {
    if (!record) {
      return {
        label: 'Kayıtlı',
        className: 'pending',
        filterValue: 'Kayıtlı'
      }
    }

    if (Number(record.remainingAmount || 0) <= 0) {
      return {
        label: 'Tamamlandı',
        className: 'paid',
        filterValue: 'Tamamlandı'
      }
    }

    return {
      label: 'Kısmi Ödeme',
      className: 'partial',
      filterValue: 'Kısmi Ödeme'
    }
  }

  const filteredPayments = payments
    .filter((payment) => {
      const searchText = filters.searchText
        .trim()
        .toLocaleLowerCase('tr-TR')
      const paymentDate = getPaymentDate(payment)
      const record = getFinancialRecordForPayment(
        payment
      )
      const status =
        getCollectionStatus(record).filterValue

      const searchableText = [
        payment.studentName,
        payment.packageName,
        payment.teacher,
        payment.referenceNumber,
        formatPeriod(getPaymentPeriod(payment))
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR')

      return (
        (searchText === '' ||
          searchableText.includes(searchText)) &&
        (filters.status === '' ||
          status === filters.status) &&
        (filters.paymentMethod === '' ||
          payment.paymentMethod ===
            filters.paymentMethod) &&
        (filters.startDate === '' ||
          paymentDate >= filters.startDate) &&
        (filters.endDate === '' ||
          paymentDate <= filters.endDate)
      )
    })
    .sort((firstPayment, secondPayment) => {
      if (sortOption === 'newest') {
        return getPaymentDate(secondPayment).localeCompare(
          getPaymentDate(firstPayment)
        )
      }

      if (sortOption === 'oldest') {
        return getPaymentDate(firstPayment).localeCompare(
          getPaymentDate(secondPayment)
        )
      }

      if (sortOption === 'studentAsc') {
        return String(
          firstPayment.studentName || ''
        ).localeCompare(
          String(secondPayment.studentName || ''),
          'tr'
        )
      }

      if (sortOption === 'studentDesc') {
        return String(
          secondPayment.studentName || ''
        ).localeCompare(
          String(firstPayment.studentName || ''),
          'tr'
        )
      }

      if (sortOption === 'amountDesc') {
        return (
          getPaymentAmount(secondPayment) -
          getPaymentAmount(firstPayment)
        )
      }

      if (sortOption === 'amountAsc') {
        return (
          getPaymentAmount(firstPayment) -
          getPaymentAmount(secondPayment)
        )
      }

      return 0
    })

  const currentMonthKey = today.slice(0, 7)
  const currentMonthLabel = formatPeriod(currentMonthKey)

  /*
   * Bu tablo yalnızca içinde bulunduğumuz ayda gerçekten
   * tahsilat yapılmış öğrenci-paket dönemlerini gösterir.
   * Aynı dönem için birden fazla ödeme varsa tek satırda
   * birleştirilir ve bu ay alınan toplam tutar gösterilir.
   */
  const monthlyCollectedRecords = (() => {
    const groupedRecords = new Map()

    payments.forEach((payment) => {
      const paymentDate = getPaymentDate(payment)

      if (
        !paymentDate ||
        paymentDate.slice(0, 7) !== currentMonthKey
      ) {
        return
      }

      const studentPackageId =
        getPaymentStudentPackageId(payment)
      const period = getPaymentPeriod(payment)
      const groupKey = `${studentPackageId}-${period}`
      const amount = getPaymentAmount(payment)
      const existingRecord = groupedRecords.get(groupKey)

      if (existingRecord) {
        existingRecord.currentMonthCollectedAmount += amount
        existingRecord.transactionCount += 1

        if (
          paymentDate > existingRecord.lastPaymentDate
        ) {
          existingRecord.lastPaymentDate = paymentDate
        }

        return
      }

      const financialRecord =
        getFinancialRecordForPayment(payment)
      const expectedAmount = Number(
        financialRecord?.expectedAmount ??
          payment.packagePrice ??
          0
      )
      const collectedAmount = Number(
        financialRecord?.collectedAmount ?? amount
      )
      const remainingAmount = Math.max(
        0,
        expectedAmount - collectedAmount
      )

      groupedRecords.set(groupKey, {
        groupKey,
        studentPackageId,
        studentName:
          payment.studentName || 'Öğrenci',
        packageName:
          payment.packageName || 'Tanımsız Paket',
        period,
        lastPaymentDate: paymentDate,
        expectedAmount,
        collectedAmount,
        currentMonthCollectedAmount: amount,
        remainingAmount,
        transactionCount: 1,
        collectionStatus: getCollectionStatus({
          remainingAmount
        })
      })
    })

    return [...groupedRecords.values()].sort(
      (firstRecord, secondRecord) =>
        secondRecord.lastPaymentDate.localeCompare(
          firstRecord.lastPaymentDate
        )
    )
  })()

  const totalReceivable =
    packageFinancialRecords.reduce(
      (total, record) =>
        total + Number(record.expectedAmount || 0),
      0
    )

  const totalCollected =
    packageFinancialRecords.reduce(
      (total, record) =>
        total + Number(record.collectedAmount || 0),
      0
    )

  const totalRemaining =
    packageFinancialRecords.reduce(
      (total, record) =>
        total + Number(record.remainingAmount || 0),
      0
    )

  const criticalOverdueCount =
    packageFinancialRecords.filter(
      (record) =>
        record.remainingAmount > 0 &&
        record.dueStatus.filterValue === 'Gecikti'
    ).length

  return (
    <div className="dashboard-shell">
      <section className="page-card">
        <div>
          <span className="page-badge">
            Tahsilat Yönetimi
          </span>
          <h1>Öğrenci Tahsilatları</h1>
          <p>
            Öğrenci ödemelerini kaydedin, bu ay alınan
            tahsilatları ve tüm ödeme hareketlerini görüntüleyin.
          </p>
        </div>
      </section>

      <section className="payment-metric-grid">
        <div className="payment-metric-card blue">
          <span>Bu Dönem Beklenen</span>
          <h3>₺{formatPrice(totalReceivable)}</h3>
        </div>

        <div className="payment-metric-card green">
          <span>Bu Dönem Tahsil Edilen</span>
          <h3>₺{formatPrice(totalCollected)}</h3>
        </div>

        <div className="payment-metric-card red">
          <span>Bu Dönem Kalan</span>
          <h3>₺{formatPrice(totalRemaining)}</h3>
        </div>

        <div className="payment-metric-card gray">
          <span>Kritik Gecikme</span>
          <h3>{criticalOverdueCount}</h3>
        </div>
      </section>

      <section className="payment-form-card">
        <div className="payment-form-heading">
          <h2>Yeni Tahsilat Kaydı</h2>
          <p>
            Tahsilatı öğrencinin açık olan aylık
            ödeme dönemine kaydedin.
          </p>
        </div>

        <form onSubmit={handlePaymentSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>
                Öğrenci <RequiredStar />
              </label>
              <select
                name="studentId"
                value={paymentForm.studentId}
                onChange={handlePaymentChange}
              >
                <option value="">
                  Öğrenci seçiniz
                </option>
                {students.map((student) => (
                  <option
                    key={student.id}
                    value={student.id}
                  >
                    {student.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>
                Öğrenci Paketi <RequiredStar />
              </label>
              <select
                name="studentPackageId"
                value={
                  paymentForm.studentPackageId
                }
                onChange={handlePaymentChange}
                disabled={!paymentForm.studentId}
              >
                <option value="">
                  Paket seçiniz
                </option>
                {selectedStudentPackages.map(
                  (packageItem) => (
                    <option
                      key={
                        packageItem.studentPackageId
                      }
                      value={
                        packageItem.studentPackageId
                      }
                    >
                      {packageItem.packageName}
                      {packageItem.teacher
                        ? ` - ${packageItem.teacher}`
                        : ''}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {selectedPackageRecord && (
            <div className="selected-payment-package">
              <div className="selected-package-heading">
                <div>
                  <span>Seçilen Öğrenci Paketi</span>
                  <h3>
                    {selectedPackageRecord.packageName}
                  </h3>
                  <p>
                    {selectedPackageRecord.teacher ||
                      'Öğretmen belirtilmemiş'}
                    {' · '}
                    {formatPeriod(
                      selectedPackageRecord.period
                    )}
                    {' · Son ödeme: '}
                    {formatDate(
                      selectedPackageRecord.dueDate
                    )}
                  </p>
                </div>

                <span
                  className={`payment-status ${selectedPackageRecord.dueStatus.className}`}
                >
                  {selectedPackageRecord.dueStatus.label}
                </span>
              </div>

              <div className="selected-package-finance-grid">
                <div className="selected-package-finance-item">
                  <small>Aylık Ücret</small>
                  <strong>
                    ₺{formatPrice(selectedPackagePrice)}
                  </strong>
                </div>
                <div className="selected-package-finance-item">
                  <small>Bu Dönem Ödenen</small>
                  <strong>
                    ₺{formatPrice(selectedCollectedAmount)}
                  </strong>
                </div>
                <div className="selected-package-finance-item remaining">
                  <small>Bu Dönem Kalan</small>
                  <strong>
                    ₺{formatPrice(selectedRemainingDebt)}
                  </strong>
                </div>
              </div>

              <small className="payment-due-detail">
                {selectedPackageRecord.dueStatus.detail}
              </small>
            </div>
          )}

          <div className="form-grid payment-entry-grid">
            <div className="form-group">
              <label>
                Alınan Tutar <RequiredStar />
              </label>
              <input
                type="number"
                name="amount"
                value={paymentForm.amount}
                onChange={handlePaymentChange}
                placeholder="Örn: 2000"
                min="0.01"
                max={
                  selectedRemainingDebt || undefined
                }
                step="0.01"
                disabled={!selectedPackageRecord}
              />
              {selectedPackageRecord &&
                enteredAmount > 0 && (
                  <small className="payment-field-help">
                    Bu işlemden sonra dönem borcu:
                    {' ₺'}
                    {formatPrice(
                      remainingAfterPayment
                    )}
                  </small>
                )}
            </div>

            <div className="form-group">
              <label>
                Tahsilat Tarihi <RequiredStar />
              </label>
              <input
                type="date"
                name="paymentDate"
                value={paymentForm.paymentDate}
                onChange={handlePaymentChange}
              />
            </div>

            <div className="form-group">
              <label>
                Ödeme Yöntemi <RequiredStar />
              </label>
              <select
                name="paymentMethod"
                value={paymentForm.paymentMethod}
                onChange={handlePaymentChange}
              >
                <option value="">Seçiniz</option>
                <option value="Nakit">Nakit</option>
                <option value="Havale / EFT">
                  Havale / EFT
                </option>
                <option value="Kredi Kartı">
                  Kredi Kartı
                </option>
                <option value="Banka Kartı">
                  Banka Kartı
                </option>
              </select>
            </div>

            <div className="form-group">
              <label>İşlem / Dekont Numarası</label>
              <input
                name="referenceNumber"
                value={
                  paymentForm.referenceNumber
                }
                onChange={handlePaymentChange}
                placeholder="İsteğe bağlı"
              />
            </div>

            <div className="form-group full-width">
              <label>Not</label>
              <textarea
                name="note"
                value={paymentForm.note}
                onChange={handlePaymentChange}
                placeholder="Tahsilat ile ilgili açıklama"
              />
            </div>
          </div>

          <div className="form-actions payment-form-actions">
            <button
              type="submit"
              className="save-button"
              disabled={!selectedPackageRecord}
            >
              Tahsilatı Kaydet
            </button>
          </div>
        </form>
      </section>

      <section className="lesson-table-card payment-list-card">
        <div className="table-head payment-list-head">
          <div>
            <h2>Bu Ay Alınan Ödemeler</h2>
            <p>
              {currentMonthLabel} ayında tahsilat yapılan
              öğrenci paketlerinin özeti
            </p>
          </div>
          <button
            type="button"
            className="lesson-count"
          >
            {monthlyCollectedRecords.length} kayıt
          </button>
        </div>

        <div className="payment-table-wrapper">
          <table className="lesson-table payment-table">
            <thead>
              <tr>
                <th>Öğrenci</th>
                <th>Paket</th>
                <th>Dönem</th>
                <th>Son Tahsilat</th>
                <th>Beklenen</th>
                <th>Bu Ay Alınan</th>
                <th>Kalan</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {monthlyCollectedRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="empty-table"
                  >
                    Bu ay henüz tahsilat kaydı
                    bulunmamaktadır.
                  </td>
                </tr>
              ) : (
                monthlyCollectedRecords.map((record) => (
                  <tr key={record.groupKey}>
                    <td>{record.studentName}</td>
                    <td>{record.packageName}</td>
                    <td>
                      {formatPeriod(record.period)}
                    </td>
                    <td>
                      {formatDate(record.lastPaymentDate)}
                      {record.transactionCount > 1 && (
                        <small className="payment-status-detail">
                          {record.transactionCount} tahsilat işlemi
                        </small>
                      )}
                    </td>
                    <td>
                      ₺{formatPrice(record.expectedAmount)}
                    </td>
                    <td>
                      ₺{formatPrice(
                        record.currentMonthCollectedAmount
                      )}
                    </td>
                    <td>
                      ₺{formatPrice(record.remainingAmount)}
                    </td>
                    <td>
                      <span
                        className={`payment-status ${record.collectionStatus.className}`}
                      >
                        {record.collectionStatus.label}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="lesson-table-card payment-list-card">
        <div className="payment-list-top">
          <div className="payment-filter-header">
            <div>
              <h2>Tahsilat Hareketleri</h2>
              <p>
                Kayıtları öğrenci, dönem, yöntem,
                tarih veya duruma göre süzün.
              </p>
            </div>
            <button
              type="button"
              className="cancel-button"
              onClick={clearFilters}
            >
              Filtreleri Temizle
            </button>
          </div>

          <div className="payment-filter-grid">
            <div className="form-group">
              <label>Öğrenci / Paket / Dönem Ara</label>
              <input
                name="searchText"
                value={filters.searchText}
                onChange={handleFilterChange}
                placeholder="Arama yapın"
              />
            </div>

            <div className="form-group">
              <label>Durum</label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="">Tümü</option>
                <option value="Kısmi Ödeme">
                  Kısmi Ödeme
                </option>
                <option value="Tamamlandı">
                  Tamamlandı
                </option>
              </select>
            </div>

            <div className="form-group">
              <label>Ödeme Yöntemi</label>
              <select
                name="paymentMethod"
                value={filters.paymentMethod}
                onChange={handleFilterChange}
              >
                <option value="">Tümü</option>
                <option value="Nakit">Nakit</option>
                <option value="Havale / EFT">
                  Havale / EFT
                </option>
                <option value="Kredi Kartı">
                  Kredi Kartı
                </option>
                <option value="Banka Kartı">
                  Banka Kartı
                </option>
              </select>
            </div>

            <div className="form-group">
              <label>Başlangıç Tarihi</label>
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
              />
            </div>

            <div className="form-group">
              <label>Bitiş Tarihi</label>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
              />
            </div>
          </div>
        </div>

        <div className="table-head payment-list-head">
          <div>
            <h3>Tahsilat Listesi</h3>
            <p>Öğrencilerden alınan ödeme hareketleri</p>
          </div>

          <div className="payment-list-tools">
            <div className="payment-sort-box">
              <label>Sırala</label>
              <select
                value={sortOption}
                onChange={(event) =>
                  setSortOption(event.target.value)
                }
              >
                <option value="newest">
                  En yeni tarih
                </option>
                <option value="oldest">
                  En eski tarih
                </option>
                <option value="studentAsc">
                  Öğrenci adı A-Z
                </option>
                <option value="studentDesc">
                  Öğrenci adı Z-A
                </option>
                <option value="amountDesc">
                  Tutar yüksek-düşük
                </option>
                <option value="amountAsc">
                  Tutar düşük-yüksek
                </option>
              </select>
            </div>
            <button
              className="lesson-count"
              type="button"
            >
              {filteredPayments.length} kayıt
            </button>
          </div>
        </div>

        <div className="payment-table-wrapper">
          <table className="lesson-table payment-table">
            <thead>
              <tr>
                <th>Öğrenci</th>
                <th>Paket</th>
                <th>Dönem</th>
                <th>Alınan Tutar</th>
                <th>Tahsilat Tarihi</th>
                <th>Ödeme Yöntemi</th>
                <th>Dekont No</th>
                <th>Ödeme Durumu</th>
                <th>İşlem</th>
              </tr>
            </thead>

            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="empty-table"
                  >
                    Filtrelere uygun tahsilat
                    hareketi bulunmamaktadır.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => {
                  const financialRecord =
                    getFinancialRecordForPayment(
                      payment
                    )
                  const status =
                    getCollectionStatus(financialRecord)

                  return (
                    <tr key={payment.id}>
                      <td>{payment.studentName}</td>
                      <td>{payment.packageName}</td>
                      <td>
                        {formatPeriod(
                          getPaymentPeriod(payment)
                        )}
                      </td>
                      <td>
                        {editingPaymentId ===
                        payment.id ? (
                          <input
                            className="table-edit-input"
                            type="number"
                            name="amount"
                            value={editForm.amount}
                            onChange={handleEditChange}
                            min="0.01"
                            step="0.01"
                          />
                        ) : (
                          `₺${formatPrice(
                            getPaymentAmount(payment)
                          )}`
                        )}
                      </td>
                      <td>
                        {editingPaymentId ===
                        payment.id ? (
                          <input
                            className="table-edit-input"
                            type="date"
                            name="paymentDate"
                            value={editForm.paymentDate}
                            onChange={handleEditChange}
                          />
                        ) : (
                          formatDate(
                            getPaymentDate(payment)
                          )
                        )}
                      </td>
                      <td>
                        {editingPaymentId ===
                        payment.id ? (
                          <select
                            className="table-edit-input"
                            name="paymentMethod"
                            value={editForm.paymentMethod}
                            onChange={handleEditChange}
                          >
                            <option value="">
                              Seçiniz
                            </option>
                            <option value="Nakit">
                              Nakit
                            </option>
                            <option value="Havale / EFT">
                              Havale / EFT
                            </option>
                            <option value="Kredi Kartı">
                              Kredi Kartı
                            </option>
                            <option value="Banka Kartı">
                              Banka Kartı
                            </option>
                          </select>
                        ) : (
                          payment.paymentMethod || '-'
                        )}
                      </td>
                      <td>
                        {payment.referenceNumber || '-'}
                      </td>
                      <td>
                        <span
                          className={`payment-status ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td>
                        {editingPaymentId ===
                        payment.id ? (
                          <div className="payment-action-row">
                            <button
                              type="button"
                              className="save-mini-button"
                              onClick={() =>
                                saveEditPayment(payment)
                              }
                            >
                              Kaydet
                            </button>
                            <button
                              type="button"
                              className="cancel-mini-button"
                              onClick={cancelEditPayment}
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <div className="payment-action-row">
                            <button
                              type="button"
                              className="edit-mini-button"
                              onClick={() =>
                                startEditPayment(payment)
                              }
                            >
                              Düzenle
                            </button>
                            <button
                              type="button"
                              className="delete-button"
                              onClick={() =>
                                deletePayment(payment)
                              }
                            >
                              Sil
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default Payments