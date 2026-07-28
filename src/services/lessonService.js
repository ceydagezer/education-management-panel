import { supabase } from '../lib/supabase'

const LESSON_OCCURRENCES_STALE_EVENT =
  'arti-akademi-lesson-occurrences-stale'

function notifyLessonOccurrencesStale() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent(
      LESSON_OCCURRENCES_STALE_EVENT
    )
  )
}

const lessonPlanSelect = `
  id,
  student_id,
  package_id,
  teacher_id,
  day,
  start_time,
  duration_minutes,
  status,
  note,
  is_makeup,
  related_lesson_id,
  is_active,
  created_at,
  updated_at,

  student:students (
    id,
    full_name
  ),

  package:packages (
    id,
    name,
    duration_minutes,

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

const lessonOccurrenceListSelect = `
  id,
  lesson_plan_id,
  student_id,
  package_id,
  teacher_id,
  lesson_date,
  day,
  start_time,
  duration_minutes,
  status,
  note,
  is_makeup,
  related_occurrence_id,
  is_active,
  created_at,
  updated_at
`

const lessonOccurrenceSelect = `
  id,
  lesson_plan_id,
  student_id,
  package_id,
  teacher_id,
  lesson_date,
  day,
  start_time,
  duration_minutes,
  status,
  note,
  is_makeup,
  related_occurrence_id,
  is_active,
  created_at,
  updated_at,

  student:students (
    id,
    full_name
  ),

  package:packages (
    id,
    name,
    duration_minutes,

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

function parseDurationMinutes(value) {
  const numericValue = Number(value)

  if (
    Number.isFinite(numericValue) &&
    numericValue > 0
  ) {
    return Math.round(numericValue)
  }

  const match = String(value || '')
    .match(/\d+/)

  if (!match) {
    return 60
  }

  return Number(match[0])
}

function normalizeTime(value) {
  const time = String(value || '').trim()

  if (!time) {
    return ''
  }

  return time.slice(0, 5)
}

function mapCommonLesson(row) {
  const durationMinutes = Number(
    row.duration_minutes || 60
  )

  return {
    id: row.id,

    studentId:
      row.student_id || '',

    studentName:
      row.student?.full_name || '',

    packageId:
      row.package_id || '',

    packageName:
      row.package?.name || '',

    instrument:
      row.package?.specialty?.name || '',

    duration:
      `${durationMinutes} dk`,

    durationMinutes,

    teacherId:
      row.teacher_id || '',

    teacher:
      row.teacher?.full_name || '',

    teacherName:
      row.teacher?.full_name || '',

    day:
      row.day || '',

    time:
      normalizeTime(row.start_time),

    status:
      row.status || 'Planlandı',

    note:
      row.note || '',

    isMakeup:
      row.is_makeup === true,

    isActive:
      row.is_active !== false,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  }
}

function mapLessonPlanFromDb(row) {
  return {
    ...mapCommonLesson(row),

    relatedLessonId:
      row.related_lesson_id || null
  }
}

function mapLessonOccurrenceFromDb(row) {
  return {
    ...mapCommonLesson(row),

    lessonPlanId:
      row.lesson_plan_id || null,

    lessonDate:
      row.lesson_date || '',

    relatedLessonId:
      row.related_occurrence_id || null,

    relatedOccurrenceId:
      row.related_occurrence_id || null
  }
}

function validateLessonInput(form) {
  const studentId = String(
    form.studentId || ''
  ).trim()

  const packageId = String(
    form.packageId || ''
  ).trim()

  const teacherId = String(
    form.teacherId || ''
  ).trim()

  const day = String(
    form.day || ''
  ).trim()

  const time = normalizeTime(
    form.time
  )

  if (!studentId) {
    throw new Error(
      'Öğrenci seçilmelidir.'
    )
  }

  if (!packageId) {
    throw new Error(
      'Paket seçilmelidir.'
    )
  }

  if (!teacherId) {
    throw new Error(
      'Öğretmen seçilmelidir.'
    )
  }

  if (!day) {
    throw new Error(
      'Ders günü seçilmelidir.'
    )
  }

  if (!time) {
    throw new Error(
      'Ders saati seçilmelidir.'
    )
  }

  return {
    student_id: studentId,
    package_id: packageId,
    teacher_id: teacherId,
    day,
    start_time: `${time}:00`,
    duration_minutes:
      parseDurationMinutes(
        form.duration ||
        form.durationMinutes
      ),
    status:
      String(
        form.status || 'Planlandı'
      ).trim(),
    note:
      String(form.note || '').trim() ||
      null,
    is_makeup:
      form.isMakeup === true,
    is_active: true
  }
}

export async function getLessonPlans() {
  const { data, error } = await supabase
    .from('lesson_plans')
    .select(lessonPlanSelect)
    .eq('is_active', true)
    .order('day')
    .order('start_time')

  if (error) {
    throw new Error(
      `Ders programı alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    mapLessonPlanFromDb
  )
}

export async function getLessonOccurrences() {
  const { data, error } = await supabase
    .from('lesson_occurrences')
    .select(lessonOccurrenceListSelect)
    .eq('is_active', true)
    .order('day')
    .order('start_time')
    .order('created_at')

  if (error) {
    throw new Error(
      `Ders durum kayıtları alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    mapLessonOccurrenceFromDb
  )
}

export async function createLessonPlan(
  form
) {
  const row = {
    ...validateLessonInput(form),
    related_lesson_id:
      form.relatedLessonId || null
  }

  const {
    data,
    error
  } = await supabase
    .from('lesson_plans')
    .insert(row)
    .select(lessonPlanSelect)
    .single()

  if (error) {
    if (
      error.code === '23505' ||
      error.message
        .toLocaleLowerCase('tr-TR')
        .includes('duplicate')
    ) {
      throw new Error(
        'Seçilen gün ve saatte öğrenci veya öğretmen için başka bir aktif ders bulunmaktadır.'
      )
    }

    throw new Error(
      `Ders planı kaydedilemedi: ${error.message}`
    )
  }

  const savedLesson =
    mapLessonPlanFromDb(data)

  notifyLessonOccurrencesStale()

  return savedLesson
}

export async function createLessonOccurrence(
  form
) {
  const row = {
    ...validateLessonInput(form),
    lesson_plan_id:
      form.lessonPlanId || null,
    lesson_date:
      form.lessonDate || null,
    related_occurrence_id:
      form.relatedOccurrenceId ||
      form.relatedLessonId ||
      null
  }

  const {
    data,
    error
  } = await supabase
    .from('lesson_occurrences')
    .insert(row)
    .select(lessonOccurrenceSelect)
    .single()

  if (error) {
    throw new Error(
      `Ders durum kaydı oluşturulamadı: ${error.message}`
    )
  }

  return mapLessonOccurrenceFromDb(data)
}

export async function deleteLessonPlan(
  lessonId
) {
  const cleanLessonId = String(
    lessonId || ''
  ).trim()

  if (!cleanLessonId) {
    throw new Error(
      'Ders planı kimliği bulunamadı.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'delete_lesson_plan_safely',
    {
      p_lesson_plan_id:
        cleanLessonId
    }
  )

  if (error) {
    throw new Error(
      `Ders planı silinemedi: ${error.message}`
    )
  }

  notifyLessonOccurrencesStale()

  return data?.[0] || data || null
}

export async function deleteLessonOccurrence(
  occurrenceId
) {
  if (!occurrenceId) {
    throw new Error(
      'Ders durum kaydı kimliği bulunamadı.'
    )
  }

  const { error } = await supabase
    .from('lesson_occurrences')
    .delete()
    .eq('id', occurrenceId)

  if (error) {
    throw new Error(
      `Ders durum kaydı silinemedi: ${error.message}`
    )
  }
}

export async function updateLessonOccurrenceStatus(
  occurrenceId,
  status
) {
  if (!occurrenceId) {
    throw new Error(
      'Ders durum kaydı kimliği bulunamadı.'
    )
  }

  const cleanStatus = String(
    status || ''
  ).trim()

  if (!cleanStatus) {
    throw new Error(
      'Ders durumu bulunamadı.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from('lesson_occurrences')
    .update({
      status: cleanStatus
    })
    .eq('id', occurrenceId)
    .select(lessonOccurrenceSelect)
    .single()

  if (error) {
    throw new Error(
      `Ders durumu güncellenemedi: ${error.message}`
    )
  }

  return mapLessonOccurrenceFromDb(data)
}