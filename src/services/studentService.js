import { supabase } from '../lib/supabase'

const studentSelect = `
  id,
  tc_no,
  full_name,
  gender,
  birth_date,
  register_date,
  phone,
  email,
  address,
  mother_name,
  mother_phone,
  father_name,
  father_phone,
  notes,
  status,
  is_active,
  passive_date,
  passive_reason,
  is_archived,
  archived_at,
  archive_reason,
  retention_review_date,
  retention_status,
  is_anonymized,
  anonymized_at,
  reactivated_at,
  created_at,
  updated_at,

  student_guardians (
    id,
    student_id,
    full_name,
    relationship,
    phone,
    email,
    address,
    same_address_as_student,
    is_primary,
    notes,
    sort_order,
    is_active,
    created_at,
    updated_at
  ),

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
    ended_at,
    end_reason,
    created_at,
    updated_at,

    package:packages (
      id,
      name,
      specialty_id,
      duration_minutes,
      lesson_count,
      total_price,
      unit_price,
      teacher_share_rate,
      status,
      is_active,

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

function normalizeStatus(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
}

function isActiveStudentPackage(item) {
  return (
    item?.isActive !== false &&
    normalizeStatus(item?.status) !== 'sonlandırıldı' &&
    normalizeStatus(item?.status) !== 'pasif'
  )
}

function mapStudentPackageFromDb(row) {
  const packageRecord = row.package || null
  const teacherRecord = row.default_teacher || null
  const specialty = packageRecord?.specialty || null

  const teacherName =
    teacherRecord?.full_name || ''

  const packageName =
    packageRecord?.name || 'Tanımsız Paket'

  const instrument =
    specialty?.name || ''

  const lessonDuration =
    packageRecord?.duration_minutes || ''

  const lessonCount = Number(
    packageRecord?.lesson_count || 0
  )

  const totalLessonCount = Number(
    row.total_lesson_count ??
    packageRecord?.lesson_count ??
    0
  )

  const agreedPrice = Number(
    row.agreed_price || 0
  )

  const status =
    row.status ||
    (
      row.is_active === false
        ? 'Sonlandırıldı'
        : 'Aktif'
    )

  const isActive =
    row.is_active !== false &&
    normalizeStatus(status) !== 'sonlandırıldı' &&
    normalizeStatus(status) !== 'pasif'

  return {
    studentPackageId: row.id,
    enrollmentId: row.id,
    assignmentId: row.id,

    studentId: row.student_id,

    packageId: row.package_id,
    packageName,

    instrument,
    branch: instrument,

    lessonDuration,
    duration: lessonDuration,
    lessonCount,

    totalLessonCount,
    usedLessonCount: 0,
    remainingLessonCount:
      Math.max(totalLessonCount, 0),
    lessonRightsStatus:
      totalLessonCount > 0
        ? 'Devam Ediyor'
        : 'Ders Hakkı Bitti',

    totalPrice: Number(
      packageRecord?.total_price || 0
    ),

    packagePrice: Number(
      packageRecord?.total_price || 0
    ),

    unitPrice: Number(
      packageRecord?.unit_price || 0
    ),

    teacherShareRate:
      packageRecord?.teacher_share_rate === null ||
      packageRecord?.teacher_share_rate === undefined
        ? null
        : Number(
            packageRecord.teacher_share_rate
          ),

    teacherId: row.default_teacher_id,
    defaultTeacherId: row.default_teacher_id,

    teacherName,
    defaultTeacherName: teacherName,
    teacher: teacherName,

    agreedPrice,
    monthlyFee: agreedPrice,

    paymentPeriod:
      row.payment_period || 'Aylık',

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

    endedAt:
      row.ended_at || '',

    endReason:
      row.end_reason || '',

    packageStatus:
      packageRecord?.status || '',

    packageIsActive:
      packageRecord?.is_active !== false,

    teacherStatus:
      teacherRecord?.status || '',

    teacherIsActive:
      teacherRecord?.is_active !== false,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  }
}

function syncLegacyPackageFields(
  student,
  enrolledPackages
) {
  const activePackages =
    enrolledPackages.filter(
      isActiveStudentPackage
    )

  const firstPackage =
    activePackages[0] ||
    enrolledPackages[0] ||
    null

  return {
    ...student,

    enrolledPackages,

    packageIds:
      activePackages.map(
        (item) => item.packageId
      ),

    packageId:
      firstPackage?.packageId || '',

    packageName:
      firstPackage?.packageName || '',

    instrument:
      firstPackage?.instrument || '',

    lessonDuration:
      firstPackage?.lessonDuration || '',

    lessonCount:
      firstPackage?.lessonCount || '',

    monthlyFee:
      firstPackage?.agreedPrice || '',

    agreedPrice:
      firstPackage?.agreedPrice || '',

    teacherId:
      firstPackage?.teacherId || '',

    defaultTeacherId:
      firstPackage?.defaultTeacherId || '',

    teacherName:
      firstPackage?.teacherName || '',

    defaultTeacherName:
      firstPackage?.defaultTeacherName || '',

    teacher:
      firstPackage?.teacherName || '',

    paymentDay:
      firstPackage?.paymentDay || '',

    firstPaymentDate:
      firstPackage?.firstPaymentDate || '',

    nextPaymentDate:
      firstPackage?.nextPaymentDate || ''
  }
}


function mapStudentSummaryFromDb(row) {
  return {
    id: row.id,
    tcNo: row.tc_no || '',
    fullName: row.full_name || '',
    phone: row.phone || '',
    email: row.email || '',
    status: row.status || 'Aktif',
    isActive: row.is_active !== false,
    isArchived: row.is_archived === true,
    isAnonymized: row.is_anonymized === true,
    retentionStatus:
      row.retention_status || 'Aktif Kayıt',
    retentionReviewDate:
      row.retention_review_date || '',
    listStatus:
      row.list_status || 'active',
    instrumentsText:
      row.instrument_names || '-',
    teachersText:
      row.teacher_names || '-',
    packagesText:
      row.package_names || '-',
    totalFee: Number(
      row.total_fee || 0
    ),
    nearestPaymentDate:
      row.nearest_payment_date || '',
    packageIds:
      Array.isArray(row.package_ids)
        ? row.package_ids
        : [],
    teacherIds:
      Array.isArray(row.teacher_ids)
        ? row.teacher_ids
        : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}


function mapStudentGuardianFromDb(row) {
  return {
    id: row.id || '',
    studentId: row.student_id || '',
    fullName: row.full_name || '',
    relationship: row.relationship || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    sameAddressAsStudent:
      row.same_address_as_student === true,
    isPrimary:
      row.is_primary === true,
    notes: row.notes || '',
    sortOrder: Number(row.sort_order || 1),
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function getGuardianFormFields(row, index) {
  const prefix = `guardian${index + 1}`

  return {
    [`${prefix}Id`]: row?.id || '',
    [`${prefix}Name`]: row?.fullName || '',
    [`${prefix}Relationship`]:
      row?.relationship || '',
    [`${prefix}Phone`]: row?.phone || '',
    [`${prefix}Email`]: row?.email || '',
    [`${prefix}Address`]: row?.address || '',
    [`${prefix}SameAddress`]:
      row?.sameAddressAsStudent === true,
    [`${prefix}IsPrimary`]:
      row?.isPrimary === true,
    [`${prefix}Notes`]: row?.notes || ''
  }
}

function normalizeGuardiansFromForm(form) {
  const rows = [1, 2]
    .map((number) => {
      const prefix = `guardian${number}`
      const fullName = String(
        form[`${prefix}Name`] || ''
      ).trim()

      if (!fullName) {
        return null
      }

      const relationship = String(
        form[`${prefix}Relationship`] || ''
      ).trim()

      if (!relationship) {
        throw new Error(
          `${number}. veli için yakınlık derecesi seçilmelidir.`
        )
      }

      return {
        id: String(
          form[`${prefix}Id`] || ''
        ).trim(),
        full_name: fullName,
        relationship,
        phone:
          String(
            form[`${prefix}Phone`] || ''
          ).trim() || null,
        email:
          String(
            form[`${prefix}Email`] || ''
          ).trim() || null,
        address:
          form[`${prefix}SameAddress`] === true
            ? null
            : String(
                form[`${prefix}Address`] || ''
              ).trim() || null,
        same_address_as_student:
          form[`${prefix}SameAddress`] === true,
        is_primary:
          form[`${prefix}IsPrimary`] === true,
        notes:
          String(
            form[`${prefix}Notes`] || ''
          ).trim() || null,
        sort_order: number,
        is_active: true
      }
    })
    .filter(Boolean)

  if (
    rows.length > 0 &&
    !rows.some((row) => row.is_primary)
  ) {
    rows[0].is_primary = true
  }

  if (
    rows.filter((row) => row.is_primary).length > 1
  ) {
    throw new Error(
      'Yalnızca bir veli birincil iletişim kişisi olabilir.'
    )
  }

  return rows
}

function mapStudentFromDb(row) {
  const enrolledPackages = (
    row.student_packages || []
  )
    .map(mapStudentPackageFromDb)
    .sort((first, second) => {
      if (
        first.isActive !== second.isActive
      ) {
        return first.isActive ? -1 : 1
      }

      return String(
        second.createdAt || ''
      ).localeCompare(
        String(first.createdAt || '')
      )
    })

  const guardians = (
    row.student_guardians || []
  )
    .filter(
      (guardian) =>
        guardian.is_active !== false
    )
    .map(mapStudentGuardianFromDb)
    .sort(
      (first, second) =>
        Number(first.sortOrder || 0) -
        Number(second.sortOrder || 0)
    )

  const legacyGuardians =
    guardians.length > 0
      ? guardians
      : [
          row.mother_name
            ? {
                fullName: row.mother_name,
                relationship: 'Anne',
                phone: row.mother_phone || '',
                email: '',
                address: '',
                sameAddressAsStudent: false,
                isPrimary: true,
                notes: '',
                sortOrder: 1,
                isActive: true
              }
            : null,
          row.father_name
            ? {
                fullName: row.father_name,
                relationship: 'Baba',
                phone: row.father_phone || '',
                email: '',
                address: '',
                sameAddressAsStudent: false,
                isPrimary: !row.mother_name,
                notes: '',
                sortOrder: 2,
                isActive: true
              }
            : null
        ].filter(Boolean)

  const student = {
    id: row.id,

    tcNo:
      row.tc_no || '',

    fullName:
      row.full_name || '',

    gender:
      row.gender || '',

    birthDate:
      row.birth_date || '',

    registerDate:
      row.register_date || '',

    phone:
      row.phone || '',

    email:
      row.email || '',

    address:
      row.address || '',

    motherName:
      row.mother_name || '',

    motherPhone:
      row.mother_phone || '',

    fatherName:
      row.father_name || '',

    fatherPhone:
      row.father_phone || '',

    notes:
      row.notes || '',

    guardians:
      legacyGuardians,

    ...getGuardianFormFields(
      legacyGuardians[0],
      0
    ),

    ...getGuardianFormFields(
      legacyGuardians[1],
      1
    ),

    status:
      row.status || 'Aktif',

    isActive:
      row.is_active !== false,

    passiveDate:
      row.passive_date || '',

    passiveReason:
      row.passive_reason || '',

    isArchived:
      row.is_archived === true,

    archivedAt:
      row.archived_at || '',

    archiveReason:
      row.archive_reason || '',

    retentionReviewDate:
      row.retention_review_date || '',

    retentionStatus:
      row.retention_status || 'Aktif Kayıt',

    isAnonymized:
      row.is_anonymized === true,

    anonymizedAt:
      row.anonymized_at || '',

    reactivatedAt:
      row.reactivated_at || '',

    lessonPlans: [],

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  }

  return syncLegacyPackageFields(
    student,
    enrolledPackages
  )
}


function getLessonUsageKey(
  studentId,
  packageId
) {
  return `${String(studentId)}::${String(packageId)}`
}

async function addLessonUsageToStudents(
  students
) {
  const studentList =
    Array.isArray(students)
      ? students
      : []

  if (studentList.length === 0) {
    return studentList
  }

  const studentIds = [
    ...new Set(
      studentList
        .map((student) => student.id)
        .filter(Boolean)
    )
  ]

  const { data, error } = await supabase
    .from('lesson_occurrences')
    .select('student_id, package_id')
    .in('student_id', studentIds)
    .eq('is_active', true)
    .in('status', ['Yapıldı', 'Telafi yapıldı'])

  if (error) {
    throw new Error(
      getStudentErrorMessage(
        error,
        'Öğrenci ders hakları şu anda hesaplanamadı.'
      )
    )
  }

  const usageByStudentPackage = new Map()

  for (const occurrence of data || []) {
    const key = getLessonUsageKey(
      occurrence.student_id,
      occurrence.package_id
    )

    usageByStudentPackage.set(
      key,
      (usageByStudentPackage.get(key) || 0) + 1
    )
  }

  return studentList.map((student) => {
    const enrolledPackages = (student.enrolledPackages || []).map((studentPackage) => {
      const key = getLessonUsageKey(
        student.id,
        studentPackage.packageId
      )

      const usedLessonCount =
        usageByStudentPackage.get(key) || 0

      const totalLessonCount = Number(
        studentPackage.totalLessonCount || 0
      )

      const remainingLessonCount = Math.max(
        totalLessonCount - usedLessonCount,
        0
      )

      let lessonRightsStatus = 'Devam Ediyor'

      if (remainingLessonCount === 0) {
        lessonRightsStatus = 'Ders Hakkı Bitti'
      } else if (remainingLessonCount === 1) {
        lessonRightsStatus = 'Bitmek Üzere'
      }

      return {
        ...studentPackage,
        usedLessonCount,
        remainingLessonCount,
        lessonRightsStatus
      }
    })

    return syncLegacyPackageFields(
      student,
      enrolledPackages
    )
  })
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

function getStudentErrorMessage(
  error,
  fallbackMessage,
  duplicateMessage = ''
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

  if (
    duplicateMessage &&
    (
      error?.code === '23505' ||
      String(
        error?.message ?? ''
      )
        .toLocaleLowerCase('tr-TR')
        .includes('duplicate')
    )
  ) {
    return duplicateMessage
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
        `${label} zorunludur.`
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

  const date = new Date(
    `${dateKey}T12:00:00`
  )

  if (
    Number.isNaN(date.getTime()) ||
    date
      .toISOString()
      .slice(0, 10) !== dateKey
  ) {
    throw new Error(
      `${label} geçerli değildir.`
    )
  }

  return dateKey
}

function normalizeStudentPackages(form) {
  if (
    Array.isArray(form.enrolledPackages) &&
    form.enrolledPackages.length > 0
  ) {
    return form.enrolledPackages
  }

  if (form.packageId) {
    return [
      {
        packageId:
          form.packageId,

        teacherId:
          form.defaultTeacherId ||
          form.teacherId,

        agreedPrice:
          form.agreedPrice ||
          form.monthlyFee,

        paymentPeriod:
          form.paymentPeriod || 'Aylık',

        paymentDay:
          form.paymentDay,

        firstPaymentDate:
          form.firstPaymentDate,

        nextPaymentDate:
          form.nextPaymentDate,

        status: 'Aktif',
        isActive: true
      }
    ]
  }

  return []
}

function normalizeStudentForm(form) {
  const tcNo = String(
    form.tcNo ?? ''
  ).trim()

  const fullName = String(
    form.fullName ?? ''
  ).trim()

  const phone = String(
    form.phone ?? ''
  ).trim()

  const registerDate =
    normalizeDateKey(
      form.registerDate,
      'Kayıt tarihi',
      {
        required: true
      }
    )

  if (!/^[0-9]{11}$/.test(tcNo)) {
    throw new Error(
      'TC Kimlik No 11 haneli olmalıdır.'
    )
  }

  if (!fullName) {
    throw new Error(
      'Ad soyad zorunludur.'
    )
  }

  if (!registerDate) {
    throw new Error(
      'Kayıt tarihi zorunludur.'
    )
  }

  if (!phone) {
    throw new Error(
      'Cep telefonu zorunludur.'
    )
  }

  const enrolledPackages =
    normalizeStudentPackages(form)

  const activePackages =
    enrolledPackages.filter(
      isActiveStudentPackage
    )

  if (activePackages.length === 0) {
    throw new Error(
      'En az bir aktif paket eklemelisiniz.'
    )
  }

  const guardianRows =
    normalizeGuardiansFromForm(form)

  const packageRows =
    activePackages.map((item) => {
      const packageId =
        item.packageId || item.id

      const teacherId =
        item.defaultTeacherId ||
        item.teacherId

      const agreedPrice = Number(
        item.agreedPrice ??
        item.monthlyFee
      )

      const firstPaymentDate =
        normalizeDateKey(
          item.firstPaymentDate,
          'İlk ödeme tarihi',
          {
            required: true
          }
        )

      const nextPaymentDate =
        normalizeDateKey(
          item.nextPaymentDate ||
            firstPaymentDate,
          'Sonraki ödeme tarihi',
          {
            required: true
          }
        )

      const paymentDay = Number(
        item.paymentDay ||
        String(firstPaymentDate).slice(8, 10)
      )

      if (!packageId) {
        throw new Error(
          'Paket kaydı bulunamadı.'
        )
      }

      if (!teacherId) {
        throw new Error(
          'Her paket için öğretmen seçilmelidir.'
        )
      }

      if (
        !Number.isFinite(agreedPrice) ||
        agreedPrice <= 0
      ) {
        throw new Error(
          'Her paket için geçerli bir ücret girilmelidir.'
        )
      }

      if (!firstPaymentDate) {
        throw new Error(
          'Her paket için ilk ödeme tarihi seçilmelidir.'
        )
      }

      if (
        nextPaymentDate <
          firstPaymentDate
      ) {
        throw new Error(
          'Sonraki ödeme tarihi ilk ödeme tarihinden önce olamaz.'
        )
      }

      if (
        !Number.isInteger(paymentDay) ||
        paymentDay < 1 ||
        paymentDay > 31
      ) {
        throw new Error(
          'Paket ödeme günü geçersiz.'
        )
      }

      return {
        package_id:
          packageId,

        default_teacher_id:
          teacherId,

        agreed_price:
          agreedPrice,

        payment_period:
          item.paymentPeriod || 'Aylık',

        payment_day:
          paymentDay,

        first_payment_date:
          firstPaymentDate,

        next_payment_date:
          nextPaymentDate,

        total_lesson_count:
          Number(
            item.totalLessonCount ??
            item.lessonCount ??
            0
          ) || null,

        status: 'Aktif',

        is_active: true,

        ended_at: null,

        end_reason: null
      }
    })

  return {
    studentRow: {
      tc_no:
        tcNo,

      full_name:
        fullName,

      gender:
        String(form.gender ?? '').trim() ||
        null,

      birth_date:
        normalizeDateKey(
          form.birthDate,
          'Doğum tarihi'
        ) || null,

      register_date:
        registerDate,

      phone,

      email:
        String(form.email ?? '').trim() ||
        null,

      address:
        String(form.address ?? '').trim() ||
        null,

      mother_name:
        String(form.motherName ?? '').trim() ||
        null,

      mother_phone:
        String(form.motherPhone ?? '').trim() ||
        null,

      father_name:
        String(form.fatherName ?? '').trim() ||
        null,

      father_phone:
        String(form.fatherPhone ?? '').trim() ||
        null,

      notes:
        String(form.notes ?? '').trim() ||
        null,

      status:
        'Aktif',

      is_active:
        true,

      passive_date:
        null,

      passive_reason:
        null,

      is_archived:
        false,

      archived_at:
        null,

      archive_reason:
        null,

      retention_review_date:
        null,

      retention_status:
        'Aktif Kayıt',

      is_anonymized:
        false,

      anonymized_at:
        null,

      reactivated_at:
        null
    },

    packageRows,
    guardianRows
  }
}


export async function getStudentsPage({
  page = 1,
  pageSize = 10,
  status = 'active',
  searchText = '',
  packageId = '',
  teacherId = '',
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
    .from('student_list_view')
    .select('*', {
      count: 'exact'
    })

  if (
    status &&
    status !== 'all'
  ) {
    query = query.eq(
      'list_status',
      status
    )
  }

  const cleanSearchText =
    cleanSearchValue(searchText)

  if (cleanSearchText) {
    const searchPattern =
      `%${cleanSearchText}%`

    query = query.or(
      [
        `full_name.ilike.${searchPattern}`,
        `tc_no.ilike.${searchPattern}`,
        `phone.ilike.${searchPattern}`,
        `email.ilike.${searchPattern}`,
        `package_names.ilike.${searchPattern}`,
        `instrument_names.ilike.${searchPattern}`,
        `teacher_names.ilike.${searchPattern}`
      ].join(',')
    )
  }

  const cleanPackageId = String(
    packageId || ''
  ).trim()

  const cleanTeacherId = String(
    teacherId || ''
  ).trim()

  if (cleanPackageId) {
    query = query.contains(
      'package_ids',
      [cleanPackageId]
    )
  }

  if (cleanTeacherId) {
    query = query.contains(
      'teacher_ids',
      [cleanTeacherId]
    )
  }

  const sortSettings = {
    newest: {
      column: 'created_at',
      ascending: false
    },
    oldest: {
      column: 'created_at',
      ascending: true
    },
    nameAsc: {
      column: 'full_name',
      ascending: true
    },
    nameDesc: {
      column: 'full_name',
      ascending: false
    },
    paymentAsc: {
      column: 'nearest_payment_date',
      ascending: true
    },
    paymentDesc: {
      column: 'nearest_payment_date',
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
      getStudentErrorMessage(
        error,
        'Öğrenci listesi şu anda alınamadı.'
      )
    )
  }

  return {
    data: (data || []).map(
      mapStudentSummaryFromDb
    ),
    total: Number(count || 0),
    page: safePage,
    pageSize: safePageSize
  }
}

export async function getStudentListCounts() {
  const statuses = [
    'active',
    'passive',
    'archived',
    'review'
  ]

  const results =
    await Promise.all(
      statuses.map(
        async (status) => {
          const {
            count,
            error
          } = await supabase
            .from('student_list_view')
            .select('id', {
              count: 'exact',
              head: true
            })
            .eq(
              'list_status',
              status
            )

          if (error) {
            throw new Error(
              getStudentErrorMessage(
                error,
                'Öğrenci durum sayıları şu anda alınamadı.'
              )
            )
          }

          return [
            status,
            Number(count || 0)
          ]
        }
      )
    )

  const counts =
    Object.fromEntries(results)

  return {
    active: counts.active || 0,
    passive: counts.passive || 0,
    archived: counts.archived || 0,
    review: counts.review || 0,
    all:
      (counts.active || 0) +
      (counts.passive || 0) +
      (counts.archived || 0) +
      (counts.review || 0)
  }
}


export async function getStudentPackageLessonUsage() {
  const { data: packageRows, error: packageError } = await supabase
    .from('student_packages')
    .select(`
      id,
      student_id,
      package_id,
      total_lesson_count,
      status,
      is_active,
      student:students (
        id,
        full_name
      ),
      package:packages (
        id,
        name
      )
    `)
    .eq('is_active', true)

  if (packageError) {
    throw new Error(
      getStudentErrorMessage(
        packageError,
        'Öğrenci paketleri şu anda alınamadı.'
      )
    )
  }

  const studentIds = [
    ...new Set(
      (packageRows || [])
        .map((row) => row.student_id)
        .filter(Boolean)
    )
  ]

  let occurrenceRows = []

  if (studentIds.length > 0) {
    const { data, error } = await supabase
      .from('lesson_occurrences')
      .select('student_id, package_id')
      .in('student_id', studentIds)
      .eq('is_active', true)
      .in('status', ['Yapıldı', 'Telafi yapıldı'])

    if (error) {
      throw new Error(
        getStudentErrorMessage(
          error,
          'Öğrenci ders hakları şu anda hesaplanamadı.'
        )
      )
    }

    occurrenceRows = data || []
  }

  const usageMap = new Map()

  for (const occurrence of occurrenceRows) {
    const key = getLessonUsageKey(
      occurrence.student_id,
      occurrence.package_id
    )

    usageMap.set(
      key,
      (usageMap.get(key) || 0) + 1
    )
  }

  return (packageRows || []).map((row) => {
    const totalLessonCount = Number(
      row.total_lesson_count || 0
    )

    const usedLessonCount = usageMap.get(
      getLessonUsageKey(
        row.student_id,
        row.package_id
      )
    ) || 0

    const remainingLessonCount = Math.max(
      totalLessonCount - usedLessonCount,
      0
    )

    let lessonRightsStatus = 'Devam Ediyor'

    if (remainingLessonCount === 0) {
      lessonRightsStatus = 'Ders Hakkı Bitti'
    } else if (remainingLessonCount === 1) {
      lessonRightsStatus = 'Bitmek Üzere'
    }

    return {
      studentPackageId: row.id,
      studentId: row.student_id,
      studentName: row.student?.full_name || '',
      packageId: row.package_id,
      packageName: row.package?.name || '',
      totalLessonCount,
      usedLessonCount,
      remainingLessonCount,
      lessonRightsStatus
    }
  })
}

export async function getStudents() {
  const { data, error } = await supabase
    .from('students')
    .select(studentSelect)
    .order('created_at', {
      ascending: false
    })

  if (error) {
    throw new Error(
      getStudentErrorMessage(
        error,
        'Öğrenciler şu anda alınamadı.'
      )
    )
  }

  const students = (data || []).map(
    mapStudentFromDb
  )

  return addLessonUsageToStudents(
    students
  )
}

export async function getStudentById(
  studentId
) {
  const cleanStudentId = String(
    studentId || ''
  ).trim()

  if (!cleanStudentId) {
    throw new Error(
      'Öğrenci kimliği bulunamadı.'
    )
  }

  const { data, error } = await supabase
    .from('students')
    .select(studentSelect)
    .eq('id', cleanStudentId)
    .single()

  if (error) {
    throw new Error(
      getStudentErrorMessage(
        error,
        'Öğrenci bilgileri şu anda alınamadı.'
      )
    )
  }

  const student = mapStudentFromDb(data)

  const enrichedStudents =
    await addLessonUsageToStudents(
      [student]
    )

  return enrichedStudents[0]
}

export async function createStudent(form) {
  const {
    studentRow,
    packageRows,
    guardianRows
  } = normalizeStudentForm(form)

  const { data, error } = await supabase
    .from('students')
    .insert(studentRow)
    .select('id')
    .single()

  if (error) {
    throw new Error(
      getStudentErrorMessage(
        error,
        'Öğrenci eklenemedi.',
        'Bu TC Kimlik No ile kayıtlı başka bir öğrenci bulunmaktadır.'
      )
    )
  }

  const studentId = data.id

  const relationRows =
    packageRows.map((row) => ({
      ...row,
      student_id: studentId
    }))

  const {
    error: packageError
  } = await supabase
    .from('student_packages')
    .insert(relationRows)

  if (packageError) {
    const {
      error: rollbackError
    } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId)

    if (rollbackError) {
      console.error(
        'Başarısız öğrenci kaydı geri alınamadı:',
        rollbackError
      )
    }

    if (packageError.code === '23505') {
      throw new Error(
        'Aynı paket öğrenciye birden fazla aktif kayıt olarak eklenemez.'
      )
    }

    throw new Error(
      getStudentErrorMessage(
        packageError,
        'Öğrenci paketleri kaydedilemedi.',
        'Aynı paket öğrenciye birden fazla aktif kayıt olarak eklenemez.'
      )
    )
  }

  if (guardianRows.length > 0) {
    const {
      error: guardianError
    } = await supabase
      .from('student_guardians')
      .insert(
        guardianRows.map((row) => {
          const {
            id,
            ...guardianRow
          } = row

          return {
            ...guardianRow,
            student_id: studentId
          }
        })
      )

    if (guardianError) {
      const {
        error: rollbackError
      } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId)

      if (rollbackError) {
        console.error(
          'Başarısız veli kaydı geri alınamadı:',
          rollbackError
        )
      }

      throw new Error(
        getStudentErrorMessage(
          guardianError,
          'Veli bilgileri kaydedilemedi.'
        )
      )
    }
  }

  return getStudentById(studentId)
}

export async function setStudentPassive(
  studentId,
  passiveReason,
  passiveDate
) {
  const cleanStudentId = String(
    studentId || ''
  ).trim()

  const cleanReason = String(
    passiveReason ?? ''
  ).trim()

  if (!cleanStudentId) {
    throw new Error(
      'Öğrenci kimliği bulunamadı.'
    )
  }

  if (!cleanReason) {
    throw new Error(
      'Pasife alma nedeni zorunludur.'
    )
  }

  const cleanPassiveDate =
    normalizeDateKey(
      passiveDate,
      'Pasife alma tarihi',
      {
        required: true
      }
    )

  const {
    data,
    error
  } = await supabase.rpc(
    'set_student_passive_safely',
    {
      p_student_id:
        cleanStudentId,
      p_passive_reason:
        cleanReason,
      p_passive_date:
        cleanPassiveDate
    }
  )

  if (error) {
    throw new Error(
      getStudentErrorMessage(
        error,
        'Öğrenci pasife alınamadı.'
      )
    )
  }

  const student =
    await getStudentById(
      cleanStudentId
    )

  return {
    ...student,
    passiveOperation:
      data?.[0] || null
  }
}

export async function reactivateStudent(
  studentId,
  reactivatedAt
) {
  const cleanStudentId = String(
    studentId || ''
  ).trim()

  if (!cleanStudentId) {
    throw new Error(
      'Öğrenci kimliği bulunamadı.'
    )
  }

  const { error } = await supabase
    .from('students')
    .update({
      is_active: true,
      status: 'Aktif',
      is_archived: false,
      archived_at: null,
      archive_reason: null,
      retention_review_date: null,
      retention_status: 'Aktif Kayıt',
      reactivated_at: reactivatedAt,
      passive_date: null,
      passive_reason: null
    })
    .eq('id', studentId)

  if (error) {
    throw new Error(
      getStudentErrorMessage(
        error,
        'Öğrenci aktifleştirilemedi.'
      )
    )
  }

  return getStudentById(studentId)
}



function normalizeStudentUpdate(form) {
  const tcNo = String(form.tcNo ?? '').trim()
  const fullName = String(form.fullName ?? '').trim()
  const phone = String(form.phone ?? '').trim()
  const registerDate =
    normalizeDateKey(
      form.registerDate,
      'Kayıt tarihi',
      {
        required: true
      }
    )

  if (!/^[0-9]{11}$/.test(tcNo)) {
    throw new Error(
      'TC Kimlik No 11 haneli olmalıdır.'
    )
  }

  if (!fullName) {
    throw new Error('Ad soyad zorunludur.')
  }

  if (!registerDate) {
    throw new Error('Kayıt tarihi zorunludur.')
  }

  if (!phone) {
    throw new Error('Cep telefonu zorunludur.')
  }

  return {
    studentRow: {
      tc_no: tcNo,
      full_name: fullName,
      gender:
        String(form.gender ?? '').trim() || null,
      birth_date:
        normalizeDateKey(
          form.birthDate,
          'Doğum tarihi'
        ) || null,
      register_date: registerDate,
      phone,
      email:
        String(form.email ?? '').trim() || null,
      address:
        String(form.address ?? '').trim() || null,
      mother_name:
        String(form.motherName ?? '').trim() || null,
      mother_phone:
        String(form.motherPhone ?? '').trim() || null,
      father_name:
        String(form.fatherName ?? '').trim() || null,
      father_phone:
        String(form.fatherPhone ?? '').trim() || null,
      notes:
        String(form.notes ?? '').trim() || null
    },
    enrolledPackages:
      normalizeStudentPackages(form),
    guardianRows:
      normalizeGuardiansFromForm(form)
  }
}

function normalizePackageUpdateRow(item) {
  const packageId = item.packageId || item.id
  const teacherId =
    item.defaultTeacherId || item.teacherId
  const agreedPrice = Number(
    item.agreedPrice ?? item.monthlyFee
  )
  const firstPaymentDate =
    normalizeDateKey(
      item.firstPaymentDate,
      'İlk ödeme tarihi',
      {
        required: true
      }
    )
  const nextPaymentDate =
    normalizeDateKey(
      item.nextPaymentDate ||
        firstPaymentDate,
      'Sonraki ödeme tarihi',
      {
        required: true
      }
    )
  const paymentDay = Number(
    item.paymentDay ||
      String(firstPaymentDate).slice(8, 10)
  )

  if (!packageId || !teacherId) {
    throw new Error(
      'Paket veya öğretmen kaydı bulunamadı.'
    )
  }

  if (
    !Number.isFinite(agreedPrice) ||
    agreedPrice <= 0
  ) {
    throw new Error(
      'Geçerli bir paket ücreti girilmelidir.'
    )
  }

  if (
    nextPaymentDate <
      firstPaymentDate
  ) {
    throw new Error(
      'Sonraki ödeme tarihi ilk ödeme tarihinden önce olamaz.'
    )
  }

  if (
    !Number.isInteger(paymentDay) ||
    paymentDay < 1 ||
    paymentDay > 31
  ) {
    throw new Error('Paket ödeme günü geçersiz.')
  }

  const active = isActiveStudentPackage(item)

  return {
    package_id: packageId,
    default_teacher_id: teacherId,
    agreed_price: agreedPrice,
    payment_period:
      item.paymentPeriod || 'Aylık',
    payment_day: paymentDay,
    first_payment_date: firstPaymentDate,
    next_payment_date: nextPaymentDate,
    total_lesson_count:
      Number(
        item.totalLessonCount ??
        item.lessonCount ??
        0
      ) || null,
    status: active ? 'Aktif' : 'Sonlandırıldı',
    is_active: active,
    ended_at:
      active ? null : item.endedAt || null,
    end_reason:
      active
        ? null
        : String(
            item.endReason || 'Belirtilmedi'
          ).trim()
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  )
}

async function syncStudentPackages(
  studentId,
  enrolledPackages
) {
  const {
    data: existingRows,
    error: readError
  } = await supabase
    .from('student_packages')
    .select('id')
    .eq('student_id', studentId)

  if (readError) {
    throw new Error(
      getStudentErrorMessage(
        readError,
        'Öğrenci paketleri şu anda alınamadı.'
      )
    )
  }

  const existingIds = new Set(
    (existingRows || []).map(
      (row) => String(row.id)
    )
  )

  for (const item of enrolledPackages) {
    const row = normalizePackageUpdateRow(item)
    const relationId =
      item.studentPackageId ||
      item.enrollmentId ||
      item.assignmentId ||
      ''

    if (
      isUuid(relationId) &&
      existingIds.has(String(relationId))
    ) {
      const { error } = await supabase
        .from('student_packages')
        .update(row)
        .eq('id', relationId)
        .eq('student_id', studentId)

      if (error) {
        throw new Error(
          getStudentErrorMessage(
          error,
          'Öğrenci paketi güncellenemedi.'
        )
        )
      }

      continue
    }

    const { error } = await supabase
      .from('student_packages')
      .insert({
        ...row,
        student_id: studentId
      })

    if (error) {
      if (error.code === '23505') {
        throw new Error(
          'Aynı paket öğrenciye birden fazla aktif kayıt olarak eklenemez.'
        )
      }

      throw new Error(
        getStudentErrorMessage(
        error,
        'Öğrenci paketi eklenemedi.',
        'Aynı paket öğrenciye birden fazla aktif kayıt olarak eklenemez.'
      )
      )
    }
  }
}


export async function extendStudentPackage(
  studentPackageId,
  lessonCountToAdd
) {
  const cleanStudentPackageId =
    String(
      studentPackageId || ''
    ).trim()

  const cleanLessonCountToAdd =
    Number(lessonCountToAdd)

  if (!cleanStudentPackageId) {
    throw new Error(
      'Öğrenci paket kaydı bulunamadı.'
    )
  }

  if (
    !Number.isInteger(
      cleanLessonCountToAdd
    ) ||
    cleanLessonCountToAdd <= 0
  ) {
    throw new Error(
      'Eklenecek ders sayısı pozitif bir tam sayı olmalıdır.'
    )
  }

  const {
    data: currentPackage,
    error: readError
  } = await supabase
    .from('student_packages')
    .select(`
      id,
      student_id,
      total_lesson_count,
      status,
      is_active
    `)
    .eq(
      'id',
      cleanStudentPackageId
    )
    .single()

  if (readError || !currentPackage) {
    throw new Error(
      getStudentErrorMessage(
        readError,
        'Öğrenci paket bilgisi alınamadı.'
      )
    )
  }

  if (
    currentPackage.is_active === false ||
    normalizeStatus(
      currentPackage.status
    ) === 'sonlandırıldı'
  ) {
    throw new Error(
      'Sonlandırılmış paket uzatılamaz.'
    )
  }

  const currentTotal =
    Number(
      currentPackage.total_lesson_count ||
      0
    )

  const newTotal =
    currentTotal +
    cleanLessonCountToAdd

  const {
    error: updateError
  } = await supabase
    .from('student_packages')
    .update({
      total_lesson_count:
        newTotal,
      updated_at:
        new Date().toISOString()
    })
    .eq(
      'id',
      cleanStudentPackageId
    )

  if (updateError) {
    throw new Error(
      getStudentErrorMessage(
        updateError,
        'Paket ders hakkı uzatılamadı.'
      )
    )
  }

  return getStudentById(
    currentPackage.student_id
  )
}


async function syncStudentGuardians(
  studentId,
  guardianRows
) {
  const cleanStudentId = String(
    studentId || ''
  ).trim()

  const {
    error: deleteError
  } = await supabase
    .from('student_guardians')
    .delete()
    .eq('student_id', cleanStudentId)

  if (deleteError) {
    throw new Error(
      getStudentErrorMessage(
        deleteError,
        'Veli bilgileri güncellenemedi.'
      )
    )
  }

  if (!guardianRows.length) {
    return
  }

  const {
    error: insertError
  } = await supabase
    .from('student_guardians')
    .insert(
      guardianRows.map((row) => {
        const {
          id,
          ...guardianRow
        } = row

        return {
          ...guardianRow,
          student_id: cleanStudentId
        }
      })
    )

  if (insertError) {
    throw new Error(
      getStudentErrorMessage(
        insertError,
        'Veli bilgileri kaydedilemedi.'
      )
    )
  }
}

export async function updateStudent(
  studentId,
  form
) {
  const cleanStudentId = String(
    studentId || ''
  ).trim()

  if (!cleanStudentId) {
    throw new Error(
      'Öğrenci kimliği bulunamadı.'
    )
  }

  const {
    studentRow,
    enrolledPackages,
    guardianRows
  } = normalizeStudentUpdate(form)

  const { error } = await supabase
    .from('students')
    .update(studentRow)
    .eq('id', cleanStudentId)

  if (error) {
    if (error.code === '23505') {
      throw new Error(
        'Bu TC Kimlik No ile kayıtlı başka bir öğrenci bulunmaktadır.'
      )
    }

    throw new Error(
      getStudentErrorMessage(
        error,
        'Öğrenci güncellenemedi.',
        'Bu TC Kimlik No ile kayıtlı başka bir öğrenci bulunmaktadır.'
      )
    )
  }

  await syncStudentPackages(
    cleanStudentId,
    enrolledPackages
  )

  await syncStudentGuardians(
    cleanStudentId,
    guardianRows
  )

  return getStudentById(
    cleanStudentId
  )
}

export async function archiveStudent(
  studentId,
  {
    archivedAt,
    archiveReason,
    retentionReviewDate
  }
) {
  const cleanStudentId = String(
    studentId || ''
  ).trim()

  if (!cleanStudentId) {
    throw new Error(
      'Öğrenci kimliği bulunamadı.'
    )
  }

  const cleanArchivedAt =
    normalizeDateKey(
      archivedAt,
      'Arşiv tarihi',
      {
        required: true
      }
    )

  const cleanRetentionReviewDate =
    normalizeDateKey(
      retentionReviewDate,
      'İnceleme tarihi',
      {
        required: true
      }
    )

  if (
    cleanRetentionReviewDate <
      cleanArchivedAt
  ) {
    throw new Error(
      'İnceleme tarihi arşiv tarihinden önce olamaz.'
    )
  }

  const { error } = await supabase
    .from('students')
    .update({
      is_active: false,
      status: 'Arşiv',
      is_archived: true,
      archived_at: cleanArchivedAt,
      archive_reason:
        String(
          archiveReason ||
          'Pasif öğrenci arşive taşındı'
        ).trim(),
      retention_review_date:
        cleanRetentionReviewDate,
      retention_status:
        'Saklama Süresi Devam Ediyor'
    })
    .eq('id', cleanStudentId)
    .eq('is_active', false)
    .eq('is_anonymized', false)

  if (error) {
    throw new Error(
      getStudentErrorMessage(
        error,
        'Öğrenci arşive taşınamadı.'
      )
    )
  }

  return getStudentById(cleanStudentId)
}

export async function extendStudentRetention(
  studentId,
  retentionReviewDate
) {
  const cleanStudentId = String(
    studentId || ''
  ).trim()

  if (!cleanStudentId) {
    throw new Error(
      'Öğrenci kimliği bulunamadı.'
    )
  }

  const cleanRetentionReviewDate =
    normalizeDateKey(
      retentionReviewDate,
      'Yeni inceleme tarihi',
      {
        required: true
      }
    )

  const { error } = await supabase
    .from('students')
    .update({
      retention_review_date:
        cleanRetentionReviewDate,
      retention_status:
        'Saklamaya Devam'
    })
    .eq('id', cleanStudentId)
    .eq('is_archived', true)
    .eq('is_anonymized', false)

  if (error) {
    throw new Error(
      getStudentErrorMessage(
        error,
        'Saklama süresi uzatılamadı.'
      )
    )
  }

  return getStudentById(cleanStudentId)
}

export async function anonymizeStudent(
  studentId,
  anonymizedAt
) {
  const cleanStudentId = String(
    studentId || ''
  ).trim()

  if (!cleanStudentId) {
    throw new Error(
      'Öğrenci kimliği bulunamadı.'
    )
  }

  const anonymousName =
    `Anonim Öğrenci #${cleanStudentId.slice(
      0,
      8
    )}`

  const anonymousTcNo =
    cleanStudentId
      .replace(/[^0-9]/g, '')
      .padEnd(11, '0')
      .slice(0, 11)

  const { error } = await supabase
    .from('students')
    .update({
      tc_no: anonymousTcNo,
      full_name: anonymousName,
      gender: null,
      birth_date: null,
      phone: null,
      email: null,
      address: null,
      mother_name: null,
      mother_phone: null,
      father_name: null,
      father_phone: null,
      notes: null,
      is_active: false,
      status: 'Arşiv',
      is_archived: true,
      is_anonymized: true,
      anonymized_at:
        anonymizedAt || null,
      retention_status:
        'Anonimleştirildi'
    })
    .eq('id', cleanStudentId)
    .eq('is_archived', true)
    .eq('is_anonymized', false)

  if (error) {
    if (error.code === '23505') {
      throw new Error(
        'Anonim öğrenci kimliği oluşturulurken benzersizlik hatası oluştu.'
      )
    }

    throw new Error(
      getStudentErrorMessage(
        error,
        'Öğrenci anonimleştirilemedi.',
        'Anonim öğrenci kimliği oluşturulurken benzersizlik hatası oluştu.'
      )
    )
  }

  return getStudentById(cleanStudentId)
}


export async function deleteStudentPermanently(
  studentId
) {
  const cleanStudentId = String(
    studentId || ''
  ).trim()

  if (!cleanStudentId) {
    throw new Error(
      'Öğrenci kimliği bulunamadı.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'delete_student_permanently_safely',
    {
      p_student_id:
        cleanStudentId
    }
  )

  if (error) {
    throw new Error(
      getStudentErrorMessage(
        error,
        'Öğrenci kalıcı olarak silinemedi.'
      )
    )
  }

  const result =
    data?.[0] || null

  if (!result) {
    throw new Error(
      'Kalıcı silme sonucu alınamadı.'
    )
  }

  if (!result.deleted) {
    const blockers = []

    const packageCount = Number(
      result.package_count || 0
    )

    const paymentCount = Number(
      result.payment_count || 0
    )

    const lessonPlanCount = Number(
      result.lesson_plan_count || 0
    )

    const occurrenceCount = Number(
      result.lesson_occurrence_count || 0
    )

    const lessonPlanStudentCount = Number(
      result.lesson_plan_student_count || 0
    )

    const lessonGroupStudentCount = Number(
      result.lesson_group_student_count || 0
    )

    if (packageCount > 0) {
      blockers.push(
        `${packageCount} paket kaydı`
      )
    }

    if (paymentCount > 0) {
      blockers.push(
        `${paymentCount} tahsilat kaydı`
      )
    }

    if (lessonPlanCount > 0) {
      blockers.push(
        `${lessonPlanCount} güncel ders kaydı`
      )
    }

    if (occurrenceCount > 0) {
      blockers.push(
        `${occurrenceCount} ders geçmişi kaydı`
      )
    }

    if (lessonPlanStudentCount > 0) {
      blockers.push(
        `${lessonPlanStudentCount} ders katılımcı bağlantısı`
      )
    }

    if (lessonGroupStudentCount > 0) {
      blockers.push(
        `${lessonGroupStudentCount} ders grubu üyeliği`
      )
    }

    throw new Error(
      `Bu öğrenci kalıcı olarak silinemez. Bağlı kayıtlar: ${
        blockers.join(', ') ||
        'bilinmeyen bağlantı'
      }. Öğrenciyi pasife alabilir, arşivleyebilir veya anonimleştirebilirsiniz.`
    )
  }

  return result
}