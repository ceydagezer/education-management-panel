import { supabase } from '../lib/supabase'

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
  const safePage = Math.max(1, Number(page) || 1)
  const allowedPageSizes = [10, 25, 50]
  const requestedPageSize = Number(pageSize)
  const safePageSize = allowedPageSizes.includes(requestedPageSize)
    ? requestedPageSize
    : 10
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1

  let query = supabase
    .from('finance_income_view')
    .select('*', { count: 'exact' })
    .eq('status', 'Aktif')

  const cleanSearchText = String(searchText || '')
    .trim()
    .replace(/[(),]/g, ' ')

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
    throw new Error(`Gelir kayıtları alınamadı: ${error.message}`)
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
    throw new Error(`Gelir özeti alınamadı: ${error.message}`)
  }

  return {
    studentIncome: Number(data?.student_income || 0),
    otherIncome: Number(data?.other_income || 0),
    totalIncome: Number(data?.total_income || 0),
    recordCount: Number(data?.record_count || 0)
  }
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
      `Ek gelirler alınamadı: ${error.message}`
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
      `Ek gelir kaydedilemedi: ${error.message}`
    )
  }

  return mapOtherIncomeFromDb(data)
}

export async function cancelOtherIncome(
  incomeId
) {
  if (!incomeId) {
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
    .eq('id', incomeId)
    .select(otherIncomeSelect)
    .single()

  if (error) {
    throw new Error(
      `Ek gelir iptal edilemedi: ${error.message}`
    )
  }

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

  const to =
    from +
    safePageSize -
    1

  let query = supabase
    .from('expenses')
    .select(expenseSelect, {
      count: 'exact'
    })
    .neq('status', 'İptal')

  const cleanSearchText = String(
    searchText || ''
  )
    .trim()
    .replace(/[(),]/g, ' ')

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
      `Gider kayıtları alınamadı: ${error.message}`
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
      `Gider özeti alınamadı: ${error.message}`
    )
  }

  return {
    totalExpense: Number(
      data?.total_expense || 0
    ),
    recordCount: Number(
      data?.record_count || 0
    )
  }
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
      `Giderler alınamadı: ${error.message}`
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
      `Gider kaydedilemedi: ${error.message}`
    )
  }

  return mapExpenseFromDb(data)
}

export async function cancelExpense(
  expenseId
) {
  if (!expenseId) {
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
    .eq('id', expenseId)
    .select(expenseSelect)
    .single()

  if (error) {
    throw new Error(
      `Gider iptal edilemedi: ${error.message}`
    )
  }

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
      `Öğretmen hakediş özeti alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    mapTeacherEarningSummaryFromDb
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
      `Öğretmen hakediş dersleri alınamadı: ${error.message}`
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

  const to =
    from +
    safePageSize -
    1

  let query = supabase
    .from('teacher_payment_history_view')
    .select('*', {
      count: 'exact'
    })

  const cleanSearchText = String(
    searchText || ''
  )
    .trim()
    .replace(/[(),]/g, ' ')

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
      `Öğretmen ödeme geçmişi alınamadı: ${error.message}`
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
      `Öğretmen ödemeleri alınamadı: ${error.message}`
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
      `Öğretmen ödemesi kaydedilemedi: ${error.message}`
    )
  }

  return mapTeacherPaymentFromDb(data)
}

export async function cancelTeacherPayment(
  paymentId
) {
  if (!paymentId) {
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
    .eq('id', paymentId)
    .select(teacherPaymentSelect)
    .single()

  if (error) {
    throw new Error(
      `Öğretmen ödemesi iptal edilemedi: ${error.message}`
    )
  }

  return mapTeacherPaymentFromDb(data)
}