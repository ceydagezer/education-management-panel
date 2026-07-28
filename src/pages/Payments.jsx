import { Fragment, useEffect, useMemo, useState } from 'react'
import RequiredStar from '../components/RequiredStar'

import {
  createPayment,
  deletePayment as deletePaymentFromDb,
  getPaymentMovementsPage,
  getPaymentsByStudentPackage,
  updatePayment,
  updateStudentPackageNextPaymentDate
} from '../services/paymentService'

import {
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
  getPaymentStudentPackageId
} from '../utils/paymentSchedule'

function Payments({
  students = [],
  setStudents = () => {},
  unsavedChanges
}) {
  const today = getTodayKey()

  const activeStudents =
    useMemo(
      () =>
        students.filter(
          (student) => {
            const normalizedStatus =
              String(
                student?.status || ''
              )
                .trim()
                .toLocaleLowerCase(
                  'tr-TR'
                )

            return (
              student?.isActive !==
                false &&
              student?.isArchived !==
                true &&
              student?.isAnonymized !==
                true &&
              normalizedStatus !==
                'pasif' &&
              normalizedStatus !==
                'arşiv'
            )
          }
        ),
      [students]
    )

  const emptyPaymentForm =
    useMemo(
      () => ({
        studentId: '',
        studentPackageId: '',
        amount: '',
        paymentDate: today,
        paymentMethod: '',
        referenceNumber: '',
        note: ''
      }),
      [today]
    )

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

  const [payments, setPayments] =
    useState([])

  const [
    paymentContextLoading,
    setPaymentContextLoading
  ] = useState(false)

  const [
    paymentContextError,
    setPaymentContextError
  ] = useState('')

  const [
    paymentContextReloadKey,
    setPaymentContextReloadKey
  ] = useState(0)

  const [movementPayments, setMovementPayments] =
    useState([])
  const [movementTotal, setMovementTotal] =
    useState(0)
  const [movementPage, setMovementPage] =
    useState(1)
  const [movementPageSize, setMovementPageSize] =
    useState(10)
  const [movementLoading, setMovementLoading] =
    useState(true)
  const [movementError, setMovementError] =
    useState('')
  const [movementReloadKey, setMovementReloadKey] =
    useState(0)

  const [editingPaymentId, setEditingPaymentId] =
    useState(null)
  const [editForm, setEditForm] = useState(null)

  const [
    expandedPaymentId,
    setExpandedPaymentId
  ] = useState(null)

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

  useEffect(() => {
    if (
      !paymentForm.studentId
    ) {
      return
    }

    const selectedStudentIsActive =
      activeStudents.some(
        (student) =>
          String(student.id) ===
          String(
            paymentForm.studentId
          )
      )

    if (
      !selectedStudentIsActive
    ) {
      setPaymentForm(
        emptyPaymentForm
      )
      setPayments([])
      setPaymentContextError('')
    }
  }, [
    activeStudents,
    emptyPaymentForm,
    paymentForm.studentId
  ])

  useEffect(() => {
    let isMounted = true

    const timeoutId = window.setTimeout(
      async () => {
        setMovementLoading(true)
        setMovementError('')

        try {
          const result =
            await getPaymentMovementsPage({
              page: movementPage,
              pageSize: movementPageSize,
              filters,
              sortOption
            })

          if (!isMounted) {
            return
          }

          const calculatedTotalPages =
            Math.max(
              1,
              Math.ceil(
                result.total /
                  movementPageSize
              )
            )

          if (
            movementPage >
            calculatedTotalPages
          ) {
            setMovementPage(
              calculatedTotalPages
            )
            return
          }

          setMovementPayments(
            result.data
          )
          setMovementTotal(
            result.total
          )
        } catch (error) {
          console.error(
            'Tahsilat hareketleri alınamadı:',
            error
          )

          if (isMounted) {
            const isOffline =
              typeof navigator !==
                'undefined' &&
              !navigator.onLine

            const errorMessage =
              String(
                error?.message || ''
              ).toLocaleLowerCase(
                'tr-TR'
              )

            const isNetworkError =
              errorMessage.includes(
                'failed to fetch'
              ) ||
              errorMessage.includes(
                'network'
              ) ||
              errorMessage.includes(
                'fetch'
              )

            setMovementError(
              isOffline
                ? 'İnternet bağlantısı bulunamadı. Tahsilat hareketleri yüklenemedi.'
                : isNetworkError
                  ? 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyiniz.'
                  : 'Tahsilat hareketleri şu anda yüklenemedi.'
            )
          }
        } finally {
          if (isMounted) {
            setMovementLoading(false)
          }
        }
      },
      filters.searchText.trim()
        ? 350
        : 0
    )

    return () => {
      isMounted = false
      window.clearTimeout(timeoutId)
    }
  }, [
    movementPage,
    movementPageSize,
    filters,
    sortOption,
    movementReloadKey
  ])

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
    () => {
      if (!paymentForm.studentPackageId) {
        return []
      }

      return studentPackageRecords
        .filter(
          (packageRecord) =>
            String(
              packageRecord.studentPackageId
            ) ===
            String(
              paymentForm.studentPackageId
            )
        )
        .map((packageRecord) => {
          const dueRecord =
            findCurrentDueRecord(
              packageRecord,
              payments
            )

          const dueStatus =
            getDueStatus({
              dueDate:
                dueRecord.dueDate,
              expectedAmount:
                dueRecord.expectedAmount,
              collectedAmount:
                dueRecord.collectedAmount,
              todayKey: today
            })

          return {
            ...packageRecord,
            ...dueRecord,
            dueStatus
          }
        })
    },
    [
      studentPackageRecords,
      paymentForm.studentPackageId,
      payments,
      today
    ]
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

  useEffect(() => {
    const studentPackageId =
      paymentForm.studentPackageId

    if (!studentPackageId) {
      setPayments([])
      setPaymentContextError('')
      setPaymentContextLoading(false)
      return undefined
    }

    let isMounted = true

    const loadSelectedPackagePayments =
      async () => {
        setPaymentContextLoading(true)
        setPaymentContextError('')

        try {
          const result =
            await getPaymentsByStudentPackage(
              studentPackageId
            )

          if (isMounted) {
            setPayments(result)
          }
        } catch (error) {
          console.error(
            'Seçilen paket tahsilatları alınamadı:',
            error
          )

          if (isMounted) {
            const isOffline =
              typeof navigator !==
                'undefined' &&
              !navigator.onLine

            const errorMessage =
              String(
                error?.message || ''
              ).toLocaleLowerCase(
                'tr-TR'
              )

            const isNetworkError =
              errorMessage.includes(
                'failed to fetch'
              ) ||
              errorMessage.includes(
                'network'
              ) ||
              errorMessage.includes(
                'fetch'
              )

            setPayments([])

            setPaymentContextError(
              isOffline
                ? 'İnternet bağlantısı bulunamadı. Paket tahsilatları yüklenemedi.'
                : isNetworkError
                  ? 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyiniz.'
                  : 'Seçilen paketin tahsilatları şu anda yüklenemedi.'
            )
          }
        } finally {
          if (isMounted) {
            setPaymentContextLoading(false)
          }
        }
      }

    loadSelectedPackagePayments()

    return () => {
      isMounted = false
    }
  }, [
    paymentForm.studentPackageId,
    paymentContextReloadKey
  ])

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
      setMovementReloadKey(
        (current) => current + 1
      )

      setPaymentContextReloadKey(
        (current) => current + 1
      )

      await updateStoredNextPaymentDate(
        selectedStudentPackage.studentPackageId,
        updatedPayments
      )

      setPaymentForm((current) => ({
        ...emptyPaymentForm,
        studentId: current.studentId,
        studentPackageId:
          current.studentPackageId,
        paymentDate: today
      }))

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

  const formatDateInputValue = (date) => {
    const year = date.getFullYear()
    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0')
    const day = String(
      date.getDate()
    ).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  const applyQuickDateFilter = (rangeName) => {
    const currentDate = new Date(
      `${today}T12:00:00`
    )

    let startDate = ''
    let endDate = ''

    if (rangeName === 'today') {
      startDate = today
      endDate = today
    }

    if (rangeName === 'thisWeek') {
      const dayOfWeek =
        currentDate.getDay() || 7

      const weekStart =
        new Date(currentDate)

      weekStart.setDate(
        currentDate.getDate() -
          dayOfWeek +
          1
      )

      startDate =
        formatDateInputValue(
          weekStart
        )
      endDate = today
    }

    if (rangeName === 'thisMonth') {
      const monthStart =
        new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        )

      startDate =
        formatDateInputValue(
          monthStart
        )
      endDate = today
    }

    if (rangeName === 'lastMonth') {
      const lastMonthStart =
        new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - 1,
          1
        )

      const lastMonthEnd =
        new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          0
        )

      startDate =
        formatDateInputValue(
          lastMonthStart
        )
      endDate =
        formatDateInputValue(
          lastMonthEnd
        )
    }

    setMovementPage(1)

    setFilters((current) => ({
      ...current,
      startDate,
      endDate
    }))
  }

  const handleFilterChange = (event) => {
    const { name, value } = event.target

    setMovementPage(1)

    setFilters((current) => ({
      ...current,
      [name]: value
    }))
  }

  const clearFilters = () => {
    setFilters(emptyFilters)
    setMovementPage(1)
  }

  const togglePaymentDetails = (paymentId) => {
    setExpandedPaymentId((current) =>
      String(current) === String(paymentId)
        ? null
        : paymentId
    )
  }

  const formatDateTime = (value) => {
    if (!value) {
      return '-'
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return '-'
    }

    return date.toLocaleString('tr-TR', {
      dateStyle: 'short',
      timeStyle: 'short'
    })
  }

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
      setMovementReloadKey(
        (current) => current + 1
      )

      setPaymentContextReloadKey(
        (current) => current + 1
      )

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
      setMovementReloadKey(
        (current) => current + 1
      )

      setPaymentContextReloadKey(
        (current) => current + 1
      )

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

  const movementTotalPages = Math.max(
    1,
    Math.ceil(
      movementTotal /
        movementPageSize
    )
  )

  const movementFirstRecord =
    movementTotal === 0
      ? 0
      : (movementPage - 1) *
          movementPageSize +
        1

  const movementLastRecord =
    Math.min(
      movementPage *
        movementPageSize,
      movementTotal
    )

  const movementPaginationItems =
    useMemo(() => {
      if (movementTotalPages <= 7) {
        return Array.from(
          {
            length:
              movementTotalPages
          },
          (_, index) =>
            index + 1
        )
      }

      const items = [1]
      const startPage = Math.max(
        2,
        movementPage - 1
      )
      const endPage = Math.min(
        movementTotalPages - 1,
        movementPage + 1
      )

      if (startPage > 2) {
        items.push('start-ellipsis')
      }

      for (
        let pageNumber = startPage;
        pageNumber <= endPage;
        pageNumber += 1
      ) {
        items.push(pageNumber)
      }

      if (
        endPage <
        movementTotalPages - 1
      ) {
        items.push('end-ellipsis')
      }

      items.push(
        movementTotalPages
      )

      return items
    }, [
      movementPage,
      movementTotalPages
    ])

  /*
   * Finansal özet artık yalnızca seçilen öğrenci-paket
   * kaydı üzerinden hesaplanmaktadır. Tüm öğrencilerin
   * tahsilat geçmişi bu ekran açılırken yüklenmez.
   */

  const editingPayment =
    movementPayments.find(
      (payment) =>
        String(payment.id) ===
        String(editingPaymentId)
    ) ?? null

  const paymentMetricLoading =
    Boolean(
      paymentForm.studentPackageId
    ) &&
    paymentContextLoading

  const renderPackageCurrency = (
    value
  ) =>
    paymentMetricLoading
      ? '₺—'
      : `₺${formatPrice(value)}`

  const renderPackageCount = (
    value
  ) =>
    paymentMetricLoading
      ? '—'
      : value

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
          <h3>
            {renderPackageCurrency(
              selectedPackagePrice
            )}
          </h3>
        </div>

        <div className="payment-metric-card green">
          <span>Bu Dönem Tahsil Edilen</span>
          <h3>
            {renderPackageCurrency(
              selectedCollectedAmount
            )}
          </h3>
        </div>

        <div className="payment-metric-card red">
          <span>Bu Dönem Kalan</span>
          <h3>
            {renderPackageCurrency(
              selectedRemainingDebt
            )}
          </h3>
        </div>

        <div className="payment-metric-card gray">
          <span>Kritik Gecikme</span>
          <h3>
            {renderPackageCount(
              selectedPackageRecord
                ?.dueStatus
                ?.filterValue ===
                'Gecikti'
                ? 1
                : 0
            )}
          </h3>
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
                {activeStudents.map((student) => (
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

          {paymentContextLoading &&
            paymentForm.studentPackageId && (
              <div
                className="finance-empty-warning"
                role="status"
              >
                Seçilen paketin tahsilat bilgileri yükleniyor...
              </div>
            )}

          {paymentContextError && (
            <div
              className="finance-empty-warning"
              role="alert"
            >
              {paymentContextError}
            </div>
          )}

          {!paymentContextLoading &&
            selectedPackageRecord && (
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

          <div className="payment-quick-date-row">
            <span>Hızlı Tarih</span>

            <div className="payment-quick-date-buttons">
              <button
                type="button"
                onClick={() =>
                  applyQuickDateFilter('today')
                }
              >
                Bugün
              </button>

              <button
                type="button"
                onClick={() =>
                  applyQuickDateFilter('thisWeek')
                }
              >
                Bu Hafta
              </button>

              <button
                type="button"
                onClick={() =>
                  applyQuickDateFilter('thisMonth')
                }
              >
                Bu Ay
              </button>

              <button
                type="button"
                onClick={() =>
                  applyQuickDateFilter('lastMonth')
                }
              >
                Geçen Ay
              </button>

              <button
                type="button"
                onClick={() =>
                  applyQuickDateFilter('all')
                }
              >
                Tüm Zamanlar
              </button>
            </div>
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
                onChange={(event) => {
                  setSortOption(
                    event.target.value
                  )
                  setMovementPage(1)
                }}
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
            <div className="payment-page-size-box">
              <label>Sayfa başına</label>
              <select
                value={movementPageSize}
                onChange={(event) => {
                  setMovementPageSize(
                    Number(
                      event.target.value
                    )
                  )
                  setMovementPage(1)
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>

            <button
              className="lesson-count"
              type="button"
            >
              {movementLoading
                ? '— kayıt'
                : `${movementTotal} kayıt`}
            </button>
          </div>
        </div>

        <div className="payment-table-wrapper">
          <table className="lesson-table payment-table payment-movements-table">
            <thead>
              <tr>
                <th>Öğrenci</th>
                <th>Paket / Dönem</th>
                <th>Ödeme Özeti</th>
                <th>Tahsilat Tarihi</th>
                <th>Ödeme Yöntemi</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>

            <tbody>
              {movementLoading ? (
                <tr>
                  <td
                    colSpan="7"
                    className="empty-table"
                  >
                    Tahsilat hareketleri yükleniyor...
                  </td>
                </tr>
              ) : movementError ? (
                <tr>
                  <td
                    colSpan="7"
                    className="empty-table"
                  >
                    {movementError}
                  </td>
                </tr>
              ) : movementPayments.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="empty-table"
                  >
                    Filtrelere uygun tahsilat
                    hareketi bulunmamaktadır.
                  </td>
                </tr>
              ) : (
                movementPayments.map((payment) => {
                  const status =
                    payment.collectionStatus ===
                    'Tamamlandı'
                      ? {
                          label: 'Tamamlandı',
                          className: 'paid'
                        }
                      : {
                          label: 'Kısmi Ödeme',
                          className: 'partial'
                        }

                  return (
                    <Fragment key={payment.id}>
                      <tr>
                      <td>{payment.studentName}</td>
                      <td>
                        <div className="payment-package-period">
                          <strong>
                            {payment.packageName}
                          </strong>
                          <small>
                            {formatPeriod(
                              getPaymentPeriod(payment)
                            )}
                          </small>
                        </div>
                      </td>

                      <td>
                        <div className="payment-amount-summary">
                          <span>
                            <small>Beklenen</small>
                            <strong>
                              ₺{formatPrice(
                                payment.packagePrice
                              )}
                            </strong>
                          </span>

                          <span>
                            <small>Alınan</small>
                            <strong>
                              ₺{formatPrice(
                                getPaymentAmount(payment)
                              )}
                            </strong>
                          </span>

                          <span>
                            <small>Güncel Kalan</small>
                            <strong>
                              ₺{formatPrice(
                                payment.remainingAmount
                              )}
                            </strong>
                          </span>
                        </div>
                      </td>

                      <td>
                        {formatDate(
                          getPaymentDate(payment)
                        )}
                      </td>

                      <td>
                        {payment.paymentMethod || '-'}
                      </td>

                      <td>
                        <span
                          className={`payment-status ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td>
                        <div className="payment-action-row">
                          <button
                            type="button"
                            className="detail-mini-button"
                            onClick={() =>
                              togglePaymentDetails(payment.id)
                            }
                          >
                            {String(expandedPaymentId) ===
                            String(payment.id)
                              ? 'Kapat'
                              : 'Detay'}
                          </button>

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
                      </td>
                    </tr>

                    {String(expandedPaymentId) ===
                      String(payment.id) && (
                      <tr className="payment-detail-row">
                        <td colSpan="7">
                          <div className="payment-detail-panel">
                            <div>
                              <small>Dekont / İşlem No</small>
                              <strong>
                                {payment.referenceNumber || '-'}
                              </strong>
                            </div>

                            <div>
                              <small>Öğretmen</small>
                              <strong>
                                {payment.teacherName || '-'}
                              </strong>
                            </div>

                            <div>
                              <small>Oluşturulma</small>
                              <strong>
                                {formatDateTime(payment.createdAt)}
                              </strong>
                            </div>

                            <div>
                              <small>Son Güncelleme</small>
                              <strong>
                                {formatDateTime(payment.updatedAt)}
                              </strong>
                            </div>

                            <div className="payment-detail-note">
                              <small>Not</small>
                              <strong>
                                {payment.note || '-'}
                              </strong>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="payment-pagination">
          <div className="payment-pagination-summary">
            {movementLoading
              ? 'Tahsilat hareketleri yükleniyor...'
              : movementTotal === 0
                ? 'Gösterilecek kayıt yok'
                : `${movementFirstRecord}–${movementLastRecord} / ${movementTotal} kayıt`}
          </div>

          <div className="payment-pagination-controls">
            <button
              type="button"
              className="payment-pagination-button"
              onClick={() =>
                setMovementPage(
                  (current) =>
                    Math.max(
                      1,
                      current - 1
                    )
                )
              }
              disabled={
                movementPage === 1 ||
                movementLoading
              }
            >
              Önceki
            </button>

            {movementPaginationItems.map(
              (item) =>
                typeof item === 'number' ? (
                  <button
                    key={item}
                    type="button"
                    className={`payment-pagination-button payment-page-number ${
                      movementPage === item
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      setMovementPage(item)
                    }
                    disabled={
                      movementLoading
                    }
                  >
                    {item}
                  </button>
                ) : (
                  <span
                    key={item}
                    className="payment-pagination-ellipsis"
                  >
                    …
                  </span>
                )
            )}

            <button
              type="button"
              className="payment-pagination-button"
              onClick={() =>
                setMovementPage(
                  (current) =>
                    Math.min(
                      movementTotalPages,
                      current + 1
                    )
                )
              }
              disabled={
                movementPage ===
                  movementTotalPages ||
                movementLoading ||
                movementTotal === 0
              }
            >
              Sonraki
            </button>
          </div>
        </div>
      </section>
      {editingPaymentId &&
        editForm &&
        editingPayment && (
        <div
          className="payment-edit-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelEditPayment()
            }
          }}
        >
          <div
            className="payment-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-edit-title"
          >
            <div className="payment-edit-modal-heading">
              <div>
                <span>Tahsilat Düzenle</span>
                <h2 id="payment-edit-title">
                  {editingPayment.studentName}
                </h2>
                <p>
                  {editingPayment.packageName}
                  {' · '}
                  {formatPeriod(
                    getPaymentPeriod(editingPayment)
                  )}
                </p>
              </div>

              <button
                type="button"
                className="payment-modal-close-button"
                onClick={cancelEditPayment}
                aria-label="Düzenleme penceresini kapat"
              >
                ×
              </button>
            </div>

            <div className="payment-edit-modal-grid">
              <div className="form-group">
                <label>Alınan Tutar</label>
                <input
                  type="number"
                  name="amount"
                  value={editForm.amount}
                  onChange={handleEditChange}
                  min="0.01"
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label>Tahsilat Tarihi</label>
                <input
                  type="date"
                  name="paymentDate"
                  value={editForm.paymentDate}
                  onChange={handleEditChange}
                />
              </div>

              <div className="form-group">
                <label>Ödeme Yöntemi</label>
                <select
                  name="paymentMethod"
                  value={editForm.paymentMethod}
                  onChange={handleEditChange}
                >
                  <option value="">Seçiniz</option>
                  <option value="Nakit">Nakit</option>
                  <option value="Havale / EFT">Havale / EFT</option>
                  <option value="Kredi Kartı">Kredi Kartı</option>
                  <option value="Banka Kartı">Banka Kartı</option>
                </select>
              </div>

              <div className="form-group">
                <label>Dekont / İşlem Numarası</label>
                <input
                  name="referenceNumber"
                  value={editForm.referenceNumber}
                  onChange={handleEditChange}
                  placeholder="İsteğe bağlı"
                />
              </div>

              <div className="form-group full-width">
                <label>Not</label>
                <textarea
                  name="note"
                  value={editForm.note}
                  onChange={handleEditChange}
                  placeholder="Tahsilatla ilgili açıklama"
                />
              </div>
            </div>

            <div className="payment-edit-modal-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={cancelEditPayment}
              >
                İptal
              </button>

              <button
                type="button"
                className="save-button"
                onClick={() =>
                  saveEditPayment(editingPayment)
                }
                disabled={
                  String(updatingPaymentId) ===
                  String(editingPayment.id)
                }
              >
                {String(updatingPaymentId) ===
                String(editingPayment.id)
                  ? 'Kaydediliyor...'
                  : 'Değişiklikleri Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Payments