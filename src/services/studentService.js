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

  const registerDate = String(
    form.registerDate ?? ''
  ).trim()

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
        item.firstPaymentDate || ''

      const nextPaymentDate =
        item.nextPaymentDate ||
        firstPaymentDate

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

      if (!nextPaymentDate) {
        throw new Error(
          'Her paket için sonraki ödeme tarihi seçilmelidir.'
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
        form.birthDate || null,

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

    packageRows
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

  if (packageId) {
    query = query.contains(
      'package_ids',
      [packageId]
    )
  }

  if (teacherId) {
    query = query.contains(
      'teacher_ids',
      [teacherId]
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
      `Öğrenci listesi alınamadı: ${error.message}`
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
            throw error
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

export async function getStudents() {
  const { data, error } = await supabase
    .from('students')
    .select(studentSelect)
    .order('created_at', {
      ascending: false
    })

  if (error) {
    throw new Error(
      `Öğrenciler alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    mapStudentFromDb
  )
}

export async function getStudentById(
  studentId
) {
  if (!studentId) {
    throw new Error(
      'Öğrenci kimliği bulunamadı.'
    )
  }

  const { data, error } = await supabase
    .from('students')
    .select(studentSelect)
    .eq('id', studentId)
    .single()

  if (error) {
    throw new Error(
      `Öğrenci alınamadı: ${error.message}`
    )
  }

  return mapStudentFromDb(data)
}

export async function createStudent(form) {
  const {
    studentRow,
    packageRows
  } = normalizeStudentForm(form)

  const { data, error } = await supabase
    .from('students')
    .insert(studentRow)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error(
        'Bu TC Kimlik No ile kayıtlı başka bir öğrenci bulunmaktadır.'
      )
    }

    throw new Error(
      `Öğrenci eklenemedi: ${error.message}`
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
      `Öğrenci paketleri kaydedilemedi: ${packageError.message}`
    )
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

  if (!passiveDate) {
    throw new Error(
      'Pasife alma tarihi zorunludur.'
    )
  }

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
        passiveDate
    }
  )

  if (error) {
    throw new Error(
      `Öğrenci pasife alınamadı: ${error.message}`
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
  if (!studentId) {
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
      `Öğrenci aktifleştirilemedi: ${error.message}`
    )
  }

  return getStudentById(studentId)
}



function normalizeStudentUpdate(form) {
  const tcNo = String(form.tcNo ?? '').trim()
  const fullName = String(form.fullName ?? '').trim()
  const phone = String(form.phone ?? '').trim()
  const registerDate = String(
    form.registerDate ?? ''
  ).trim()

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
      birth_date: form.birthDate || null,
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
      normalizeStudentPackages(form)
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
    item.firstPaymentDate || ''
  const nextPaymentDate =
    item.nextPaymentDate || firstPaymentDate
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

  if (!firstPaymentDate || !nextPaymentDate) {
    throw new Error(
      'Paket ödeme tarihleri zorunludur.'
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
      `Öğrenci paketleri alınamadı: ${readError.message}`
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
          `Öğrenci paketi güncellenemedi: ${error.message}`
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
        `Öğrenci paketi eklenemedi: ${error.message}`
      )
    }
  }
}

export async function updateStudent(
  studentId,
  form
) {
  if (!studentId) {
    throw new Error('Öğrenci kimliği bulunamadı.')
  }

  const {
    studentRow,
    enrolledPackages
  } = normalizeStudentUpdate(form)

  const { error } = await supabase
    .from('students')
    .update(studentRow)
    .eq('id', studentId)

  if (error) {
    if (error.code === '23505') {
      throw new Error(
        'Bu TC Kimlik No ile kayıtlı başka bir öğrenci bulunmaktadır.'
      )
    }

    throw new Error(
      `Öğrenci güncellenemedi: ${error.message}`
    )
  }

  await syncStudentPackages(
    studentId,
    enrolledPackages
  )

  return getStudentById(studentId)
}

export async function archiveStudent(
  studentId,
  {
    archivedAt,
    archiveReason,
    retentionReviewDate
  }
) {
  if (!studentId) {
    throw new Error(
      'Öğrenci kimliği bulunamadı.'
    )
  }

  if (
    !archivedAt ||
    !retentionReviewDate
  ) {
    throw new Error(
      'Arşiv ve inceleme tarihleri zorunludur.'
    )
  }

  const { error } = await supabase
    .from('students')
    .update({
      is_active: false,
      status: 'Arşiv',
      is_archived: true,
      archived_at: archivedAt,
      archive_reason:
        String(
          archiveReason ||
          'Pasif öğrenci arşive taşındı'
        ).trim(),
      retention_review_date:
        retentionReviewDate,
      retention_status:
        'Saklama Süresi Devam Ediyor'
    })
    .eq('id', studentId)
    .eq('is_active', false)
    .eq('is_anonymized', false)

  if (error) {
    throw new Error(
      `Öğrenci arşive taşınamadı: ${error.message}`
    )
  }

  return getStudentById(studentId)
}

export async function extendStudentRetention(
  studentId,
  retentionReviewDate
) {
  if (!studentId) {
    throw new Error(
      'Öğrenci kimliği bulunamadı.'
    )
  }

  if (!retentionReviewDate) {
    throw new Error(
      'Yeni inceleme tarihi zorunludur.'
    )
  }

  const { error } = await supabase
    .from('students')
    .update({
      retention_review_date:
        retentionReviewDate,
      retention_status:
        'Saklamaya Devam'
    })
    .eq('id', studentId)
    .eq('is_archived', true)
    .eq('is_anonymized', false)

  if (error) {
    throw new Error(
      `Saklama süresi uzatılamadı: ${error.message}`
    )
  }

  return getStudentById(studentId)
}

export async function anonymizeStudent(
  studentId,
  anonymizedAt
) {
  if (!studentId) {
    throw new Error(
      'Öğrenci kimliği bulunamadı.'
    )
  }

  const anonymousName =
    `Anonim Öğrenci #${String(
      studentId
    ).slice(0, 8)}`

  const anonymousTcNo =
    String(
      studentId
    )
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
    .eq('id', studentId)
    .eq('is_archived', true)
    .eq('is_anonymized', false)

  if (error) {
    if (error.code === '23505') {
      throw new Error(
        'Anonim öğrenci kimliği oluşturulurken benzersizlik hatası oluştu.'
      )
    }

    throw new Error(
      `Öğrenci anonimleştirilemedi: ${error.message}`
    )
  }

  return getStudentById(studentId)
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
      `Öğrenci kalıcı olarak silinemedi: ${error.message}`
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

    throw new Error(
      `Bu öğrenci kalıcı olarak silinemez. Bağlı kayıtlar: ${
        blockers.join(', ') ||
        'bilinmeyen bağlantı'
      }. Öğrenciyi pasife alabilir, arşivleyebilir veya anonimleştirebilirsiniz.`
    )
  }

  return result
}