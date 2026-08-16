import { supabase } from '../lib/supabase'

const FINANCE_OVERVIEW_CACHE_MAX_AGE_MS = 30_000

const financeOverviewCache = {
  incomeSummary: null,
  expenseSummary: null,
  teacherSummaries: null,
  staffPaymentSummary: null,
  updatedAt: {
    incomeSummary: 0,
    expenseSummary: 0,
    teacherSummaries: 0,
    staffPaymentSummary: 0
  }
}

let financeOverviewPrefetchPromise = null

function setFinanceOverviewCacheEntry(key, value) {
  financeOverviewCache[key] = value
  financeOverviewCache.updatedAt[key] = Date.now()
  return value
}

function invalidateFinanceOverviewCacheEntry(...keys) {
  keys.forEach((key) => {
    financeOverviewCache.updatedAt[key] = 0
  })
}

function isFinanceOverviewCacheEntryFresh(
  key,
  maxAgeMs = FINANCE_OVERVIEW_CACHE_MAX_AGE_MS
) {
  return (
    financeOverviewCache[key] !== null &&
    Date.now() - Number(financeOverviewCache.updatedAt[key] || 0) <= maxAgeMs
  )
}

export function invalidateFinanceIncomeSummaryCache() {
  invalidateFinanceOverviewCacheEntry('incomeSummary')
}

export async function refreshFinanceIncomeSummaryCache() {
  invalidateFinanceIncomeSummaryCache()
  return getFinanceIncomeSummary()
}

export function getFinanceOverviewCache() {
  return {
    incomeSummary:
      financeOverviewCache.incomeSummary,
    expenseSummary:
      financeOverviewCache.expenseSummary,
    teacherSummaries:
      financeOverviewCache.teacherSummaries,
    staffPaymentSummary:
      financeOverviewCache.staffPaymentSummary,
    updatedAt: {
      ...financeOverviewCache.updatedAt
    }
  }
}

export async function prefetchFinanceOverview({
  maxAgeMs = FINANCE_OVERVIEW_CACHE_MAX_AGE_MS
} = {}) {
  if (financeOverviewPrefetchPromise) {
    return financeOverviewPrefetchPromise
  }

  const tasks = []

  if (!isFinanceOverviewCacheEntryFresh('incomeSummary', maxAgeMs)) {
    tasks.push(getFinanceIncomeSummary())
  }

  if (!isFinanceOverviewCacheEntryFresh('expenseSummary', maxAgeMs)) {
    tasks.push(getFinanceExpenseSummary())
  }

  if (!isFinanceOverviewCacheEntryFresh('teacherSummaries', maxAgeMs)) {
    tasks.push(getTeacherEarningsSummary())
  }

  if (!isFinanceOverviewCacheEntryFresh('staffPaymentSummary', maxAgeMs)) {
    tasks.push(getStaffPaymentSummary())
  }

  if (tasks.length === 0) {
    return getFinanceOverviewCache()
  }

  financeOverviewPrefetchPromise = Promise
    .allSettled(tasks)
    .then(() => getFinanceOverviewCache())
    .finally(() => {
      financeOverviewPrefetchPromise = null
    })

  return financeOverviewPrefetchPromise
}

const otherIncomeSelect = `
  id,
  title,
  category,
  amount,
  date,
  payment_method,
  related_party,
  document_number,
  note,
  status,
  cancelled_at,
  created_at,
  updated_at
`

const expenseSelect = `
  id,
  title,
  category,
  amount,
  date,
  payment_method,
  payee,
  document_number,
  note,
  status,
  cancelled_at,
  created_at,
  updated_at
`

const teacherPaymentSelect = `
  id,
  teacher_id,
  amount,
  payment_date,
  payment_method,
  reference_number,
  note,
  status,
  cancelled_at,
  created_at,
  updated_at,

  teacher:teachers (
    id,
    full_name
  )
`

function cleanOptionalText(value) {
  const cleanValue = String(value || '').trim()
  return cleanValue || null
}

function mapOtherIncomeFromDb(row) {
  return {
    id: row.id,
    title: row.title || '',
    category: row.category || '',
    amount: Number(row.amount || 0),
    date: row.date || '',
    paymentMethod: row.payment_method || '',
    relatedParty: row.related_party || '',
    documentNumber: row.document_number || '',
    note: row.note || '',
    status: row.status || 'Aktif',
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapExpenseFromDb(row) {
  return {
    id: row.id,
    title: row.title || '',
    category: row.category || '',
    amount: Number(row.amount || 0),
    date: row.date || '',
    paymentMethod: row.payment_method || '',
    payee: row.payee || '',
    documentNumber: row.document_number || '',
    note: row.note || '',
    status: row.status || 'Aktif',
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapTeacherPaymentFromDb(row) {
  return {
    id: row.id,
    teacherId: row.teacher_id || '',
    teacherName: row.teacher?.full_name || '',
    amount: Number(row.amount || 0),
    paymentDate: row.payment_date || '',
    paymentMethod: row.payment_method || '',
    referenceNumber: row.reference_number || '',
    note: row.note || '',
    status: row.status || 'Aktif',
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapTeacherPaymentHistoryFromDb(row) {
  return {
    id: row.id,
    teacherId: row.teacher_id || '',
    teacherName: row.teacher_name || '',
    amount: Number(row.amount || 0),
    paymentDate: row.payment_date || '',
    paymentMethod: row.payment_method || '',
    referenceNumber: row.reference_number || '',
    note: row.note || '',
    status: row.status || 'Aktif',
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}


function mapFinanceIncomeFromDb(row) {
  return {
    id: row.id || '',
    sourceId: row.source_id || '',
    sourceType: row.source_type || '',
    title: row.title || '',
    category: row.category || '',
    description: row.description || '',
    amount: Number(row.amount || 0),
    date: row.date || '',
    paymentMethod: row.payment_method || '',
    relatedParty: row.related_party || '',
    documentNumber: row.document_number || '',
    note: row.note || '',
    sourceLabel:
      row.source_type === 'student-payment'
        ? 'Otomatik Kayıt'
        : 'Ek Gelir',
    status: row.status || 'Aktif',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}


function mapTeacherEarningSummaryFromDb(row) {
  return {
    teacher: {
      id: row.teacher_id || '',
      fullName: row.teacher_name || '',
      name: row.teacher_name || '',
      branch: row.branch || '',
      commissionRate: Number(
        row.commission_rate || 0
      ),
      isActive:
        row.teacher_is_active !== false,
      status:
        row.teacher_status || 'Aktif'
    },
    completedLessons: [],
    completedLessonCount: Number(
      row.completed_lesson_count || 0
    ),
    totalLessonAmount: Number(
      row.total_lesson_amount || 0
    ),
    commissionRate: Number(
      row.commission_rate || 0
    ),
    totalEarning: Number(
      row.total_earning || 0
    ),
    totalPaid: Number(
      row.total_paid || 0
    ),
    remainingPayment: Number(
      row.remaining_payment || 0
    ),
    paymentRecords: []
  }
}

function mapTeacherEarningLessonFromDb(row) {
  return {
    earningRecordId:
      row.lesson_id || '',
    lessonId:
      row.lesson_id || '',
    teacherId:
      row.teacher_id || '',
    teacherName:
      row.teacher_name || '',
    studentId:
      row.student_id || '',
    studentName:
      row.student_name || 'Öğrenci',
    studentPackageId:
      row.student_package_id || '',
    packageId:
      row.package_id || '',
    packageName:
      row.package_name || 'Tanımsız Paket',
    instrument:
      row.instrument || '',
    lessonDate:
      row.lesson_date || '',
    day:
      row.day || '',
    time:
      String(row.start_time || '')
        .slice(0, 5),
    status:
      row.status || '',
    agreedPrice: Number(
      row.agreed_price || 0
    ),
    lessonCount: Number(
      row.lesson_count || 1
    ),
    unitPrice: Number(
      row.unit_price || 0
    ),
    commissionRate: Number(
      row.commission_rate || 0
    ),
    teacherEarning: Number(
      row.teacher_earning || 0
    )
  }
}

function validatePositiveAmount(value, label) {
  const amount = Number(value)

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      `${label} 0’dan büyük olmalıdır.`
    )
  }

  return amount
}

function isNetworkError(error) {
  const message = String(
    error?.message ?? ''
  ).toLocaleLowerCase('tr-TR')

  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch')
  )
}

function getFinanceErrorMessage(
  error,
  fallbackMessage
) {
  if (
    typeof navigator !==
      'undefined' &&
    !navigator.onLine
  ) {
    return (
      'İnternet bağlantısı bulunamadı. ' +
      'Bağlantınızı kontrol edip tekrar deneyiniz.'
    )
  }

  if (isNetworkError(error)) {
    return (
      'Sunucuya ulaşılamadı. ' +
      'İnternet bağlantınızı kontrol edip tekrar deneyiniz.'
    )
  }

  return fallbackMessage
}

function getSafePagination(
  page,
  pageSize
) {
  const safePage = Math.max(
    1,
    Number(page) || 1
  )

  const allowedPageSizes = [
    10,
    25,
    50
  ]

  const requestedPageSize =
    Number(pageSize)

  const safePageSize =
    allowedPageSizes.includes(
      requestedPageSize
    )
      ? requestedPageSize
      : 10

  const from =
    (safePage - 1) *
    safePageSize

  return {
    safePage,
    safePageSize,
    from,
    to:
      from +
      safePageSize -
      1
  }
}

function cleanSearchValue(value) {
  return String(value || '')
    .trim()
    .replace(/[(),]/g, ' ')
}


export async function getFinanceIncomePage({
  page = 1,
  pageSize = 10,
  searchText = '',
  sourceType = '',
  paymentMethod = '',
  startDate = '',
  endDate = '',
  sortOption = 'newest'
} = {}) {
  const {
    safePage,
    safePageSize,
    from,
    to
  } = getSafePagination(
    page,
    pageSize
  )

  let query = supabase
    .from('finance_income_view')
    .select('*', { count: 'exact' })
    .eq('status', 'Aktif')

  const cleanSearchText =
    cleanSearchValue(searchText)

  if (cleanSearchText) {
    const searchPattern = `%${cleanSearchText}%`
    query = query.or([
      `title.ilike.${searchPattern}`,
      `category.ilike.${searchPattern}`,
      `description.ilike.${searchPattern}`,
      `related_party.ilike.${searchPattern}`,
      `payment_method.ilike.${searchPattern}`,
      `document_number.ilike.${searchPattern}`,
      `note.ilike.${searchPattern}`
    ].join(','))
  }

  if (sourceType) {
    query = query.eq('source_type', sourceType)
  }

  if (paymentMethod) {
    query = query.eq('payment_method', paymentMethod)
  }

  if (startDate) {
    query = query.gte('date', startDate)
  }

  if (endDate) {
    query = query.lte('date', endDate)
  }

  const sortSettings = {
    newest: { column: 'date', ascending: false },
    oldest: { column: 'date', ascending: true },
    amountDesc: { column: 'amount', ascending: false },
    amountAsc: { column: 'amount', ascending: true },
    titleAsc: { column: 'title', ascending: true },
    titleDesc: { column: 'title', ascending: false }
  }

  const selectedSort = sortSettings[sortOption] || sortSettings.newest

  query = query
    .order(selectedSort.column, {
      ascending: selectedSort.ascending,
      nullsFirst: false
    })
    .order('created_at', { ascending: false })
    .range(from, to)

  const { data, error, count } = await query

  if (error) {
    throw new Error(getFinanceErrorMessage(
        error,
        'Gelir kayıtları şu anda alınamadı.'
      ))
  }

  return {
    data: (data || []).map(mapFinanceIncomeFromDb),
    total: Number(count || 0),
    page: safePage,
    pageSize: safePageSize
  }
}

export async function getFinanceIncomeSummary() {
  const { data, error } = await supabase
    .rpc('get_finance_income_summary')
    .single()

  if (error) {
    throw new Error(getFinanceErrorMessage(
        error,
        'Gelir özeti şu anda alınamadı.'
      ))
  }

  const result = {
    studentIncome: Number(data?.student_income || 0),
    otherIncome: Number(data?.other_income || 0),
    totalIncome: Number(data?.total_income || 0),
    recordCount: Number(data?.record_count || 0)
  }

  return setFinanceOverviewCacheEntry(
    'incomeSummary',
    result
  )
}

export async function getOtherIncomes() {
  const { data, error } = await supabase
    .from('other_incomes')
    .select(otherIncomeSelect)
    .order('date', {
      ascending: false
    })
    .order('created_at', {
      ascending: false
    })

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Ek gelirler şu anda alınamadı.'
      )
    )
  }

  return (data || []).map(
    mapOtherIncomeFromDb
  )
}

export async function createOtherIncome(form) {
  const title = String(
    form.title || ''
  ).trim()

  const category = String(
    form.category || ''
  ).trim()

  const date = String(
    form.date || ''
  ).trim()

  if (!title) {
    throw new Error(
      'Gelir başlığı zorunludur.'
    )
  }

  if (!category) {
    throw new Error(
      'Gelir kategorisi seçilmelidir.'
    )
  }

  if (!date) {
    throw new Error(
      'Gelir tarihi seçilmelidir.'
    )
  }

  const amount = validatePositiveAmount(
    form.amount,
    'Gelir tutarı'
  )

  const { data, error } = await supabase
    .from('other_incomes')
    .insert({
      title,
      category,
      amount,
      date,
      payment_method:
        cleanOptionalText(
          form.paymentMethod
        ),
      related_party:
        cleanOptionalText(
          form.relatedParty
        ),
      document_number:
        cleanOptionalText(
          form.documentNumber
        ),
      note:
        cleanOptionalText(
          form.note
        ),
      status: 'Aktif'
    })
    .select(otherIncomeSelect)
    .single()

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Ek gelir kaydedilemedi.'
      )
    )
  }

  invalidateFinanceOverviewCacheEntry('incomeSummary')
  return mapOtherIncomeFromDb(data)
}

export async function cancelOtherIncome(
  incomeId
) {
  const cleanIncomeId = String(
    incomeId || ''
  ).trim()

  if (!cleanIncomeId) {
    throw new Error(
      'Ek gelir kimliği bulunamadı.'
    )
  }

  const { data, error } = await supabase
    .from('other_incomes')
    .update({
      status: 'İptal',
      cancelled_at:
        new Date().toISOString()
    })
    .eq('id', cleanIncomeId)
    .select(otherIncomeSelect)
    .single()

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Ek gelir iptal edilemedi.'
      )
    )
  }

  invalidateFinanceOverviewCacheEntry('incomeSummary')
  return mapOtherIncomeFromDb(data)
}


export async function getExpensesPage({
  page = 1,
  pageSize = 10,
  searchText = '',
  category = '',
  paymentMethod = '',
  startDate = '',
  endDate = '',
  sortOption = 'newest'
} = {}) {
  const {
    safePage,
    safePageSize,
    from,
    to
  } = getSafePagination(
    page,
    pageSize
  )

  let query = supabase
    .from('expenses')
    .select(expenseSelect, {
      count: 'exact'
    })
    .neq('status', 'İptal')

  const cleanSearchText =
    cleanSearchValue(searchText)

  if (cleanSearchText) {
    const searchPattern =
      `%${cleanSearchText}%`

    query = query.or(
      [
        `title.ilike.${searchPattern}`,
        `category.ilike.${searchPattern}`,
        `payee.ilike.${searchPattern}`,
        `payment_method.ilike.${searchPattern}`,
        `document_number.ilike.${searchPattern}`,
        `note.ilike.${searchPattern}`
      ].join(',')
    )
  }

  if (category) {
    query = query.eq(
      'category',
      category
    )
  }

  if (paymentMethod) {
    query = query.eq(
      'payment_method',
      paymentMethod
    )
  }

  if (startDate) {
    query = query.gte(
      'date',
      startDate
    )
  }

  if (endDate) {
    query = query.lte(
      'date',
      endDate
    )
  }

  const sortSettings = {
    newest: {
      column: 'date',
      ascending: false
    },
    oldest: {
      column: 'date',
      ascending: true
    },
    amountDesc: {
      column: 'amount',
      ascending: false
    },
    amountAsc: {
      column: 'amount',
      ascending: true
    },
    titleAsc: {
      column: 'title',
      ascending: true
    },
    titleDesc: {
      column: 'title',
      ascending: false
    }
  }

  const selectedSort =
    sortSettings[sortOption] ||
    sortSettings.newest

  query = query
    .order(
      selectedSort.column,
      {
        ascending:
          selectedSort.ascending,
        nullsFirst: false
      }
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    )
    .range(from, to)

  const {
    data,
    error,
    count
  } = await query

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Gider kayıtları şu anda alınamadı.'
      )
    )
  }

  return {
    data: (data || []).map(
      mapExpenseFromDb
    ),
    total: Number(count || 0),
    page: safePage,
    pageSize: safePageSize
  }
}

export async function getFinanceExpenseSummary() {
  const {
    data,
    error
  } = await supabase
    .rpc(
      'get_finance_expense_summary'
    )
    .single()

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Gider özeti şu anda alınamadı.'
      )
    )
  }

  const result = {
    totalExpense: Number(
      data?.total_expense || 0
    ),
    recordCount: Number(
      data?.record_count || 0
    )
  }

  return setFinanceOverviewCacheEntry(
    'expenseSummary',
    result
  )
}

export async function getExpenses() {
  const { data, error } = await supabase
    .from('expenses')
    .select(expenseSelect)
    .order('date', {
      ascending: false
    })
    .order('created_at', {
      ascending: false
    })

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Giderler şu anda alınamadı.'
      )
    )
  }

  return (data || []).map(
    mapExpenseFromDb
  )
}

export async function createExpense(form) {
  const title = String(
    form.title || ''
  ).trim()

  const category = String(
    form.category || ''
  ).trim()

  const date = String(
    form.date || ''
  ).trim()

  if (!title) {
    throw new Error(
      'Gider başlığı zorunludur.'
    )
  }

  if (!category) {
    throw new Error(
      'Gider kategorisi seçilmelidir.'
    )
  }

  if (!date) {
    throw new Error(
      'Gider tarihi seçilmelidir.'
    )
  }

  const amount = validatePositiveAmount(
    form.amount,
    'Gider tutarı'
  )

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      title,
      category,
      amount,
      date,
      payment_method:
        cleanOptionalText(
          form.paymentMethod
        ),
      payee:
        cleanOptionalText(
          form.payee
        ),
      document_number:
        cleanOptionalText(
          form.documentNumber
        ),
      note:
        cleanOptionalText(
          form.note
        ),
      status: 'Aktif'
    })
    .select(expenseSelect)
    .single()

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Gider kaydedilemedi.'
      )
    )
  }

  invalidateFinanceOverviewCacheEntry('expenseSummary')
  return mapExpenseFromDb(data)
}

export async function cancelExpense(
  expenseId
) {
  const cleanExpenseId = String(
    expenseId || ''
  ).trim()

  if (!cleanExpenseId) {
    throw new Error(
      'Gider kimliği bulunamadı.'
    )
  }

  const { data, error } = await supabase
    .from('expenses')
    .update({
      status: 'İptal',
      cancelled_at:
        new Date().toISOString()
    })
    .eq('id', cleanExpenseId)
    .select(expenseSelect)
    .single()

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Gider iptal edilemedi.'
      )
    )
  }

  invalidateFinanceOverviewCacheEntry('expenseSummary')
  return mapExpenseFromDb(data)
}


export async function getTeacherEarningsSummary() {
  const {
    data,
    error
  } = await supabase
    .from(
      'teacher_earnings_summary_view'
    )
    .select('*')
    .order(
      'teacher_name',
      {
        ascending: true
      }
    )

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Öğretmen hakediş özeti şu anda alınamadı.'
      )
    )
  }

  const result = (data || []).map(
    mapTeacherEarningSummaryFromDb
  )

  return setFinanceOverviewCacheEntry(
    'teacherSummaries',
    result
  )
}

export async function getTeacherEarningLessons(
  teacherId
) {
  const cleanTeacherId = String(
    teacherId || ''
  ).trim()

  if (!cleanTeacherId) {
    return []
  }

  const {
    data,
    error
  } = await supabase
    .from(
      'teacher_earning_lessons_view'
    )
    .select('*')
    .eq(
      'teacher_id',
      cleanTeacherId
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    )

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Öğretmen hakediş dersleri şu anda alınamadı.'
      )
    )
  }

  return (data || []).map(
    mapTeacherEarningLessonFromDb
  )
}

export async function getTeacherPaymentsPage({
  page = 1,
  pageSize = 10,
  searchText = '',
  paymentMethod = '',
  startDate = '',
  endDate = '',
  sortOption = 'newest'
} = {}) {
  const {
    safePage,
    safePageSize,
    from,
    to
  } = getSafePagination(
    page,
    pageSize
  )

  let query = supabase
    .from('teacher_payment_history_view')
    .select('*', {
      count: 'exact'
    })

  const cleanSearchText =
    cleanSearchValue(searchText)

  if (cleanSearchText) {
    const searchPattern =
      `%${cleanSearchText}%`

    query = query.or(
      [
        `reference_number.ilike.${searchPattern}`,
        `note.ilike.${searchPattern}`,
        `teacher_name.ilike.${searchPattern}`
      ].join(',')
    )
  }

  if (paymentMethod) {
    query = query.eq(
      'payment_method',
      paymentMethod
    )
  }

  if (startDate) {
    query = query.gte(
      'payment_date',
      startDate
    )
  }

  if (endDate) {
    query = query.lte(
      'payment_date',
      endDate
    )
  }

  const sortSettings = {
    newest: {
      column: 'payment_date',
      ascending: false
    },
    oldest: {
      column: 'payment_date',
      ascending: true
    },
    amountDesc: {
      column: 'amount',
      ascending: false
    },
    amountAsc: {
      column: 'amount',
      ascending: true
    }
  }

  const selectedSort =
    sortSettings[sortOption] ||
    sortSettings.newest

  query = query
    .order(
      selectedSort.column,
      {
        ascending:
          selectedSort.ascending,
        nullsFirst: false
      }
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    )
    .range(from, to)

  const {
    data,
    error,
    count
  } = await query

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Öğretmen ödeme geçmişi şu anda alınamadı.'
      )
    )
  }

  return {
    data: (data || []).map(
      mapTeacherPaymentHistoryFromDb
    ),
    total: Number(count || 0),
    page: safePage,
    pageSize: safePageSize
  }
}

export async function getTeacherPayments() {
  const { data, error } = await supabase
    .from('teacher_payments')
    .select(teacherPaymentSelect)
    .order('payment_date', {
      ascending: false
    })
    .order('created_at', {
      ascending: false
    })

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Öğretmen ödemeleri şu anda alınamadı.'
      )
    )
  }

  return (data || []).map(
    mapTeacherPaymentFromDb
  )
}

export async function createTeacherPayment(
  form
) {
  const teacherId = String(
    form.teacherId || ''
  ).trim()

  const paymentDate = String(
    form.paymentDate || ''
  ).trim()

  const paymentMethod = String(
    form.paymentMethod || ''
  ).trim()

  if (!teacherId) {
    throw new Error(
      'Öğretmen seçilmelidir.'
    )
  }

  if (!paymentDate) {
    throw new Error(
      'Ödeme tarihi seçilmelidir.'
    )
  }

  if (!paymentMethod) {
    throw new Error(
      'Ödeme yöntemi seçilmelidir.'
    )
  }

  const amount = validatePositiveAmount(
    form.amount,
    'Ödeme tutarı'
  )

  const { data, error } = await supabase
    .from('teacher_payments')
    .insert({
      teacher_id: teacherId,
      amount,
      payment_date:
        paymentDate,
      payment_method:
        paymentMethod,
      reference_number:
        cleanOptionalText(
          form.referenceNumber
        ),
      note:
        cleanOptionalText(
          form.note
        ),
      status: 'Aktif'
    })
    .select(teacherPaymentSelect)
    .single()

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Öğretmen ödemesi kaydedilemedi.'
      )
    )
  }

  invalidateFinanceOverviewCacheEntry('teacherSummaries')
  return mapTeacherPaymentFromDb(data)
}

export async function cancelTeacherPayment(
  paymentId
) {
  const cleanPaymentId = String(
    paymentId || ''
  ).trim()

  if (!cleanPaymentId) {
    throw new Error(
      'Öğretmen ödemesi kimliği bulunamadı.'
    )
  }

  const { data, error } = await supabase
    .from('teacher_payments')
    .update({
      status: 'İptal',
      cancelled_at:
        new Date().toISOString()
    })
    .eq('id', cleanPaymentId)
    .select(teacherPaymentSelect)
    .single()

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Öğretmen ödemesi iptal edilemedi.'
      )
    )
  }

  invalidateFinanceOverviewCacheEntry('teacherSummaries')
  return mapTeacherPaymentFromDb(data)
}


const staffPaymentSelect = `
  id,
  staff_name,
  role_title,
  payment_type,
  payment_period,
  amount,
  payment_date,
  payment_method,
  reference_number,
  note,
  status,
  cancelled_at,
  created_at,
  updated_at
`

function mapStaffPaymentFromDb(row) {
  return {
    id: row.id,
    staffName: row.staff_name || '',
    roleTitle: row.role_title || '',
    paymentType: row.payment_type || '',
    paymentPeriod: row.payment_period || '',
    amount: Number(row.amount || 0),
    paymentDate: row.payment_date || '',
    paymentMethod: row.payment_method || '',
    referenceNumber: row.reference_number || '',
    note: row.note || '',
    status: row.status || 'Aktif',
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export async function getStaffPaymentsPage({
  page = 1,
  pageSize = 10,
  searchText = '',
  paymentType = '',
  paymentMethod = '',
  startDate = '',
  endDate = '',
  sortOption = 'newest'
} = {}) {
  const {
    safePage,
    safePageSize,
    from,
    to
  } = getSafePagination(
    page,
    pageSize
  )

  let query = supabase
    .from('staff_payments')
    .select(staffPaymentSelect, {
      count: 'exact'
    })
    .eq('status', 'Aktif')

  const cleanSearchText =
    cleanSearchValue(searchText)

  if (cleanSearchText) {
    const searchPattern =
      `%${cleanSearchText}%`

    query = query.or(
      [
        `staff_name.ilike.${searchPattern}`,
        `role_title.ilike.${searchPattern}`,
        `payment_period.ilike.${searchPattern}`,
        `reference_number.ilike.${searchPattern}`,
        `note.ilike.${searchPattern}`
      ].join(',')
    )
  }

  if (paymentType) {
    query = query.eq(
      'payment_type',
      paymentType
    )
  }

  if (paymentMethod) {
    query = query.eq(
      'payment_method',
      paymentMethod
    )
  }

  if (startDate) {
    query = query.gte(
      'payment_date',
      startDate
    )
  }

  if (endDate) {
    query = query.lte(
      'payment_date',
      endDate
    )
  }

  const sortSettings = {
    newest: {
      column: 'payment_date',
      ascending: false
    },
    oldest: {
      column: 'payment_date',
      ascending: true
    },
    amountDesc: {
      column: 'amount',
      ascending: false
    },
    amountAsc: {
      column: 'amount',
      ascending: true
    },
    staffAsc: {
      column: 'staff_name',
      ascending: true
    },
    staffDesc: {
      column: 'staff_name',
      ascending: false
    }
  }

  const selectedSort =
    sortSettings[sortOption] ||
    sortSettings.newest

  query = query
    .order(
      selectedSort.column,
      {
        ascending:
          selectedSort.ascending,
        nullsFirst: false
      }
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    )
    .range(from, to)

  const {
    data,
    error,
    count
  } = await query

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Personel ödemeleri şu anda alınamadı.'
      )
    )
  }

  return {
    data: (data || []).map(
      mapStaffPaymentFromDb
    ),
    total: Number(count || 0),
    page: safePage,
    pageSize: safePageSize
  }
}

export async function getStaffPaymentSummary() {
  const {
    data,
    error,
    count
  } = await supabase
    .from('staff_payments')
    .select('amount', {
      count: 'exact'
    })
    .eq('status', 'Aktif')

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Personel ödeme özeti şu anda alınamadı.'
      )
    )
  }

  const result = {
    totalPaid: (data || []).reduce(
      (total, row) =>
        total +
        Number(row.amount || 0),
      0
    ),
    recordCount:
      Number(count || 0)
  }

  return setFinanceOverviewCacheEntry(
    'staffPaymentSummary',
    result
  )
}

export async function createStaffPayment(
  form
) {
  const staffName = String(
    form.staffName || ''
  ).trim()

  const roleTitle = String(
    form.roleTitle || ''
  ).trim()

  const paymentType = String(
    form.paymentType || ''
  ).trim()

  const paymentDate = String(
    form.paymentDate || ''
  ).trim()

  const paymentMethod = String(
    form.paymentMethod || ''
  ).trim()

  if (!staffName) {
    throw new Error(
      'Personel adı zorunludur.'
    )
  }

  if (!roleTitle) {
    throw new Error(
      'Personelin görevi zorunludur.'
    )
  }

  if (!paymentType) {
    throw new Error(
      'Ödeme türü seçilmelidir.'
    )
  }

  if (!paymentDate) {
    throw new Error(
      'Ödeme tarihi seçilmelidir.'
    )
  }

  if (!paymentMethod) {
    throw new Error(
      'Ödeme yöntemi seçilmelidir.'
    )
  }

  const amount = validatePositiveAmount(
    form.amount,
    'Personel ödeme tutarı'
  )

  const {
    data,
    error
  } = await supabase
    .from('staff_payments')
    .insert({
      staff_name: staffName,
      role_title: roleTitle,
      payment_type: paymentType,
      payment_period:
        cleanOptionalText(
          form.paymentPeriod
        ),
      amount,
      payment_date:
        paymentDate,
      payment_method:
        paymentMethod,
      reference_number:
        cleanOptionalText(
          form.referenceNumber
        ),
      note:
        cleanOptionalText(
          form.note
        ),
      status: 'Aktif'
    })
    .select(staffPaymentSelect)
    .single()

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Personel ödemesi kaydedilemedi.'
      )
    )
  }

  invalidateFinanceOverviewCacheEntry('staffPaymentSummary')
  return mapStaffPaymentFromDb(data)
}

export async function cancelStaffPayment(
  paymentId
) {
  const cleanPaymentId = String(
    paymentId || ''
  ).trim()

  if (!cleanPaymentId) {
    throw new Error(
      'Personel ödemesi kimliği bulunamadı.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from('staff_payments')
    .update({
      status: 'İptal',
      cancelled_at:
        new Date().toISOString()
    })
    .eq('id', cleanPaymentId)
    .select(staffPaymentSelect)
    .single()

  if (error) {
    throw new Error(
      getFinanceErrorMessage(
        error,
        'Personel ödemesi iptal edilemedi.'
      )
    )
  }

  invalidateFinanceOverviewCacheEntry('staffPaymentSummary')
  return mapStaffPaymentFromDb(data)
}
