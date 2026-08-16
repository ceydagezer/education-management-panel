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

function getPaymentErrorMessage(
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

function normalizeDateKey(
  value,
  label,
  {
    required = false
  } = {}
) {
  const dateKey = String(
    value || ''
  ).trim()

  if (!dateKey) {
    if (required) {
      throw new Error(
        `${label} bulunamadı.`
      )
    }

    return ''
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateKey
    )
  ) {
    throw new Error(
      `${label} geçerli değildir.`
    )
  }

  return dateKey
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

  const paymentDate =
    normalizeDateKey(
      form.paymentDate,
      'Tahsilat tarihi',
      {
        required: true
      }
    )

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
      normalizeDateKey(
        form.dueDate,
        'Vade tarihi'
      ) || null,

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



const paymentStudentSelect = `
  id,
  tc_no,
  full_name,
  status,
  is_active,
  is_archived,
  is_anonymized,

  student_packages (
    id,
    student_id,
    package_id,
    default_teacher_id,
    agreed_price,
    payment_period,
    payment_day,
    first_payment_date,
    next_payment_date,
    total_lesson_count,
    status,
    is_active,
    created_at,

    package:packages (
      id,
      name,
      duration_minutes,
      lesson_count,
      total_price,

      specialty:specialties (
        id,
        name
      )
    ),

    default_teacher:teachers (
      id,
      full_name,
      status,
      is_active
    )
  )
`

function normalizePaymentStudentStatus(
  value
) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
}

function mapPaymentStudentPackageFromDb(
  row
) {
  const packageRecord =
    row.package || null

  const teacherRecord =
    row.default_teacher || null

  const packageStatus =
    normalizePaymentStudentStatus(
      row.status
    )

  const isActive =
    row.is_active !== false &&
    packageStatus !==
      'sonlandırıldı' &&
    packageStatus !==
      'pasif'

  const agreedPrice =
    Number(
      row.agreed_price || 0
    )

  const lessonDuration =
    Number(
      packageRecord
        ?.duration_minutes || 0
    )

  const lessonCount =
    Number(
      packageRecord
        ?.lesson_count || 0
    )

  return {
    studentPackageId:
      row.id || '',
    enrollmentId:
      row.id || '',
    assignmentId:
      row.id || '',

    studentId:
      row.student_id || '',

    packageId:
      row.package_id || '',
    packageName:
      packageRecord?.name ||
      'Tanımsız Paket',

    instrument:
      packageRecord
        ?.specialty
        ?.name || '',
    branch:
      packageRecord
        ?.specialty
        ?.name || '',

    lessonDuration:
      lessonDuration
        ? `${lessonDuration} dk`
        : '',
    duration:
      lessonDuration
        ? `${lessonDuration} dk`
        : '',

    lessonCount,
    totalLessonCount:
      Number(
        row.total_lesson_count ??
        lessonCount
      ),

    totalPrice:
      Number(
        packageRecord
          ?.total_price || 0
      ),
    packagePrice:
      Number(
        packageRecord
          ?.total_price || 0
      ),

    teacherId:
      row.default_teacher_id || '',
    defaultTeacherId:
      row.default_teacher_id || '',
    teacher:
      teacherRecord
        ?.full_name || '',
    teacherName:
      teacherRecord
        ?.full_name || '',
    defaultTeacherName:
      teacherRecord
        ?.full_name || '',

    agreedPrice,
    monthlyFee:
      agreedPrice,

    paymentPeriod:
      row.payment_period ||
      'Aylık',
    paymentDay:
      row.payment_day || '',
    firstPaymentDate:
      row.first_payment_date || '',
    nextPaymentDate:
      row.next_payment_date || '',

    status:
      isActive
        ? 'Aktif'
        : 'Sonlandırıldı',
    isActive,

    createdAt:
      row.created_at || null
  }
}

function mapPaymentStudentFromDb(
  row
) {
  const enrolledPackages =
    (row.student_packages || [])
      .map(
        mapPaymentStudentPackageFromDb
      )
      .filter(
        (item) =>
          item.isActive !== false
      )
      .sort(
        (first, second) =>
          String(
            second.createdAt || ''
          ).localeCompare(
            String(
              first.createdAt || ''
            )
          )
      )

  return {
    id:
      row.id,

    tcNo:
      row.tc_no || '',

    fullName:
      row.full_name || '',

    status:
      row.status || '',

    isActive:
      row.is_active !== false,

    isArchived:
      row.is_archived === true,

    isAnonymized:
      row.is_anonymized === true,

    enrolledPackages
  }
}

export async function getPaymentStudents() {
  const {
    data,
    error
  } = await supabase
    .from('students')
    .select(
      paymentStudentSelect
    )
    .eq('is_active', true)
    .order(
      'full_name',
      {
        ascending: true
      }
    )

  if (error) {
    throw new Error(
      getPaymentErrorMessage(
        error,
        'Tahsilat için öğrenci ve paket bilgileri şu anda alınamadı.'
      )
    )
  }

  return (data || [])
    .filter(
      (row) => {
        const normalizedStatus =
          normalizePaymentStudentStatus(
            row.status
          )

        return (
          row.is_active !== false &&
          row.is_archived !== true &&
          row.is_anonymized !== true &&
          normalizedStatus !==
            'pasif' &&
          normalizedStatus !==
            'arşiv'
        )
      }
    )
    .map(
      mapPaymentStudentFromDb
    )
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
      getPaymentErrorMessage(
        error,
        'Dashboard tahsilatları şu anda alınamadı.'
      )
    )
  }

  return (data || []).map(
    mapPaymentFromDb
  )
}

export async function getStudentPaymentCount(
  studentId
) {
  const cleanStudentId = String(
    studentId || ''
  ).trim()

  if (!cleanStudentId) {
    return 0
  }

  const { count, error } = await supabase
    .from('payments')
    .select('id', {
      count: 'exact',
      head: true
    })
    .eq('student_id', cleanStudentId)

  if (error) {
    throw new Error(
      getPaymentErrorMessage(
        error,
        'Öğrenci tahsilat bağlantıları şu anda kontrol edilemedi.'
      )
    )
  }

  return Number(count || 0)
}

export async function getTeacherPaymentReferenceCount(
  teacherId
) {
  const cleanTeacherId = String(
    teacherId || ''
  ).trim()

  if (!cleanTeacherId) {
    return 0
  }

  const { count, error } = await supabase
    .from('payments')
    .select('id', {
      count: 'exact',
      head: true
    })
    .eq('teacher_id', cleanTeacherId)

  if (error) {
    throw new Error(
      getPaymentErrorMessage(
        error,
        'Öğretmen tahsilat bağlantıları şu anda kontrol edilemedi.'
      )
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
      getPaymentErrorMessage(
        error,
        'Tahsilatlar şu anda alınamadı.'
      )
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
      getPaymentErrorMessage(
        error,
        'Seçilen paketin tahsilat geçmişi şu anda alınamadı.'
      )
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
  const {
    safePage,
    safePageSize,
    from,
    to
  } = getSafePagination(
    page,
    pageSize
  )

  const cleanStartDate =
    normalizeDateKey(
      filters.startDate,
      'Başlangıç tarihi'
    )

  const cleanEndDate =
    normalizeDateKey(
      filters.endDate,
      'Bitiş tarihi'
    )

  if (
    cleanStartDate &&
    cleanEndDate &&
    cleanStartDate >
      cleanEndDate
  ) {
    throw new Error(
      'Başlangıç tarihi bitiş tarihinden sonra olamaz.'
    )
  }

  let query = supabase
    .from('payment_movements_view')
    .select('*', {
      count: 'exact'
    })

  const searchText =
    cleanSearchValue(
      filters.searchText
    )

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

  if (cleanStartDate) {
    query = query.gte(
      'payment_date',
      cleanStartDate
    )
  }

  if (cleanEndDate) {
    query = query.lte(
      'payment_date',
      cleanEndDate
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
      getPaymentErrorMessage(
        error,
        'Tahsilat hareketleri şu anda alınamadı.'
      )
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
      getPaymentErrorMessage(
        error,
        'Tahsilat kaydedilemedi.'
      )
    )
  }

  return mapPaymentFromDb(data)
}

export async function updatePayment(
  paymentId,
  changes
) {
  const cleanPaymentId = String(
    paymentId || ''
  ).trim()

  if (!cleanPaymentId) {
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

  const paymentDate =
    normalizeDateKey(
      changes.paymentDate,
      'Tahsilat tarihi',
      {
        required: true
      }
    )

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
    .eq('id', cleanPaymentId)
    .select(paymentSelect)
    .single()

  if (error) {
    throw new Error(
      getPaymentErrorMessage(
        error,
        'Tahsilat güncellenemedi.'
      )
    )
  }

  return mapPaymentFromDb(data)
}

export async function deletePayment(
  paymentId
) {
  const cleanPaymentId = String(
    paymentId || ''
  ).trim()

  if (!cleanPaymentId) {
    throw new Error(
      'Tahsilat kimliği bulunamadı.'
    )
  }

  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', cleanPaymentId)

  if (error) {
    throw new Error(
      getPaymentErrorMessage(
        error,
        'Tahsilat silinemedi.'
      )
    )
  }
}

export async function updateStudentPackageNextPaymentDate(
  studentPackageId,
  nextPaymentDate
) {
  const cleanStudentPackageId = String(
    studentPackageId || ''
  ).trim()

  if (!cleanStudentPackageId) {
    throw new Error(
      'Öğrenci paketi kimliği bulunamadı.'
    )
  }

  const cleanNextPaymentDate =
    normalizeDateKey(
      nextPaymentDate,
      'Sonraki ödeme tarihi'
    )

  const { error } = await supabase
    .from('student_packages')
    .update({
      next_payment_date:
        cleanNextPaymentDate || null
    })
    .eq('id', cleanStudentPackageId)

  if (error) {
    throw new Error(
      getPaymentErrorMessage(
        error,
        'Sonraki ödeme tarihi güncellenemedi.'
      )
    )
  }
}