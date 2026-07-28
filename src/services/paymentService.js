import { supabase } from '../lib/supabase'

const paymentSelect = `
  id,
  student_id,
  student_package_id,
  package_id,
  teacher_id,
  amount,
  payment_period,
  due_date,
  payment_date,
  payment_method,
  reference_number,
  note,
  is_active,
  created_at,
  updated_at,

  student:students (
    id,
    full_name
  ),

  student_package:student_packages (
    id,
    agreed_price,
    payment_day,
    first_payment_date,
    next_payment_date
  ),

  package:packages (
    id,
    name,

    specialty:specialties (
      id,
      name
    )
  ),

  teacher:teachers (
    id,
    full_name
  )
`

function cleanOptionalText(value) {
  const cleanValue = String(value || '').trim()

  return cleanValue || null
}

function mapPaymentFromDb(row) {
  return {
    id: row.id,

    studentId:
      row.student_id || '',

    studentName:
      row.student?.full_name || '',

    studentPackageId:
      row.student_package_id || '',

    packageId:
      row.package_id || '',

    packageName:
      row.package?.name || 'Tanımsız Paket',

    instrument:
      row.package?.specialty?.name || '',

    teacherId:
      row.teacher_id || '',

    teacher:
      row.teacher?.full_name || '',

    teacherName:
      row.teacher?.full_name || '',

    packagePrice: Number(
      row.student_package?.agreed_price || 0
    ),

    amount:
      Number(row.amount || 0),

    paymentPeriod:
      row.payment_period || '',

    dueDate:
      row.due_date || '',

    paymentDate:
      row.payment_date || '',

    paymentMethod:
      row.payment_method || '',

    referenceNumber:
      row.reference_number || '',

    note:
      row.note || '',

    isActive:
      row.is_active !== false,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  }
}

function mapPaymentMovementFromDb(row) {
  return {
    id: row.id,

    studentId:
      row.student_id || '',

    studentName:
      row.student_name || '',

    studentPackageId:
      row.student_package_id || '',

    packageId:
      row.package_id || '',

    packageName:
      row.package_name || 'Tanımsız Paket',

    instrument:
      row.instrument || '',

    teacherId:
      row.teacher_id || '',

    teacher:
      row.teacher_name || '',

    teacherName:
      row.teacher_name || '',

    packagePrice: Number(
      row.package_price || 0
    ),

    amount:
      Number(row.amount || 0),

    paymentPeriod:
      row.payment_period || '',

    dueDate:
      row.due_date || '',

    paymentDate:
      row.payment_date || '',

    paymentMethod:
      row.payment_method || '',

    referenceNumber:
      row.reference_number || '',

    note:
      row.note || '',

    isActive:
      row.is_active !== false,

    periodCollectedAmount:
      Number(
        row.period_collected_amount || 0
      ),

    remainingAmount:
      Number(
        row.remaining_amount || 0
      ),

    collectionStatus:
      row.collection_status || 'Kısmi Ödeme',

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  }
}

function validatePaymentInput(form) {
  const studentId = String(
    form.studentId || ''
  ).trim()

  const studentPackageId = String(
    form.studentPackageId || ''
  ).trim()

  const amount = Number(
    form.amount
  )

  const paymentPeriod = String(
    form.paymentPeriod || ''
  ).trim()

  const paymentDate = String(
    form.paymentDate || ''
  ).trim()

  const paymentMethod = String(
    form.paymentMethod || ''
  ).trim()

  if (!studentId) {
    throw new Error(
      'Öğrenci bilgisi bulunamadı.'
    )
  }

  if (!studentPackageId) {
    throw new Error(
      'Öğrenci paketi bulunamadı.'
    )
  }

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      'Tahsilat tutarı 0’dan büyük olmalıdır.'
    )
  }

  if (!paymentPeriod) {
    throw new Error(
      'Ödeme dönemi bulunamadı.'
    )
  }

  if (!paymentDate) {
    throw new Error(
      'Tahsilat tarihi bulunamadı.'
    )
  }

  if (!paymentMethod) {
    throw new Error(
      'Ödeme yöntemi bulunamadı.'
    )
  }

  return {
    student_id:
      studentId,

    student_package_id:
      studentPackageId,

    package_id:
      form.packageId || null,

    teacher_id:
      form.teacherId || null,

    amount,

    payment_period:
      paymentPeriod,

    due_date:
      form.dueDate || null,

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

    is_active: true
  }
}


export async function getDashboardPayments({
  monthsBack = 18
} = {}) {
  const safeMonthsBack = Math.max(
    1,
    Number(monthsBack) || 18
  )

  const cutoffDate = new Date()
  cutoffDate.setMonth(
    cutoffDate.getMonth() -
      safeMonthsBack
  )

  const cutoffKey = cutoffDate
    .toISOString()
    .slice(0, 10)

  const { data, error } = await supabase
    .from('payments')
    .select(paymentSelect)
    .eq('is_active', true)
    .gte('payment_date', cutoffKey)
    .order('payment_date', {
      ascending: false
    })
    .order('created_at', {
      ascending: false
    })

  if (error) {
    throw new Error(
      `Dashboard tahsilatları alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    mapPaymentFromDb
  )
}

export async function getStudentPaymentCount(
  studentId
) {
  if (!studentId) return 0

  const { count, error } = await supabase
    .from('payments')
    .select('id', {
      count: 'exact',
      head: true
    })
    .eq('student_id', studentId)

  if (error) {
    throw new Error(
      `Öğrenci tahsilat bağlantıları kontrol edilemedi: ${error.message}`
    )
  }

  return Number(count || 0)
}

export async function getTeacherPaymentReferenceCount(
  teacherId
) {
  if (!teacherId) return 0

  const { count, error } = await supabase
    .from('payments')
    .select('id', {
      count: 'exact',
      head: true
    })
    .eq('teacher_id', teacherId)

  if (error) {
    throw new Error(
      `Öğretmen tahsilat bağlantıları kontrol edilemedi: ${error.message}`
    )
  }

  return Number(count || 0)
}

export async function getPayments() {
  const {
    data,
    error
  } = await supabase
    .from('payments')
    .select(paymentSelect)
    .eq('is_active', true)
    .order('payment_date', {
      ascending: false
    })
    .order('created_at', {
      ascending: false
    })

  if (error) {
    throw new Error(
      `Tahsilatlar alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    mapPaymentFromDb
  )
}


export async function getPaymentsByStudentPackage(
  studentPackageId
) {
  const cleanStudentPackageId = String(
    studentPackageId || ''
  ).trim()

  if (!cleanStudentPackageId) {
    return []
  }

  const {
    data,
    error
  } = await supabase
    .from('payments')
    .select(paymentSelect)
    .eq(
      'student_package_id',
      cleanStudentPackageId
    )
    .eq('is_active', true)
    .order('payment_date', {
      ascending: true
    })
    .order('created_at', {
      ascending: true
    })

  if (error) {
    throw new Error(
      `Seçilen paketin tahsilat geçmişi alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    mapPaymentFromDb
  )
}

export async function getPaymentMovementsPage({
  page = 1,
  pageSize = 10,
  filters = {},
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
    .from('payment_movements_view')
    .select('*', {
      count: 'exact'
    })

  const searchText = String(
    filters.searchText || ''
  )
    .trim()
    .replace(/[(),]/g, ' ')

  if (searchText) {
    const searchPattern =
      `%${searchText}%`

    query = query.or(
      [
        `student_name.ilike.${searchPattern}`,
        `package_name.ilike.${searchPattern}`,
        `teacher_name.ilike.${searchPattern}`,
        `reference_number.ilike.${searchPattern}`,
        `payment_period.ilike.${searchPattern}`
      ].join(',')
    )
  }

  if (filters.status) {
    query = query.eq(
      'collection_status',
      filters.status
    )
  }

  if (filters.paymentMethod) {
    query = query.eq(
      'payment_method',
      filters.paymentMethod
    )
  }

  if (filters.startDate) {
    query = query.gte(
      'payment_date',
      filters.startDate
    )
  }

  if (filters.endDate) {
    query = query.lte(
      'payment_date',
      filters.endDate
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
    studentAsc: {
      column: 'student_name',
      ascending: true
    },
    studentDesc: {
      column: 'student_name',
      ascending: false
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
      `Tahsilat hareketleri alınamadı: ${error.message}`
    )
  }

  return {
    data: (data || []).map(
      mapPaymentMovementFromDb
    ),
    total: Number(count || 0),
    page: safePage,
    pageSize: safePageSize
  }
}

export async function createPayment(
  form
) {
  const row =
    validatePaymentInput(form)

  const {
    data,
    error
  } = await supabase
    .from('payments')
    .insert(row)
    .select(paymentSelect)
    .single()

  if (error) {
    throw new Error(
      `Tahsilat kaydedilemedi: ${error.message}`
    )
  }

  return mapPaymentFromDb(data)
}

export async function updatePayment(
  paymentId,
  changes
) {
  if (!paymentId) {
    throw new Error(
      'Tahsilat kimliği bulunamadı.'
    )
  }

  const amount = Number(
    changes.amount
  )

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      'Tahsilat tutarı 0’dan büyük olmalıdır.'
    )
  }

  const paymentDate = String(
    changes.paymentDate || ''
  ).trim()

  const paymentMethod = String(
    changes.paymentMethod || ''
  ).trim()

  if (!paymentDate) {
    throw new Error(
      'Tahsilat tarihi bulunamadı.'
    )
  }

  if (!paymentMethod) {
    throw new Error(
      'Ödeme yöntemi bulunamadı.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from('payments')
    .update({
      amount,

      payment_date:
        paymentDate,

      payment_method:
        paymentMethod,

      reference_number:
        cleanOptionalText(
          changes.referenceNumber
        ),

      note:
        cleanOptionalText(
          changes.note
        )
    })
    .eq('id', paymentId)
    .select(paymentSelect)
    .single()

  if (error) {
    throw new Error(
      `Tahsilat güncellenemedi: ${error.message}`
    )
  }

  return mapPaymentFromDb(data)
}

export async function deletePayment(
  paymentId
) {
  if (!paymentId) {
    throw new Error(
      'Tahsilat kimliği bulunamadı.'
    )
  }

  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', paymentId)

  if (error) {
    throw new Error(
      `Tahsilat silinemedi: ${error.message}`
    )
  }
}

export async function updateStudentPackageNextPaymentDate(
  studentPackageId,
  nextPaymentDate
) {
  if (!studentPackageId) {
    throw new Error(
      'Öğrenci paketi kimliği bulunamadı.'
    )
  }

  const { error } = await supabase
    .from('student_packages')
    .update({
      next_payment_date:
        nextPaymentDate || null
    })
    .eq('id', studentPackageId)

  if (error) {
    throw new Error(
      `Sonraki ödeme tarihi güncellenemedi: ${error.message}`
    )
  }
}