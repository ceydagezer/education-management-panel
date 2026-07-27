import { useMemo, useState } from 'react'
import RequiredStar from '../components/RequiredStar'
import '../styles/finance.css'

import {
  cancelExpense as cancelExpenseFromDb,
  cancelOtherIncome,
  createExpense,
  createOtherIncome,
  createTeacherPayment
} from '../services/financeService'

import {
  formatDate,
  formatPrice,
  getTodayKey
} from '../utils/dateHelpers'

import {
  getPaymentAmount,
  getPaymentDate,
  isActivePayment
} from '../utils/paymentSchedule'

import {
  isCompletedLesson,
  normalizeLessonStatus
} from '../utils/lessonHelpers'

import {
  matchesSearchQuery,
  normalizeStatusText as normalizeText
} from '../utils/textHelpers'

const incomeCategories = [
  'Kayıt Ücreti',
  'Materyal / Enstrüman Satışı',
  'Etkinlik / Atölye Geliri',
  'Salon / Stüdyo Kiralama',
  'Sponsorluk / Destek',
  'İade / Geri Ödeme',
  'Diğer'
]

const expenseCategories = [
  'Kira',
  'Elektrik / Su / Doğalgaz',
  'İnternet / Telefon',
  'Temizlik',
  'Kırtasiye',
  'Bakım / Onarım',
  'Enstrüman / Ekipman',
  'Yazılım / Abonelik',
  'Reklam / Tanıtım',
  'Vergi / Resmî Ödeme',
  'Etkinlik Gideri',
  'Ulaşım',
  'Diğer'
]

const paymentMethods = [
  'Nakit',
  'Havale / EFT',
  'Kredi Kartı',
  'Banka Kartı'
]

function Finance({
  students = [],
  payments = [],
  teachers = [],
  packages = [],
  lessonPlans = [],
  otherIncomes = [],
  setOtherIncomes = () => {},
  expenses = [],
  setExpenses = () => {},
  teacherPayments = [],
  setTeacherPayments = () => {},
  unsavedChanges
}) {
  const today = getTodayKey()

  const [activeTab, setActiveTab] = useState('overview')
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showTeacherPaymentForm, setShowTeacherPaymentForm] = useState(false)
  const [showTeacherLessonDetails, setShowTeacherLessonDetails] =
    useState(false)

  const [incomeSearch, setIncomeSearch] = useState('')
  const [expenseSearch, setExpenseSearch] = useState('')
  const [teacherSearch, setTeacherSearch] = useState('')

  const [isSavingIncome, setIsSavingIncome] =
    useState(false)

  const [isSavingExpense, setIsSavingExpense] =
    useState(false)

  const [isSavingTeacherPayment, setIsSavingTeacherPayment] =
    useState(false)

  const [cancellingIncomeId, setCancellingIncomeId] =
    useState(null)

  const [cancellingExpenseId, setCancellingExpenseId] =
    useState(null)

  const [incomeForm, setIncomeForm] = useState({
    title: '',
    category: '',
    amount: '',
    date: today,
    paymentMethod: '',
    relatedParty: '',
    documentNumber: '',
    note: ''
  })

  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: '',
    amount: '',
    date: today,
    paymentMethod: '',
    payee: '',
    documentNumber: '',
    note: ''
  })

  const [teacherPaymentForm, setTeacherPaymentForm] = useState({
    teacherId: '',
    amount: '',
    paymentDate: today,
    paymentMethod: '',
    referenceNumber: '',
    note: ''
  })

  /*
   * Finans ekranında birbirinden bağımsız üç taslak vardır:
   * ek gelir, gider ve öğretmen ödemesi.
   */
  const [incomeDraftDirty, setIncomeDraftDirty] =
    useState(false)

  const [expenseDraftDirty, setExpenseDraftDirty] =
    useState(false)

  const [
    teacherPaymentDraftDirty,
    setTeacherPaymentDraftDirty
  ] = useState(false)

  const hasFinanceDraftChanges =
    incomeDraftDirty ||
    expenseDraftDirty ||
    teacherPaymentDraftDirty

  const syncGlobalFinanceDirty = (
    nextIncomeDirty,
    nextExpenseDirty,
    nextTeacherPaymentDirty
  ) => {
    if (
      nextIncomeDirty ||
      nextExpenseDirty ||
      nextTeacherPaymentDirty
    ) {
      unsavedChanges?.markDirty?.()
      return
    }

    unsavedChanges?.markClean?.()
  }

  const updateIncomeDraftDirty = (isDirty) => {
    setIncomeDraftDirty(isDirty)
    syncGlobalFinanceDirty(
      isDirty,
      expenseDraftDirty,
      teacherPaymentDraftDirty
    )
  }

  const updateExpenseDraftDirty = (isDirty) => {
    setExpenseDraftDirty(isDirty)
    syncGlobalFinanceDirty(
      incomeDraftDirty,
      isDirty,
      teacherPaymentDraftDirty
    )
  }

  const updateTeacherPaymentDraftDirty = (
    isDirty
  ) => {
    setTeacherPaymentDraftDirty(isDirty)
    syncGlobalFinanceDirty(
      incomeDraftDirty,
      expenseDraftDirty,
      isDirty
    )
  }

  const runProtectedFinanceAction = (action) => {
    if (!hasFinanceDraftChanges) {
      action()
      return
    }

    if (unsavedChanges?.requestAction) {
      unsavedChanges.requestAction(action)
      return
    }

    action()
  }

  const getTeacherName = (teacher) =>
    teacher?.fullName ?? teacher?.name ?? ''

  const getTeacherBranch = (teacher) => {
    if (teacher?.branch) {
      return teacher.branch
    }

    if (Array.isArray(teacher?.specialties)) {
      const specialtyNames = teacher.specialties
        .map((specialty) =>
          typeof specialty === 'string'
            ? specialty
            : specialty?.name
        )
        .filter(Boolean)

      return specialtyNames.length > 0
        ? specialtyNames.join(', ')
        : '-'
    }

    return '-'
  }

  const getTeacherCommissionRate = (teacher) =>
    Number(
      teacher?.commissionRate ??
        teacher?.commissionPercentage ??
        teacher?.commission ??
        teacher?.hakEdisYuzdesi ??
        teacher?.hakedisYuzdesi ??
        0
    )

  const findTeacherByIdOrName = (teacherId, teacherName) => {
    const normalizedTeacherName = normalizeText(teacherName)

    return teachers.find((teacher) => {
      const idMatches =
        teacherId !== '' &&
        teacherId !== null &&
        teacherId !== undefined &&
        String(teacher.id) === String(teacherId)

      const nameMatches =
        normalizedTeacherName !== '' &&
        normalizeText(getTeacherName(teacher)) === normalizedTeacherName

      return idMatches || nameMatches
    })
  }

  const getPackageFromCatalog = (packageId, packageName) => {
    const normalizedPackageName = normalizeText(packageName)

    return packages.find((packageItem) => {
      const idMatches =
        packageId !== '' &&
        packageId !== null &&
        packageId !== undefined &&
        String(packageItem.id) === String(packageId)

      const nameMatches =
        normalizedPackageName !== '' &&
        normalizeText(packageItem.name) === normalizedPackageName

      return idMatches || nameMatches
    })
  }

  const normalizeOneStudentPackage = (
    student,
    packageItem,
    index
  ) => {
    const packageId =
      packageItem?.packageId ??
      packageItem?.id ??
      student.packageId ??
      `package-${index}`

    const catalogPackage = getPackageFromCatalog(
      packageId,
      packageItem?.packageName ??
        packageItem?.name ??
        student.packageName
    )

    const rawTeacher =
      packageItem?.teacher ??
      packageItem?.teacherName ??
      student.teacher ??
      student.teacherName ??
      ''

    const teacherId =
      packageItem?.teacherId ??
      packageItem?.teacher?.id ??
      student.teacherId ??
      student.teacher?.id ??
      ''

    const teacherName =
      packageItem?.teacherName ??
      (typeof rawTeacher === 'string'
        ? rawTeacher
        : rawTeacher?.fullName ?? rawTeacher?.name) ??
      ''

    const matchedTeacher = findTeacherByIdOrName(
      teacherId,
      teacherName
    )

    const studentPackageId =
      packageItem?.studentPackageId ??
      packageItem?.enrollmentId ??
      packageItem?.assignmentId ??
      `${student.id}-${packageId}-${index}`

    const agreedPrice = Number(
      packageItem?.agreedPrice ??
        packageItem?.monthlyFee ??
        packageItem?.totalPrice ??
        packageItem?.packagePrice ??
        student.agreedPrice ??
        student.monthlyFee ??
        student.totalPrice ??
        student.packagePrice ??
        catalogPackage?.totalPrice ??
        0
    )

    const lessonCount = Number(
      packageItem?.lessonCount ??
        student.lessonCount ??
        catalogPackage?.lessonCount ??
        1
    ) || 1

    const unitPrice =
      lessonCount > 0
        ? agreedPrice / lessonCount
        : Number(catalogPackage?.unitPrice ?? agreedPrice)

    return {
      studentPackageId: String(studentPackageId),
      packageId: String(packageId),
      packageName:
        packageItem?.packageName ??
        packageItem?.name ??
        student.packageName ??
        catalogPackage?.name ??
        'Tanımsız Paket',
      instrument:
        packageItem?.instrument ??
        student.instrument ??
        catalogPackage?.instrument ??
        '',
      teacherId: String(matchedTeacher?.id ?? teacherId ?? ''),
      teacherName:
        getTeacherName(matchedTeacher) || teacherName || '',
      agreedPrice,
      lessonCount,
      unitPrice
    }
  }

  const normalizeStudentPackages = (student) => {
    const possiblePackageLists = [
      student.enrolledPackages,
      student.studentPackages,
      student.assignedPackages,
      student.selectedPackages
    ]

    const packageList = possiblePackageLists.find(
      (list) => Array.isArray(list) && list.length > 0
    )

    if (packageList) {
      return packageList.map((packageItem, index) =>
        normalizeOneStudentPackage(student, packageItem, index)
      )
    }

    if (Array.isArray(student.packageIds) && student.packageIds.length > 0) {
      return student.packageIds.map((packageId, index) => {
        const catalogPackage = packages.find(
          (item) => String(item.id) === String(packageId)
        )

        return normalizeOneStudentPackage(
          student,
          catalogPackage
            ? {
                packageId: catalogPackage.id,
                packageName: catalogPackage.name,
                totalPrice: catalogPackage.totalPrice
              }
            : { packageId },
          index
        )
      })
    }

    if (student.packageId || student.packageName) {
      return [normalizeOneStudentPackage(student, student, 0)]
    }

    return []
  }

  const assignedPackageRecords = useMemo(() => {
    return students.flatMap((student) =>
      normalizeStudentPackages(student).map((packageItem) => ({
        ...packageItem,
        studentId: String(student.id),
        studentName:
          student.fullName ?? student.name ?? 'Öğrenci'
      }))
    )
  }, [students, packages, teachers])

  /*
   * Öğretmen hakedişi artık paket öğrenciye tanımlandığı anda oluşmaz.
   * Yalnızca Ders Durum Takibi ekranında "Yapıldı" veya
   * "Telafi yapıldı" olarak işaretlenen dersler hakedişe dahil edilir.
   *
   * Her dersin brüt değeri:
   * öğrenciyle anlaşılan paket ücreti / paketteki ders adedi
   *
   * Öğretmenin o dersten hakedişi:
   * ders brüt değeri × öğretmenin hakediş yüzdesi
   *
   * Geçici öğretmen değişikliğinde hakediş, paketin varsayılan
   * öğretmenine değil ders kaydındaki gerçek teacherId değerine yazılır.
   */
  const completedLessonRecords = useMemo(() => {
    return lessonPlans
      .filter(isCompletedLesson)
      .map((lesson, index) => {
        const lessonTeacher = findTeacherByIdOrName(
          lesson.teacherId,
          lesson.teacherName ?? lesson.teacher
        )

        if (!lessonTeacher) {
          return null
        }

        const lessonStudentId = String(lesson.studentId ?? '')
        const lessonPackageId = String(lesson.packageId ?? '')
        const lessonStudentPackageId = String(
          lesson.studentPackageId ??
            lesson.enrollmentId ??
            lesson.assignmentId ??
            ''
        )

        const studentPackage =
          assignedPackageRecords.find(
            (item) =>
              lessonStudentPackageId !== '' &&
              String(item.studentId) === lessonStudentId &&
              String(item.studentPackageId) ===
                lessonStudentPackageId
          ) ??
          assignedPackageRecords.find(
            (item) =>
              lessonPackageId !== '' &&
              String(item.studentId) === lessonStudentId &&
              String(item.packageId) === lessonPackageId
          ) ??
          assignedPackageRecords.find(
            (item) =>
              String(item.studentId) === lessonStudentId &&
              normalizeText(item.packageName) ===
                normalizeText(lesson.packageName)
          )

        const catalogPackage = getPackageFromCatalog(
          lesson.packageId,
          lesson.packageName
        )

        const agreedPrice = Number(
          studentPackage?.agreedPrice ??
            catalogPackage?.totalPrice ??
            lesson.packagePrice ??
            lesson.totalPrice ??
            0
        )

        const lessonCount = Number(
          studentPackage?.lessonCount ??
            catalogPackage?.lessonCount ??
            lesson.lessonCount ??
            1
        ) || 1

        const unitPrice = Number(
          studentPackage?.unitPrice ??
            (lessonCount > 0
              ? agreedPrice / lessonCount
              : catalogPackage?.unitPrice ?? agreedPrice)
        )

        const commissionRate =
          getTeacherCommissionRate(lessonTeacher)

        const teacherEarning =
          unitPrice * (commissionRate / 100)

        return {
          earningRecordId: String(
            lesson.id ??
              `completed-lesson-${index}`
          ),
          lessonId: lesson.id,
          teacherId: String(lessonTeacher.id),
          teacherName: getTeacherName(lessonTeacher),
          studentId: lessonStudentId,
          studentName:
            lesson.studentName ??
            students.find(
              (student) =>
                String(student.id) === lessonStudentId
            )?.fullName ??
            'Öğrenci',
          studentPackageId:
            studentPackage?.studentPackageId ??
            lessonStudentPackageId,
          packageId:
            studentPackage?.packageId ??
            lesson.packageId ??
            catalogPackage?.id ??
            '',
          packageName:
            studentPackage?.packageName ??
            lesson.packageName ??
            catalogPackage?.name ??
            'Tanımsız Paket',
          instrument:
            lesson.instrument ??
            studentPackage?.instrument ??
            catalogPackage?.instrument ??
            '',
          day: lesson.day ?? '',
          time: lesson.time ?? '',
          lessonDate:
            lesson.lessonDate ??
            lesson.date ??
            lesson.completedAt ??
            '',
          status: normalizeLessonStatus(lesson.status),
          agreedPrice,
          lessonCount,
          unitPrice,
          commissionRate,
          teacherEarning
        }
      })
      .filter(Boolean)
  }, [
    lessonPlans,
    assignedPackageRecords,
    packages,
    teachers,
    students
  ])

  const teacherSummaries = useMemo(() => {
    return teachers.map((teacher) => {
      const teacherName = getTeacherName(teacher)

      const completedLessons = completedLessonRecords.filter(
        (lessonRecord) => {
          const idMatches =
            lessonRecord.teacherId !== '' &&
            String(lessonRecord.teacherId) ===
              String(teacher.id)

          const nameMatches =
            lessonRecord.teacherName !== '' &&
            normalizeText(lessonRecord.teacherName) ===
              normalizeText(teacherName)

          return idMatches || nameMatches
        }
      )

      const commissionRate =
        getTeacherCommissionRate(teacher)

      const totalLessonAmount =
        completedLessons.reduce(
          (total, lessonRecord) =>
            total + Number(lessonRecord.unitPrice || 0),
          0
        )

      const totalEarning =
        completedLessons.reduce(
          (total, lessonRecord) =>
            total +
            Number(lessonRecord.teacherEarning || 0),
          0
        )

      const paymentRecords = teacherPayments.filter(
        (payment) =>
          normalizeText(payment.status) !== 'iptal' &&
          String(payment.teacherId) ===
            String(teacher.id)
      )

      const totalPaid = paymentRecords.reduce(
        (total, payment) =>
          total + Number(payment.amount || 0),
        0
      )

      return {
        teacher,
        completedLessons,
        completedLessonCount: completedLessons.length,
        totalLessonAmount,
        commissionRate,
        totalEarning,
        totalPaid,
        remainingPayment: Math.max(
          0,
          totalEarning - totalPaid
        ),
        paymentRecords
      }
    })
  }, [
    teachers,
    completedLessonRecords,
    teacherPayments
  ])

  const automaticStudentIncomes = useMemo(
    () =>
      payments
        .filter(isActivePayment)
        .map((payment) => ({
        id: `student-payment-${payment.id}`,
        sourceId: payment.id,
        sourceType: 'student-payment',
        title: payment.studentName || 'Öğrenci tahsilatı',
        category: 'Öğrenci Tahsilatı',
        description: payment.packageName || '',
        amount: getPaymentAmount(payment),
        date: getPaymentDate(payment),
        paymentMethod: payment.paymentMethod || '-',
        relatedParty: payment.studentName || '-',
        documentNumber: payment.referenceNumber || '',
        sourceLabel: 'Otomatik Kayıt',
          status: 'Aktif'
        })),
    [payments]
  )

  const activeOtherIncomes = otherIncomes.filter(
    (income) => income.status !== 'İptal'
  )

  const activeExpenses = expenses.filter(
    (expense) => expense.status !== 'İptal'
  )

  const allIncomeRecords = [
    ...automaticStudentIncomes,
    ...activeOtherIncomes.map((income) => ({
      ...income,
      sourceType: 'other-income',
      sourceLabel: 'Ek Gelir'
    }))
  ].sort(
    (firstItem, secondItem) =>
      new Date(secondItem.date) - new Date(firstItem.date)
  )

  const filteredIncomeRecords = allIncomeRecords.filter(
    (income) =>
      matchesSearchQuery(
        [
          income.title,
          income.category,
          income.description,
          income.relatedParty,
          income.paymentMethod,
          income.documentNumber
        ],
        incomeSearch
      )
  )

  const filteredExpenseRecords = activeExpenses.filter(
    (expense) =>
      matchesSearchQuery(
        [
          expense.title,
          expense.category,
          expense.payee,
          expense.paymentMethod,
          expense.documentNumber,
          expense.note
        ],
        expenseSearch
      )
  )

  const filteredTeacherSummaries = teacherSummaries.filter(
    (summary) =>
      matchesSearchQuery(
        [
          getTeacherName(summary.teacher),
          getTeacherBranch(summary.teacher)
        ],
        teacherSearch
      )
  )

  const totalStudentIncome = automaticStudentIncomes.reduce(
    (total, income) => total + Number(income.amount || 0),
    0
  )

  const totalOtherIncome = activeOtherIncomes.reduce(
    (total, income) => total + Number(income.amount || 0),
    0
  )

  const totalIncome = totalStudentIncome + totalOtherIncome

  const totalInstitutionExpenses = activeExpenses.reduce(
    (total, expense) => total + Number(expense.amount || 0),
    0
  )

  const totalTeacherEarning = teacherSummaries.reduce(
    (total, summary) => total + summary.totalEarning,
    0
  )

  const totalTeacherPaid = teacherPayments
    .filter(
      (payment) =>
        normalizeText(payment.status) !== 'iptal'
    )
    .reduce(
      (total, payment) =>
        total + Number(payment.amount || 0),
      0
    )

  const totalTeacherRemaining = teacherSummaries.reduce(
    (total, summary) => total + summary.remainingPayment,
    0
  )

  const totalCompletedLessonCount = teacherSummaries.reduce(
    (total, summary) =>
      total + summary.completedLessonCount,
    0
  )

  const totalExpense = totalInstitutionExpenses + totalTeacherPaid
  const netCash = totalIncome - totalExpense

  const selectedTeacherSummary = teacherSummaries.find(
    (summary) =>
      String(summary.teacher.id) ===
      String(teacherPaymentForm.teacherId)
  )

  const selectedTeacherRemaining = Number(
    selectedTeacherSummary?.remainingPayment || 0
  )

  const teacherPaymentAmount = Number(
    teacherPaymentForm.amount || 0
  )

  const remainingAfterTeacherPayment = Math.max(
    0,
    selectedTeacherRemaining - teacherPaymentAmount
  )

  const resetIncomeForm = () =>
    setIncomeForm({
      title: '',
      category: '',
      amount: '',
      date: today,
      paymentMethod: '',
      relatedParty: '',
      documentNumber: '',
      note: ''
    })

  const resetExpenseForm = () =>
    setExpenseForm({
      title: '',
      category: '',
      amount: '',
      date: today,
      paymentMethod: '',
      payee: '',
      documentNumber: '',
      note: ''
    })

  const resetTeacherPaymentForm = () =>
    setTeacherPaymentForm({
      teacherId: '',
      amount: '',
      paymentDate: today,
      paymentMethod: '',
      referenceNumber: '',
      note: ''
    })

  const handleIncomeFormChange = (
    fieldName,
    value
  ) => {
    updateIncomeDraftDirty(true)

    setIncomeForm((current) => ({
      ...current,
      [fieldName]: value
    }))
  }

  const handleExpenseFormChange = (
    fieldName,
    value
  ) => {
    updateExpenseDraftDirty(true)

    setExpenseForm((current) => ({
      ...current,
      [fieldName]: value
    }))
  }

  const handleTeacherPaymentFormChange = (
    fieldName,
    value
  ) => {
    updateTeacherPaymentDraftDirty(true)

    setTeacherPaymentForm((current) => ({
      ...current,
      [fieldName]: value
    }))
  }

  const handleTeacherSelectionChange = (value) => {
    updateTeacherPaymentDraftDirty(true)

    setTeacherPaymentForm((current) => ({
      ...current,
      teacherId: value,
      amount: ''
    }))

    setShowTeacherLessonDetails(false)
  }

  const applyRemainingTeacherPayment = () => {
    updateTeacherPaymentDraftDirty(true)

    setTeacherPaymentForm((current) => ({
      ...current,
      amount: String(selectedTeacherRemaining)
    }))
  }

  const performCloseIncomeForm = () => {
    resetIncomeForm()
    setShowIncomeForm(false)
    updateIncomeDraftDirty(false)
  }

  const closeIncomeForm = () => {
    if (!incomeDraftDirty) {
      performCloseIncomeForm()
      return
    }

    if (unsavedChanges?.requestAction) {
      unsavedChanges.requestAction(
        performCloseIncomeForm
      )
      return
    }

    performCloseIncomeForm()
  }

  const toggleIncomeForm = () => {
    if (showIncomeForm) {
      closeIncomeForm()
      return
    }

    resetIncomeForm()
    updateIncomeDraftDirty(false)
    setShowIncomeForm(true)
  }

  const performCloseExpenseForm = () => {
    resetExpenseForm()
    setShowExpenseForm(false)
    updateExpenseDraftDirty(false)
  }

  const closeExpenseForm = () => {
    if (!expenseDraftDirty) {
      performCloseExpenseForm()
      return
    }

    if (unsavedChanges?.requestAction) {
      unsavedChanges.requestAction(
        performCloseExpenseForm
      )
      return
    }

    performCloseExpenseForm()
  }

  const toggleExpenseForm = () => {
    if (showExpenseForm) {
      closeExpenseForm()
      return
    }

    resetExpenseForm()
    updateExpenseDraftDirty(false)
    setShowExpenseForm(true)
  }

  const performCloseTeacherPaymentForm = () => {
    resetTeacherPaymentForm()
    setShowTeacherPaymentForm(false)
    setShowTeacherLessonDetails(false)
    updateTeacherPaymentDraftDirty(false)
  }

  const closeTeacherPaymentForm = () => {
    if (!teacherPaymentDraftDirty) {
      performCloseTeacherPaymentForm()
      return
    }

    if (unsavedChanges?.requestAction) {
      unsavedChanges.requestAction(
        performCloseTeacherPaymentForm
      )
      return
    }

    performCloseTeacherPaymentForm()
  }

  const toggleTeacherPaymentForm = () => {
    if (showTeacherPaymentForm) {
      closeTeacherPaymentForm()
      return
    }

    resetTeacherPaymentForm()
    updateTeacherPaymentDraftDirty(false)
    setShowTeacherLessonDetails(false)
    setShowTeacherPaymentForm(true)
  }

  const discardAllFinanceDrafts = () => {
    resetIncomeForm()
    resetExpenseForm()
    resetTeacherPaymentForm()

    setShowIncomeForm(false)
    setShowExpenseForm(false)
    setShowTeacherPaymentForm(false)
    setShowTeacherLessonDetails(false)

    setIncomeDraftDirty(false)
    setExpenseDraftDirty(false)
    setTeacherPaymentDraftDirty(false)
    unsavedChanges?.markClean?.()
  }

  const changeFinanceTab = (nextTab) => {
    if (nextTab === activeTab) {
      return
    }

    runProtectedFinanceAction(() => {
      discardAllFinanceDrafts()
      setActiveTab(nextTab)
    })
  }

  const saveIncome = async (event) => {
    event.preventDefault()

    if (isSavingIncome) {
      return
    }

    if (!incomeForm.title.trim()) {
      alert('Gelir başlığı zorunludur.')
      return
    }

    if (!incomeForm.category) {
      alert('Gelir kategorisi seçiniz.')
      return
    }

    const incomeAmount = Number(incomeForm.amount)

    if (!Number.isFinite(incomeAmount) || incomeAmount <= 0) {
      alert('Gelir tutarı 0’dan büyük olmalıdır.')
      return
    }

    if (!incomeForm.date) {
      alert('Gelir tarihi seçiniz.')
      return
    }

    setIsSavingIncome(true)

    try {
      const savedIncome = await createOtherIncome({
        ...incomeForm,
        title: incomeForm.title.trim(),
        amount: incomeAmount,
        relatedParty: incomeForm.relatedParty.trim(),
        documentNumber: incomeForm.documentNumber.trim(),
        note: incomeForm.note.trim()
      })

      setOtherIncomes((current) => [
        ...current,
        savedIncome
      ])

      performCloseIncomeForm()
    } catch (error) {
      console.error(
        'Ek gelir kaydetme hatası:',
        error
      )

      alert(
        error instanceof Error
          ? error.message
          : 'Ek gelir kaydedilemedi.'
      )
    } finally {
      setIsSavingIncome(false)
    }
  }

  const saveExpense = async (event) => {
    event.preventDefault()

    if (isSavingExpense) {
      return
    }

    if (!expenseForm.title.trim()) {
      alert('Gider başlığı zorunludur.')
      return
    }

    if (!expenseForm.category) {
      alert('Gider kategorisi seçiniz.')
      return
    }

    const expenseAmount = Number(expenseForm.amount)

    if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
      alert('Gider tutarı 0’dan büyük olmalıdır.')
      return
    }

    if (!expenseForm.date) {
      alert('Gider tarihi seçiniz.')
      return
    }

    setIsSavingExpense(true)

    try {
      const savedExpense = await createExpense({
        ...expenseForm,
        title: expenseForm.title.trim(),
        amount: expenseAmount,
        payee: expenseForm.payee.trim(),
        documentNumber: expenseForm.documentNumber.trim(),
        note: expenseForm.note.trim()
      })

      setExpenses((current) => [
        ...current,
        savedExpense
      ])

      performCloseExpenseForm()
    } catch (error) {
      console.error(
        'Gider kaydetme hatası:',
        error
      )

      alert(
        error instanceof Error
          ? error.message
          : 'Gider kaydedilemedi.'
      )
    } finally {
      setIsSavingExpense(false)
    }
  }

  const saveTeacherPayment = async (event) => {
    event.preventDefault()

    if (isSavingTeacherPayment) {
      return
    }

    if (!teacherPaymentForm.teacherId) {
      alert('Öğretmen seçiniz.')
      return
    }

    const amount = Number(teacherPaymentForm.amount)

    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Ödeme tutarı 0’dan büyük olmalıdır.')
      return
    }

    if (selectedTeacherRemaining <= 0) {
      alert('Seçilen öğretmenin bekleyen hakedişi bulunmamaktadır.')
      return
    }

    if (amount > selectedTeacherRemaining) {
      alert(
        `Ödeme tutarı bekleyen hakediş olan ₺${formatPrice(
          selectedTeacherRemaining
        )} tutarını aşamaz.`
      )
      return
    }

    if (!teacherPaymentForm.paymentDate) {
      alert('Ödeme tarihi seçiniz.')
      return
    }

    if (!teacherPaymentForm.paymentMethod) {
      alert('Ödeme yöntemi seçiniz.')
      return
    }

    const teacher = teachers.find(
      (item) =>
        String(item.id) === String(teacherPaymentForm.teacherId)
    )

    if (!teacher) {
      alert('Seçilen öğretmen bulunamadı.')
      return
    }

    setIsSavingTeacherPayment(true)

    try {
      const savedPayment = await createTeacherPayment({
        teacherId: teacher.id,
        amount,
        paymentDate: teacherPaymentForm.paymentDate,
        paymentMethod: teacherPaymentForm.paymentMethod,
        referenceNumber:
          teacherPaymentForm.referenceNumber.trim(),
        note: teacherPaymentForm.note.trim()
      })

      setTeacherPayments((current) => [
        ...current,
        savedPayment
      ])

      performCloseTeacherPaymentForm()
    } catch (error) {
      console.error(
        'Öğretmen ödemesi kaydetme hatası:',
        error
      )

      alert(
        error instanceof Error
          ? error.message
          : 'Öğretmen ödemesi kaydedilemedi.'
      )
    } finally {
      setIsSavingTeacherPayment(false)
    }
  }

  const cancelIncome = async (incomeId) => {
    if (
      String(cancellingIncomeId) ===
      String(incomeId)
    ) {
      return
    }

    if (!window.confirm('Bu ek gelir kaydını iptal etmek istediğinize emin misiniz?')) {
      return
    }

    setCancellingIncomeId(incomeId)

    try {
      const cancelledIncome =
        await cancelOtherIncome(incomeId)

      setOtherIncomes((current) =>
        current.map((income) =>
          String(income.id) === String(incomeId)
            ? cancelledIncome
            : income
        )
      )
    } catch (error) {
      console.error(
        'Ek gelir iptal etme hatası:',
        error
      )

      alert(
        error instanceof Error
          ? error.message
          : 'Ek gelir iptal edilemedi.'
      )
    } finally {
      setCancellingIncomeId(null)
    }
  }

  const cancelExpense = async (expenseId) => {
    if (
      String(cancellingExpenseId) ===
      String(expenseId)
    ) {
      return
    }

    if (!window.confirm('Bu gider kaydını iptal etmek istediğinize emin misiniz?')) {
      return
    }

    setCancellingExpenseId(expenseId)

    try {
      const cancelledExpense =
        await cancelExpenseFromDb(expenseId)

      setExpenses((current) =>
        current.map((expense) =>
          String(expense.id) === String(expenseId)
            ? cancelledExpense
            : expense
        )
      )
    } catch (error) {
      console.error(
        'Gider iptal etme hatası:',
        error
      )

      alert(
        error instanceof Error
          ? error.message
          : 'Gider iptal edilemedi.'
      )
    } finally {
      setCancellingExpenseId(null)
    }
  }

  const renderTopMetrics = () => (
    <section className="finance-metric-grid">
      <div className="finance-metric-card income">
        <span>Toplam Gelir</span>
        <strong>₺{formatPrice(totalIncome)}</strong>
        <small>
          Öğrenci tahsilatları otomatik, diğer gelirler manuel olarak eklenir.
        </small>
      </div>

      <div className="finance-metric-card expense">
        <span>Toplam Gider</span>
        <strong>₺{formatPrice(totalExpense)}</strong>
        <small>Kurum giderleri ve öğretmenlere yapılan ödemeler.</small>
      </div>

      <div className="finance-metric-card net">
        <span>Net Nakit</span>
        <strong>₺{formatPrice(netCash)}</strong>
        <small>Toplam gelir − gerçekleşen giderler</small>
      </div>

      <div className="finance-metric-card teacher">
        <span>Bekleyen Öğretmen Hakedişi</span>
        <strong>₺{formatPrice(totalTeacherRemaining)}</strong>
        <small>Hak edilmiş ancak henüz ödenmemiş tutar.</small>
      </div>
    </section>
  )

  const renderOverview = () => (
    <div className="finance-overview-layout">
      <section className="finance-overview-card">
        <div className="finance-section-heading">
          <div>
            <h2>Gelir Özeti</h2>
            <p>Kuruma giren tutarların kaynak dağılımı</p>
          </div>
        </div>

        <div className="finance-summary-row">
          <span>Öğrenci Tahsilatları</span>
          <strong>₺{formatPrice(totalStudentIncome)}</strong>
        </div>

        <div className="finance-summary-row">
          <span>Diğer Gelirler</span>
          <strong>₺{formatPrice(totalOtherIncome)}</strong>
        </div>

        <div className="finance-summary-row total">
          <span>Toplam Gelir</span>
          <strong>₺{formatPrice(totalIncome)}</strong>
        </div>
      </section>

      <section className="finance-overview-card">
        <div className="finance-section-heading">
          <div>
            <h2>Gider Özeti</h2>
            <p>Gerçekleşen kurum ve öğretmen ödemeleri</p>
          </div>
        </div>

        <div className="finance-summary-row">
          <span>Kurum Giderleri</span>
          <strong>₺{formatPrice(totalInstitutionExpenses)}</strong>
        </div>

        <div className="finance-summary-row">
          <span>Öğretmenlere Ödenen</span>
          <strong>₺{formatPrice(totalTeacherPaid)}</strong>
        </div>

        <div className="finance-summary-row total">
          <span>Toplam Gider</span>
          <strong>₺{formatPrice(totalExpense)}</strong>
        </div>
      </section>

      <section className="finance-overview-card finance-overview-wide">
        <div className="finance-section-heading">
          <div>
            <h2>Öğretmen Hakediş Durumu</h2>
            <p>
              Yalnızca yapılan ve tamamlanan telafi dersleri, paket ders bedeli ve öğretmen yüzdesine göre hesaplanır.
            </p>
          </div>
        </div>

        <div className="finance-teacher-summary-grid">
          <div className="finance-teacher-summary-item">
            <span>Tahakkuk Eden Hakediş</span>
            <strong>₺{formatPrice(totalTeacherEarning)}</strong>
          </div>

          <div className="finance-teacher-summary-item paid">
            <span>Ödenen Hakediş</span>
            <strong>₺{formatPrice(totalTeacherPaid)}</strong>
          </div>

          <div className="finance-teacher-summary-item pending">
            <span>Bekleyen Hakediş</span>
            <strong>₺{formatPrice(totalTeacherRemaining)}</strong>
          </div>

          <div className="finance-teacher-summary-item lessons">
            <span>Hakedişe Esas Yapılan Ders</span>
            <strong>{totalCompletedLessonCount}</strong>
          </div>
        </div>
      </section>
    </div>
  )

  const renderIncomes = () => (
    <section className="finance-table-card">
      <div className="finance-section-heading">
        <div>
          <h2>Gelirler</h2>
          <p>
            Öğrenci tahsilatları otomatik olarak, diğer gelirler manuel olarak listelenir.
          </p>
        </div>

        <button
          type="button"
          className="finance-primary-button"
          onClick={toggleIncomeForm}
        >
          + Ek Gelir Ekle
        </button>
      </div>

      {showIncomeForm && (
        <form className="finance-entry-form" onSubmit={saveIncome}>
          <div className="finance-entry-form-heading">
            <h3>Yeni Ek Gelir</h3>
            <p>Öğrenci tahsilatı dışındaki gelirleri kaydedin.</p>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>
                Gelir Başlığı <RequiredStar />
              </label>
              <input
                name="title"
                value={incomeForm.title}
                onChange={(event) =>
                  handleIncomeFormChange(
                    'title',
                    event.target.value
                  )
                }
                placeholder="Örn: Yaz atölyesi geliri"
              />
            </div>

            <div className="form-group">
              <label>
                Kategori <RequiredStar />
              </label>
              <select
                value={incomeForm.category}
                onChange={(event) =>
                  handleIncomeFormChange(
                    'category',
                    event.target.value
                  )
                }
              >
                <option value="">Kategori seçiniz</option>
                {incomeCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>
                Tutar <RequiredStar />
              </label>
              <input
                type="number"
                value={incomeForm.amount}
                onChange={(event) =>
                  handleIncomeFormChange(
                    'amount',
                    event.target.value
                  )
                }
                min="0.01"
                step="0.01"
                placeholder="Örn: 5000"
              />
            </div>

            <div className="form-group">
              <label>
                Tarih <RequiredStar />
              </label>
              <input
                type="date"
                value={incomeForm.date}
                onChange={(event) =>
                  handleIncomeFormChange(
                    'date',
                    event.target.value
                  )
                }
              />
            </div>

            <div className="form-group">
              <label>Ödeme Yöntemi</label>
              <select
                value={incomeForm.paymentMethod}
                onChange={(event) =>
                  handleIncomeFormChange(
                    'paymentMethod',
                    event.target.value
                  )
                }
              >
                <option value="">Seçiniz</option>
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>İlgili Kişi / Kurum</label>
              <input
                value={incomeForm.relatedParty}
                onChange={(event) =>
                  handleIncomeFormChange(
                    'relatedParty',
                    event.target.value
                  )
                }
                placeholder="İsteğe bağlı"
              />
            </div>

            <div className="form-group">
              <label>Dekont / Belge Numarası</label>
              <input
                value={incomeForm.documentNumber}
                onChange={(event) =>
                  handleIncomeFormChange(
                    'documentNumber',
                    event.target.value
                  )
                }
                placeholder="İsteğe bağlı"
              />
            </div>

            <div className="form-group full-width">
              <label>Not</label>
              <textarea
                value={incomeForm.note}
                onChange={(event) =>
                  handleIncomeFormChange(
                    'note',
                    event.target.value
                  )
                }
                placeholder="Gelirle ilgili açıklama"
              />
            </div>
          </div>

          <div className="form-actions finance-form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={closeIncomeForm}
            >
              İptal
            </button>
            <button
              type="submit"
              className="save-button"
              disabled={isSavingIncome}
            >
              {isSavingIncome
                ? 'Kaydediliyor...'
                : 'Geliri Kaydet'}
            </button>
          </div>
        </form>
      )}

      <div className="finance-list-controls">
        <div className="finance-search-box">
          <label>Gelir Kaydı Ara</label>
          <input
            value={incomeSearch}
            onChange={(event) => setIncomeSearch(event.target.value)}
            placeholder="Başlık, kategori veya kişi ara"
          />
        </div>
        <span className="finance-record-count">
          {filteredIncomeRecords.length} kayıt
        </span>
      </div>

      <div className="finance-table-wrapper">
        <table className="lesson-table finance-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Gelir Başlığı</th>
              <th>Kategori</th>
              <th>Kaynak</th>
              <th>İlgili Kişi / Kurum</th>
              <th>Ödeme Yöntemi</th>
              <th>Tutar</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncomeRecords.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-table">
                  Gelir kaydı bulunmamaktadır.
                </td>
              </tr>
            ) : (
              filteredIncomeRecords.map((income) => (
                <tr key={income.id}>
                  <td>{formatDate(income.date)}</td>
                  <td>{income.title}</td>
                  <td>{income.category}</td>
                  <td>
                    <span
                      className={
                        income.sourceType === 'student-payment'
                          ? 'finance-source-badge automatic'
                          : 'finance-source-badge manual'
                      }
                    >
                      {income.sourceLabel}
                    </span>
                  </td>
                  <td>{income.relatedParty || '-'}</td>
                  <td>{income.paymentMethod || '-'}</td>
                  <td>₺{formatPrice(income.amount)}</td>
                  <td>
                    {income.sourceType === 'student-payment' ? (
                      <span className="finance-readonly-label">
                        Tahsilatlardan gelir
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="cancel-mini-button"
                        onClick={() => cancelIncome(income.id)}
                        disabled={
                          String(cancellingIncomeId) ===
                          String(income.id)
                        }
                      >
                        {String(cancellingIncomeId) ===
                        String(income.id)
                          ? 'İptal Ediliyor...'
                          : 'İptal Et'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )

  const renderExpenses = () => (
    <section className="finance-table-card">
      <div className="finance-section-heading">
        <div>
          <h2>Giderler</h2>
          <p>Kuruma ait harcamaları kategori bazlı kaydedin ve takip edin.</p>
        </div>

        <button
          type="button"
          className="finance-primary-button"
          onClick={toggleExpenseForm}
        >
          + Gider Ekle
        </button>
      </div>

      {showExpenseForm && (
        <form className="finance-entry-form" onSubmit={saveExpense}>
          <div className="finance-entry-form-heading">
            <h3>Yeni Gider</h3>
            <p>Kuruma ait gerçekleşen bir harcamayı kaydedin.</p>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>
                Gider Başlığı <RequiredStar />
              </label>
              <input
                value={expenseForm.title}
                onChange={(event) =>
                  handleExpenseFormChange(
                    'title',
                    event.target.value
                  )
                }
                placeholder="Örn: Temmuz elektrik faturası"
              />
            </div>

            <div className="form-group">
              <label>
                Kategori <RequiredStar />
              </label>
              <select
                value={expenseForm.category}
                onChange={(event) =>
                  handleExpenseFormChange(
                    'category',
                    event.target.value
                  )
                }
              >
                <option value="">Kategori seçiniz</option>
                {expenseCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>
                Tutar <RequiredStar />
              </label>
              <input
                type="number"
                value={expenseForm.amount}
                onChange={(event) =>
                  handleExpenseFormChange(
                    'amount',
                    event.target.value
                  )
                }
                min="0.01"
                step="0.01"
                placeholder="Örn: 1500"
              />
            </div>

            <div className="form-group">
              <label>
                Tarih <RequiredStar />
              </label>
              <input
                type="date"
                value={expenseForm.date}
                onChange={(event) =>
                  handleExpenseFormChange(
                    'date',
                    event.target.value
                  )
                }
              />
            </div>

            <div className="form-group">
              <label>Ödeme Yöntemi</label>
              <select
                value={expenseForm.paymentMethod}
                onChange={(event) =>
                  handleExpenseFormChange(
                    'paymentMethod',
                    event.target.value
                  )
                }
              >
                <option value="">Seçiniz</option>
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Ödenen Kişi / Firma</label>
              <input
                value={expenseForm.payee}
                onChange={(event) =>
                  handleExpenseFormChange(
                    'payee',
                    event.target.value
                  )
                }
                placeholder="Örn: Elektrik firması"
              />
            </div>

            <div className="form-group">
              <label>Fatura / Belge Numarası</label>
              <input
                value={expenseForm.documentNumber}
                onChange={(event) =>
                  handleExpenseFormChange(
                    'documentNumber',
                    event.target.value
                  )
                }
                placeholder="İsteğe bağlı"
              />
            </div>

            <div className="form-group full-width">
              <label>Not</label>
              <textarea
                value={expenseForm.note}
                onChange={(event) =>
                  handleExpenseFormChange(
                    'note',
                    event.target.value
                  )
                }
                placeholder="Giderle ilgili açıklama"
              />
            </div>
          </div>

          <div className="form-actions finance-form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={closeExpenseForm}
            >
              İptal
            </button>
            <button
              type="submit"
              className="save-button"
              disabled={isSavingExpense}
            >
              {isSavingExpense
                ? 'Kaydediliyor...'
                : 'Gideri Kaydet'}
            </button>
          </div>
        </form>
      )}

      <div className="finance-list-controls">
        <div className="finance-search-box">
          <label>Gider Kaydı Ara</label>
          <input
            value={expenseSearch}
            onChange={(event) => setExpenseSearch(event.target.value)}
            placeholder="Başlık, kategori veya firma ara"
          />
        </div>
        <span className="finance-record-count">
          {filteredExpenseRecords.length} kayıt
        </span>
      </div>

      <div className="finance-table-wrapper">
        <table className="lesson-table finance-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Gider Başlığı</th>
              <th>Kategori</th>
              <th>Ödenen Kişi / Firma</th>
              <th>Ödeme Yöntemi</th>
              <th>Belge No</th>
              <th>Tutar</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenseRecords.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-table">
                  Gider kaydı bulunmamaktadır.
                </td>
              </tr>
            ) : (
              filteredExpenseRecords.map((expense) => (
                <tr key={expense.id}>
                  <td>{formatDate(expense.date)}</td>
                  <td>{expense.title}</td>
                  <td>{expense.category}</td>
                  <td>{expense.payee || '-'}</td>
                  <td>{expense.paymentMethod || '-'}</td>
                  <td>{expense.documentNumber || '-'}</td>
                  <td>₺{formatPrice(expense.amount)}</td>
                  <td>
                    <button
                      type="button"
                      className="cancel-mini-button"
                      onClick={() => cancelExpense(expense.id)}
                      disabled={
                        String(cancellingExpenseId) ===
                        String(expense.id)
                      }
                    >
                      {String(cancellingExpenseId) ===
                      String(expense.id)
                        ? 'İptal Ediliyor...'
                        : 'İptal Et'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )

  const renderTeacherPayments = () => (
    <>
      <section className="finance-teacher-metric-grid">
        <div className="finance-teacher-metric-card">
          <span>Tahakkuk Eden Hakediş</span>
          <strong>₺{formatPrice(totalTeacherEarning)}</strong>
        </div>

        <div className="finance-teacher-metric-card paid">
          <span>Ödenen Tutar</span>
          <strong>₺{formatPrice(totalTeacherPaid)}</strong>
        </div>

        <div className="finance-teacher-metric-card pending">
          <span>Bekleyen Hakediş</span>
          <strong>₺{formatPrice(totalTeacherRemaining)}</strong>
        </div>

        <div className="finance-teacher-metric-card lessons">
          <span>Hakedişe Esas Yapılan Ders</span>
          <strong>{totalCompletedLessonCount}</strong>
        </div>
      </section>

      <section className="finance-table-card">
        <div className="finance-section-heading">
          <div>
            <h2>Öğretmen Ödemeleri</h2>
            <p>
              Ders Durum Takibi ekranında yapılan olarak işaretlenen derslerden oluşan hakedişleri ve ödemeleri takip edin.
            </p>
          </div>

          <button
            type="button"
            className="finance-primary-button"
            onClick={toggleTeacherPaymentForm}
          >
            + Öğretmen Ödemesi Yap
          </button>
        </div>

        {showTeacherPaymentForm && (
          <form className="finance-entry-form" onSubmit={saveTeacherPayment}>
            <div className="finance-entry-form-heading">
              <h3>Yeni Öğretmen Ödemesi</h3>
              <p>
                Öğretmeni seçin; hakediş bilgileri sistem tarafından otomatik gösterilir.
              </p>
            </div>

            <div className="form-grid">
              <div className="form-group full-width">
                <label>
                  Öğretmen <RequiredStar />
                </label>
                <select
                  value={teacherPaymentForm.teacherId}
                  onChange={(event) =>
                    handleTeacherSelectionChange(
                      event.target.value
                    )
                  }
                >
                  <option value="">Öğretmen seçiniz</option>
                  {teachers.map((teacher) => {
                    const summary = teacherSummaries.find(
                      (item) =>
                        String(item.teacher.id) === String(teacher.id)
                    )

                    return (
                      <option key={teacher.id} value={teacher.id}>
                        {getTeacherName(teacher)}
                        {getTeacherBranch(teacher) !== '-'
                          ? ` - ${getTeacherBranch(teacher)}`
                          : ''}
                        {' — Bekleyen ₺'}
                        {formatPrice(summary?.remainingPayment || 0)}
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>

            {teachers.length === 0 && (
              <div className="finance-empty-warning">
                Öğretmen listesi boş. App.jsx içinde Finance bileşenine
                <strong> teachers={'{teachers}'}</strong> gönderildiğinden emin olun.
              </div>
            )}

            {selectedTeacherSummary && (
              <div className="teacher-payment-summary">
                <div className="teacher-payment-summary-head">
                  <div>
                    <span>Hakediş Özeti</span>
                    <h4>{getTeacherName(selectedTeacherSummary.teacher)}</h4>
                    <p>
                      {getTeacherBranch(selectedTeacherSummary.teacher)}
                      {' · %'}
                      {selectedTeacherSummary.commissionRate} hakediş
                    </p>
                  </div>

                  <span
                    className={`finance-status ${
                      selectedTeacherSummary.remainingPayment <= 0
                        ? 'paid'
                        : selectedTeacherSummary.totalPaid > 0
                          ? 'partial'
                          : 'pending'
                    }`}
                  >
                    {selectedTeacherSummary.remainingPayment <= 0
                      ? 'Ödendi'
                      : selectedTeacherSummary.totalPaid > 0
                        ? 'Kısmi Ödendi'
                        : 'Bekliyor'}
                  </span>
                </div>

                <div className="teacher-payment-summary-grid compact">
                  <div className="teacher-payment-summary-item">
                    <small>Toplam Hakediş</small>
                    <strong>
                      ₺{formatPrice(selectedTeacherSummary.totalEarning)}
                    </strong>
                  </div>

                  <div className="teacher-payment-summary-item paid">
                    <small>Daha Önce Ödenen</small>
                    <strong>
                      ₺{formatPrice(selectedTeacherSummary.totalPaid)}
                    </strong>
                  </div>

                  <div className="teacher-payment-summary-item pending">
                    <small>Kalan Hakediş</small>
                    <strong>
                      ₺{formatPrice(selectedTeacherSummary.remainingPayment)}
                    </strong>
                  </div>
                </div>

                <div className="teacher-payment-summary-footer">
                  <span>
                    {selectedTeacherSummary.completedLessonCount}
                    {' '}hakedişe esas yapılan ders
                  </span>

                  {selectedTeacherSummary.completedLessons.length > 0 && (
                    <button
                      type="button"
                      className="teacher-package-toggle"
                      onClick={() =>
                        setShowTeacherLessonDetails(
                          (current) => !current
                        )
                      }
                    >
                      {showTeacherLessonDetails
                        ? 'Ders Detaylarını Gizle'
                        : 'Ders Detaylarını Görüntüle'}
                    </button>
                  )}
                </div>

                {showTeacherLessonDetails &&
                  selectedTeacherSummary.completedLessons.length > 0 && (
                    <div className="teacher-package-list">
                      <div className="teacher-package-list-grid">
                        {selectedTeacherSummary.completedLessons.map(
                          (lessonRecord) => (
                            <div
                              className="teacher-package-list-item"
                              key={lessonRecord.earningRecordId}
                            >
                              <div>
                                <strong>
                                  {lessonRecord.instrument ||
                                    lessonRecord.packageName}
                                </strong>
                                <small>
                                  {lessonRecord.studentName}
                                  {' · '}
                                  {lessonRecord.packageName}
                                  {lessonRecord.lessonDate
                                    ? ` · ${formatDate(
                                        String(
                                          lessonRecord.lessonDate
                                        ).slice(0, 10)
                                      )}`
                                    : lessonRecord.day
                                      ? ` · ${lessonRecord.day}`
                                      : ''}
                                  {lessonRecord.time
                                    ? ` ${lessonRecord.time}`
                                    : ''}
                                </small>
                              </div>

                              <div className="teacher-package-amounts">
                                <span>
                                  Ders bedeli: ₺
                                  {formatPrice(
                                    lessonRecord.unitPrice
                                  )}
                                </span>
                                <span>
                                  Öğretmen hakedişi: ₺
                                  {formatPrice(
                                    lessonRecord.teacherEarning
                                  )}
                                </span>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {selectedTeacherSummary.completedLessons.length === 0 && (
                  <div className="finance-empty-warning compact">
                    Bu öğretmenin henüz "Yapıldı" veya
                    "Telafi yapıldı" durumunda bir dersi
                    bulunmamaktadır.
                  </div>
                )}
              </div>
            )}

            <div className="form-grid teacher-payment-entry-grid">
              <div className="form-group finance-payment-amount-group">
                <label>
                  Ödenen Tutar <RequiredStar />
                </label>

                <input
                  type="number"
                  value={teacherPaymentForm.amount}
                  onChange={(event) =>
                    handleTeacherPaymentFormChange(
                      'amount',
                      event.target.value
                    )
                  }
                  min="0.01"
                  max={selectedTeacherRemaining || undefined}
                  step="0.01"
                  placeholder="Örn: 2500"
                  disabled={!selectedTeacherSummary}
                />

                {selectedTeacherSummary && (
                  <div className="finance-payment-quick-row">
                    <small className="finance-payment-remaining-note">
                      {teacherPaymentAmount > 0
                        ? `Bu ödeme sonrasında kalan hakediş: ₺${formatPrice(
                            remainingAfterTeacherPayment
                          )}`
                        : `Kaydedilebilecek en yüksek tutar: ₺${formatPrice(
                            selectedTeacherRemaining
                          )}`}
                    </small>

                    {selectedTeacherRemaining > 0 && (
                      <button
                        type="button"
                        className="finance-fill-remaining-button"
                        onClick={
                          applyRemainingTeacherPayment
                        }
                      >
                        Kalan Tutarı Uygula
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>
                  Ödeme Tarihi <RequiredStar />
                </label>
                <input
                  type="date"
                  value={teacherPaymentForm.paymentDate}
                  onChange={(event) =>
                    handleTeacherPaymentFormChange(
                      'paymentDate',
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="form-group">
                <label>
                  Ödeme Yöntemi <RequiredStar />
                </label>
                <select
                  value={teacherPaymentForm.paymentMethod}
                  onChange={(event) =>
                    handleTeacherPaymentFormChange(
                      'paymentMethod',
                      event.target.value
                    )
                  }
                >
                  <option value="">Seçiniz</option>
                  {paymentMethods
                    .filter((method) => method !== 'Kredi Kartı')
                    .map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label>İşlem / Dekont Numarası</label>
                <input
                  value={teacherPaymentForm.referenceNumber}
                  onChange={(event) =>
                    handleTeacherPaymentFormChange(
                      'referenceNumber',
                      event.target.value
                    )
                  }
                  placeholder="İsteğe bağlı"
                />
              </div>

              <div className="form-group full-width">
                <label>Not</label>
                <textarea
                  value={teacherPaymentForm.note}
                  onChange={(event) =>
                    handleTeacherPaymentFormChange(
                      'note',
                      event.target.value
                    )
                  }
                  placeholder="Öğretmen ödemesiyle ilgili açıklama"
                />
              </div>
            </div>

            <div className="form-actions finance-form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={closeTeacherPaymentForm}
              >
                İptal
              </button>
              <button
                type="submit"
                className="save-button"
                disabled={
                  !selectedTeacherSummary ||
                  selectedTeacherRemaining <= 0 ||
                  isSavingTeacherPayment
                }
              >
                {isSavingTeacherPayment
                  ? 'Kaydediliyor...'
                  : 'Ödemeyi Kaydet'}
              </button>
            </div>
          </form>
        )}

        <div className="finance-list-controls">
          <div className="finance-search-box">
            <label>Öğretmen Ara</label>
            <input
              value={teacherSearch}
              onChange={(event) => setTeacherSearch(event.target.value)}
              placeholder="Öğretmen adı veya branş ara"
            />
          </div>
          <span className="finance-record-count">
            {filteredTeacherSummaries.length} öğretmen
          </span>
        </div>

        <div className="finance-table-wrapper">
          <table className="lesson-table finance-table">
            <thead>
              <tr>
                <th>Öğretmen</th>
                <th>Branş</th>
                <th>Hakediş Oranı</th>
                <th>Yapılan Ders</th>
                <th>Ders Tutarı</th>
                <th>Toplam Hakediş</th>
                <th>Ödenen</th>
                <th>Bekleyen</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeacherSummaries.length === 0 ? (
                <tr>
                  <td colSpan="9" className="empty-table">
                    Öğretmen hakediş kaydı bulunmamaktadır.
                  </td>
                </tr>
              ) : (
                filteredTeacherSummaries.map((summary) => {
                  let status = 'Bekliyor'
                  let statusClass = 'pending'

                  if (
                    summary.totalEarning > 0 &&
                    summary.remainingPayment <= 0
                  ) {
                    status = 'Ödendi'
                    statusClass = 'paid'
                  } else if (summary.totalPaid > 0) {
                    status = 'Kısmi Ödendi'
                    statusClass = 'partial'
                  }

                  return (
                    <tr key={summary.teacher.id}>
                      <td>{getTeacherName(summary.teacher)}</td>
                      <td>{getTeacherBranch(summary.teacher)}</td>
                      <td>%{summary.commissionRate}</td>
                      <td>{summary.completedLessonCount}</td>
                      <td>₺{formatPrice(summary.totalLessonAmount)}</td>
                      <td>₺{formatPrice(summary.totalEarning)}</td>
                      <td>₺{formatPrice(summary.totalPaid)}</td>
                      <td>₺{formatPrice(summary.remainingPayment)}</td>
                      <td>
                        <span className={`finance-status ${statusClass}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="finance-payment-history">
          <div className="finance-section-heading">
            <div>
              <h3>Öğretmen Ödeme Geçmişi</h3>
              <p>Öğretmenlere yapılan ödeme hareketleri</p>
            </div>
          </div>

          <div className="finance-table-wrapper">
            <table className="lesson-table finance-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Öğretmen</th>
                  <th>Ödeme Yöntemi</th>
                  <th>Dekont No</th>
                  <th>Tutar</th>
                </tr>
              </thead>
              <tbody>
                {teacherPayments.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-table">
                      Henüz öğretmen ödeme kaydı bulunmamaktadır.
                    </td>
                  </tr>
                ) : (
                  [...teacherPayments]
                    .sort(
                      (firstPayment, secondPayment) =>
                        new Date(secondPayment.paymentDate) -
                        new Date(firstPayment.paymentDate)
                    )
                    .map((payment) => (
                      <tr key={payment.id}>
                        <td>{formatDate(payment.paymentDate)}</td>
                        <td>{payment.teacherName}</td>
                        <td>{payment.paymentMethod || '-'}</td>
                        <td>{payment.referenceNumber || '-'}</td>
                        <td>₺{formatPrice(payment.amount)}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  )

  return (
    <div className="dashboard-shell">
      <section className="page-card finance-page-header">
        <div>
          <span className="page-badge">Finans Yönetimi</span>
          <h1>Finans</h1>
          <p>
            Öğrenci tahsilatlarını, ek gelirleri, kurum giderlerini ve öğretmen ödemelerini tek alandan takip edin.
          </p>
        </div>
      </section>

      {renderTopMetrics()}

      <nav className="finance-tabs">
        <button
          type="button"
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() =>
            changeFinanceTab('overview')
          }
        >
          Genel Bakış
        </button>
        <button
          type="button"
          className={activeTab === 'incomes' ? 'active' : ''}
          onClick={() =>
            changeFinanceTab('incomes')
          }
        >
          Gelirler
        </button>
        <button
          type="button"
          className={activeTab === 'expenses' ? 'active' : ''}
          onClick={() =>
            changeFinanceTab('expenses')
          }
        >
          Giderler
        </button>
        <button
          type="button"
          className={activeTab === 'teacher-payments' ? 'active' : ''}
          onClick={() =>
            changeFinanceTab('teacher-payments')
          }
        >
          Öğretmen Ödemeleri
        </button>
      </nav>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'incomes' && renderIncomes()}
      {activeTab === 'expenses' && renderExpenses()}
      {activeTab === 'teacher-payments' && renderTeacherPayments()}
    </div>
  )
}

export default Finance