import { useMemo, useState } from 'react'
import RequiredStar from '../components/RequiredStar'

import {
  createPayment,
  deletePayment as deletePaymentFromDb,
  updatePayment,
  updateStudentPackageNextPaymentDate
} from '../services/paymentService'

import {
  createDueDate,
  formatDate,
  formatPeriod,
  formatPrice,
  getDateKey,
  getTodayKey
} from '../utils/dateHelpers'

import {
  findCurrentDueRecord,
  getCollectedAmountForPeriod,
  getDueStatus,
  getPaymentAmount,
  getPaymentDate,
  getPaymentPeriod,
  getPaymentStudentPackageId,
  isActivePayment
} from '../utils/paymentSchedule'

import {
  matchesSearchQuery
} from '../utils/textHelpers'

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

  const [isSavingPayment, setIsSavingPayment] =
    useState(false)

  const [updatingPaymentId, setUpdatingPaymentId] =
    useState(null)

  const [deletingPaymentId, setDeletingPaymentId] =
    useState(null)

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

          const firstPaymentDate = getDateKey(
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
            teacherId:
              packageItem.teacherId ??
              packageItem.defaultTeacherId ??
              packageItem.teacher?.id ??
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
            nextPaymentDate: getDateKey(
              packageItem.nextPaymentDate ??
                firstPaymentDate
            )
          }
        }
      )
    }

    if (student?.packageId) {
      const firstPaymentDate = getDateKey(
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
          teacherId:
            student.teacherId ??
            student.defaultTeacherId ??
            '',
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
          nextPaymentDate: getDateKey(
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

  const updateStoredNextPaymentDate = async (
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

    await updateStudentPackageNextPaymentDate(
      studentPackageId,
      nextDueRecord.dueDate
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

    if (
      !paymentForm.amount ||
      !Number.isFinite(enteredAmount) ||
      enteredAmount <= 0
    ) {
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

  const handlePaymentSubmit = async (event) => {
    event.preventDefault()

    if (isSavingPayment) {
      return
    }

    if (!validatePaymentForm()) {
      return
    }

    setIsSavingPayment(true)

    try {
      const savedPayment =
        await createPayment({
          studentId:
            selectedStudent.id,
          studentPackageId:
            selectedStudentPackage.studentPackageId,
          packageId:
            selectedStudentPackage.packageId,
          teacherId:
            selectedStudentPackage.teacherId || null,
          amount:
            enteredAmount,
          paymentPeriod:
            selectedPackageRecord.period,
          dueDate:
            selectedPackageRecord.dueDate,
          paymentDate:
            paymentForm.paymentDate,
          paymentMethod:
            paymentForm.paymentMethod,
          referenceNumber:
            paymentForm.referenceNumber,
          note:
            paymentForm.note
        })

      const updatedPayments = [
        ...payments,
        savedPayment
      ]

      setPayments(updatedPayments)

      await updateStoredNextPaymentDate(
        selectedStudentPackage.studentPackageId,
        updatedPayments
      )

      setPaymentForm({
        ...emptyPaymentForm,
        paymentDate: today
      })

      updatePaymentFormDirty(false)
    } catch (error) {
      console.error(
        'Tahsilat kaydetme hatası:',
        error
      )

      alert(
        error instanceof Error
          ? error.message
          : 'Tahsilat kaydedilemedi.'
      )
    } finally {
      setIsSavingPayment(false)
    }
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
    if (String(editingPaymentId) === String(payment.id)) {
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

  const saveEditPayment = async (payment) => {
    if (
      String(updatingPaymentId) ===
      String(payment.id)
    ) {
      return
    }

    const amount = Number(editForm.amount)
    const studentPackageId =
      getPaymentStudentPackageId(payment)
    const period = getPaymentPeriod(payment)

    if (
      !editForm.amount ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
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

    setUpdatingPaymentId(payment.id)

    try {
      const savedPayment =
        await updatePayment(
          payment.id,
          {
            amount,
            paymentDate:
              editForm.paymentDate,
            paymentMethod:
              editForm.paymentMethod,
            referenceNumber:
              editForm.referenceNumber,
            note:
              editForm.note
          }
        )

      const updatedPayments = payments.map(
        (item) =>
          String(item.id) ===
          String(payment.id)
            ? savedPayment
            : item
      )

      setPayments(updatedPayments)

      await updateStoredNextPaymentDate(
        studentPackageId,
        updatedPayments
      )

      performCancelEditPayment()
    } catch (error) {
      console.error(
        'Tahsilat güncelleme hatası:',
        error
      )

      alert(
        error instanceof Error
          ? error.message
          : 'Tahsilat güncellenemedi.'
      )
    } finally {
      setUpdatingPaymentId(null)
    }
  }

  const deletePayment = async (payment) => {
    if (
      String(deletingPaymentId) ===
      String(payment.id)
    ) {
      return
    }

    const confirmed = window.confirm(
      'Bu tahsilat kaydını silmek istediğinize emin misiniz?'
    )

    if (!confirmed) {
      return
    }

    setDeletingPaymentId(payment.id)

    try {
      await deletePaymentFromDb(
        payment.id
      )

      const updatedPayments = payments.filter(
        (item) =>
          String(item.id) !==
          String(payment.id)
      )

      setPayments(updatedPayments)

      await updateStoredNextPaymentDate(
        getPaymentStudentPackageId(payment),
        updatedPayments
      )
    } catch (error) {
      console.error(
        'Tahsilat silme hatası:',
        error
      )

      alert(
        error instanceof Error
          ? error.message
          : 'Tahsilat silinemedi.'
      )
    } finally {
      setDeletingPaymentId(null)
    }
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
        period,
        payments
      )
    const dueDate =
      getDateKey(payment.dueDate) ||
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
      if (!isActivePayment(payment)) {
        return false
      }
      const paymentDate = getPaymentDate(payment)
      const record = getFinancialRecordForPayment(
        payment
      )
      const status =
        getCollectionStatus(record).filterValue

      return (
        matchesSearchQuery(
          [
            payment.studentName,
            payment.packageName,
            payment.teacher,
            payment.referenceNumber,
            formatPeriod(getPaymentPeriod(payment))
          ],
          filters.searchText
        ) &&
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
      if (!isActivePayment(payment)) {
        return
      }

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
              disabled={
                !selectedPackageRecord ||
                isSavingPayment
              }
            >
              {isSavingPayment
                ? 'Kaydediliyor...'
                : 'Tahsilatı Kaydet'}
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
          <table className="lesson-table payment-table monthly-payment-table">
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
          <table className="lesson-table payment-table payment-movements-table">
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
                        {String(editingPaymentId) ===
                        String(payment.id) ? (
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
                        {String(editingPaymentId) ===
                        String(payment.id) ? (
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
                        {String(editingPaymentId) ===
                        String(payment.id) ? (
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
                        {String(editingPaymentId) ===
                        String(payment.id) ? (
                          <div className="payment-action-row">
                            <button
                              type="button"
                              className="save-mini-button"
                              onClick={() =>
                                saveEditPayment(payment)
                              }
                              disabled={
                                String(updatingPaymentId) ===
                                String(payment.id)
                              }
                            >
                              {String(updatingPaymentId) ===
                              String(payment.id)
                                ? 'Kaydediliyor...'
                                : 'Kaydet'}
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
                              disabled={
                                String(deletingPaymentId) ===
                                String(payment.id)
                              }
                            >
                              {String(deletingPaymentId) ===
                              String(payment.id)
                                ? 'Siliniyor...'
                                : 'Sil'}
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