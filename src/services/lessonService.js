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
  group_id,
  lesson_type,
  group_name,
  capacity,
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
  const lessonType =
    row.lesson_type === 'group'
      ? 'group'
      : 'individual'

  return {
    ...mapCommonLesson(row),

    groupId:
      row.group_id || '',

    lessonType,

    isGroupLesson:
      lessonType === 'group',

    groupName:
      row.group_name || '',

    capacity:
      row.capacity === null ||
      row.capacity === undefined
        ? null
        : Number(row.capacity),

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


/*
 * Dashboard ana ekranda bütün aktif ders planlarını yüklemez.
 * Bu sorgu yalnız bugünün tablo satırlarını ilişkili adlarla getirir.
 * Çakışma ve bekleyen telafi sayıları dashboardService içindeki
 * getDashboardLessonHealth() ile veritabanında hesaplanır.
 */
export async function getDashboardLessonPlanSnapshot({
  currentDayName = ''
} = {}) {
  const cleanDayName = String(
    currentDayName || ''
  ).trim()

  if (!cleanDayName) {
    return {
      todayLessons: []
    }
  }

  const {
    data,
    error
  } = await supabase
    .from('lesson_plans')
    .select(lessonPlanSelect)
    .eq('is_active', true)
    .eq('day', cleanDayName)
    .order('start_time')

  if (error) {
    throw new Error(
      `Bugünkü ders programı alınamadı: ${error.message}`
    )
  }

  return {
    todayLessons: (data || []).map(
      mapLessonPlanFromDb
    )
  }
}

export async function getLessonPlanStudents() {
  const {
    data,
    error
  } = await supabase
    .from('lesson_plan_students')
    .select(`
      id,
      lesson_plan_id,
      student_id,
      student_package_id,
      joined_at,
      is_active,
      created_at,
      updated_at
    `)
    .eq('is_active', true)
    .order('created_at')

  if (error) {
    throw new Error(
      `Ders öğrencileri alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    (row) => ({
      id: row.id,
      lessonPlanId:
        row.lesson_plan_id || '',
      studentId:
        row.student_id || '',
      studentPackageId:
        row.student_package_id || '',
      joinedAt:
        row.joined_at || null,
      isActive:
        row.is_active !== false,
      createdAt:
        row.created_at || null,
      updatedAt:
        row.updated_at || null
    })
  )
}

function formatLocalDateKey(date) {
  const year = date.getFullYear()
  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0')
  const day = String(
    date.getDate()
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getCurrentWeekRange() {
  const today = new Date()
  const monday = new Date(today)
  const dayOfWeek =
    monday.getDay() || 7

  monday.setHours(12, 0, 0, 0)
  monday.setDate(
    monday.getDate() -
      dayOfWeek +
      1
  )

  const sunday = new Date(monday)
  sunday.setDate(
    monday.getDate() + 6
  )

  return {
    startDate:
      formatLocalDateKey(monday),
    endDate:
      formatLocalDateKey(sunday)
  }
}

export async function getLessonOccurrences() {
  const {
    startDate,
    endDate
  } = getCurrentWeekRange()

  /*
   * Haftalık Ders Durumu ekranı yalnız seçili (şimdilik mevcut)
   * haftanın occurrence kayıtlarına ihtiyaç duyar. Geçmiş kayıtlar
   * aşağıdaki getLessonHistoryPage() ile zaten server-side
   * sayfalanır; burada tüm geçmişi tarayıcıya indirmeyiz.
   */
  const [
    weekResult,
    legacyMakeupResult
  ] = await Promise.all([
    supabase
      .from('lesson_occurrences')
      .select(lessonOccurrenceListSelect)
      .eq('is_active', true)
      .gte('lesson_date', startDate)
      .lte('lesson_date', endDate)
      .order('day')
      .order('start_time')
      .order('created_at'),

    /*
     * Tarihi olmayan eski telafi/test kayıtlarının geçiş sürecinde
     * görünmeye devam etmesi için küçük ve kontrollü bir üst sınır.
     */
    supabase
      .from('lesson_occurrences')
      .select(lessonOccurrenceListSelect)
      .eq('is_active', true)
      .eq('is_makeup', true)
      .is('lesson_date', null)
      .order('created_at', {
        ascending: false
      })
      .limit(100)
  ])

  if (weekResult.error) {
    throw new Error(
      `Bu haftanın ders durumları alınamadı: ${weekResult.error.message}`
    )
  }

  if (legacyMakeupResult.error) {
    throw new Error(
      `Eski telafi kayıtları alınamadı: ${legacyMakeupResult.error.message}`
    )
  }

  const rowsById = new Map()

  ;[
    ...(weekResult.data || []),
    ...(legacyMakeupResult.data || [])
  ].forEach((row) => {
    if (row?.id) {
      rowsById.set(
        String(row.id),
        row
      )
    }
  })

  return Array.from(
    rowsById.values()
  ).map(
    mapLessonOccurrenceFromDb
  )
}


export async function getLessonHistoryPage({
  page = 1,
  pageSize = 10,
  teacherId = '',
  studentId = '',
  status = 'all',
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

  const historyStatuses = [
    'Yapıldı',
    'Telafi yapıldı',
    'İptal edildi'
  ]

  let query = supabase
    .from('lesson_occurrences')
    .select(
      lessonOccurrenceSelect,
      {
        count: 'exact'
      }
    )
    .in(
      'status',
      historyStatuses
    )

  if (teacherId) {
    query = query.eq(
      'teacher_id',
      teacherId
    )
  }

  if (studentId) {
    query = query.eq(
      'student_id',
      studentId
    )
  }

  if (
    status &&
    status !== 'all'
  ) {
    if (
      !historyStatuses.includes(
        status
      )
    ) {
      return {
        data: [],
        total: 0,
        page: safePage,
        pageSize: safePageSize
      }
    }

    query = query.eq(
      'status',
      status
    )
  }

  if (startDate) {
    query = query.gte(
      'lesson_date',
      startDate
    )
  }

  if (endDate) {
    query = query.lte(
      'lesson_date',
      endDate
    )
  }

  const ascending =
    sortOption === 'oldest'

  query = query
    .order(
      'lesson_date',
      {
        ascending,
        nullsFirst: false
      }
    )
    .order(
      'created_at',
      {
        ascending
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
      `Ders geçmişi alınamadı: ${error.message}`
    )
  }

  return {
    data: (data || []).map(
      mapLessonOccurrenceFromDb
    ),
    total: Number(count || 0),
    page: safePage,
    pageSize: safePageSize
  }
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

function normalizeGroupParticipants(
  participants
) {
  if (!Array.isArray(participants)) {
    return []
  }

  const uniqueParticipants = new Map()

  participants.forEach((participant) => {
    const studentId = String(
      participant?.studentId || ''
    ).trim()

    const packageId = String(
      participant?.packageId || ''
    ).trim()

    const studentPackageId = String(
      participant?.studentPackageId || ''
    ).trim()

    if (
      !studentId ||
      !packageId ||
      !studentPackageId
    ) {
      return
    }

    uniqueParticipants.set(
      studentId,
      {
        studentId,
        packageId,
        studentPackageId
      }
    )
  })

  return Array.from(
    uniqueParticipants.values()
  )
}

export async function createGroupLessonPlan(
  form
) {
  const teacherId = String(
    form?.teacherId || ''
  ).trim()

  const day = String(
    form?.day || ''
  ).trim()

  const time = normalizeTime(
    form?.time
  )

  const groupName = String(
    form?.groupName || ''
  ).trim()

  const durationMinutes =
    parseDurationMinutes(
      form?.duration ||
      form?.durationMinutes
    )

  const participants =
    normalizeGroupParticipants(
      form?.participants
    )

  const requestedCapacity = Number(
    form?.capacity
  )

  const capacity =
    Number.isInteger(
      requestedCapacity
    ) &&
    requestedCapacity > 0
      ? requestedCapacity
      : participants.length

  if (!groupName) {
    throw new Error(
      'Grup adı girilmelidir.'
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

  if (participants.length < 2) {
    throw new Error(
      'Grup dersine en az iki öğrenci eklenmelidir.'
    )
  }

  if (
    capacity <
    participants.length
  ) {
    throw new Error(
      'Kontenjan, seçilen öğrenci sayısından az olamaz.'
    )
  }

  const primaryParticipant =
    participants[0]

  /*
   * Mevcut bireysel ders yapısının ve eski ekranların
   * bozulmaması için grup dersinin ilk öğrencisi,
   * lesson_plans tablosundaki eski student_id ve
   * package_id alanlarında da tutulur.
   *
   * Grubun gerçek ve eksiksiz katılımcı listesi
   * lesson_plan_students tablosundadır.
   */
  const lessonPlanRow = {
    student_id:
      primaryParticipant.studentId,

    package_id:
      primaryParticipant.packageId,

    teacher_id:
      teacherId,

    day,

    start_time:
      `${time}:00`,

    duration_minutes:
      durationMinutes,

    status:
      String(
        form?.status ||
        'Planlandı'
      ).trim(),

    note:
      String(
        form?.note || ''
      ).trim() || null,

    is_makeup:
      false,

    related_lesson_id:
      null,

    is_active:
      true,

    group_id:
      String(
        form?.groupId || ''
      ).trim() || null,

    lesson_type:
      'group',

    group_name:
      groupName,

    capacity
  }

  const {
    data: createdPlan,
    error: lessonPlanError
  } = await supabase
    .from('lesson_plans')
    .insert(lessonPlanRow)
    .select(`
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
      group_id,
      lesson_type,
      group_name,
      capacity,
      created_at,
      updated_at
    `)
    .single()

  if (lessonPlanError) {
    if (
      lessonPlanError.code ===
        '23505' ||
      String(
        lessonPlanError.message || ''
      )
        .toLocaleLowerCase('tr-TR')
        .includes('duplicate')
    ) {
      throw new Error(
        'Seçilen gün ve saatte öğretmen veya öğrencilerden biri için başka bir aktif ders bulunmaktadır.'
      )
    }

    throw new Error(
      `Grup dersi kaydedilemedi: ${lessonPlanError.message}`
    )
  }

  const participantRows =
    participants.map(
      (participant) => ({
        lesson_plan_id:
          createdPlan.id,

        student_id:
          participant.studentId,

        student_package_id:
          participant.studentPackageId,

        is_active:
          true
      })
    )

  const {
    data: createdParticipants,
    error: participantsError
  } = await supabase
    .from('lesson_plan_students')
    .insert(participantRows)
    .select(`
      id,
      lesson_plan_id,
      student_id,
      student_package_id,
      joined_at,
      is_active,
      created_at,
      updated_at
    `)

  if (participantsError) {
    /*
     * Katılımcılar kaydedilemezse yarım bir grup dersi
     * bırakmamak için yeni oluşturulan plan geri silinir.
     */
    await supabase
      .from('lesson_plans')
      .delete()
      .eq(
        'id',
        createdPlan.id
      )

    throw new Error(
      `Grup öğrencileri kaydedilemedi: ${participantsError.message}`
    )
  }

  notifyLessonOccurrencesStale()

  return {
    id:
      createdPlan.id,

    teacherId:
      createdPlan.teacher_id || '',

    day:
      createdPlan.day || '',

    time:
      normalizeTime(
        createdPlan.start_time
      ),

    duration:
      `${Number(
        createdPlan.duration_minutes ||
        60
      )} dk`,

    durationMinutes:
      Number(
        createdPlan.duration_minutes ||
        60
      ),

    status:
      createdPlan.status ||
      'Planlandı',

    note:
      createdPlan.note || '',

    isMakeup:
      false,

    isActive:
      createdPlan.is_active !==
      false,

    groupId:
      createdPlan.group_id || '',

    lessonType:
      'group',

    isGroupLesson:
      true,

    groupName:
      createdPlan.group_name ||
      groupName,

    capacity:
      Number(
        createdPlan.capacity ||
        capacity
      ),

    studentId:
      primaryParticipant.studentId,

    packageId:
      primaryParticipant.packageId,

    participants:
      (createdParticipants || []).map(
        (participant) => ({
          id:
            participant.id,

          lessonPlanId:
            participant.lesson_plan_id,

          studentId:
            participant.student_id,

          studentPackageId:
            participant.student_package_id,

          joinedAt:
            participant.joined_at ||
            null,

          isActive:
            participant.is_active !==
            false,

          createdAt:
            participant.created_at ||
            null,

          updatedAt:
            participant.updated_at ||
            null
        })
      ),

    studentIds:
      participants.map(
        (participant) =>
          participant.studentId
      ),

    studentCount:
      participants.length,

    createdAt:
      createdPlan.created_at,

    updatedAt:
      createdPlan.updated_at
  }
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