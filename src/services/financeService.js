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