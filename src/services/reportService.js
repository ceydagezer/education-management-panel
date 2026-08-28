import { supabase } from '../lib/supabase'

/*
 * =========================================================
 * ORTAK YARDIMCI FONKSİYONLAR
 * =========================================================
 */

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

function cleanSearchValue(
  value
) {
  return String(value || '')
    .trim()
    .replace(/[(),]/g, ' ')
}


/*
 * =========================================================
 * ÖĞRENCİ TAKİP RAPORU
 * =========================================================
 */

function mapStudentTrackingRow(
  row
) {
  return {
    studentId:
      row.student_id || '',

    studentName:
      row.student_name || '',

    gender:
      row.gender || '',

    teacherNames:
      row.teacher_names || '-',

    packageNames:
      row.package_names || '-',

    groupNames:
      row.group_names || '-',

    registerDate:
      row.register_date || '',

    studentStatus:
      row.student_status || '',

    studentIsActive:
      row.student_is_active !== false
  }
}

function applyStudentTrackingFilters(
  query,
  {
    searchText = '',
    studentStatus = 'active'
  } = {}
) {
  const cleanSearchText =
    cleanSearchValue(
      searchText
    )

  if (cleanSearchText) {
    const searchPattern =
      `%${cleanSearchText}%`

    query = query.or(
      [
        `student_name.ilike.${searchPattern}`,
        `teacher_names.ilike.${searchPattern}`,
        `package_names.ilike.${searchPattern}`,
        `group_names.ilike.${searchPattern}`
      ].join(',')
    )
  }

  if (
    studentStatus === 'active'
  ) {
    query = query.eq(
      'student_is_active',
      true
    )
  } else if (
    studentStatus === 'passive'
  ) {
    query = query.eq(
      'student_is_active',
      false
    )
  }

  return query
}

export async function getStudentTrackingReportPage({
  page = 1,
  pageSize = 10,
  searchText = '',
  studentStatus = 'active',
  sortOption = 'nameAsc'
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
    .from(
      'student_tracking_report_view'
    )
    .select(
      '*',
      {
        count: 'exact'
      }
    )

  query =
    applyStudentTrackingFilters(
      query,
      {
        searchText,
        studentStatus
      }
    )

  const sortSettings = {
    nameAsc: {
      column: 'student_name',
      ascending: true
    },

    nameDesc: {
      column: 'student_name',
      ascending: false
    },

    newest: {
      column: 'register_date',
      ascending: false
    },

    oldest: {
      column: 'register_date',
      ascending: true
    }
  }

  const selectedSort =
    sortSettings[sortOption] ||
    sortSettings.nameAsc

  query = query
    .order(
      selectedSort.column,
      {
        ascending:
          selectedSort.ascending,

        nullsFirst: false
      }
    )
    .range(
      from,
      to
    )

  const {
    data,
    error,
    count
  } = await query

  if (error) {
    console.error(
      'Öğrenci takip raporu sorgu hatası:',
      error
    )

    throw new Error(
      `Öğrenci takip raporu alınamadı: ${error.message}`
    )
  }

  return {
    data:
      (data || []).map(
        mapStudentTrackingRow
      ),

    total:
      Number(count || 0),

    page:
      safePage,

    pageSize:
      safePageSize
  }
}

export async function getAllStudentTrackingReportRows(
  filters = {}
) {
  let query = supabase
    .from(
      'student_tracking_report_view'
    )
    .select('*')

  query =
    applyStudentTrackingFilters(
      query,
      filters
    )

  const {
    data,
    error
  } = await query
    .order(
      'student_name',
      {
        ascending: true
      }
    )

  if (error) {
    console.error(
      'Öğrenci takip raporu dışa aktarma sorgu hatası:',
      error
    )

    throw new Error(
      `Öğrenci takip raporu alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    mapStudentTrackingRow
  )
}


/*
 * =========================================================
 * ÖĞRENCİ ÖDEME RAPORU
 * =========================================================
 */

function mapStudentPaymentRow(
  row
) {
  return {
    studentPackageId:
      row.student_package_id || '',

    studentId:
      row.student_id || '',

    studentName:
      row.student_name || '',

    studentIsActive:
      row.student_is_active !== false,

    packageId:
      row.package_id || '',

    packageName:
      row.package_name || '',

    teacherId:
      row.teacher_id || '',

    teacherName:
      row.teacher_name || '-',

    paymentPeriod:
      row.payment_period || '',

    paymentDay:
      row.payment_day ?? null,

    firstPaymentDate:
      row.first_payment_date || '',

    nextPaymentDate:
      row.next_payment_date || '',

    agreedPrice:
      Number(
        row.agreed_price || 0
      ),

    paidAmount:
      Number(
        row.paid_amount || 0
      ),

    remainingAmount:
      Number(
        row.remaining_amount || 0
      ),

    lastPaymentDate:
      row.last_payment_date || '',

    paymentStatus:
      row.payment_status || '',

    packageStatus:
      row.package_status || '',

    packageIsActive:
      row.package_is_active !== false,

    createdAt:
      row.created_at || ''
  }
}

function applyStudentPaymentFilters(
  query,
  {
    searchText = '',
    studentStatus = 'active',
    packageId = '',
    teacherId = '',
    paymentStatus = 'all'
  } = {}
) {
  const cleanSearchText =
    cleanSearchValue(
      searchText
    )

  if (cleanSearchText) {
    const searchPattern =
      `%${cleanSearchText}%`

    query = query.or(
      [
        `student_name.ilike.${searchPattern}`,
        `package_name.ilike.${searchPattern}`,
        `teacher_name.ilike.${searchPattern}`,
        `payment_period.ilike.${searchPattern}`,
        `payment_status.ilike.${searchPattern}`
      ].join(',')
    )
  }

  if (
    studentStatus === 'active'
  ) {
    query = query
      .eq(
        'student_is_active',
        true
      )
      .eq(
        'package_is_active',
        true
      )
  } else if (
    studentStatus === 'passive'
  ) {
    query = query.eq(
      'student_is_active',
      false
    )
  }

  if (packageId) {
    query = query.eq(
      'package_id',
      packageId
    )
  }

  if (teacherId) {
    query = query.eq(
      'teacher_id',
      teacherId
    )
  }

  if (
    paymentStatus &&
    paymentStatus !== 'all'
  ) {
    query = query.eq(
      'payment_status',
      paymentStatus
    )
  }

  return query
}

export async function getStudentPaymentReportPage({
  page = 1,
  pageSize = 10,
  searchText = '',
  studentStatus = 'active',
  packageId = '',
  teacherId = '',
  paymentStatus = 'all',
  sortOption = 'nameAsc'
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
    .from(
      'student_payment_report_view'
    )
    .select(
      '*',
      {
        count: 'exact'
      }
    )

  query =
    applyStudentPaymentFilters(
      query,
      {
        searchText,
        studentStatus,
        packageId,
        teacherId,
        paymentStatus
      }
    )

  const sortSettings = {
    nameAsc: {
      column: 'student_name',
      ascending: true
    },

    nameDesc: {
      column: 'student_name',
      ascending: false
    },

    highestPrice: {
      column: 'agreed_price',
      ascending: false
    },

    lowestPrice: {
      column: 'agreed_price',
      ascending: true
    },

    highestRemaining: {
      column: 'remaining_amount',
      ascending: false
    },

    lowestRemaining: {
      column: 'remaining_amount',
      ascending: true
    },

    newestPayment: {
      column: 'last_payment_date',
      ascending: false
    },

    oldestPayment: {
      column: 'last_payment_date',
      ascending: true
    },

    nextPaymentAsc: {
      column: 'next_payment_date',
      ascending: true
    },

    nextPaymentDesc: {
      column: 'next_payment_date',
      ascending: false
    }
  }

  const selectedSort =
    sortSettings[sortOption] ||
    sortSettings.nameAsc

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
      'student_name',
      {
        ascending: true
      }
    )
    .range(
      from,
      to
    )

  const {
    data,
    error,
    count
  } = await query

  if (error) {
    console.error(
      'Öğrenci ödeme raporu sorgu hatası:',
      error
    )

    throw new Error(
      `Öğrenci ödeme raporu alınamadı: ${error.message}`
    )
  }

  return {
    data:
      (data || []).map(
        mapStudentPaymentRow
      ),

    total:
      Number(count || 0),

    page:
      safePage,

    pageSize:
      safePageSize
  }
}

export async function getAllStudentPaymentReportRows(
  filters = {}
) {
  let query = supabase
    .from(
      'student_payment_report_view'
    )
    .select('*')

  query =
    applyStudentPaymentFilters(
      query,
      filters
    )

  const {
    data,
    error
  } = await query
    .order(
      'student_name',
      {
        ascending: true
      }
    )
    .order(
      'package_name',
      {
        ascending: true
      }
    )

  if (error) {
    console.error(
      'Öğrenci ödeme raporu dışa aktarma sorgu hatası:',
      error
    )

    throw new Error(
      `Öğrenci ödeme raporu alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    mapStudentPaymentRow
  )
}


/*
 * =========================================================
 * ÖĞRETMEN TAKİP RAPORU
 * =========================================================
 */

function mapTeacherTrackingRow(row) {
  return {
    teacherId:
      row.teacher_id || '',

    teacherName:
      row.teacher_name || '',

    gender:
      row.gender || '',

    phone:
      row.phone || '',

    email:
      row.email || '',

    teacherStatus:
      row.teacher_status || '',

    teacherIsActive:
      row.teacher_is_active !== false,

    teacherCreatedAt:
      row.teacher_created_at || '',

    specialtyNames:
      row.specialty_names || '-',

    totalStudentCount:
      Number(
        row.total_student_count || 0
      ),

    individualStudentCount:
      Number(
        row.individual_student_count || 0
      ),

    groupStudentCount:
      Number(
        row.group_student_count || 0
      ),

    groupCount:
      Number(
        row.group_count || 0
      ),

    weeklyLessonCount:
      Number(
        row.weekly_lesson_count || 0
      ),

    packageNames:
      row.package_names || '-'
  }
}

function mapTeacherTrackingDetailRow(row) {
  return {
    detailId:
      row.detail_id || '',

    teacherId:
      row.teacher_id || '',

    recordType:
      row.record_type || '',

    recordTypeLabel:
      row.record_type_label || '',

    studentId:
      row.student_id || '',

    studentName:
      row.student_name || '',

    studentRegisterDate:
      row.student_register_date || '',

    studentIsActive:
      row.student_is_active !== false,

    groupId:
      row.group_id || '',

    groupName:
      row.group_name || '',

    packageId:
      row.package_id || '',

    packageName:
      row.package_name || '',

    studentPackageId:
      row.student_package_id || '',

    assignmentCreatedAt:
      row.assignment_created_at || '',

    assignmentIsActive:
      row.assignment_is_active !== false
  }
}

function applyTeacherTrackingFilters(
  query,
  {
    searchText = '',
    teacherStatus = 'active',
    specialtyText = '',
    packageText = ''
  } = {}
) {
  const cleanedSearchText =
    cleanSearchValue(searchText)

  if (cleanedSearchText) {
    const searchPattern =
      `%${cleanedSearchText}%`

    query = query.or(
      [
        `teacher_name.ilike.${searchPattern}`,
        `specialty_names.ilike.${searchPattern}`,
        `package_names.ilike.${searchPattern}`,
        `phone.ilike.${searchPattern}`,
        `email.ilike.${searchPattern}`
      ].join(',')
    )
  }

  if (teacherStatus === 'active') {
    query = query.eq(
      'teacher_is_active',
      true
    )
  } else if (
    teacherStatus === 'passive'
  ) {
    query = query.eq(
      'teacher_is_active',
      false
    )
  }

  const cleanedSpecialtyText =
    cleanSearchValue(specialtyText)

  if (cleanedSpecialtyText) {
    query = query.ilike(
      'specialty_names',
      `%${cleanedSpecialtyText}%`
    )
  }

  const cleanedPackageText =
    cleanSearchValue(packageText)

  if (cleanedPackageText) {
    query = query.ilike(
      'package_names',
      `%${cleanedPackageText}%`
    )
  }

  return query
}

export async function getTeacherTrackingReportPage({
  page = 1,
  pageSize = 10,
  searchText = '',
  teacherStatus = 'active',
  specialtyText = '',
  packageText = '',
  sortOption = 'nameAsc'
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
    .from(
      'teacher_tracking_report_view'
    )
    .select(
      '*',
      {
        count: 'exact'
      }
    )

  query = applyTeacherTrackingFilters(
    query,
    {
      searchText,
      teacherStatus,
      specialtyText,
      packageText
    }
  )

  const sortSettings = {
    nameAsc: {
      column: 'teacher_name',
      ascending: true
    },

    nameDesc: {
      column: 'teacher_name',
      ascending: false
    },

    totalStudentDesc: {
      column: 'total_student_count',
      ascending: false
    },

    totalStudentAsc: {
      column: 'total_student_count',
      ascending: true
    },

    individualStudentDesc: {
      column:
        'individual_student_count',
      ascending: false
    },

    groupCountDesc: {
      column: 'group_count',
      ascending: false
    },

    groupCountAsc: {
      column: 'group_count',
      ascending: true
    },

    weeklyLessonDesc: {
      column: 'weekly_lesson_count',
      ascending: false
    },

    weeklyLessonAsc: {
      column: 'weekly_lesson_count',
      ascending: true
    },

    newestTeacher: {
      column: 'teacher_created_at',
      ascending: false
    },

    oldestTeacher: {
      column: 'teacher_created_at',
      ascending: true
    }
  }

  const selectedSort =
    sortSettings[sortOption] ||
    sortSettings.nameAsc

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
      'teacher_name',
      {
        ascending: true
      }
    )
    .range(
      from,
      to
    )

  const {
    data,
    error,
    count
  } = await query

  if (error) {
    console.error(
      'Öğretmen takip raporu sorgu hatası:',
      error
    )

    throw new Error(
      `Öğretmen takip raporu alınamadı: ${error.message}`
    )
  }

  return {
    data:
      (data || []).map(
        mapTeacherTrackingRow
      ),

    total:
      Number(count || 0),

    page:
      safePage,

    pageSize:
      safePageSize
  }
}

export async function getTeacherTrackingDetails(
  teacherId
) {
  if (!teacherId) {
    return []
  }

  const {
    data,
    error
  } = await supabase
    .from(
      'teacher_tracking_detail_view'
    )
    .select('*')
    .eq(
      'teacher_id',
      teacherId
    )
    .eq(
      'assignment_is_active',
      true
    )
    .order(
      'record_type',
      {
        ascending: true
      }
    )
    .order(
      'group_name',
      {
        ascending: true,
        nullsFirst: false
      }
    )
    .order(
      'student_name',
      {
        ascending: true
      }
    )

  if (error) {
    console.error(
      'Öğretmen takip detay sorgu hatası:',
      error
    )

    throw new Error(
      `Öğretmen detayları alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    mapTeacherTrackingDetailRow
  )
}

export async function getAllTeacherTrackingReportRows(
  filters = {}
) {
  let teacherQuery = supabase
    .from(
      'teacher_tracking_report_view'
    )
    .select('*')

  teacherQuery =
    applyTeacherTrackingFilters(
      teacherQuery,
      filters
    )

  const {
    data: teacherRows,
    error: teacherError
  } = await teacherQuery.order(
    'teacher_name',
    {
      ascending: true
    }
  )

  if (teacherError) {
    console.error(
      'Öğretmen takip raporu dışa aktarma sorgu hatası:',
      teacherError
    )

    throw new Error(
      `Öğretmen takip raporu alınamadı: ${teacherError.message}`
    )
  }

  const mappedTeachers =
    (teacherRows || []).map(
      mapTeacherTrackingRow
    )

  if (
    mappedTeachers.length === 0
  ) {
    return []
  }

  const teacherIds =
    mappedTeachers.map(
      (teacher) =>
        teacher.teacherId
    )

  const {
    data: detailRows,
    error: detailError
  } = await supabase
    .from(
      'teacher_tracking_detail_view'
    )
    .select('*')
    .in(
      'teacher_id',
      teacherIds
    )
    .eq(
      'assignment_is_active',
      true
    )
    .order(
      'record_type',
      {
        ascending: true
      }
    )
    .order(
      'group_name',
      {
        ascending: true,
        nullsFirst: false
      }
    )
    .order(
      'student_name',
      {
        ascending: true
      }
    )

  if (detailError) {
    console.error(
      'Öğretmen takip detay dışa aktarma sorgu hatası:',
      detailError
    )

    throw new Error(
      `Öğretmen detayları alınamadı: ${detailError.message}`
    )
  }

  const mappedDetails =
    (detailRows || []).map(
      mapTeacherTrackingDetailRow
    )

  return mappedTeachers.map(
    (teacher) => ({
      ...teacher,

      details:
        mappedDetails.filter(
          (detail) =>
            detail.teacherId ===
            teacher.teacherId
        )
    })
  )
}

/*
 * =========================================================
 * ÖĞRETMEN HAKEDİŞ RAPORU
 * =========================================================
 */

function getTeacherEarningStatus(
  totalEarning,
  totalPaid,
  remainingPayment
) {
  const safeTotalEarning =
    Number(totalEarning || 0)

  const safeTotalPaid =
    Number(totalPaid || 0)

  const safeRemainingPayment =
    Number(remainingPayment || 0)

  if (safeTotalEarning <= 0) {
    return {
      label: 'Hakediş Yok',
      className: 'none'
    }
  }

  if (safeRemainingPayment <= 0) {
    return {
      label: 'Ödendi',
      className: 'paid'
    }
  }

  if (safeTotalPaid > 0) {
    return {
      label: 'Kısmi Ödendi',
      className: 'partial'
    }
  }

  return {
    label: 'Bekliyor',
    className: 'waiting'
  }
}

function mapTeacherEarningsReportRow(
  row
) {
  const totalEarning =
    Number(
      row.total_earning || 0
    )

  const totalPaid =
    Number(
      row.total_paid || 0
    )

  const remainingPayment =
    Number(
      row.remaining_payment || 0
    )

  const earningStatus =
    getTeacherEarningStatus(
      totalEarning,
      totalPaid,
      remainingPayment
    )

  return {
    teacherId:
      row.teacher_id || '',

    teacherName:
      row.teacher_name || '',

    branch:
      row.branch || '-',

    commissionRate:
      Number(
        row.commission_rate || 0
      ),

    teacherIsActive:
      row.teacher_is_active !== false,

    teacherStatus:
      row.teacher_status || 'Aktif',

    completedLessonCount:
      Number(
        row.completed_lesson_count || 0
      ),

    totalLessonAmount:
      Number(
        row.total_lesson_amount || 0
      ),

    totalEarning,

    totalPaid,

    remainingPayment,

    earningStatus:
      earningStatus.label,

    earningStatusClass:
      earningStatus.className
  }
}

function mapTeacherEarningReportDetailRow(
  row
) {
  const groupName =
    row.group_name || ''

  const studentName =
    row.student_name || ''

  const recordType =
    groupName
      ? 'group'
      : 'individual'

  return {
    lessonId:
      row.lesson_id || '',

    teacherId:
      row.teacher_id || '',

    teacherName:
      row.teacher_name || '',

    studentId:
      row.student_id || '',

    studentName:
      studentName || 'Öğrenci',

    groupId:
      row.group_id || '',

    groupName,

    recordType,

    recordTypeLabel:
      recordType === 'group'
        ? 'Grup'
        : 'Bireysel',

    studentOrGroupName:
      groupName
        ? `${groupName}${
            studentName
              ? ` — ${studentName}`
              : ''
          }`
        : studentName ||
          'Öğrenci',

    studentPackageId:
      row.student_package_id || '',

    packageId:
      row.package_id || '',

    packageName:
      row.package_name ||
      'Tanımsız Paket',

    instrument:
      row.instrument || '',

    lessonDate:
      row.lesson_date || '',

    day:
      row.day || '',

    startTime:
      String(
        row.start_time || ''
      ).slice(
        0,
        5
      ),

    lessonStatus:
      row.status || '',

    agreedPrice:
      Number(
        row.agreed_price || 0
      ),

    lessonCount:
      Number(
        row.lesson_count || 1
      ),

    unitPrice:
      Number(
        row.unit_price || 0
      ),

    commissionRate:
      Number(
        row.commission_rate || 0
      ),

    teacherEarning:
      Number(
        row.teacher_earning || 0
      ),

    createdAt:
      row.created_at || ''
  }
}

function applyTeacherEarningsReportFilters(
  query,
  {
    searchText = '',
    teacherStatus = 'active',
    branchText = '',
    earningStatus = 'all'
  } = {}
) {
  const cleanedSearchText =
    cleanSearchValue(searchText)

  if (cleanedSearchText) {
    const searchPattern =
      `%${cleanedSearchText}%`

    query = query.or(
      [
        `teacher_name.ilike.${searchPattern}`,
        `branch.ilike.${searchPattern}`
      ].join(',')
    )
  }

  if (teacherStatus === 'active') {
    query = query.eq(
      'teacher_is_active',
      true
    )
  } else if (
    teacherStatus === 'passive'
  ) {
    query = query.eq(
      'teacher_is_active',
      false
    )
  }

  const cleanedBranchText =
    cleanSearchValue(branchText)

  if (cleanedBranchText) {
    query = query.ilike(
      'branch',
      `%${cleanedBranchText}%`
    )
  }

  if (earningStatus === 'paid') {
    query = query
      .gt(
        'total_earning',
        0
      )
      .lte(
        'remaining_payment',
        0
      )
  } else if (
    earningStatus === 'partial'
  ) {
    query = query
      .gt(
        'total_paid',
        0
      )
      .gt(
        'remaining_payment',
        0
      )
  } else if (
    earningStatus === 'waiting'
  ) {
    query = query
      .gt(
        'total_earning',
        0
      )
      .eq(
        'total_paid',
        0
      )
      .gt(
        'remaining_payment',
        0
      )
  } else if (
    earningStatus === 'none'
  ) {
    query = query.eq(
      'total_earning',
      0
    )
  }

  return query
}

export async function getTeacherEarningsReportPage({
  page = 1,
  pageSize = 10,
  searchText = '',
  teacherStatus = 'active',
  branchText = '',
  earningStatus = 'all',
  sortOption = 'nameAsc'
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
    .from(
      'teacher_earnings_summary_view'
    )
    .select(
      '*',
      {
        count: 'exact'
      }
    )

  query =
    applyTeacherEarningsReportFilters(
      query,
      {
        searchText,
        teacherStatus,
        branchText,
        earningStatus
      }
    )

  const sortSettings = {
    nameAsc: {
      column: 'teacher_name',
      ascending: true
    },

    nameDesc: {
      column: 'teacher_name',
      ascending: false
    },

    lessonCountDesc: {
      column:
        'completed_lesson_count',
      ascending: false
    },

    lessonCountAsc: {
      column:
        'completed_lesson_count',
      ascending: true
    },

    lessonAmountDesc: {
      column:
        'total_lesson_amount',
      ascending: false
    },

    lessonAmountAsc: {
      column:
        'total_lesson_amount',
      ascending: true
    },

    earningDesc: {
      column: 'total_earning',
      ascending: false
    },

    earningAsc: {
      column: 'total_earning',
      ascending: true
    },

    paidDesc: {
      column: 'total_paid',
      ascending: false
    },

    paidAsc: {
      column: 'total_paid',
      ascending: true
    },

    remainingDesc: {
      column:
        'remaining_payment',
      ascending: false
    },

    remainingAsc: {
      column:
        'remaining_payment',
      ascending: true
    }
  }

  const selectedSort =
    sortSettings[sortOption] ||
    sortSettings.nameAsc

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
      'teacher_name',
      {
        ascending: true
      }
    )
    .range(
      from,
      to
    )

  const {
    data,
    error,
    count
  } = await query

  if (error) {
    console.error(
      'Öğretmen hakediş raporu sorgu hatası:',
      error
    )

    throw new Error(
      `Öğretmen hakediş raporu alınamadı: ${error.message}`
    )
  }

  return {
    data:
      (data || []).map(
        mapTeacherEarningsReportRow
      ),

    total:
      Number(count || 0),

    page:
      safePage,

    pageSize:
      safePageSize
  }
}

export async function getTeacherEarningReportDetails(
  teacherId
) {
  const cleanedTeacherId =
    String(
      teacherId || ''
    ).trim()

  if (!cleanedTeacherId) {
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
      cleanedTeacherId
    )
    .order(
      'created_at',
      {
        ascending: false,
        nullsFirst: false
      }
    )
    .order(
      'start_time',
      {
        ascending: false,
        nullsFirst: false
      }
    )

  if (error) {
    console.error(
      'Öğretmen hakediş detay sorgu hatası:',
      error
    )

    throw new Error(
      `Öğretmen hakediş detayları alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    mapTeacherEarningReportDetailRow
  )
}

export async function getAllTeacherEarningsReportRows(
  filters = {}
) {
  const allTeachers = []

  let currentPage = 1
  let total = 0

  do {
    const result =
      await getTeacherEarningsReportPage({
        ...filters,
        page: currentPage,
        pageSize: 50,
        sortOption: 'nameAsc'
      })

    if (
      currentPage === 1
    ) {
      total =
        Number(
          result.total || 0
        )
    }

    allTeachers.push(
      ...(result.data || [])
    )

    currentPage += 1
  } while (
    allTeachers.length <
    total
  )

  if (
    allTeachers.length === 0
  ) {
    return []
  }

  const teachersWithDetails = []

  for (
    const teacher of
      allTeachers
  ) {
    const details =
      await getTeacherEarningReportDetails(
        teacher.teacherId
      )

    teachersWithDetails.push({
      ...teacher,
      details
    })
  }

  return teachersWithDetails
}

/*
 * =========================================================
 * ÖĞRETMEN ÖDEMELERİ RAPORU
 * =========================================================
 */

function mapTeacherPaymentReportRow(
  row
) {
  return {
    paymentId:
      row.id || '',

    teacherId:
      row.teacher_id || '',

    teacherName:
      row.teacher_name || '',

    amount:
      Number(
        row.amount || 0
      ),

    paymentDate:
      row.payment_date || '',

    paymentMethod:
      row.payment_method || '',

    referenceNumber:
      row.reference_number || '',

    note:
      row.note || '',

    status:
      row.status || 'Aktif',

    cancelledAt:
      row.cancelled_at || '',

    createdAt:
      row.created_at || '',

    updatedAt:
      row.updated_at || ''
  }
}

function applyTeacherPaymentReportFilters(
  query,
  {
    searchText = '',
    paymentMethod = '',
    startDate = '',
    endDate = ''
  } = {}
) {
  const cleanedSearchText =
    cleanSearchValue(
      searchText
    )

  if (cleanedSearchText) {
    const searchPattern =
      `%${cleanedSearchText}%`

    query = query.or(
      [
        `teacher_name.ilike.${searchPattern}`,
        `reference_number.ilike.${searchPattern}`,
        `note.ilike.${searchPattern}`
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

  return query
}

export async function getTeacherPaymentsReportPage({
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
    .from(
      'teacher_payment_history_view'
    )
    .select(
      '*',
      {
        count: 'exact'
      }
    )

  query =
    applyTeacherPaymentReportFilters(
      query,
      {
        searchText,
        paymentMethod,
        startDate,
        endDate
      }
    )

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

    teacherAsc: {
      column: 'teacher_name',
      ascending: true
    },

    teacherDesc: {
      column: 'teacher_name',
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
    .range(
      from,
      to
    )

  const {
    data,
    error,
    count
  } = await query

  if (error) {
    console.error(
      'Öğretmen ödemeleri raporu sorgu hatası:',
      error
    )

    throw new Error(
      `Öğretmen ödemeleri raporu alınamadı: ${error.message}`
    )
  }

  return {
    data:
      (data || []).map(
        mapTeacherPaymentReportRow
      ),

    total:
      Number(count || 0),

    page:
      safePage,

    pageSize:
      safePageSize
  }
}

export async function getAllTeacherPaymentsReportRows(
  filters = {}
) {
  const allRows = []

  let currentPage = 1
  let total = 0

  do {
    const result =
      await getTeacherPaymentsReportPage({
        ...filters,
        page: currentPage,
        pageSize: 50,
        sortOption: 'newest'
      })

    if (
      currentPage === 1
    ) {
      total =
        Number(
          result.total || 0
        )
    }

    allRows.push(
      ...(result.data || [])
    )

    currentPage += 1
  } while (
    allRows.length <
    total
  )

  return allRows
}

/*
 * =========================================================
 * PERSONEL ÖDEMELERİ RAPORU
 * =========================================================
 */

function mapStaffPaymentReportRow(
  row
) {
  return {
    paymentId:
      row.id || '',

    staffName:
      row.staff_name || '',

    roleTitle:
      row.role_title || '',

    paymentType:
      row.payment_type || '',

    paymentPeriod:
      row.payment_period || '',

    amount:
      Number(
        row.amount || 0
      ),

    paymentDate:
      row.payment_date || '',

    paymentMethod:
      row.payment_method || '',

    referenceNumber:
      row.reference_number || '',

    note:
      row.note || '',

    status:
      row.status || 'Aktif',

    cancelledAt:
      row.cancelled_at || '',

    createdAt:
      row.created_at || '',

    updatedAt:
      row.updated_at || ''
  }
}

function applyStaffPaymentReportFilters(
  query,
  {
    searchText = '',
    paymentType = '',
    paymentMethod = '',
    startDate = '',
    endDate = ''
  } = {}
) {
  const cleanedSearchText =
    cleanSearchValue(
      searchText
    )

  if (cleanedSearchText) {
    const searchPattern =
      `%${cleanedSearchText}%`

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

  return query
}

export async function getStaffPaymentsReportPage({
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
    .from(
      'staff_payments'
    )
    .select(
      '*',
      {
        count: 'exact'
      }
    )
    .eq(
      'status',
      'Aktif'
    )

  query =
    applyStaffPaymentReportFilters(
      query,
      {
        searchText,
        paymentType,
        paymentMethod,
        startDate,
        endDate
      }
    )

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
    .range(
      from,
      to
    )

  const {
    data,
    error,
    count
  } = await query

  if (error) {
    console.error(
      'Personel ödemeleri raporu sorgu hatası:',
      error
    )

    throw new Error(
      `Personel ödemeleri raporu alınamadı: ${error.message}`
    )
  }

  return {
    data:
      (data || []).map(
        mapStaffPaymentReportRow
      ),

    total:
      Number(count || 0),

    page:
      safePage,

    pageSize:
      safePageSize
  }
}

export async function getAllStaffPaymentsReportRows(
  filters = {}
) {
  let query = supabase
    .from(
      'staff_payments'
    )
    .select('*')
    .eq(
      'status',
      'Aktif'
    )

  query =
    applyStaffPaymentReportFilters(
      query,
      filters
    )

  const {
    data,
    error
  } = await query
    .order(
      'payment_date',
      {
        ascending: false,
        nullsFirst: false
      }
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    )

  if (error) {
    console.error(
      'Personel ödemeleri dışa aktarma sorgu hatası:',
      error
    )

    throw new Error(
      `Personel ödemeleri raporu alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    mapStaffPaymentReportRow
  )
}

/*
 * =========================================================
 * GELİR - GİDER RAPORU
 * =========================================================
 */

function mapFinanceIncomeExpenseReportRow(
  row
) {
  return {
    recordId:
      row.record_id || '',

    direction:
      row.direction || '',

    directionLabel:
      row.direction === 'income'
        ? 'Gelir'
        : 'Gider',

    sourceType:
      row.source_type || '',

    sourceLabel:
      row.source_label || '',

    title:
      row.title || '',

    category:
      row.category || '',

    description:
      row.description || '',

    amount:
      Number(
        row.amount || 0
      ),

    transactionDate:
      row.transaction_date || '',

    paymentMethod:
      row.payment_method || '',

    relatedParty:
      row.related_party || '',

    documentNumber:
      row.document_number || '',

    note:
      row.note || '',

    createdAt:
      row.created_at || ''
  }
}

function applyFinanceIncomeExpenseReportFilters(
  query,
  {
    searchText = '',
    direction = 'all',
    sourceType = '',
    paymentMethod = '',
    startDate = '',
    endDate = ''
  } = {}
) {
  const cleanedSearchText =
    cleanSearchValue(
      searchText
    )

  if (cleanedSearchText) {
    const searchPattern =
      `%${cleanedSearchText}%`

    query = query.or(
      [
        `source_label.ilike.${searchPattern}`,
        `title.ilike.${searchPattern}`,
        `category.ilike.${searchPattern}`,
        `description.ilike.${searchPattern}`,
        `related_party.ilike.${searchPattern}`,
        `payment_method.ilike.${searchPattern}`,
        `document_number.ilike.${searchPattern}`,
        `note.ilike.${searchPattern}`
      ].join(',')
    )
  }

  if (
    direction === 'income' ||
    direction === 'expense'
  ) {
    query = query.eq(
      'direction',
      direction
    )
  }

  if (sourceType) {
    query = query.eq(
      'source_type',
      sourceType
    )
  }

  if (paymentMethod) {
    query = query.ilike(
      'payment_method',
      `%${paymentMethod}%`
    )
  }

  if (startDate) {
    query = query.gte(
      'transaction_date',
      startDate
    )
  }

  if (endDate) {
    query = query.lte(
      'transaction_date',
      endDate
    )
  }

  return query
}

export async function getFinanceIncomeExpenseReportPage({
  page = 1,
  pageSize = 10,
  searchText = '',
  direction = 'all',
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
    .from(
      'finance_income_expense_report_view'
    )
    .select(
      '*',
      {
        count: 'exact'
      }
    )

  query =
    applyFinanceIncomeExpenseReportFilters(
      query,
      {
        searchText,
        direction,
        sourceType,
        paymentMethod,
        startDate,
        endDate
      }
    )

  const sortSettings = {
    newest: {
      column:
        'transaction_date',
      ascending:
        false
    },

    oldest: {
      column:
        'transaction_date',
      ascending:
        true
    },

    amountDesc: {
      column:
        'amount',
      ascending:
        false
    },

    amountAsc: {
      column:
        'amount',
      ascending:
        true
    },

    titleAsc: {
      column:
        'title',
      ascending:
        true
    },

    titleDesc: {
      column:
        'title',
      ascending:
        false
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

        nullsFirst:
          false
      }
    )
    .order(
      'created_at',
      {
        ascending:
          false,

        nullsFirst:
          false
      }
    )
    .range(
      from,
      to
    )

  const {
    data,
    error,
    count
  } = await query

  if (error) {
    console.error(
      'Gelir-gider raporu sorgu hatası:',
      error
    )

    throw new Error(
      `Gelir-gider raporu alınamadı: ${error.message}`
    )
  }

  return {
    data:
      (data || []).map(
        mapFinanceIncomeExpenseReportRow
      ),

    total:
      Number(
        count || 0
      ),

    page:
      safePage,

    pageSize:
      safePageSize
  }
}

export async function getAllFinanceIncomeExpenseReportRows(
  filters = {}
) {
  const allRows = []

  let currentPage = 1
  let total = 0

  do {
    const result =
      await getFinanceIncomeExpenseReportPage({
        ...filters,

        page:
          currentPage,

        pageSize:
          50,

        sortOption:
          filters.sortOption ||
          'newest'
      })

    if (
      currentPage === 1
    ) {
      total =
        Number(
          result.total || 0
        )
    }

    allRows.push(
      ...(result.data || [])
    )

    currentPage += 1
  } while (
    allRows.length <
    total
  )

  return allRows
}

export async function getFinanceIncomeExpenseReportSummary(
  filters = {}
) {
  const rows =
    await getAllFinanceIncomeExpenseReportRows(
      filters
    )

  const totalIncome =
    rows.reduce(
      (
        total,
        row
      ) =>
        row.direction ===
        'income'
          ? total +
            Number(
              row.amount || 0
            )
          : total,
      0
    )

  const totalExpense =
    rows.reduce(
      (
        total,
        row
      ) =>
        row.direction ===
        'expense'
          ? total +
            Number(
              row.amount || 0
            )
          : total,
      0
    )

  return {
    totalIncome,

    totalExpense,

    netBalance:
      totalIncome -
      totalExpense,

    recordCount:
      rows.length
  }
}

