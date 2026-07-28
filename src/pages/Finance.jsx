import { useEffect, useMemo, useState } from 'react'
import RequiredStar from '../components/RequiredStar'
import '../styles/finance.css'


import {
  cancelExpense as cancelExpenseFromDb,
  cancelOtherIncome,
  createExpense,
  createOtherIncome,
  createTeacherPayment,
  getFinanceIncomePage,
  getFinanceIncomeSummary,
  getExpensesPage,
  getFinanceExpenseSummary,
  getTeacherEarningsSummary,
  getTeacherEarningLessons,
  getTeacherPaymentsPage
} from '../services/financeService'

import {
  formatDate,
  formatPrice,
  getTodayKey
} from '../utils/dateHelpers'


import {
  matchesSearchQuery
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
  teachers = [],
  setOtherIncomes = () => {},
  setExpenses = () => {},
  setTeacherPayments = () => {},
  unsavedChanges
}) {
  const today = getTodayKey()

  const financeTabs = [
    'overview',
    'incomes',
    'expenses',
    'teacher-payments'
  ]

  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem(
      'arti-akademi-finance-active-tab'
    )

    return financeTabs.includes(savedTab)
      ? savedTab
      : 'overview'
  })
  useEffect(() => {
    localStorage.setItem(
      'arti-akademi-finance-active-tab',
      activeTab
    )
  }, [activeTab])


  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showTeacherPaymentForm, setShowTeacherPaymentForm] = useState(false)
  const [showTeacherLessonDetails, setShowTeacherLessonDetails] =
    useState(false)

  const [incomeSearch, setIncomeSearch] = useState('')

  const [incomeSourceFilter, setIncomeSourceFilter] =
    useState('')
  const [incomeMethodFilter, setIncomeMethodFilter] =
    useState('')
  const [incomeStartDate, setIncomeStartDate] =
    useState('')
  const [incomeEndDate, setIncomeEndDate] =
    useState('')
  const [incomeSort, setIncomeSort] =
    useState('newest')
  const [incomePage, setIncomePage] =
    useState(1)
  const [incomePageSize, setIncomePageSize] =
    useState(10)
  const [incomeRows, setIncomeRows] =
    useState([])
  const [incomeTotal, setIncomeTotal] =
    useState(0)
  const [incomeLoading, setIncomeLoading] =
    useState(true)
  const [incomeError, setIncomeError] =
    useState('')
  const [incomeReloadKey, setIncomeReloadKey] =
    useState(0)
  const [incomeSummary, setIncomeSummary] =
    useState({
      studentIncome: 0,
      otherIncome: 0,
      totalIncome: 0,
      recordCount: 0
    })
  const [
    incomeSummaryLoading,
    setIncomeSummaryLoading
  ] = useState(true)
  const [expenseSearch, setExpenseSearch] =
    useState('')
  const [
    expenseCategoryFilter,
    setExpenseCategoryFilter
  ] = useState('')
  const [
    expenseMethodFilter,
    setExpenseMethodFilter
  ] = useState('')
  const [
    expenseStartDate,
    setExpenseStartDate
  ] = useState('')
  const [
    expenseEndDate,
    setExpenseEndDate
  ] = useState('')
  const [expenseSort, setExpenseSort] =
    useState('newest')
  const [expensePage, setExpensePage] =
    useState(1)
  const [
    expensePageSize,
    setExpensePageSize
  ] = useState(10)
  const [expenseRows, setExpenseRows] =
    useState([])
  const [expenseTotal, setExpenseTotal] =
    useState(0)
  const [
    expenseLoading,
    setExpenseLoading
  ] = useState(true)
  const [expenseError, setExpenseError] =
    useState('')
  const [
    expenseReloadKey,
    setExpenseReloadKey
  ] = useState(0)
  const [
    expenseSummary,
    setExpenseSummary
  ] = useState({
    totalExpense: 0,
    recordCount: 0
  })
  const [
    expenseSummaryLoading,
    setExpenseSummaryLoading
  ] = useState(true)
  const [teacherSearch, setTeacherSearch] =
    useState('')

  const [
    teacherSummaries,
    setTeacherSummaries
  ] = useState([])

  const [
    teacherEarningsLoading,
    setTeacherEarningsLoading
  ] = useState(true)

  const [
    ,
    setTeacherEarningsError
  ] = useState('')

  const [
    teacherEarningsReloadKey,
    setTeacherEarningsReloadKey
  ] = useState(0)

  const [
    teacherLessonLoading,
    setTeacherLessonLoading
  ] = useState(false)


  const [
    teacherHistorySearch,
    setTeacherHistorySearch
  ] = useState('')

  const [
    teacherHistoryMethod,
    setTeacherHistoryMethod
  ] = useState('')

  const [
    teacherHistoryStartDate,
    setTeacherHistoryStartDate
  ] = useState('')

  const [
    teacherHistoryEndDate,
    setTeacherHistoryEndDate
  ] = useState('')

  const [
    teacherHistorySort,
    setTeacherHistorySort
  ] = useState('newest')

  const [
    teacherHistoryPage,
    setTeacherHistoryPage
  ] = useState(1)

  const [
    teacherHistoryPageSize,
    setTeacherHistoryPageSize
  ] = useState(10)

  const [
    teacherHistoryRows,
    setTeacherHistoryRows
  ] = useState([])

  const [
    teacherHistoryTotal,
    setTeacherHistoryTotal
  ] = useState(0)

  const [
    teacherHistoryLoading,
    setTeacherHistoryLoading
  ] = useState(true)

  const [
    teacherHistoryError,
    setTeacherHistoryError
  ] = useState('')

  const [
    teacherHistoryReloadKey,
    setTeacherHistoryReloadKey
  ] = useState(0)


  useEffect(() => {
    let isMounted = true

    const loadIncomeSummary = async () => {
      setIncomeSummaryLoading(true)

      try {
        const result =
          await getFinanceIncomeSummary()

        if (isMounted) {
          setIncomeSummary(result)
        }
      } catch (error) {
        console.error(
          'Gelir özeti alınamadı:',
          error
        )
      } finally {
        if (isMounted) {
          setIncomeSummaryLoading(false)
        }
      }
    }

    loadIncomeSummary()

    return () => {
      isMounted = false
    }
  }, [incomeReloadKey])

  useEffect(() => {
    if (activeTab !== 'incomes') {
      return undefined
    }

    let isMounted = true

    const timeoutId = window.setTimeout(
      async () => {
        setIncomeLoading(true)
        setIncomeError('')

        try {
          const result =
            await getFinanceIncomePage({
              page: incomePage,
              pageSize: incomePageSize,
              searchText: incomeSearch,
              sourceType:
                incomeSourceFilter,
              paymentMethod:
                incomeMethodFilter,
              startDate: incomeStartDate,
              endDate: incomeEndDate,
              sortOption: incomeSort
            })

          if (!isMounted) return

          const totalPages = Math.max(
            1,
            Math.ceil(
              result.total /
                incomePageSize
            )
          )

          if (incomePage > totalPages) {
            setIncomePage(totalPages)
            return
          }

          setIncomeRows(result.data)
          setIncomeTotal(result.total)
        } catch (error) {
          console.error(
            'Gelir listesi alınamadı:',
            error
          )

          if (isMounted) {
            setIncomeError(
              error instanceof Error
                ? error.message
                : 'Gelir listesi alınamadı.'
            )
          }
        } finally {
          if (isMounted) {
            setIncomeLoading(false)
          }
        }
      },
      incomeSearch.trim() ? 350 : 0
    )

    return () => {
      isMounted = false
      window.clearTimeout(timeoutId)
    }
  }, [
    activeTab,
    incomePage,
    incomePageSize,
    incomeSearch,
    incomeSourceFilter,
    incomeMethodFilter,
    incomeStartDate,
    incomeEndDate,
    incomeSort,
    incomeReloadKey
  ])


  useEffect(() => {
    let isMounted = true

    const loadExpenseSummary =
      async () => {
        setExpenseSummaryLoading(true)

        try {
          const result =
            await getFinanceExpenseSummary()

          if (isMounted) {
            setExpenseSummary(result)
          }
        } catch (error) {
          console.error(
            'Gider özeti alınamadı:',
            error
          )
        } finally {
          if (isMounted) {
            setExpenseSummaryLoading(false)
          }
        }
      }

    loadExpenseSummary()

    return () => {
      isMounted = false
    }
  }, [expenseReloadKey])

  useEffect(() => {
    if (activeTab !== 'expenses') {
      return undefined
    }

    let isMounted = true

    const timeoutId =
      window.setTimeout(
        async () => {
          setExpenseLoading(true)
          setExpenseError('')

          try {
            const result =
              await getExpensesPage({
                page: expensePage,
                pageSize:
                  expensePageSize,
                searchText:
                  expenseSearch,
                category:
                  expenseCategoryFilter,
                paymentMethod:
                  expenseMethodFilter,
                startDate:
                  expenseStartDate,
                endDate:
                  expenseEndDate,
                sortOption:
                  expenseSort
              })

            if (!isMounted) {
              return
            }

            const totalPages =
              Math.max(
                1,
                Math.ceil(
                  result.total /
                    expensePageSize
                )
              )

            if (
              expensePage >
              totalPages
            ) {
              setExpensePage(
                totalPages
              )
              return
            }

            setExpenseRows(
              result.data
            )
            setExpenseTotal(
              result.total
            )
          } catch (error) {
            console.error(
              'Gider listesi alınamadı:',
              error
            )

            if (isMounted) {
              setExpenseError(
                error instanceof Error
                  ? error.message
                  : 'Gider listesi alınamadı.'
              )
            }
          } finally {
            if (isMounted) {
              setExpenseLoading(false)
            }
          }
        },
        expenseSearch.trim()
          ? 350
          : 0
      )

    return () => {
      isMounted = false
      window.clearTimeout(
        timeoutId
      )
    }
  }, [
    activeTab,
    expensePage,
    expensePageSize,
    expenseSearch,
    expenseCategoryFilter,
    expenseMethodFilter,
    expenseStartDate,
    expenseEndDate,
    expenseSort,
    expenseReloadKey
  ])



  useEffect(() => {
    let isMounted = true

    const loadTeacherEarnings =
      async () => {
        setTeacherEarningsLoading(
          true
        )
        setTeacherEarningsError('')

        try {
          const result =
            await getTeacherEarningsSummary()

          if (isMounted) {
            setTeacherSummaries(
              result
            )
          }
        } catch (error) {
          console.error(
            'Öğretmen hakedişleri alınamadı:',
            error
          )

          if (isMounted) {
            setTeacherEarningsError(
              error instanceof Error
                ? error.message
                : 'Öğretmen hakedişleri alınamadı.'
            )
          }
        } finally {
          if (isMounted) {
            setTeacherEarningsLoading(
              false
            )
          }
        }
      }

    loadTeacherEarnings()

    return () => {
      isMounted = false
    }
  }, [teacherEarningsReloadKey])


useEffect(() => {
    if (
      activeTab !==
      'teacher-payments'
    ) {
      return undefined
    }

    let isMounted = true

    const timeoutId =
      window.setTimeout(
        async () => {
          setTeacherHistoryLoading(
            true
          )
          setTeacherHistoryError('')

          try {
            const result =
              await getTeacherPaymentsPage(
                {
                  page:
                    teacherHistoryPage,
                  pageSize:
                    teacherHistoryPageSize,
                  searchText:
                    teacherHistorySearch,
                  paymentMethod:
                    teacherHistoryMethod,
                  startDate:
                    teacherHistoryStartDate,
                  endDate:
                    teacherHistoryEndDate,
                  sortOption:
                    teacherHistorySort
                }
              )

            if (!isMounted) {
              return
            }

            const totalPages =
              Math.max(
                1,
                Math.ceil(
                  result.total /
                    teacherHistoryPageSize
                )
              )

            if (
              teacherHistoryPage >
              totalPages
            ) {
              setTeacherHistoryPage(
                totalPages
              )
              return
            }

            setTeacherHistoryRows(
              result.data
            )

            setTeacherHistoryTotal(
              result.total
            )
          } catch (error) {
            console.error(
              'Öğretmen ödeme geçmişi alınamadı:',
              error
            )

            if (isMounted) {
              setTeacherHistoryError(
                error instanceof Error
                  ? error.message
                  : 'Öğretmen ödeme geçmişi alınamadı.'
              )
            }
          } finally {
            if (isMounted) {
              setTeacherHistoryLoading(
                false
              )
            }
          }
        },
        teacherHistorySearch.trim()
          ? 350
          : 0
      )

    return () => {
      isMounted = false
      window.clearTimeout(
        timeoutId
      )
    }
  }, [
    activeTab,
    teacherHistoryPage,
    teacherHistoryPageSize,
    teacherHistorySearch,
    teacherHistoryMethod,
    teacherHistoryStartDate,
    teacherHistoryEndDate,
    teacherHistorySort,
    teacherHistoryReloadKey
  ])

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
    teacher?.fullName ??
    teacher?.name ??
    ''

  const getTeacherBranch = (teacher) =>
    teacher?.branch || '-'

  const incomeTotalPages = Math.max(
    1,
    Math.ceil(
      incomeTotal / incomePageSize
    )
  )

  const incomeFirstRecord =
    incomeTotal === 0
      ? 0
      : (incomePage - 1) *
          incomePageSize +
        1

  const incomeLastRecord = Math.min(
    incomePage * incomePageSize,
    incomeTotal
  )

  const incomePageItems = useMemo(() => {
    if (incomeTotalPages <= 7) {
      return Array.from(
        { length: incomeTotalPages },
        (_, index) => index + 1
      )
    }

    const items = [1]
    const startPage = Math.max(
      2,
      incomePage - 1
    )
    const endPage = Math.min(
      incomeTotalPages - 1,
      incomePage + 1
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

    if (endPage < incomeTotalPages - 1) {
      items.push('end-ellipsis')
    }

    items.push(incomeTotalPages)
    return items
  }, [incomePage, incomeTotalPages])

  const clearIncomeFilters = () => {
    setIncomeSearch('')
    setIncomeSourceFilter('')
    setIncomeMethodFilter('')
    setIncomeStartDate('')
    setIncomeEndDate('')
    setIncomeSort('newest')
    setIncomePage(1)
  }

  const expenseTotalPages =
    Math.max(
      1,
      Math.ceil(
        expenseTotal /
          expensePageSize
      )
    )

  const expenseFirstRecord =
    expenseTotal === 0
      ? 0
      : (expensePage - 1) *
          expensePageSize +
        1

  const expenseLastRecord =
    expenseTotal === 0
      ? 0
      : Math.min(
          expensePage *
            expensePageSize,
          expenseTotal
        )

  const expensePageItems =
    useMemo(() => {
      if (expenseTotalPages <= 7) {
        return Array.from(
          {
            length:
              expenseTotalPages
          },
          (_, index) =>
            index + 1
        )
      }

      const items = [1]
      const startPage =
        Math.max(
          2,
          expensePage - 1
        )
      const endPage =
        Math.min(
          expenseTotalPages - 1,
          expensePage + 1
        )

      if (startPage > 2) {
        items.push(
          'expense-start-ellipsis'
        )
      }

      for (
        let pageNumber =
          startPage;
        pageNumber <= endPage;
        pageNumber += 1
      ) {
        items.push(pageNumber)
      }

      if (
        endPage <
        expenseTotalPages - 1
      ) {
        items.push(
          'expense-end-ellipsis'
        )
      }

      items.push(
        expenseTotalPages
      )

      return items
    }, [
      expensePage,
      expenseTotalPages
    ])

  const clearExpenseFilters =
    () => {
      setExpenseSearch('')
      setExpenseCategoryFilter('')
      setExpenseMethodFilter('')
      setExpenseStartDate('')
      setExpenseEndDate('')
      setExpenseSort('newest')
      setExpensePage(1)
    }

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

  const totalStudentIncome =
    incomeSummary.studentIncome

  const totalOtherIncome =
    incomeSummary.otherIncome

  const totalIncome =
    incomeSummary.totalIncome

  const totalInstitutionExpenses =
    expenseSummary.totalExpense

  const totalTeacherEarning =
    teacherSummaries.reduce(
      (total, summary) =>
        total +
        Number(
          summary.totalEarning || 0
        ),
      0
    )

  const totalTeacherPaid =
    teacherSummaries.reduce(
      (total, summary) =>
        total +
        Number(
          summary.totalPaid || 0
        ),
      0
    )

  const totalTeacherRemaining =
    teacherSummaries.reduce(
      (total, summary) =>
        total +
        Number(
          summary.remainingPayment || 0
        ),
      0
    )

  const totalCompletedLessonCount =
    teacherSummaries.reduce(
      (total, summary) =>
        total +
        Number(
          summary.completedLessonCount || 0
        ),
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

  const toggleTeacherLessonDetails =
    async () => {
      if (!selectedTeacherSummary) {
        return
      }

      if (showTeacherLessonDetails) {
        setShowTeacherLessonDetails(false)
        return
      }

      if (
        selectedTeacherSummary
          .completedLessons
          .length > 0
      ) {
        setShowTeacherLessonDetails(true)
        return
      }

      setTeacherLessonLoading(true)

      try {
        const lessonRows =
          await getTeacherEarningLessons(
            selectedTeacherSummary
              .teacher.id
          )

        setTeacherSummaries(
          (current) =>
            current.map(
              (summary) =>
                String(
                  summary.teacher.id
                ) ===
                String(
                  selectedTeacherSummary
                    .teacher.id
                )
                  ? {
                      ...summary,
                      completedLessons:
                        lessonRows
                    }
                  : summary
            )
        )

        setShowTeacherLessonDetails(true)
      } catch (error) {
        console.error(
          'Öğretmen hakediş dersleri alınamadı:',
          error
        )

        alert(
          error instanceof Error
            ? error.message
            : 'Öğretmen hakediş dersleri alınamadı.'
        )
      } finally {
        setTeacherLessonLoading(false)
      }
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

      setIncomePage(1)
      setIncomeReloadKey(
        (current) => current + 1
      )

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

      setExpensePage(1)
      setExpenseReloadKey(
        (current) => current + 1
      )

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

      setTeacherHistoryPage(1)
      setTeacherHistoryReloadKey(
        (current) => current + 1
      )

      setTeacherEarningsReloadKey(
        (current) => current + 1
      )

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

      setIncomeReloadKey(
        (current) => current + 1
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

      setExpenseReloadKey(
        (current) => current + 1
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

  const financeSummaryLoading =
    incomeSummaryLoading ||
    expenseSummaryLoading ||
    teacherEarningsLoading

  const renderCurrencyValue = (
    value,
    isLoading = financeSummaryLoading
  ) =>
    isLoading
      ? '₺—'
      : `₺${formatPrice(value)}`

  const renderCountValue = (
    value,
    isLoading = financeSummaryLoading
  ) =>
    isLoading
      ? '—'
      : value

  const renderTopMetrics = () => (
    <section className="finance-metric-grid">
      <div className="finance-metric-card income">
        <span>Toplam Gelir</span>
        <strong>{renderCurrencyValue(totalIncome)}</strong>
        <small>
          Öğrenci tahsilatları otomatik, diğer gelirler manuel olarak eklenir.
        </small>
      </div>

      <div className="finance-metric-card expense">
        <span>Toplam Gider</span>
        <strong>{renderCurrencyValue(totalExpense)}</strong>
        <small>Kurum giderleri ve öğretmenlere yapılan ödemeler.</small>
      </div>

      <div className="finance-metric-card net">
        <span>Net Nakit</span>
        <strong>{renderCurrencyValue(netCash)}</strong>
        <small>Toplam gelir − gerçekleşen giderler</small>
      </div>

      <div className="finance-metric-card teacher">
        <span>Bekleyen Öğretmen Hakedişi</span>
        <strong>
          {renderCurrencyValue(totalTeacherRemaining)}
        </strong>
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
          <strong>
            {renderCurrencyValue(
              totalStudentIncome,
              incomeSummaryLoading
            )}
          </strong>
        </div>

        <div className="finance-summary-row">
          <span>Diğer Gelirler</span>
          <strong>
            {renderCurrencyValue(
              totalOtherIncome,
              incomeSummaryLoading
            )}
          </strong>
        </div>

        <div className="finance-summary-row total">
          <span>Toplam Gelir</span>
          <strong>{renderCurrencyValue(totalIncome)}</strong>
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
          <strong>
            {renderCurrencyValue(
              totalInstitutionExpenses,
              expenseSummaryLoading
            )}
          </strong>
        </div>

        <div className="finance-summary-row">
          <span>Öğretmenlere Ödenen</span>
          <strong>
            {renderCurrencyValue(
              totalTeacherPaid,
              teacherEarningsLoading
            )}
          </strong>
        </div>

        <div className="finance-summary-row total">
          <span>Toplam Gider</span>
          <strong>{renderCurrencyValue(totalExpense)}</strong>
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
            <strong>
              {renderCurrencyValue(
                totalTeacherEarning,
                teacherEarningsLoading
              )}
            </strong>
          </div>

          <div className="finance-teacher-summary-item paid">
            <span>Ödenen Hakediş</span>
            <strong>
            {renderCurrencyValue(
              totalTeacherPaid,
              teacherEarningsLoading
            )}
          </strong>
          </div>

          <div className="finance-teacher-summary-item pending">
            <span>Bekleyen Hakediş</span>
            <strong>
          {renderCurrencyValue(totalTeacherRemaining)}
        </strong>
          </div>

          <div className="finance-teacher-summary-item lessons">
            <span>Hakedişe Esas Yapılan Ders</span>
            <strong>
              {renderCountValue(
                totalCompletedLessonCount,
                teacherEarningsLoading
              )}
            </strong>
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

      <div className="finance-income-filter-panel">
        <div className="finance-income-filter-grid">
          <div className="form-group">
            <label>Gelir Kaydı Ara</label>
            <input
              value={incomeSearch}
              onChange={(event) => {
                setIncomeSearch(
                  event.target.value
                )
                setIncomePage(1)
              }}
              placeholder="Başlık, öğrenci, kategori veya belge"
            />
          </div>

          <div className="form-group">
            <label>Kaynak</label>
            <select
              value={incomeSourceFilter}
              onChange={(event) => {
                setIncomeSourceFilter(
                  event.target.value
                )
                setIncomePage(1)
              }}
            >
              <option value="">Tüm kaynaklar</option>
              <option value="student-payment">
                Öğrenci Tahsilatı
              </option>
              <option value="other-income">
                Ek Gelir
              </option>
            </select>
          </div>

          <div className="form-group">
            <label>Ödeme Yöntemi</label>
            <select
              value={incomeMethodFilter}
              onChange={(event) => {
                setIncomeMethodFilter(
                  event.target.value
                )
                setIncomePage(1)
              }}
            >
              <option value="">Tüm yöntemler</option>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Başlangıç Tarihi</label>
            <input
              type="date"
              value={incomeStartDate}
              onChange={(event) => {
                setIncomeStartDate(
                  event.target.value
                )
                setIncomePage(1)
              }}
            />
          </div>

          <div className="form-group">
            <label>Bitiş Tarihi</label>
            <input
              type="date"
              value={incomeEndDate}
              onChange={(event) => {
                setIncomeEndDate(
                  event.target.value
                )
                setIncomePage(1)
              }}
            />
          </div>

          <div className="form-group">
            <label>Sırala</label>
            <select
              value={incomeSort}
              onChange={(event) => {
                setIncomeSort(
                  event.target.value
                )
                setIncomePage(1)
              }}
            >
              <option value="newest">En yeni</option>
              <option value="oldest">En eski</option>
              <option value="amountDesc">
                Tutar yüksekten düşüğe
              </option>
              <option value="amountAsc">
                Tutar düşükten yükseğe
              </option>
              <option value="titleAsc">
                Başlık A-Z
              </option>
              <option value="titleDesc">
                Başlık Z-A
              </option>
            </select>
          </div>
        </div>

        <div className="finance-income-filter-actions">
          <div className="finance-income-page-size">
            <label>Sayfa başına</label>
            <select
              value={incomePageSize}
              onChange={(event) => {
                setIncomePageSize(
                  Number(event.target.value)
                )
                setIncomePage(1)
              }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>

          <button
            type="button"
            className="cancel-button"
            onClick={clearIncomeFilters}
          >
            Filtreleri Temizle
          </button>
        </div>
      </div>

      <div className="finance-list-controls finance-income-count-row">
        <span className="finance-record-count">
          {incomeLoading
            ? '— kayıt'
            : `${incomeTotal} kayıt`}
        </span>
      </div>

      <div className="finance-table-wrapper">
        <table className="lesson-table finance-table finance-income-table">
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
            {incomeLoading ? (
              <tr>
                <td colSpan="8" className="empty-table">
                  Gelir kayıtları yükleniyor...
                </td>
              </tr>
            ) : incomeError ? (
              <tr>
                <td colSpan="8" className="empty-table">
                  {incomeError}
                </td>
              </tr>
            ) : incomeRows.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-table">
                  Gelir kaydı bulunmamaktadır.
                </td>
              </tr>
            ) : (
              incomeRows.map((income) => (
                <tr key={income.id}>
                  <td>{formatDate(income.date)}</td>
                  <td>{income.title}</td>
                  <td>{income.category}</td>
                  <td>
                    <span
                      className={
                        income.sourceType ===
                        'student-payment'
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
                    {income.sourceType ===
                    'student-payment' ? (
                      <span className="finance-readonly-label">
                        Tahsilatlardan gelir
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="cancel-mini-button"
                        onClick={() =>
                          cancelIncome(income.sourceId)
                        }
                        disabled={
                          String(cancellingIncomeId) ===
                          String(income.sourceId)
                        }
                      >
                        {String(cancellingIncomeId) ===
                        String(income.sourceId)
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

      <div className="finance-income-pagination">
        <div className="finance-income-pagination-summary">
          {incomeLoading
            ? 'Gelir kayıtları yükleniyor...'
            : incomeTotal === 0
              ? 'Gösterilecek kayıt yok'
              : `${incomeFirstRecord}–${incomeLastRecord} / ${incomeTotal} gelir kaydı`}
        </div>

        <div className="finance-income-pagination-controls">
          <button
            type="button"
            className="finance-income-page-button"
            onClick={() =>
              setIncomePage((current) =>
                Math.max(1, current - 1)
              )
            }
            disabled={
              incomePage === 1 ||
              incomeLoading
            }
          >
            Önceki
          </button>

          {incomePageItems.map((item) =>
            typeof item === 'number' ? (
              <button
                key={item}
                type="button"
                className={`finance-income-page-button ${
                  incomePage === item
                    ? 'active'
                    : ''
                }`}
                onClick={() => setIncomePage(item)}
                disabled={incomeLoading}
              >
                {item}
              </button>
            ) : (
              <span
                key={item}
                className="finance-income-page-ellipsis"
              >
                …
              </span>
            )
          )}

          <button
            type="button"
            className="finance-income-page-button"
            onClick={() =>
              setIncomePage((current) =>
                Math.min(
                  incomeTotalPages,
                  current + 1
                )
              )
            }
            disabled={
              incomePage === incomeTotalPages ||
              incomeLoading ||
              incomeTotal === 0
            }
          >
            Sonraki
          </button>
        </div>
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

      <div className="finance-income-filter-panel">
        <div className="finance-income-filter-grid">
          <div className="form-group">
            <label>Gider Kaydı Ara</label>
            <input
              value={expenseSearch}
              onChange={(event) => {
                setExpenseSearch(
                  event.target.value
                )
                setExpensePage(1)
              }}
              placeholder="Başlık, kategori, firma veya belge"
            />
          </div>

          <div className="form-group">
            <label>Kategori</label>
            <select
              value={
                expenseCategoryFilter
              }
              onChange={(event) => {
                setExpenseCategoryFilter(
                  event.target.value
                )
                setExpensePage(1)
              }}
            >
              <option value="">
                Tüm kategoriler
              </option>
              {expenseCategories.map(
                (category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="form-group">
            <label>Ödeme Yöntemi</label>
            <select
              value={
                expenseMethodFilter
              }
              onChange={(event) => {
                setExpenseMethodFilter(
                  event.target.value
                )
                setExpensePage(1)
              }}
            >
              <option value="">
                Tüm yöntemler
              </option>
              {paymentMethods.map(
                (method) => (
                  <option
                    key={method}
                    value={method}
                  >
                    {method}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="form-group">
            <label>Başlangıç Tarihi</label>
            <input
              type="date"
              value={expenseStartDate}
              onChange={(event) => {
                setExpenseStartDate(
                  event.target.value
                )
                setExpensePage(1)
              }}
            />
          </div>

          <div className="form-group">
            <label>Bitiş Tarihi</label>
            <input
              type="date"
              value={expenseEndDate}
              onChange={(event) => {
                setExpenseEndDate(
                  event.target.value
                )
                setExpensePage(1)
              }}
            />
          </div>

          <div className="form-group">
            <label>Sırala</label>
            <select
              value={expenseSort}
              onChange={(event) => {
                setExpenseSort(
                  event.target.value
                )
                setExpensePage(1)
              }}
            >
              <option value="newest">
                En yeni
              </option>
              <option value="oldest">
                En eski
              </option>
              <option value="amountDesc">
                Tutar yüksekten düşüğe
              </option>
              <option value="amountAsc">
                Tutar düşükten yükseğe
              </option>
              <option value="titleAsc">
                Başlık A-Z
              </option>
              <option value="titleDesc">
                Başlık Z-A
              </option>
            </select>
          </div>
        </div>

        <div className="finance-income-filter-actions">
          <div className="finance-income-page-size">
            <label>Sayfa başına</label>
            <select
              value={expensePageSize}
              onChange={(event) => {
                setExpensePageSize(
                  Number(
                    event.target.value
                  )
                )
                setExpensePage(1)
              }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>

          <button
            type="button"
            className="cancel-button"
            onClick={clearExpenseFilters}
          >
            Filtreleri Temizle
          </button>
        </div>
      </div>

      <div className="finance-list-controls finance-income-count-row">
        <span className="finance-record-count">
          {expenseLoading
            ? '— kayıt'
            : `${expenseTotal} kayıt`}
        </span>
      </div>

      <div className="finance-table-wrapper">
        <table className="lesson-table finance-table finance-expense-table">
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
            {expenseLoading ? (
              <tr>
                <td
                  colSpan="8"
                  className="empty-table"
                >
                  Gider kayıtları yükleniyor...
                </td>
              </tr>
            ) : expenseError ? (
              <tr>
                <td
                  colSpan="8"
                  className="empty-table"
                >
                  {expenseError}
                </td>
              </tr>
            ) : expenseRows.length === 0 ? (
              <tr>
                <td
                  colSpan="8"
                  className="empty-table"
                >
                  Gider kaydı bulunmamaktadır.
                </td>
              </tr>
            ) : (
              expenseRows.map(
                (expense) => (
                  <tr key={expense.id}>
                    <td>
                      {formatDate(
                        expense.date
                      )}
                    </td>
                    <td>
                      {expense.title}
                    </td>
                    <td>
                      {expense.category}
                    </td>
                    <td>
                      {expense.payee || '-'}
                    </td>
                    <td>
                      {expense.paymentMethod ||
                        '-'}
                    </td>
                    <td>
                      {expense.documentNumber ||
                        '-'}
                    </td>
                    <td>
                      ₺
                      {formatPrice(
                        expense.amount
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cancel-mini-button"
                        onClick={() =>
                          cancelExpense(
                            expense.id
                          )
                        }
                        disabled={
                          String(
                            cancellingExpenseId
                          ) ===
                          String(expense.id)
                        }
                      >
                        {String(
                          cancellingExpenseId
                        ) ===
                        String(expense.id)
                          ? 'İptal Ediliyor...'
                          : 'İptal Et'}
                      </button>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>

      <div className="finance-income-pagination">
        <div className="finance-income-pagination-summary">
          {expenseLoading
            ? 'Gider kayıtları yükleniyor...'
            : expenseTotal === 0
              ? 'Gösterilecek kayıt yok'
              : `${expenseFirstRecord}–${expenseLastRecord} / ${expenseTotal} gider kaydı`}
        </div>

        <div className="finance-income-pagination-controls">
          <button
            type="button"
            className="finance-income-page-button"
            onClick={() =>
              setExpensePage(
                (current) =>
                  Math.max(
                    1,
                    current - 1
                  )
              )
            }
            disabled={
              expensePage === 1 ||
              expenseLoading
            }
          >
            Önceki
          </button>

          {expensePageItems.map(
            (item) =>
              typeof item ===
              'number' ? (
                <button
                  key={item}
                  type="button"
                  className={`finance-income-page-button ${
                    expensePage === item
                      ? 'active'
                      : ''
                  }`}
                  onClick={() =>
                    setExpensePage(item)
                  }
                  disabled={
                    expenseLoading
                  }
                >
                  {item}
                </button>
              ) : (
                <span
                  key={item}
                  className="finance-income-page-ellipsis"
                >
                  …
                </span>
              )
          )}

          <button
            type="button"
            className="finance-income-page-button"
            onClick={() =>
              setExpensePage(
                (current) =>
                  Math.min(
                    expenseTotalPages,
                    current + 1
                  )
              )
            }
            disabled={
              expensePage ===
                expenseTotalPages ||
              expenseLoading ||
              expenseTotal === 0
            }
          >
            Sonraki
          </button>
        </div>
      </div>
    </section>
  )

  const teacherHistoryTotalPages =
    Math.max(
      1,
      Math.ceil(
        teacherHistoryTotal /
          teacherHistoryPageSize
      )
    )

  const teacherHistoryFirstRecord =
    teacherHistoryTotal === 0
      ? 0
      : (
          teacherHistoryPage -
          1
        ) *
          teacherHistoryPageSize +
        1

  const teacherHistoryLastRecord =
    Math.min(
      teacherHistoryPage *
        teacherHistoryPageSize,
      teacherHistoryTotal
    )

  const teacherHistoryPageItems =
    useMemo(() => {
      if (
        teacherHistoryTotalPages <=
        7
      ) {
        return Array.from(
          {
            length:
              teacherHistoryTotalPages
          },
          (_, index) =>
            index + 1
        )
      }

      const items = [1]

      const startPage =
        Math.max(
          2,
          teacherHistoryPage - 1
        )

      const endPage =
        Math.min(
          teacherHistoryTotalPages - 1,
          teacherHistoryPage + 1
        )

      if (startPage > 2) {
        items.push(
          'start-ellipsis'
        )
      }

      for (
        let pageNumber =
          startPage;
        pageNumber <= endPage;
        pageNumber += 1
      ) {
        items.push(
          pageNumber
        )
      }

      if (
        endPage <
        teacherHistoryTotalPages - 1
      ) {
        items.push(
          'end-ellipsis'
        )
      }

      items.push(
        teacherHistoryTotalPages
      )

      return items
    }, [
      teacherHistoryPage,
      teacherHistoryTotalPages
    ])

  const clearTeacherHistoryFilters =
    () => {
      setTeacherHistorySearch('')
      setTeacherHistoryMethod('')
      setTeacherHistoryStartDate('')
      setTeacherHistoryEndDate('')
      setTeacherHistorySort(
        'newest'
      )
      setTeacherHistoryPage(1)
    }

  const renderTeacherPayments = () => (
    <>
      <section className="finance-teacher-metric-grid">
        <div className="finance-teacher-metric-card">
          <span>Tahakkuk Eden Hakediş</span>
          <strong>
              {renderCurrencyValue(
                totalTeacherEarning,
                teacherEarningsLoading
              )}
            </strong>
        </div>

        <div className="finance-teacher-metric-card paid">
          <span>Ödenen Tutar</span>
          <strong>
            {renderCurrencyValue(
              totalTeacherPaid,
              teacherEarningsLoading
            )}
          </strong>
        </div>

        <div className="finance-teacher-metric-card pending">
          <span>Bekleyen Hakediş</span>
          <strong>
          {renderCurrencyValue(totalTeacherRemaining)}
        </strong>
        </div>

        <div className="finance-teacher-metric-card lessons">
          <span>Hakedişe Esas Yapılan Ders</span>
          <strong>
              {renderCountValue(
                totalCompletedLessonCount,
                teacherEarningsLoading
              )}
            </strong>
        </div>
      </section>

      <section className="finance-table-card finance-teacher-current-card">
        <div className="finance-section-heading">
          <div>
            <span className="finance-section-kicker">
              Güncel Durum
            </span>
            <h2>Öğretmen Hakediş Durumu</h2>
            <p>
              Yapılan derslere göre oluşan toplam hakedişleri, ödenen ve bekleyen tutarları görüntüleyin.
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
                            disabled={
                              teacherLessonLoading
                            }
                      onClick={
                              toggleTeacherLessonDetails
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

        <div className="finance-subsection-heading">
          <div>
            <h3>Güncel Hakediş Özeti</h3>
            <p>
              Her öğretmenin mevcut hakediş ve ödeme durumunu toplu olarak inceleyin.
            </p>
          </div>
        </div>

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
          <table className="lesson-table finance-table finance-teacher-earnings-table">
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

        </section>

      <section className="finance-table-card finance-payment-history finance-teacher-history-card">
          <div className="finance-section-heading finance-history-heading">
            <div>
              <span className="finance-section-kicker">
                İşlem Geçmişi
              </span>
              <h2>Yapılan Öğretmen Ödemeleri</h2>
              <p>
                Öğretmenlere gerçekleştirilen ödeme işlemlerini tarih, yöntem ve dekont bilgileriyle görüntüleyin.
              </p>
            </div>

            <span className="finance-record-count">
              {teacherHistoryLoading
                ? '— kayıt'
                : `${teacherHistoryTotal} kayıt`}
            </span>
          </div>

          <div className="teacher-history-filter-panel">
            <div className="teacher-history-filter-grid">
              <div className="form-group">
                <label>
                  Öğretmen / Dekont / Not Ara
                </label>
                <input
                  value={
                    teacherHistorySearch
                  }
                  onChange={(event) => {
                    setTeacherHistorySearch(
                      event.target.value
                    )
                    setTeacherHistoryPage(1)
                  }}
                  placeholder="Arama yapın"
                />
              </div>

              <div className="form-group">
                <label>
                  Ödeme Yöntemi
                </label>
                <select
                  value={
                    teacherHistoryMethod
                  }
                  onChange={(event) => {
                    setTeacherHistoryMethod(
                      event.target.value
                    )
                    setTeacherHistoryPage(1)
                  }}
                >
                  <option value="">
                    Tümü
                  </option>
                  {paymentMethods.map(
                    (method) => (
                      <option
                        key={method}
                        value={method}
                      >
                        {method}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>
                  Başlangıç Tarihi
                </label>
                <input
                  type="date"
                  value={
                    teacherHistoryStartDate
                  }
                  onChange={(event) => {
                    setTeacherHistoryStartDate(
                      event.target.value
                    )
                    setTeacherHistoryPage(1)
                  }}
                />
              </div>

              <div className="form-group">
                <label>
                  Bitiş Tarihi
                </label>
                <input
                  type="date"
                  value={
                    teacherHistoryEndDate
                  }
                  onChange={(event) => {
                    setTeacherHistoryEndDate(
                      event.target.value
                    )
                    setTeacherHistoryPage(1)
                  }}
                />
              </div>

              <div className="form-group">
                <label>Sırala</label>
                <select
                  value={
                    teacherHistorySort
                  }
                  onChange={(event) => {
                    setTeacherHistorySort(
                      event.target.value
                    )
                    setTeacherHistoryPage(1)
                  }}
                >
                  <option value="newest">
                    En yeni tarih
                  </option>
                  <option value="oldest">
                    En eski tarih
                  </option>
                  <option value="amountDesc">
                    Tutar yüksek-düşük
                  </option>
                  <option value="amountAsc">
                    Tutar düşük-yüksek
                  </option>
                </select>
              </div>
            </div>

            <div className="teacher-history-filter-actions">
              <div className="teacher-history-page-size">
                <label>
                  Sayfa başına
                </label>
                <select
                  value={
                    teacherHistoryPageSize
                  }
                  onChange={(event) => {
                    setTeacherHistoryPageSize(
                      Number(
                        event.target.value
                      )
                    )
                    setTeacherHistoryPage(1)
                  }}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>

              <button
                type="button"
                className="cancel-button"
                onClick={
                  clearTeacherHistoryFilters
                }
              >
                Filtreleri Temizle
              </button>
            </div>
          </div>

          <div className="finance-table-wrapper">
            <table className="lesson-table finance-table finance-teacher-history-table">
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
                {teacherHistoryLoading ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="empty-table"
                    >
                      Öğretmen ödeme geçmişi yükleniyor...
                    </td>
                  </tr>
                ) : teacherHistoryError ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="empty-table"
                    >
                      {teacherHistoryError}
                    </td>
                  </tr>
                ) : teacherHistoryRows.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="empty-table"
                    >
                      Filtrelere uygun öğretmen ödeme kaydı bulunmamaktadır.
                    </td>
                  </tr>
                ) : (
                  teacherHistoryRows.map(
                    (payment) => (
                      <tr key={payment.id}>
                        <td>
                          {formatDate(
                            payment.paymentDate
                          )}
                        </td>
                        <td>
                          {payment.teacherName}
                        </td>
                        <td>
                          {payment.paymentMethod ||
                            '-'}
                        </td>
                        <td>
                          {payment.referenceNumber ||
                            '-'}
                        </td>
                        <td>
                          ₺
                          {formatPrice(
                            payment.amount
                          )}
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="finance-history-pagination">
            <div className="finance-history-pagination-summary">
              {teacherHistoryTotal === 0
                ? 'Gösterilecek kayıt yok'
                : `${teacherHistoryFirstRecord}–${teacherHistoryLastRecord} / ${teacherHistoryTotal} kayıt`}
            </div>

            <div className="finance-history-pagination-controls">
              <button
                type="button"
                className="finance-history-page-button"
                onClick={() =>
                  setTeacherHistoryPage(
                    (current) =>
                      Math.max(
                        1,
                        current - 1
                      )
                  )
                }
                disabled={
                  teacherHistoryPage === 1 ||
                  teacherHistoryLoading
                }
              >
                Önceki
              </button>

              {teacherHistoryPageItems.map(
                (item) =>
                  typeof item ===
                  'number' ? (
                    <button
                      key={item}
                      type="button"
                      className={`finance-history-page-button ${
                        teacherHistoryPage ===
                        item
                          ? 'active'
                          : ''
                      }`}
                      onClick={() =>
                        setTeacherHistoryPage(
                          item
                        )
                      }
                      disabled={
                        teacherHistoryLoading
                      }
                    >
                      {item}
                    </button>
                  ) : (
                    <span
                      key={item}
                      className="finance-history-page-ellipsis"
                    >
                      …
                    </span>
                  )
              )}

              <button
                type="button"
                className="finance-history-page-button"
                onClick={() =>
                  setTeacherHistoryPage(
                    (current) =>
                      Math.min(
                        teacherHistoryTotalPages,
                        current + 1
                      )
                  )
                }
                disabled={
                  teacherHistoryPage ===
                    teacherHistoryTotalPages ||
                  teacherHistoryLoading ||
                  teacherHistoryTotal === 0
                }
              >
                Sonraki
              </button>
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