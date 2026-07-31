import { supabase } from '../lib/supabase'

const lessonGroupSelect = `
  id,
  name,
  specialty_id,
  default_teacher_id,
  default_duration_minutes,
  capacity,
  is_active,
  created_at,
  updated_at,

  specialty:specialties (
    id,
    name
  ),

  default_teacher:teachers (
    id,
    full_name
  )
`

function normalizePositiveInteger(
  value,
  fallback
) {
  const numericValue = Number(value)

  if (
    Number.isInteger(numericValue) &&
    numericValue > 0
  ) {
    return numericValue
  }

  return fallback
}

function mapLessonGroupFromDb(row) {
  return {
    id: row.id,

    name:
      row.name || '',

    specialtyId:
      row.specialty_id || '',

    specialtyName:
      row.specialty?.name || '',

    defaultTeacherId:
      row.default_teacher_id || '',

    defaultTeacherName:
      row.default_teacher?.full_name || '',

    defaultDurationMinutes:
      Number(
        row.default_duration_minutes ||
        60
      ),

    capacity:
      Number(
        row.capacity || 1
      ),

    isActive:
      row.is_active !== false,

    createdAt:
      row.created_at || null,

    updatedAt:
      row.updated_at || null
  }
}

function validateLessonGroupInput(
  form
) {
  const name = String(
    form?.name || ''
  ).trim()

  const specialtyId = String(
    form?.specialtyId || ''
  ).trim()

  const defaultTeacherId = String(
    form?.defaultTeacherId || ''
  ).trim()

  const defaultDurationMinutes =
    normalizePositiveInteger(
      form?.defaultDurationMinutes,
      60
    )

  const capacity =
    normalizePositiveInteger(
      form?.capacity,
      6
    )

  if (!name) {
    throw new Error(
      'Grup adı girilmelidir.'
    )
  }

  if (!specialtyId) {
    throw new Error(
      'Grubun branşı seçilmelidir.'
    )
  }

  return {
    name,
    specialty_id:
      specialtyId,
    default_teacher_id:
      defaultTeacherId || null,
    default_duration_minutes:
      defaultDurationMinutes,
    capacity,
    is_active:
      form?.isActive !== false
  }
}

export async function getLessonGroups({
  includeInactive = false
} = {}) {
  let query = supabase
    .from('lesson_groups')
    .select(lessonGroupSelect)
    .order('name')

  if (!includeInactive) {
    query = query.eq(
      'is_active',
      true
    )
  }

  const {
    data,
    error
  } = await query

  if (error) {
    throw new Error(
      `Ders grupları alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    mapLessonGroupFromDb
  )
}

export async function createLessonGroup(
  form
) {
  const row =
    validateLessonGroupInput(
      form
    )

  const {
    data,
    error
  } = await supabase
    .from('lesson_groups')
    .insert(row)
    .select(lessonGroupSelect)
    .single()

  if (error) {
    throw new Error(
      `Ders grubu kaydedilemedi: ${error.message}`
    )
  }

  return mapLessonGroupFromDb(
    data
  )
}

export async function updateLessonGroup(
  groupId,
  form
) {
  const cleanGroupId = String(
    groupId || ''
  ).trim()

  if (!cleanGroupId) {
    throw new Error(
      'Ders grubu kimliği bulunamadı.'
    )
  }

  const row =
    validateLessonGroupInput(
      form
    )

  const {
    data,
    error
  } = await supabase
    .from('lesson_groups')
    .update({
      ...row,
      updated_at:
        new Date().toISOString()
    })
    .eq(
      'id',
      cleanGroupId
    )
    .select(lessonGroupSelect)
    .single()

  if (error) {
    throw new Error(
      `Ders grubu güncellenemedi: ${error.message}`
    )
  }

  return mapLessonGroupFromDb(
    data
  )
}

export async function setLessonGroupActive(
  groupId,
  isActive
) {
  const cleanGroupId = String(
    groupId || ''
  ).trim()

  if (!cleanGroupId) {
    throw new Error(
      'Ders grubu kimliği bulunamadı.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from('lesson_groups')
    .update({
      is_active:
        isActive === true,
      updated_at:
        new Date().toISOString()
    })
    .eq(
      'id',
      cleanGroupId
    )
    .select(lessonGroupSelect)
    .single()

  if (error) {
    throw new Error(
      `Ders grubu durumu güncellenemedi: ${error.message}`
    )
  }

  return mapLessonGroupFromDb(
    data
  )
}

function mapLessonGroupStudentFromDb(row) {
  return {
    id: row.id,

    groupId:
      row.group_id || '',

    studentId:
      row.student_id || '',

    studentPackageId:
      row.student_package_id || '',

    studentName:
      row.student?.full_name || '',

    studentTcNo:
      row.student?.tc_no || '',

    studentPhone:
      row.student?.phone || '',

    packageId:
      row.student_package?.package_id || '',

    packageName:
      row.student_package?.package?.name || '',

    specialtyName:
      row.student_package?.package?.specialty?.name || '',

    joinedAt:
      row.joined_at || null,

    leftAt:
      row.left_at || null,

    isActive:
      row.is_active !== false,

    createdAt:
      row.created_at || null,

    updatedAt:
      row.updated_at || null
  }
}

const lessonGroupStudentSelect = `
  id,
  group_id,
  student_id,
  student_package_id,
  joined_at,
  left_at,
  is_active,
  created_at,
  updated_at,

  student:students (
    id,
    full_name,
    tc_no,
    phone
  ),

  student_package:student_packages (
    id,
    package_id,

    package:packages (
      id,
      name,

      specialty:specialties (
        id,
        name
      )
    )
  )
`

export async function getLessonGroupStudents(
  groupId
) {
  const cleanGroupId = String(
    groupId || ''
  ).trim()

  if (!cleanGroupId) {
    return []
  }

  const {
    data,
    error
  } = await supabase
    .from('lesson_group_students')
    .select(lessonGroupStudentSelect)
    .eq('group_id', cleanGroupId)
    .eq('is_active', true)
    .order('joined_at')

  if (error) {
    throw new Error(
      `Grup öğrencileri alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    mapLessonGroupStudentFromDb
  )
}

export async function addStudentToLessonGroup({
  groupId,
  studentId,
  studentPackageId
}) {
  const cleanGroupId = String(
    groupId || ''
  ).trim()

  const cleanStudentId = String(
    studentId || ''
  ).trim()

  const cleanStudentPackageId = String(
    studentPackageId || ''
  ).trim()

  if (!cleanGroupId) {
    throw new Error(
      'Ders grubu seçilmelidir.'
    )
  }

  if (!cleanStudentId) {
    throw new Error(
      'Öğrenci seçilmelidir.'
    )
  }

  if (!cleanStudentPackageId) {
    throw new Error(
      'Öğrencinin paketi seçilmelidir.'
    )
  }

  const {
    data: packageRecord,
    error: packageError
  } = await supabase
    .from('student_packages')
    .select('id, student_id, is_active')
    .eq('id', cleanStudentPackageId)
    .eq('student_id', cleanStudentId)
    .single()

  if (packageError || !packageRecord) {
    throw new Error(
      'Seçilen paket bu öğrenciye ait değildir.'
    )
  }

  if (packageRecord.is_active === false) {
    throw new Error(
      'Sonlandırılmış paket gruba bağlanamaz.'
    )
  }

  const {
    data: existingRecord,
    error: existingError
  } = await supabase
    .from('lesson_group_students')
    .select('id, is_active')
    .eq('group_id', cleanGroupId)
    .eq('student_id', cleanStudentId)
    .maybeSingle()

  if (existingError) {
    throw new Error(
      `Grup üyeliği kontrol edilemedi: ${existingError.message}`
    )
  }

  let query

  if (existingRecord) {
    if (existingRecord.is_active !== false) {
      throw new Error(
        'Bu öğrenci zaten gruba kayıtlıdır.'
      )
    }

    query = supabase
      .from('lesson_group_students')
      .update({
        student_package_id:
          cleanStudentPackageId,
        joined_at:
          new Date().toISOString(),
        left_at: null,
        is_active: true,
        updated_at:
          new Date().toISOString()
      })
      .eq('id', existingRecord.id)
  } else {
    query = supabase
      .from('lesson_group_students')
      .insert({
        group_id:
          cleanGroupId,
        student_id:
          cleanStudentId,
        student_package_id:
          cleanStudentPackageId,
        is_active: true
      })
  }

  const {
    data,
    error
  } = await query
    .select(lessonGroupStudentSelect)
    .single()

  if (error) {
    throw new Error(
      `Öğrenci gruba eklenemedi: ${error.message}`
    )
  }

  return mapLessonGroupStudentFromDb(
    data
  )
}

export async function removeStudentFromLessonGroup(
  membershipId
) {
  const cleanMembershipId = String(
    membershipId || ''
  ).trim()

  if (!cleanMembershipId) {
    throw new Error(
      'Grup üyeliği bulunamadı.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from('lesson_group_students')
    .update({
      is_active: false,
      left_at:
        new Date().toISOString(),
      updated_at:
        new Date().toISOString()
    })
    .eq('id', cleanMembershipId)
    .select(lessonGroupStudentSelect)
    .single()

  if (error) {
    throw new Error(
      `Öğrenci gruptan çıkarılamadı: ${error.message}`
    )
  }

  return mapLessonGroupStudentFromDb(
    data
  )
}