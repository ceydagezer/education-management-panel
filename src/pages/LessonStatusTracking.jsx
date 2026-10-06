import { useEffect, useRef, useState } from 'react'
import {
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

import {
  createLessonOccurrence,
  deleteLessonOccurrence,
  getLessonHistoryPage,
  getAcademicYearStartDate,
  getAcademicYearUnmarkedLessonsQuery,
  getLessonCalendar,
  getLessonPlanStudents,
  UNMARKED_LESSONS_QUERY_ROOT,
  updateLessonOccurrenceStatus
} from '../services/lessonService'
import '../styles/status.css'

import StudentSearchSelect from '../components/StudentSearchSelect'

import {
  doTimeRangesOverlap,
  getCompactLessonStatusLabel,
  getLessonDurationMinutes,
  getLessonStatusBadgeClass,
  getLessonStatusClass,
  getLessonStatusLabel,
  getLessonTimeRange,
  groupLessonsByStartTime,
  isMakeupLesson,
  normalizeLessonStatus,
  timeToMinutes
} from '../utils/lessonHelpers'

import {
  areIdsEqual,
  normalizeSearchText,
  normalizeStatusText
} from '../utils/textHelpers'


import {
  confirmDialog,
  notify
} from '../lib/feedback'
const formatLocalDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0')
  const day = String(
    date.getDate()
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const getMondayDateKey = (
  value = new Date()
) => {
  const date =
    value instanceof Date
      ? new Date(value)
      : new Date(
          `${String(value).slice(
            0,
            10
          )}T12:00:00`
        )

  if (Number.isNaN(date.getTime())) {
    return formatLocalDateKey(
      new Date()
    )
  }

  const dayOfWeek =
    date.getDay() || 7

  date.setDate(
    date.getDate() -
      dayOfWeek +
      1
  )

  return formatLocalDateKey(date)
}

const addDaysToDateKey = (
  dateKey,
  dayCount
) => {
  const date = new Date(
    `${dateKey}T12:00:00`
  )

  date.setDate(
    date.getDate() +
      dayCount
  )

  return formatLocalDateKey(date)
}

const formatShortDate = (
  dateKey
) =>
  new Date(
    `${dateKey}T12:00:00`
  ).toLocaleDateString(
    'tr-TR',
    {
      day: '2-digit',
      month: '2-digit'
    }
  )

const LESSON_PLAN_STUDENTS_QUERY_KEY = [
  'lesson-plan-students',
  'active'
]

const LESSON_HISTORY_QUERY_ROOT = [
  'lesson-status',
  'history'
]

/*
 * "2026-09" -> "Eylül 2026"
 */
const formatMonthLabel = (monthKey) =>
  new Date(
    `${monthKey}-01T12:00:00`
  ).toLocaleDateString(
    'tr-TR',
    {
      month: 'long',
      year: 'numeric'
    }
  )

/*
 * "2026-09" -> { startDate: "2026-09-01", endDate: "2026-09-30" }
 */
const getMonthDateRange = (monthKey) => {
  const [year, month] = monthKey
    .split('-')
    .map(Number)

  const lastDay = new Date(
    year,
    month,
    0
  ).getDate()

  return {
    startDate: `${monthKey}-01`,
    endDate: `${monthKey}-${String(
      lastDay
    ).padStart(2, '0')}`
  }
}

/*
 * Ayın takvim hücreleri (Pazartesi ile başlayan haftalar).
 * Ayın ilk gününden önceki boş hücreler null döner.
 */
const getMonthCalendarCells = (monthKey) => {
  const { startDate, endDate } =
    getMonthDateRange(monthKey)

  const firstDayOffset =
    (new Date(`${startDate}T12:00:00`).getDay() + 6) % 7

  const dayCount = Number(endDate.slice(8, 10))

  const cells = Array.from(
    { length: firstDayOffset },
    () => null
  )

  for (let day = 1; day <= dayCount; day += 1) {
    cells.push(
      `${monthKey}-${String(day).padStart(2, '0')}`
    )
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  return cells
}

const CALENDAR_WEEKDAY_LABELS = [
  'Pzt',
  'Sal',
  'Çar',
  'Per',
  'Cum',
  'Cmt',
  'Paz'
]

/*
 * Eğitim yılı başından (1 Eylül) bu aya kadar olan aylar.
 */
const getMonthKeysBetween = (
  startMonthKey,
  endMonthKey
) => {
  const monthKeys = []
  let [year, month] = startMonthKey
    .split('-')
    .map(Number)

  while (
    `${year}-${String(month).padStart(2, '0')}` <=
    endMonthKey
  ) {
    monthKeys.push(
      `${year}-${String(month).padStart(2, '0')}`
    )

    month += 1

    if (month > 12) {
      month = 1
      year += 1
    }
  }

  return monthKeys
}

const formatLongDate = (dateKey) =>
  new Date(
    `${dateKey}T12:00:00`
  ).toLocaleDateString(
    'tr-TR',
    {
      day: '2-digit',
      month: 'long',
      weekday: 'long'
    }
  )

const getLessonHistoryQueryKey = ({
  page,
  pageSize,
  teacherId,
  studentId,
  status,
  startDate,
  endDate,
  sortOption
}) => [
  ...LESSON_HISTORY_QUERY_ROOT,
  {
    page,
    pageSize,
    teacherId,
    studentId,
    status,
    startDate,
    endDate,
    sortOption
  }
]

const getLessonHistoryErrorMessage = (
  error
) => {
  const isOffline =
    typeof navigator !== 'undefined' &&
    !navigator.onLine

  if (isOffline) {
    return 'İnternet bağlantısı bulunamadı. Ders geçmişi yüklenemedi.'
  }

  const errorMessage =
    String(
      error?.message || ''
    ).toLocaleLowerCase(
      'tr-TR'
    )

  const isNetworkError =
    errorMessage.includes(
      'failed to fetch'
    ) ||
    errorMessage.includes(
      'network'
    ) ||
    errorMessage.includes(
      'fetch'
    )

  return isNetworkError
    ? 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyiniz.'
    : 'Ders geçmişi şu anda yüklenemedi.'
}

function LessonStatusTracking({
  lessons = [],
  lessonPlans = [],
  setLessons,
  teachers = [],
  students = [],
  packages = [],
  unsavedChanges
}) {
  const queryClient = useQueryClient()

  /*
   * Aylık ders kontrolü: haftalık tablo yalnız bu haftayı gösterir.
   * Geçmiş günlerde işaretlenmeyen dersler, eğitim yılı başından
   * (1 Eylül) itibaren ay ay buradan işaretlenir ve hakedişe o
   * tarihle girer. Bölüm bir butonla açılır.
   */
  const unmarkedTodayKey =
    formatLocalDateKey(new Date())

  const academicMonthKeys =
    getMonthKeysBetween(
      getAcademicYearStartDate(
        unmarkedTodayKey
      ).slice(0, 7),
      unmarkedTodayKey.slice(0, 7)
    )

  const [showMonthlyCheck, setShowMonthlyCheck] =
    useState(false)

  const [unmarkedMonth, setUnmarkedMonth] =
    useState(() =>
      unmarkedTodayKey.slice(0, 7)
    )

  const unmarkedLessonsQueryOptions =
    getAcademicYearUnmarkedLessonsQuery(
      unmarkedTodayKey
    )

  const unmarkedLessonsQuery = useQuery(
    unmarkedLessonsQueryOptions
  )

  const allUnmarkedLessons =
    unmarkedLessonsQuery.data ?? []

  const getUnmarkedCountForMonth = (monthKey) =>
    allUnmarkedLessons.filter(
      (lesson) =>
        lesson.lessonDate.startsWith(monthKey)
    ).length

  const unmarkedMonthIndex =
    academicMonthKeys.indexOf(unmarkedMonth)

  /*
   * Takvim: seçilen ayın tüm dersleri (işaretlenmiş + işaretlenmemiş).
   */
  const [selectedCalendarKey, setSelectedCalendarKey] =
    useState('')

  const calendarQuery = useQuery({
    queryKey: [
      ...UNMARKED_LESSONS_QUERY_ROOT,
      'calendar',
      unmarkedMonth
    ],
    queryFn: () =>
      getLessonCalendar(
        getMonthDateRange(unmarkedMonth)
      ),
    enabled: showMonthlyCheck,
    staleTime: 30_000
  })

  useEffect(() => {
    if (!showMonthlyCheck) {
      return undefined
    }

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow =
        previousOverflow
    }
  }, [showMonthlyCheck])

  const days = [
    'Pazartesi',
    'Salı',
    'Çarşamba',
    'Perşembe',
    'Cuma',
    'Cumartesi',
    'Pazar'
  ]


  const statusOptions = [
    'Planlandı',
    'Yapıldı',
    'İptal edildi',
    'Telafi yapılacak',
    'Telafi yapıldı'
  ]

  const dayOrder = {
    Pazartesi: 1,
    Salı: 2,
    Çarşamba: 3,
    Perşembe: 4,
    Cuma: 5,
    Cumartesi: 6,
    Pazar: 7
  }

  const todayDateKey =
    formatLocalDateKey(
      new Date()
    )

  const currentWeekStart =
    getMondayDateKey(
      todayDateKey
    )

  const formattedToday =
    new Date(
      `${todayDateKey}T12:00:00`
    ).toLocaleDateString(
      'tr-TR',
      {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }
    )

  const emptyMakeupForm = {
    lessonType: 'individual',
    lessonPlanId: '',
    teacherId: '',
    studentId: '',
    packageId: '',
    packageName: '',
    instrument: '',
    duration: '',
    day: 'Pazartesi',
    time: '09:00',
    status: 'Telafi yapılacak',
    note: ''
  }

  const [selectedTeacher, setSelectedTeacher] =
    useState('all')

  const [selectedStudent, setSelectedStudent] =
    useState('all')

  const [studentSearch, setStudentSearch] =
    useState('')

  const [showStudentSuggestions, setShowStudentSuggestions] =
    useState(false)

  const [selectedStatus, setSelectedStatus] =
    useState('all')

  const [showMakeupForm, setShowMakeupForm] =
    useState(false)

  const [makeupForm, setMakeupForm] =
    useState(emptyMakeupForm)

  const [openMenuId, setOpenMenuId] =
    useState(null)

  const [updatingLessonId, setUpdatingLessonId] =
    useState(null)

  const [deletingLessonId, setDeletingLessonId] =
    useState(null)

  const [isSavingMakeup, setIsSavingMakeup] =
    useState(false)

  /*
   * Geçmiş tarihli ders: programda olmayan (unutulmuş, ek) ama yapılmış
   * bir ders "Yapıldı" olarak kaydedilir ve hakedişe o tarihle girer.
   */
  const emptyBackdatedForm = {
    lessonType: 'individual',
    lessonPlanId: '',
    studentId: '',
    packageId: '',
    teacherId: '',
    lessonDate: '',
    time: '',
    duration: '',
    note: ''
  }

  const [backdatedForm, setBackdatedForm] =
    useState(null)

  const [isSavingBackdated, setIsSavingBackdated] =
    useState(false)

  const [
    historyPage,
    setHistoryPage
  ] = useState(1)

  const [
    historyPageSize,
    setHistoryPageSize
  ] = useState(10)

  const [
    historyStartDate,
    setHistoryStartDate
  ] = useState('')

  const [
    historyEndDate,
    setHistoryEndDate
  ] = useState('')

  const [
    historySort,
    setHistorySort
  ] = useState('newest')

  const studentSearchRef = useRef(null)

  /*
   * Kaydedilmemiş değişiklik yoksa işlem doğrudan
   * gerçekleştirilir. Telafi formunda değişiklik varsa
   * App.jsx içindeki ortak uyarı penceresi açılır.
   */
  const runProtectedAction = (action) => {
    if (unsavedChanges?.requestAction) {
      unsavedChanges.requestAction(action)
      return
    }

    action()
  }

  const activeTeachers = teachers.filter(
    (teacher) =>
      teacher.isActive !== false &&
      normalizeStatusText(teacher.status) !== 'pasif'
  )

  const activeStudents = students.filter(
    (student) =>
      student.isActive !== false &&
      normalizeStatusText(student.status) !== 'pasif' &&
      student.isArchived !== true
  )

  const getStudentFullName = (student) =>
    student?.fullName || student?.name || ''

  const getStudentSearchValue = (student) =>
    normalizeSearchText(
      [
        getStudentFullName(student),
        student?.tcNo
      ]
        .filter(Boolean)
        .join(' ')
    )

  const normalizedStudentSearch =
    normalizeSearchText(studentSearch)

  const studentSuggestions = students
    .filter((student) => {
      if (!normalizedStudentSearch) {
        return false
      }

      return getStudentSearchValue(student).includes(
        normalizedStudentSearch
      )
    })
    .sort((firstStudent, secondStudent) =>
      getStudentFullName(firstStudent).localeCompare(
        getStudentFullName(secondStudent),
        'tr'
      )
    )
    .slice(0, 8)

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target

      if (
        !(target instanceof Element) ||
        !target.closest('.lesson-action-wrapper')
      ) {
        setOpenMenuId(null)
      }

      if (
        studentSearchRef.current &&
        !studentSearchRef.current.contains(target)
      ) {
        setShowStudentSuggestions(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenMenuId(null)
        setShowStudentSuggestions(false)

        if (
          !document.querySelector(
            '.calendar-lesson-modal'
          )
        ) {
          setShowMonthlyCheck(false)
        }
      }
    }

    const handleScroll = () => {
      setOpenMenuId(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown
      )
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [])

  /*
   * Ders Programı ekranıyla aynı query key kullanılır. Kullanıcı sayfalar
   * arasında dolaşırken grup dersi katılımcıları yeniden boş state'ten
   * yüklenmez; cache varsa anında kullanılır, stale ise arka planda yenilenir.
   */
  const lessonPlanStudentsQuery = useQuery({
    queryKey:
      LESSON_PLAN_STUDENTS_QUERY_KEY,
    queryFn:
      getLessonPlanStudents
  })

  const lessonPlanStudents =
    lessonPlanStudentsQuery.data ?? []

  const getTeacherName = (lesson) => {
    if (lesson.teacherName) {
      return lesson.teacherName
    }

    if (lesson.teacher) {
      return lesson.teacher
    }

    const teacher = teachers.find(
      (item) =>
        areIdsEqual(item.id, lesson.teacherId)
    )

    return (
      teacher?.fullName ||
      teacher?.name ||
      '-'
    )
  }

  const getTeacherId = (lesson) => {
    if (lesson.teacherId) {
      return lesson.teacherId
    }

    const teacherName =
      lesson.teacherName || lesson.teacher

    const normalizedTeacherName =
      normalizeStatusText(teacherName)

    const teacher = teachers.find(
      (item) =>
        normalizeStatusText(item.fullName) ===
          normalizedTeacherName ||
        normalizeStatusText(item.name) ===
          normalizedTeacherName
    )

    return teacher?.id || ''
  }

  const getStudentName = (lesson) => {
    if (lesson.studentName) {
      return lesson.studentName
    }

    const student = students.find(
      (item) =>
        String(item.id) ===
        String(lesson.studentId)
    )

    return (
      student?.fullName ||
      student?.name ||
      '-'
    )
  }

  const getLessonPlanRecord = (lesson) => {
    const planId =
      lesson.lessonPlanId ||
      lesson.id

    return lessonPlans.find(
      (lessonPlan) =>
        areIdsEqual(
          lessonPlan.id,
          planId
        )
    ) || null
  }

  const isGroupLessonRecord = (lesson) => {
    if (
      lesson.isGroupLesson === true ||
      lesson.lessonType === 'group'
    ) {
      return true
    }

    const lessonPlan =
      getLessonPlanRecord(lesson)

    return (
      lessonPlan?.isGroupLesson === true ||
      lessonPlan?.lessonType === 'group'
    )
  }

  const groupLessonPlans =
    lessonPlans
      .filter(
        (lessonPlan) =>
          lessonPlan.isActive !== false &&
          (
            lessonPlan.isGroupLesson === true ||
            lessonPlan.lessonType === 'group'
          )
      )
      .sort((firstPlan, secondPlan) =>
        String(
          firstPlan.groupName || ''
        ).localeCompare(
          String(secondPlan.groupName || ''),
          'tr'
        )
      )

  const getLessonPlanId = (lesson) =>
    lesson.lessonPlanId ||
    (
      isGroupLessonRecord(lesson)
        ? lesson.id
        : ''
    )

  const getGroupParticipantIds = (lesson) => {
    const lessonPlanId =
      getLessonPlanId(lesson)

    if (!lessonPlanId) {
      return []
    }

    return lessonPlanStudents
      .filter(
        (link) =>
          link.isActive !== false &&
          areIdsEqual(
            link.lessonPlanId,
            lessonPlanId
          )
      )
      .map(
        (link) => link.studentId
      )
  }

  const getGroupStudentCount = (lesson) => {
    const participantIds =
      getGroupParticipantIds(lesson)

    if (participantIds.length > 0) {
      return participantIds.length
    }

    const lessonPlan =
      getLessonPlanRecord(lesson)

    return Number(
      lesson.studentCount ||
      lessonPlan?.studentCount ||
      0
    )
  }

  const getGroupName = (lesson) => {
    const lessonPlan =
      getLessonPlanRecord(lesson)

    return (
      lesson.groupName ||
      lessonPlan?.groupName ||
      'Grup Dersi'
    )
  }

  const getLessonStudentIds = (lesson) => {
    if (isGroupLessonRecord(lesson)) {
      const participantIds =
        getGroupParticipantIds(lesson)

      if (participantIds.length > 0) {
        return participantIds
      }
    }

    return lesson.studentId
      ? [lesson.studentId]
      : []
  }

  const getLessonDisplayStudent = (lesson) => {
    if (!isGroupLessonRecord(lesson)) {
      return getStudentName(lesson)
    }

    return getGroupName(lesson)
  }

  const getLessonDisplaySummary = (lesson) => {
    if (!isGroupLessonRecord(lesson)) {
      return `${getStudentName(
        lesson
      )} • ${getLessonInstrument(
        lesson
      )}`
    }

    const studentCount =
      getGroupStudentCount(lesson)

    return `${getGroupName(
      lesson
    )} • ${
      studentCount > 0
        ? `${studentCount} öğrenci`
        : 'Grup'
    }`
  }

  const getLessonTitle = (lesson) => {
    return (
      lesson.packageName ||
      lesson.instrument ||
      lesson.lessonName ||
      'Ders'
    )
  }

  const getLessonInstrument = (lesson) => {
    if (lesson.instrument) {
      return lesson.instrument
    }

    const packageDetail = packages.find(
      (item) =>
        String(item.id) ===
        String(lesson.packageId)
    )

    return (
      packageDetail?.instrument ||
      lesson.lessonName ||
      'Ders'
    )
  }

  const getStudentPackageOptions = (
    studentId = makeupForm.studentId
  ) => {
    const student = students.find(
      (item) =>
        areIdsEqual(
          item.id,
          studentId
        )
    )

    if (!student) {
      return []
    }

    if (
      Array.isArray(student.enrolledPackages) &&
      student.enrolledPackages.length > 0
    ) {
      return student.enrolledPackages.map(
        (enrolledPackage) => {
          const packageDetail = packages.find(
            (item) =>
              areIdsEqual(
                item.id,
                enrolledPackage.packageId
              )
          )

          return {
            id:
              enrolledPackage.packageId ??
              packageDetail?.id,

            name:
              enrolledPackage.packageName ||
              packageDetail?.name ||
              '',

            instrument:
              enrolledPackage.instrument ||
              packageDetail?.instrument ||
              '',

            duration:
              enrolledPackage.lessonDuration ||
              enrolledPackage.duration ||
              packageDetail?.duration ||
              '',

            lessonCount:
              enrolledPackage.lessonCount ||
              packageDetail?.lessonCount ||
              '',

            totalPrice:
              enrolledPackage.agreedPrice ||
              enrolledPackage.monthlyFee ||
              enrolledPackage.totalPrice ||
              packageDetail?.totalPrice ||
              '',

            studentPackageId:
              enrolledPackage.studentPackageId ||
              '',

            teacherId:
              enrolledPackage.teacherId ||
              packageDetail?.teacherId ||
              ''
          }
        }
      )
    }

    if (
      Array.isArray(student.packageIds) &&
      student.packageIds.length > 0
    ) {
      return packages.filter((item) =>
        student.packageIds.some(
          (packageId) =>
            areIdsEqual(packageId, item.id)
        )
      )
    }

    if (student.packageId) {
      return packages.filter(
        (item) =>
          areIdsEqual(item.id, student.packageId)
      )
    }

    return []
  }

  const matchesCurrentFilters = (lesson) => {
    const lessonStatus =
      normalizeLessonStatus(lesson.status)

    const teacherMatch =
      selectedTeacher === 'all' ||
      areIdsEqual(
        getTeacherId(lesson),
        selectedTeacher
      )

    const lessonStudentIds =
      getLessonStudentIds(lesson)

    const lessonStudents =
      lessonStudentIds
        .map(
          (studentId) =>
            students.find(
              (student) =>
                areIdsEqual(
                  student.id,
                  studentId
                )
            )
        )
        .filter(Boolean)

    const lessonStudentSearchValue =
      normalizeSearchText(
        [
          getLessonDisplayStudent(
            lesson
          ),
          ...lessonStudents.flatMap(
            (student) => [
              student?.fullName,
              student?.name,
              student?.tcNo
            ]
          )
        ]
          .filter(Boolean)
          .join(' ')
      )

    const studentMatch =
      selectedStudent !== 'all'
        ? lessonStudentIds.some(
            (studentId) =>
              areIdsEqual(
                studentId,
                selectedStudent
              )
          )
        : !normalizedStudentSearch ||
          lessonStudentSearchValue.includes(
            normalizedStudentSearch
          )

    const statusMatch =
      selectedStatus === 'all' ||
      lessonStatus === selectedStatus

    return (
      teacherMatch &&
      studentMatch &&
      statusMatch
    )
  }

  const getLessonDateForDay = (
    day
  ) => {
    const dayIndex =
      (dayOrder[day] || 1) - 1

    return addDaysToDateKey(
      currentWeekStart,
      dayIndex
    )
  }

  const selectedWeekEnd =
    addDaysToDateKey(
      currentWeekStart,
      6
    )

  /*
   * Aynı haftalık ders planı her hafta tekrar eder.
   * Bu nedenle occurrence kaydı plan kimliği ve gerçek ders tarihiyle
   * birlikte bulunur.
   */
  const occurrenceByPlanAndDate =
    new Map(
      lessons
        .filter(
          (lesson) =>
            lesson.lessonPlanId &&
            lesson.lessonDate &&
            !isMakeupLesson(lesson)
        )
        .map(
          (lesson) => [
            `${String(
              lesson.lessonPlanId
            )}-${lesson.lessonDate}`,
            lesson
          ]
        )
    )

  const currentScheduleLessons =
    lessonPlans
      .filter(
        (lesson) =>
          lesson.isActive !== false
      )
      .map((lesson) => {
        const lessonDate =
          getLessonDateForDay(
            lesson.day
          )

        const occurrence =
          occurrenceByPlanAndDate.get(
            `${String(
              lesson.id
            )}-${lessonDate}`
          )

        return {
          ...lesson,
          occurrenceId:
            occurrence?.id || '',
          lessonPlanId:
            lesson.id,
          lessonDate,
          status:
            occurrence?.status ||
            'Planlandı',
          note:
            occurrence?.note ||
            lesson.note ||
            '',
          isMakeup:
            false
        }
      })

  /*
   * Telafi dersleri yalnızca seçilen haftanın içindeyse gösterilir.
   * Tarihsiz eski test kayıtları geçiş sürecinde görünmeye devam eder.
   */
  const pendingMakeupLessons =
    lessons.filter((lesson) => {
      const belongsToSelectedWeek =
        !lesson.lessonDate ||
        (
          lesson.lessonDate >=
            currentWeekStart &&
          lesson.lessonDate <=
            selectedWeekEnd
        )

      /*
       * Telafi dersi sonuçlandıktan sonra haftalık tablodan
       * kaldırılmaz. Böylece aynı öğrenci/öğretmen için aynı
       * tarih ve saate ikinci bir telafi eklenmesi engellenir.
       * Durum kartın rengi ve etiketiyle gösterilir.
       */
      return (
        belongsToSelectedWeek &&
        isMakeupLesson(lesson)
      )
    })

  const weeklyLessons = [
    ...currentScheduleLessons,
    ...pendingMakeupLessons
  ].filter(matchesCurrentFilters)

  const historyFilters = {
    page: historyPage,
    pageSize:
      historyPageSize,
    teacherId:
      selectedTeacher ===
      'all'
        ? ''
        : selectedTeacher,
    studentId:
      selectedStudent ===
      'all'
        ? ''
        : selectedStudent,
    status:
      selectedStatus,
    startDate:
      historyStartDate,
    endDate:
      historyEndDate,
    sortOption:
      historySort
  }

  /*
   * Geçmiş tablosunu filtre + sayfa bazında cache'le. Aynı filtreye geri
   * dönüldüğünde son gerçek tablo anında görünür. 30 saniye sonrası refetch
   * olursa eski tablo ekranda kalır; yalnız ilk kez açılan sorguda loading
   * gösterilir.
   */
  const historyQuery = useQuery({
    queryKey:
      getLessonHistoryQueryKey(
        historyFilters
      ),
    queryFn: () =>
      getLessonHistoryPage(
        historyFilters
      )
  })

  const historyRows =
    historyQuery.data?.data ?? []

  const historyTotal =
    Number(
      historyQuery.data?.total ?? 0
    )

  const historyLoading =
    historyQuery.isPending &&
    historyQuery.data === undefined

  const historyError =
    historyQuery.isError &&
    historyQuery.data === undefined
      ? getLessonHistoryErrorMessage(
          historyQuery.error
        )
      : ''

  useEffect(() => {
    if (!historyQuery.data) {
      return
    }

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          historyTotal /
            historyPageSize
        )
      )

    if (
      historyPage >
      totalPages
    ) {
      setHistoryPage(
        totalPages
      )
    }
  }, [
    historyPage,
    historyPageSize,
    historyQuery.data,
    historyTotal
  ])

  const historyTotalPages =
    Math.max(
      1,
      Math.ceil(
        historyTotal /
          historyPageSize
      )
    )

  const historyFirstRecord =
    historyTotal === 0
      ? 0
      : (
          historyPage - 1
        ) *
          historyPageSize +
        1

  const historyLastRecord =
    Math.min(
      historyPage *
        historyPageSize,
      historyTotal
    )

  const resetHistoryPage = () => {
    setHistoryPage(1)
  }

  /*
   * Haftalık tablo gün sütunlarından oluşur: her günün dersleri
   * saat sırasıyla alt alta listelenir.
   */
  const getLessonsByDay = (day) => {
    return weeklyLessons
      .filter(
        (lesson) => lesson.day === day
      )
      .sort(
        (
          firstLesson,
          secondLesson
        ) =>
          (timeToMinutes(firstLesson.time) ?? 0) -
            (timeToMinutes(secondLesson.time) ?? 0) ||
          getTeacherName(
            firstLesson
          ).localeCompare(
            getTeacherName(
              secondLesson
            ),
            'tr'
          )
      )
  }

  const getLessonActions = (lesson) => {
    const normalizedStatus =
      normalizeLessonStatus(lesson.status)

    const makeupLesson =
      isMakeupLesson(lesson)

    if (makeupLesson) {
      if (
        normalizedStatus ===
          'Telafi yapıldı' ||
        normalizedStatus ===
          'İptal edildi'
      ) {
        return ['Geri al']
      }

      return [
        'Telafi yapıldı',
        'İptal edildi'
      ]
    }

    if (
      normalizedStatus === 'Yapıldı' ||
      normalizedStatus ===
        'İptal edildi'
    ) {
      return ['Geri al']
    }

    return [
      'Yapıldı',
      'İptal edildi'
    ]
  }

  const updateLessonStatus = async (
    currentLesson,
    newStatus
  ) => {
    if (
      !currentLesson ||
      updatingLessonId
    ) {
      return
    }

    const makeupLesson =
      isMakeupLesson(currentLesson)

    /*
     * Düzenli derslerde gerçek occurrence kimliği
     * occurrenceId alanında bulunur.
     *
     * Telafi dersleri doğrudan lesson_occurrences
     * tablosundan geldiği için gerçek kayıt kimliği
     * id alanındadır.
     */
    const existingOccurrenceId =
      currentLesson.occurrenceId ||
      (
        makeupLesson
          ? currentLesson.id
          : ''
      )

    const actionId =
      existingOccurrenceId ||
      currentLesson.id

    const statusToSave =
      newStatus === 'Geri al'
        ? (
            makeupLesson
              ? 'Telafi yapılacak'
              : 'Planlandı'
          )
        : newStatus

    const lessonDate =
      currentLesson.lessonDate ||
      getLessonDateForDay(
        currentLesson.day
      )

    setUpdatingLessonId(actionId)

    try {
      let savedLesson

      if (existingOccurrenceId) {
        savedLesson =
          await updateLessonOccurrenceStatus(
            existingOccurrenceId,
            statusToSave
          )

        setLessons((currentLessons) =>
          currentLessons.map(
            (lesson) =>
              areIdsEqual(
                lesson.id,
                existingOccurrenceId
              )
                ? savedLesson
                : lesson
          )
        )
      } else {
        savedLesson =
          await createLessonOccurrence({
            lessonPlanId:
              currentLesson.lessonPlanId ||
              currentLesson.id,
            teacherId:
              currentLesson.teacherId,
            studentId:
              currentLesson.studentId,
            packageId:
              currentLesson.packageId,
            lessonDate,
            day:
              currentLesson.day,
            time:
              currentLesson.time,
            duration:
              currentLesson.duration ||
              '60 dk',
            status:
              statusToSave,
            note:
              currentLesson.note || '',
            isMakeup:
              false,
            relatedLessonId:
              null
          })

        setLessons((currentLessons) => [
          ...currentLessons,
          savedLesson
        ])
      }

      notify.success(newStatus === 'Geri al'
          ? 'Ders işareti geri alındı.'
          : `Ders "${statusToSave}" olarak işaretlendi.`)

      queryClient.invalidateQueries({
        queryKey:
          LESSON_HISTORY_QUERY_ROOT
      })

      queryClient.invalidateQueries({
        queryKey:
          UNMARKED_LESSONS_QUERY_ROOT
      })

      setOpenMenuId(null)
    } catch (error) {
      console.error(
        'Ders durumu güncelleme hatası:',
        error
      )

      notify(
        error instanceof Error
          ? error.message
          : 'Ders durumu güncellenemedi.'
      )
    } finally {
      setUpdatingLessonId(null)
    }
  }

  const deleteMakeupLesson = async (
    lessonId
  ) => {
    if (deletingLessonId) {
      return
    }

    const confirmDelete =
      await confirmDialog(
        'Bu telafi dersini kaldırmak istediğinize emin misiniz?'
      )

    if (!confirmDelete) {
      return
    }

    setDeletingLessonId(lessonId)

    try {
      await deleteLessonOccurrence(lessonId)

      notify.success('Ders kaydı silindi.')

      setLessons((currentLessons) =>
        currentLessons.filter(
          (lesson) =>
            !areIdsEqual(
              lesson.id,
              lessonId
            )
        )
      )

      queryClient.invalidateQueries({
        queryKey:
          LESSON_HISTORY_QUERY_ROOT
      })

      setOpenMenuId(null)
    } catch (error) {
      console.error(
        'Telafi dersi silme hatası:',
        error
      )

      notify(
        error instanceof Error
          ? error.message
          : 'Telafi dersi silinemedi.'
      )
    } finally {
      setDeletingLessonId(null)
    }
  }

  const handleStudentSearchChange = (event) => {
    setStudentSearch(event.target.value)
    setSelectedStudent('all')
    resetHistoryPage()
    setShowStudentSuggestions(true)
  }

  const selectStudentFilter = (student) => {
    setSelectedStudent(String(student.id))
    setStudentSearch(getStudentFullName(student))
    setShowStudentSuggestions(false)
  }

  const clearStudentFilter = () => {
    setSelectedStudent('all')
    setStudentSearch('')
    setShowStudentSuggestions(false)
  }

  const clearFilters = () => {
    setSelectedTeacher('all')
    setSelectedStudent('all')
    setStudentSearch('')
    setShowStudentSuggestions(false)
    setSelectedStatus('all')
    setOpenMenuId(null)
    resetHistoryPage()
  }

  const performOpenMakeupForm = () => {
    unsavedChanges?.markClean?.()
    setMakeupForm(emptyMakeupForm)
    setShowMakeupForm(true)
  }

  const openMakeupForm = () => {
    runProtectedAction(performOpenMakeupForm)
  }

  const performCloseMakeupForm = () => {
    unsavedChanges?.markClean?.()
    setMakeupForm(emptyMakeupForm)
    setShowMakeupForm(false)
  }

  const closeMakeupForm = () => {
    runProtectedAction(performCloseMakeupForm)
  }

  const handleMakeupChange = (event) => {
    const { name, value } =
      event.target

    unsavedChanges?.markDirty?.()

    if (name === 'lessonType') {
      setMakeupForm((currentForm) => ({
        ...emptyMakeupForm,
        lessonType: value,
        day: currentForm.day,
        time: currentForm.time,
        note: currentForm.note
      }))

      return
    }

    if (name === 'lessonPlanId') {
      const selectedPlan =
        groupLessonPlans.find(
          (lessonPlan) =>
            areIdsEqual(
              lessonPlan.id,
              value
            )
        )

      setMakeupForm((currentForm) => ({
        ...currentForm,
        lessonPlanId: value,
        teacherId:
          selectedPlan?.teacherId || '',
        studentId:
          selectedPlan?.studentId || '',
        packageId:
          selectedPlan?.packageId || '',
        packageName: selectedPlan
          ? getGroupName(selectedPlan)
          : '',
        instrument: selectedPlan
          ? getLessonInstrument(selectedPlan)
          : '',
        duration:
          selectedPlan?.duration ||
          (selectedPlan?.durationMinutes
            ? `${selectedPlan.durationMinutes} dk`
            : '')
      }))

      return
    }

    if (name === 'studentId') {
      setMakeupForm((currentForm) => ({
        ...currentForm,
        studentId: value,
        packageId: '',
        packageName: '',
        instrument: '',
        duration: ''
      }))

      return
    }

    if (name === 'packageId') {
      const studentPackages =
        getStudentPackageOptions()

      const selectedPackage =
        studentPackages.find(
          (item) =>
            areIdsEqual(item.id, value)
        )

      setMakeupForm((currentForm) => ({
        ...currentForm,
        packageId: value,
        packageName:
          selectedPackage?.name || '',
        instrument:
          selectedPackage?.instrument || '',
        duration:
          selectedPackage?.duration || ''
      }))

      return
    }

    setMakeupForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }))
  }

  const getMakeupStudentIds = () => {
    if (
      makeupForm.lessonType === 'group' &&
      makeupForm.lessonPlanId
    ) {
      const participantIds =
        getGroupParticipantIds({
          lessonPlanId:
            makeupForm.lessonPlanId
        })

      if (participantIds.length > 0) {
        return participantIds
      }
    }

    return makeupForm.studentId
      ? [makeupForm.studentId]
      : []
  }

  const hasConflict = () => {
    const makeupStudentIds =
      getMakeupStudentIds()

    const isMakeupStudentId = (studentId) =>
      makeupStudentIds.some((makeupStudentId) =>
        areIdsEqual(
          studentId,
          makeupStudentId
        )
      )

    const selectedLessonDate =
      getLessonDateForDay(
        makeupForm.day
      )

    const occurrenceConflict =
      lessons.some((lesson) => {
        const lessonStatus =
          normalizeLessonStatus(
            lesson.status
          )

        const sameDate =
          lesson.lessonDate
            ? lesson.lessonDate ===
              selectedLessonDate
            : lesson.day ===
              makeupForm.day

        const sameTime =
          doTimeRangesOverlap(
            makeupForm.time,
            makeupForm.duration,
            lesson.time,
            getLessonDurationMinutes(lesson)
          )

        const sameTeacher =
          areIdsEqual(
            getTeacherId(lesson),
            makeupForm.teacherId
          )

        /*
         * Grup dersinde yalnız ana öğrenci değil,
         * gruptaki tüm öğrenciler kontrol edilir.
         */
        const sameStudent =
          getLessonStudentIds(
            lesson
          ).some(isMakeupStudentId)

        /*
         * Yapılmış bir telafi de o tarih ve saatte gerçekleşmiş
         * gerçek bir derstir. Bu yüzden yalnızca iptal edilmiş
         * kayıtlar yeni ders eklenmesine engel olmaz.
         */
        const blocksSlot =
          lessonStatus !==
            'İptal edildi'

        return (
          lesson.isActive !== false &&
          blocksSlot &&
          sameDate &&
          sameTime &&
          (
            sameTeacher ||
            sameStudent
          )
        )
      })

    if (occurrenceConflict) {
      return true
    }

    return lessonPlans.some(
      (lessonPlan) => {
        const sameDay =
          lessonPlan.day ===
          makeupForm.day

        const sameTime =
          doTimeRangesOverlap(
            makeupForm.time,
            makeupForm.duration,
            lessonPlan.time,
            getLessonDurationMinutes(lessonPlan)
          )

        const sameTeacher =
          areIdsEqual(
            getTeacherId(
              lessonPlan
            ),
            makeupForm.teacherId
          )

        const sameStudent =
          getLessonStudentIds(
            lessonPlan
          ).some(isMakeupStudentId)

        return (
          lessonPlan.isActive !== false &&
          sameDay &&
          sameTime &&
          (
            sameTeacher ||
            sameStudent
          )
        )
      }
    )
  }

  const saveMakeupLesson = async (event) => {
    event.preventDefault()

    if (isSavingMakeup) {
      return
    }

    if (
      makeupForm.lessonType === 'group' &&
      !makeupForm.lessonPlanId
    ) {
      notify('Grup dersi seçilmelidir.')
      return
    }

    if (!makeupForm.studentId) {
      notify('Öğrenci seçilmelidir.')
      return
    }

    if (!makeupForm.teacherId) {
      notify('Öğretmen seçilmelidir.')
      return
    }

    if (!makeupForm.packageId) {
      notify(
        makeupForm.lessonType === 'group'
          ? 'Seçilen grup dersinin paket bilgisi bulunamadı.'
          : 'Öğrenciye tanımlı bir paket seçilmelidir.'
      )
      return
    }

    if (!makeupForm.day) {
      notify('Gün seçilmelidir.')
      return
    }

    if (!makeupForm.time) {
      notify('Saat seçilmelidir.')
      return
    }

    if (hasConflict()) {
      notify(
        makeupForm.lessonType === 'group'
          ? 'Seçilen gün ve saatte öğretmenin veya gruptaki öğrencilerden birinin başka bir dersi var (ders süreleri dikkate alınarak). Lütfen başka bir saat yazınız.'
          : 'Seçilen gün ve saatte öğretmenin veya öğrencinin başka bir dersi var (ders süreleri dikkate alınarak). Lütfen başka bir saat yazınız.'
      )
      return
    }

    setIsSavingMakeup(true)

    try {
      const savedLesson =
        await createLessonOccurrence({
          /*
           * Grup telafisi grup dersinin planına bağlanır; böylece
           * gruptaki tüm öğrenciler derse dahil olur ve hakediş her
           * öğrencinin kendi ücretiyle hesaplanır.
           */
          lessonPlanId:
            makeupForm.lessonType === 'group'
              ? makeupForm.lessonPlanId
              : null,
          teacherId:
            makeupForm.teacherId,
          studentId:
            makeupForm.studentId,
          packageId:
            makeupForm.packageId,
          lessonDate:
            getLessonDateForDay(
              makeupForm.day
            ),
          day:
            makeupForm.day,
          time:
            makeupForm.time,
          duration:
            makeupForm.duration ||
            '60 dk',
          status:
            'Telafi yapılacak',
          note:
            makeupForm.note.trim(),
          isMakeup:
            true,
          relatedLessonId:
            null
        })

      notify.success('Telafi dersi kaydedildi.')

      setLessons((currentLessons) => [
        ...currentLessons,
        savedLesson
      ])

      queryClient.invalidateQueries({
        queryKey:
          LESSON_HISTORY_QUERY_ROOT
      })

      unsavedChanges?.markClean?.()
      performCloseMakeupForm()
    } catch (error) {
      console.error(
        'Telafi dersi kaydetme hatası:',
        error
      )

      notify(
        error instanceof Error
          ? error.message
          : 'Telafi dersi kaydedilemedi.'
      )
    } finally {
      setIsSavingMakeup(false)
    }
  }

  const studentPackageOptions =
    getStudentPackageOptions()

  const makeupGroupStudentNames =
    makeupForm.lessonType === 'group' &&
    makeupForm.lessonPlanId
      ? getMakeupStudentIds().map(
          (studentId) => {
            const student = students.find(
              (item) =>
                areIdsEqual(
                  item.id,
                  studentId
                )
            )

            return (
              student?.fullName ||
              student?.name ||
              'Öğrenci'
            )
          }
        )
      : []

  /*
   * GEÇMİŞ TARİHLİ DERS EKLEME
   */
  const WEEKDAY_BY_INDEX = [
    'Pazar',
    'Pazartesi',
    'Salı',
    'Çarşamba',
    'Perşembe',
    'Cuma',
    'Cumartesi'
  ]

  const getWeekdayName = (dateKey) =>
    WEEKDAY_BY_INDEX[
      new Date(`${dateKey}T12:00:00`).getDay()
    ]

  const backdatedStudentOptions = [...students].sort(
    (firstStudent, secondStudent) =>
      String(
        firstStudent.fullName || firstStudent.name || ''
      ).localeCompare(
        String(
          secondStudent.fullName || secondStudent.name || ''
        ),
        'tr'
      )
  )

  const backdatedPackageOptions =
    backdatedForm?.studentId
      ? getStudentPackageOptions(
          backdatedForm.studentId
        )
      : []

  const backdatedPlan =
    backdatedForm?.lessonType === 'group'
      ? groupLessonPlans.find((lessonPlan) =>
          areIdsEqual(
            lessonPlan.id,
            backdatedForm.lessonPlanId
          )
        ) || null
      : null

  const openBackdatedForm = (lessonDate = '') => {
    setBackdatedForm({
      ...emptyBackdatedForm,
      lessonDate:
        lessonDate && lessonDate <= todayDateKey
          ? lessonDate
          : ''
    })
  }

  const closeBackdatedForm = () => {
    if (!isSavingBackdated) {
      setBackdatedForm(null)
    }
  }

  const handleBackdatedChange = (event) => {
    const { name, value } = event.target

    setBackdatedForm((currentForm) => {
      if (name === 'lessonType') {
        return {
          ...emptyBackdatedForm,
          lessonType: value,
          lessonDate: currentForm.lessonDate,
          time: currentForm.time,
          note: currentForm.note
        }
      }

      if (name === 'lessonPlanId') {
        const selectedPlan = groupLessonPlans.find(
          (lessonPlan) =>
            areIdsEqual(lessonPlan.id, value)
        )

        return {
          ...currentForm,
          lessonPlanId: value,
          teacherId: selectedPlan?.teacherId || '',
          time:
            currentForm.time ||
            selectedPlan?.time ||
            '',
          duration:
            selectedPlan?.duration ||
            (selectedPlan?.durationMinutes
              ? `${selectedPlan.durationMinutes} dk`
              : '')
        }
      }

      if (name === 'studentId') {
        const [firstPackage] =
          getStudentPackageOptions(value)

        return {
          ...currentForm,
          studentId: value,
          packageId: firstPackage?.id || '',
          teacherId: firstPackage?.teacherId || '',
          duration: firstPackage?.duration || ''
        }
      }

      if (name === 'packageId') {
        const selectedPackage =
          getStudentPackageOptions(
            currentForm.studentId
          ).find((item) =>
            areIdsEqual(item.id, value)
          )

        return {
          ...currentForm,
          packageId: value,
          teacherId:
            selectedPackage?.teacherId ||
            currentForm.teacherId,
          duration: selectedPackage?.duration || ''
        }
      }

      return {
        ...currentForm,
        [name]: value
      }
    })
  }

  /*
   * Tahmini hakediş, hakediş görünümüyle aynı formül:
   * paket ücreti / paket ders sayısı × öğretmen yüzdesi.
   * Grup dersinde gruptaki her öğrencinin kendi paketi toplanır.
   */
  const getUnitPrice = (packageOption) => {
    const price = Number(packageOption?.totalPrice || 0)
    const lessonCount = Math.max(
      Number(packageOption?.lessonCount || 1),
      1
    )

    return price / lessonCount
  }

  const getBackdatedEstimate = () => {
    if (!backdatedForm?.teacherId) {
      return null
    }

    const teacher = teachers.find((item) =>
      areIdsEqual(item.id, backdatedForm.teacherId)
    )

    const commissionRate = Number(
      teacher?.commissionRate ?? 0
    )

    let rows = []

    if (backdatedForm.lessonType === 'group') {
      if (!backdatedPlan) {
        return null
      }

      rows = lessonPlanStudents
        .filter(
          (link) =>
            link.isActive !== false &&
            areIdsEqual(
              link.lessonPlanId,
              backdatedPlan.id
            )
        )
        .map((link) => {
          const student = students.find((item) =>
            areIdsEqual(item.id, link.studentId)
          )

          const packageOption =
            getStudentPackageOptions(
              link.studentId
            ).find((item) =>
              link.studentPackageId
                ? areIdsEqual(
                    item.studentPackageId,
                    link.studentPackageId
                  )
                : false
            ) ||
            getStudentPackageOptions(
              link.studentId
            )[0]

          return {
            studentName:
              student?.fullName ||
              student?.name ||
              'Öğrenci',
            unitPrice: getUnitPrice(packageOption)
          }
        })
    } else {
      const packageOption =
        backdatedPackageOptions.find((item) =>
          areIdsEqual(item.id, backdatedForm.packageId)
        )

      if (!packageOption) {
        return null
      }

      const student = students.find((item) =>
        areIdsEqual(item.id, backdatedForm.studentId)
      )

      rows = [
        {
          studentName:
            student?.fullName ||
            student?.name ||
            'Öğrenci',
          unitPrice: getUnitPrice(packageOption)
        }
      ]
    }

    const totalUnitPrice = rows.reduce(
      (sum, row) => sum + row.unitPrice,
      0
    )

    return {
      rows,
      commissionRate,
      totalUnitPrice,
      teacherEarning:
        totalUnitPrice * (commissionRate / 100)
    }
  }

  const formatMoney = (value) =>
    `₺${Number(value || 0).toLocaleString('tr-TR', {
      maximumFractionDigits: 2
    })}`

  const saveBackdatedLesson = async (event) => {
    event.preventDefault()

    if (!backdatedForm || isSavingBackdated) {
      return
    }

    const form = backdatedForm
    const isGroup = form.lessonType === 'group'

    if (isGroup && !backdatedPlan) {
      notify('Grup dersi seçilmelidir.')
      return
    }

    if (!isGroup && !form.studentId) {
      notify('Öğrenci seçilmelidir.')
      return
    }

    if (!isGroup && !form.packageId) {
      notify('Öğrencinin paketi seçilmelidir.')
      return
    }

    if (!form.teacherId) {
      notify('Öğretmen seçilmelidir.')
      return
    }

    if (!form.lessonDate) {
      notify('Ders tarihi seçilmelidir.')
      return
    }

    if (form.lessonDate > todayDateKey) {
      notify(
        'İleri tarihli ders buradan eklenemez. Ders Programı ekranını kullanınız.'
      )
      return
    }

    if (!form.time) {
      notify('Ders saati yazılmalıdır.')
      return
    }

    const weekdayName = getWeekdayName(form.lessonDate)

    const isPlannedOccurrence = (lessonPlan) =>
      lessonPlan.isActive !== false &&
      lessonPlan.day === weekdayName &&
      String(lessonPlan.createdAt || '').slice(0, 10) <=
        form.lessonDate

    /*
     * Programdaki bir dersin o tarihteki tekrarı zaten takvimde
     * vardır; aynı ders ikinci kez eklenirse hakediş iki kez sayılır.
     */
    if (isGroup && isPlannedOccurrence(backdatedPlan)) {
      notify(
        `Bu grubun ${formatLongDate(
          form.lessonDate
        )} tarihinde programda zaten dersi var. Takvimde o derse tıklayarak "Yapıldı" olarak işaretleyiniz.`
      )
      return
    }

    if (!isGroup) {
      const plannedLesson = lessonPlans.find(
        (lessonPlan) =>
          !isGroupLessonRecord(lessonPlan) &&
          areIdsEqual(lessonPlan.studentId, form.studentId) &&
          areIdsEqual(lessonPlan.packageId, form.packageId) &&
          isPlannedOccurrence(lessonPlan)
      )

      if (
        plannedLesson &&
        !await confirmDialog(
          `Öğrencinin bu pakette ${formatLongDate(
            form.lessonDate
          )} tarihinde programda zaten dersi var (${plannedLesson.time}). Programdaki dersi işaretlemek için takvimi kullanınız.\n\nYine de ayrı bir ek ders olarak eklensin mi?`
        )
      ) {
        return
      }
    }

    setIsSavingBackdated(true)

    try {
      await createLessonOccurrence({
        lessonPlanId: isGroup ? backdatedPlan.id : null,
        teacherId: form.teacherId,
        studentId: isGroup
          ? backdatedPlan.studentId
          : form.studentId,
        packageId: isGroup
          ? backdatedPlan.packageId
          : form.packageId,
        lessonDate: form.lessonDate,
        day: weekdayName,
        time: form.time,
        duration: form.duration || '60 dk',
        status: 'Yapıldı',
        note: form.note.trim() || 'Geçmiş tarihli ders kaydı',
        isMakeup: false,
        relatedLessonId: null
      })

      notify.success('Geçmiş ders kaydedildi ve hakedişe eklendi.')

      // Takvim, geçmiş, hakediş ve dashboard özetleri yenilenir.
      await queryClient.invalidateQueries()

      if (
        academicMonthKeys.includes(
          form.lessonDate.slice(0, 7)
        )
      ) {
        setUnmarkedMonth(form.lessonDate.slice(0, 7))
      }

      setBackdatedForm(null)
    } catch (error) {
      console.error('Geçmiş ders kaydetme hatası:', error)

      notify(
        error instanceof Error
          ? error.message
          : 'Geçmiş ders kaydedilemedi.'
      )
    } finally {
      setIsSavingBackdated(false)
    }
  }

  const backdatedEstimate = backdatedForm
    ? getBackdatedEstimate()
    : null

  return (
    <div className="dashboard-shell">
      <section className="page-card">
        <div>
          <span className="page-badge">
            Ders Takibi
          </span>

          <h1>Ders Durum Takibi</h1>

          <p>
            Haftalık ders programını görüntüleyin,
            iptal ve telafi süreçlerini takip edin.
          </p>
        </div>

        <div className="status-today-date">
          <span>Bugün</span>
          <strong>{formattedToday}</strong>
        </div>
      </section>

      <section className="lesson-table-card status-filter-card">
        <div className="status-filter-grid">
          <div className="form-group">
            <label>
              Öğretmene Göre Filtrele
            </label>

            <select
              value={selectedTeacher}
              onChange={(event) =>
                setSelectedTeacher(
                  event.target.value
                )
              }
            >
              <option value="all">
                Tüm öğretmenler
              </option>

              {teachers.map((teacher) => (
                <option
                  key={teacher.id}
                  value={teacher.id}
                >
                  {teacher.fullName ||
                    teacher.name}
                </option>
              ))}
            </select>
          </div>

          <div
            className="form-group student-filter-group"
            ref={studentSearchRef}
          >
            <label htmlFor="student-status-search">
              Öğrenci Ara
            </label>

            <div className="student-search-control">
              <span
                className="student-search-icon"
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4-4" />
                </svg>
              </span>

              <input
                id="student-status-search"
                type="text"
                value={studentSearch}
                onChange={handleStudentSearchChange}
                onFocus={() =>
                  setShowStudentSuggestions(true)
                }
                placeholder="Ad veya TC ile ara"
                autoComplete="off"
                role="combobox"
                aria-expanded={showStudentSuggestions}
                aria-controls="student-filter-results"
              />

              {studentSearch && (
                <button
                  type="button"
                  className="student-search-clear"
                  onClick={clearStudentFilter}
                  aria-label="Öğrenci filtresini temizle"
                >
                  ×
                </button>
              )}
            </div>

            {showStudentSuggestions &&
              normalizedStudentSearch && (
                <div
                  id="student-filter-results"
                  className="student-search-results"
                  role="listbox"
                >
                  {studentSuggestions.length > 0 ? (
                    studentSuggestions.map((student) => (
                      <button
                        type="button"
                        className={`student-search-result ${
                          String(selectedStudent) ===
                          String(student.id)
                            ? 'selected'
                            : ''
                        }`}
                        key={student.id}
                        onClick={() =>
                          selectStudentFilter(student)
                        }
                        role="option"
                        aria-selected={
                          String(selectedStudent) ===
                          String(student.id)
                        }
                      >
                        <span className="student-result-avatar">
                          {getStudentFullName(student)
                            .charAt(0)
                            .toLocaleUpperCase('tr-TR') ||
                            '?'}
                        </span>

                        <span className="student-result-content">
                          <strong>
                            {getStudentFullName(student)}
                          </strong>
                          {student.tcNo && (
                            <small>
                              TC: {student.tcNo}
                            </small>
                          )}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="student-search-empty">
                      Eşleşen öğrenci bulunamadı.
                    </div>
                  )}
                </div>
              )}
          </div>

          <div className="form-group">
            <label>
              Duruma Göre Filtrele
            </label>

            <select
              value={selectedStatus}
              onChange={(event) =>
                setSelectedStatus(
                  event.target.value
                )
              }
            >
              <option value="all">
                Tüm durumlar
              </option>

              {statusOptions.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status === 'Planlandı'
                      ? 'Düzenli Ders'
                      : status}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="form-group">
            <label>&nbsp;</label>

            <button
              className="cancel-button"
              type="button"
              onClick={clearFilters}
            >
              Filtreleri Temizle
            </button>
          </div>
        </div>
      </section>

      {showMakeupForm && (
        <section className="lesson-table-card slide-down-panel">
          <div className="section-title-row">
            <div>
              <h2>Telafi Dersi Ekle</h2>

              <p>
                Bireysel telafi için öğrenci ve
                paketini, grup telafisi için grup
                dersini seçin.
              </p>
            </div>

            <button
              className="edit-section-button"
              type="button"
              onClick={closeMakeupForm}
              disabled={isSavingMakeup}
            >
              Kapat
            </button>
          </div>

          <form onSubmit={saveMakeupLesson}>
            <div className="makeup-form-grid">
              <div className="form-group">
                <label>Telafi Türü</label>

                <select
                  name="lessonType"
                  value={makeupForm.lessonType}
                  onChange={handleMakeupChange}
                >
                  <option value="individual">
                    Bireysel ders
                  </option>
                  <option value="group">
                    Grup dersi
                  </option>
                </select>
              </div>

              {makeupForm.lessonType === 'group' ? (
                <div className="form-group">
                  <label>Grup Dersi</label>

                  <select
                    name="lessonPlanId"
                    value={makeupForm.lessonPlanId}
                    onChange={handleMakeupChange}
                  >
                    <option value="">
                      {groupLessonPlans.length > 0
                        ? 'Grup dersi seçiniz'
                        : 'Planlanmış grup dersi yok'}
                    </option>

                    {groupLessonPlans.map(
                      (lessonPlan) => (
                        <option
                          key={lessonPlan.id}
                          value={lessonPlan.id}
                        >
                          {getGroupName(lessonPlan)}
                          {' · '}
                          {lessonPlan.day}{' '}
                          {lessonPlan.time}
                          {' · '}
                          {getTeacherName(lessonPlan)}
                        </option>
                      )
                    )}
                  </select>
                </div>
              ) : (
                <>
              <div className="form-group">
                <label htmlFor="makeup-student-search">
                  Öğrenci
                </label>

                <StudentSearchSelect
                  id="makeup-student-search"
                  students={activeStudents}
                  value={makeupForm.studentId}
                  onChange={(studentId) =>
                    handleMakeupChange({
                      target: {
                        name: 'studentId',
                        value: studentId
                      }
                    })
                  }
                />
              </div>

                </>
              )}

              <div className="form-group">
                <label>Öğretmen</label>

                <select
                  name="teacherId"
                  value={makeupForm.teacherId}
                  onChange={handleMakeupChange}
                >
                  <option value="">
                    Öğretmen seçiniz
                  </option>

                  {activeTeachers.map(
                    (teacher) => (
                      <option
                        key={teacher.id}
                        value={teacher.id}
                      >
                        {teacher.fullName ||
                          teacher.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              {makeupForm.lessonType !== 'group' && (
              <div className="form-group">
                <label>
                  Öğrencinin Paketi
                </label>

                <select
                  name="packageId"
                  value={makeupForm.packageId}
                  onChange={handleMakeupChange}
                  disabled={
                    !makeupForm.studentId
                  }
                >
                  <option value="">
                    {makeupForm.studentId
                      ? 'Paket seçiniz'
                      : 'Önce öğrenci seçiniz'}
                  </option>

                  {studentPackageOptions.map(
                    (item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              )}

              <div className="form-group">
                <label>Gün</label>

                <select
                  name="day"
                  value={makeupForm.day}
                  onChange={handleMakeupChange}
                >
                  {days.map((day) => (
                    <option
                      key={day}
                      value={day}
                    >
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Saat</label>

                <input
                  type="time"
                  step="300"
                  name="time"
                  value={makeupForm.time}
                  onChange={handleMakeupChange}
                />
              </div>

              <div className="form-group full-width">
                {makeupForm.packageId ? (
                  <div className="selected-package-card">
                    <span>
                      {makeupForm.lessonType === 'group'
                        ? 'Seçilen Grup Dersi'
                        : 'Seçilen Paket'}
                    </span>

                    <h3>
                      {makeupForm.packageName}
                    </h3>

                    <div className="selected-package-grid">
                      <p>
                        <strong>Ders:</strong>{' '}
                        {makeupForm.instrument ||
                          '-'}
                      </p>

                      <p>
                        <strong>Süre:</strong>{' '}
                        {makeupForm.duration ||
                          '-'}
                      </p>

                      {makeupForm.lessonType === 'group' && (
                        <p>
                          <strong>Öğrenciler:</strong>{' '}
                          {makeupGroupStudentNames.join(', ') ||
                            '-'}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="selected-package-card empty">
                    <span>
                      {makeupForm.lessonType === 'group'
                        ? 'Grup dersi seçildiğinde ders ve öğrenci bilgileri burada görüntülenecektir.'
                        : 'Öğrenci ve paket seçimi tamamlandığında ders bilgileri burada görüntülenecektir.'}
                    </span>
                  </div>
                )}
              </div>

              <div className="form-group full-width">
                <label>Not</label>

                <textarea
                  name="note"
                  value={makeupForm.note}
                  onChange={handleMakeupChange}
                  placeholder="Telafi dersiyle ilgili not..."
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={closeMakeupForm}
                disabled={isSavingMakeup}
              >
                İptal
              </button>

              <button
                type="submit"
                className="save-button"
                disabled={isSavingMakeup}
              >
                {isSavingMakeup
                  ? 'Kaydediliyor...'
                  : 'Telafi Dersini Kaydet'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="lesson-table-card">
        <div className="table-head">
          <div>
            <h2>Haftalık Program</h2>

            <p>
              Güncel haftalık program ve ders
              durumları.
            </p>
          </div>

          <div className="status-table-actions">
            <button
              className={`monthly-check-button ${
                showMonthlyCheck ? 'active' : ''
              } ${
                allUnmarkedLessons.length > 0
                  ? 'has-pending'
                  : ''
              }`}
              type="button"
              onClick={() =>
                setShowMonthlyCheck(
                  (current) => !current
                )
              }
            >
              {showMonthlyCheck
                ? 'Aylık Kontrolü Kapat'
                : 'Aylık Kontrol'}
              {allUnmarkedLessons.length > 0 && (
                <span>
                  {allUnmarkedLessons.length}
                </span>
              )}
            </button>

            <button
              className="makeup-add-button"
              type="button"
              onClick={openMakeupForm}
            >
              + Telafi Ekle
            </button>

            <button
              className="lesson-count"
              type="button"
            >
              {weeklyLessons.length} ders
            </button>
          </div>
        </div>

        <div className="weekly-schedule-wrapper">
          <table className="weekly-schedule-table status-weekly-table day-column-table">
            <thead>
              <tr>
                {days.map((day) => (
                  <th key={day}>
                    <span>{day}</span>
                    <small>
                      {formatShortDate(
                        getLessonDateForDay(
                          day
                        )
                      )}
                    </small>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              <tr className="day-column-row">

                  {days.map((day) => {
                    const cellKey = day

                    const cellLessons =
                      getLessonsByDay(day)

                    const visibleLessons =
                      cellLessons

                    return (
                      <td
                        key={cellKey}
                        className={
                          cellLessons.length > 0
                            ? 'status-cell-has-lessons'
                            : ''
                        }
                      >
                        {cellLessons.length > 0 ? (
                          <div className="status-cell-stack">
                            {groupLessonsByStartTime(visibleLessons).map(
                              (timeGroup) => (
                                <div
                                  key={`${cellKey}-${timeGroup.time}`}
                                  className={`day-time-group ${
                                    timeGroup.lessons.length > 1
                                      ? 'multiple'
                                      : ''
                                  }`}
                                >
                                  {timeGroup.lessons.length > 1 && (
                                    <div className="day-time-group-head">
                                      <b>{timeGroup.time}</b>
                                      <span>
                                        {timeGroup.lessons.length} ders aynı saatte
                                      </span>
                                    </div>
                                  )}

                                  {timeGroup.lessons.map(
                              (lesson) => {
                                const lessonActions =
                                  getLessonActions(
                                    lesson
                                  )

                                const compactStatus =
                                  getCompactLessonStatusLabel(
                                    lesson.status
                                  )

                                return (
                                  <div
                                    key={(lesson.occurrenceId || lesson.id)}
                                    className={`${getLessonStatusClass(
                                      lesson.status,
                                      'status-lesson-card'
                                    )} ${
                                      isMakeupLesson(lesson)
                                        ? 'makeup-card'
                                        : ''
                                    } ${
                                      areIdsEqual(
                                        openMenuId,
                                        (lesson.occurrenceId || lesson.id)
                                      )
                                        ? 'menu-open'
                                        : ''
                                    }`}
                                  >
                                    {isMakeupLesson(lesson) &&
                                      normalizeLessonStatus(
                                        lesson.status
                                      ) ===
                                        'Telafi yapılacak' && (
                                        <button
                                          type="button"
                                          className="makeup-delete-button"
                                          onClick={(
                                            event
                                          ) => {
                                            event.stopPropagation()

                                            deleteMakeupLesson(
                                              (lesson.occurrenceId || lesson.id)
                                            )
                                          }}
                                          disabled={
                                            areIdsEqual(
                                              deletingLessonId,
                                              (lesson.occurrenceId || lesson.id)
                                            )
                                          }
                                          title="Telafi dersini kaldır"
                                        >
                                          {areIdsEqual(
                                            deletingLessonId,
                                            (lesson.occurrenceId || lesson.id)
                                          )
                                            ? '…'
                                            : '×'}
                                        </button>
                                      )}

                                    <div className="status-card-top">
                                      <div className="status-card-text">
                                        <small className="schedule-card-time">
                                          {getLessonTimeRange(
                                            lesson
                                          )}
                                        </small>

                                        <div className="status-teacher-line">
                                          <strong
                                            title={getTeacherName(
                                              lesson
                                            )}
                                          >
                                            {getTeacherName(
                                              lesson
                                            )}
                                          </strong>
                                        </div>

                                        <span
                                          title={getLessonDisplaySummary(
                                            lesson
                                          )}
                                        >
                                          {isGroupLessonRecord(
                                            lesson
                                          ) ? (
                                            <>
                                              {getGroupName(
                                                lesson
                                              )}
                                              <b>•</b>
                                              {getGroupStudentCount(
                                                lesson
                                              )}{' '}
                                              öğrenci
                                            </>
                                          ) : (
                                            <>
                                              {getStudentName(
                                                lesson
                                              )}
                                              <b>•</b>
                                              {getLessonInstrument(
                                                lesson
                                              )}
                                            </>
                                          )}
                                        </span>

                                        {compactStatus && (
                                          <em>
                                            {compactStatus}
                                          </em>
                                        )}
                                      </div>

                                      <div className="lesson-action-wrapper">
                                        <button
                                          type="button"
                                          className="lesson-menu-button"
                                          onClick={(
                                            event
                                          ) => {
                                            event.stopPropagation()

                                            setOpenMenuId(
                                              areIdsEqual(
                                                openMenuId,
                                                (lesson.occurrenceId || lesson.id)
                                              )
                                                ? null
                                                : (lesson.occurrenceId || lesson.id)
                                            )
                                          }}
                                          aria-label="Ders işlemleri"
                                        >
                                          ⋯
                                        </button>

                                        {areIdsEqual(
                                          openMenuId,
                                          (lesson.occurrenceId || lesson.id)
                                        ) && (
                                          <div className="lesson-action-menu">
                                            {lessonActions.map(
                                              (action) => (
                                                <button
                                                  key={
                                                    action
                                                  }
                                                  type="button"
                                                  onClick={() =>
                                                    updateLessonStatus(
                                                      lesson,
                                                      action
                                                    )
                                                  }
                                                  disabled={
                                                    areIdsEqual(
                                                      updatingLessonId,
                                                      (lesson.occurrenceId || lesson.id)
                                                    )
                                                  }
                                                >
                                                  {areIdsEqual(
                                                    updatingLessonId,
                                                    (lesson.occurrenceId || lesson.id)
                                                  )
                                                    ? 'Kaydediliyor...'
                                                    : action}
                                                </button>
                                              )
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              }
                            )}
                                </div>
                              )
                            )}

                          </div>
                        ) : (
                          <span className="empty-slot">
                            Ders yok
                          </span>
                        )}
                      </td>
                    )
                  })}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {showMonthlyCheck && (
      <div
        className="monthly-drawer-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setShowMonthlyCheck(false)
          }
        }}
      >
      <section
        className="lesson-table-card unmarked-lessons-card monthly-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="monthly-check-title"
      >
        <div className="table-head unmarked-lessons-head">
          <div>
            <h2 id="monthly-check-title">Aylık Ders Kontrolü</h2>

            <p>
              Ayın tüm dersleri takvim üzerinde. Turuncu
              dersler işaretlenmemiş geçmiş derslerdir;
              derse tıklayarak geçmiş tarihli dersleri de
              işaretleyebilirsiniz (1 Eylül'den itibaren).
              İşaretlenmeyen ders öğretmen hakedişine girmez.
            </p>
          </div>

          <div className="unmarked-month-nav">
            <button
              type="button"
              className="makeup-add-button backdated-add-button"
              onClick={() => openBackdatedForm()}
            >
              + Geçmiş Ders Ekle
            </button>

            <button
              type="button"
              className="unmarked-month-arrow"
              disabled={unmarkedMonthIndex <= 0}
              onClick={() =>
                setUnmarkedMonth(
                  academicMonthKeys[
                    unmarkedMonthIndex - 1
                  ]
                )
              }
              aria-label="Önceki ay"
            >
              ‹
            </button>

            <select
              value={unmarkedMonth}
              onChange={(event) =>
                setUnmarkedMonth(
                  event.target.value
                )
              }
            >
              {academicMonthKeys.map((monthKey) => {
                const monthCount =
                  getUnmarkedCountForMonth(
                    monthKey
                  )

                return (
                  <option
                    key={monthKey}
                    value={monthKey}
                  >
                    {formatMonthLabel(monthKey)}
                    {monthCount > 0
                      ? ` (${monthCount})`
                      : ''}
                  </option>
                )
              })}
            </select>

            <button
              type="button"
              className="unmarked-month-arrow"
              disabled={
                unmarkedMonthIndex < 0 ||
                unmarkedMonthIndex >=
                  academicMonthKeys.length - 1
              }
              onClick={() =>
                setUnmarkedMonth(
                  academicMonthKeys[
                    unmarkedMonthIndex + 1
                  ]
                )
              }
              aria-label="Sonraki ay"
            >
              ›
            </button>

            <button
              type="button"
              className="payment-modal-close-button"
              onClick={() =>
                setShowMonthlyCheck(false)
              }
              aria-label="Aylık kontrolü kapat"
            >
              ×
            </button>
          </div>
        </div>

        <div className="monthly-drawer-body">
        {(() => {
          if (
            calendarQuery.isPending &&
            !calendarQuery.data
          ) {
            return (
              <p className="unmarked-lessons-empty">
                Takvim hazırlanıyor...
              </p>
            )
          }

          if (calendarQuery.isError) {
            return (
              <p className="unmarked-lessons-empty error">
                {calendarQuery.error?.message ||
                  'Ders takvimi alınamadı.'}
              </p>
            )
          }

          const calendarLessons = (
            calendarQuery.data ?? []
          ).filter(
            (lesson) =>
              selectedTeacher === 'all' ||
              areIdsEqual(
                getTeacherId(lesson),
                selectedTeacher
              )
          )

          const isUnmarkedPastLesson = (lesson) =>
            !lesson.isMakeup &&
            normalizeLessonStatus(lesson.status) ===
              'Planlandı' &&
            lesson.lessonDate < todayDateKey

          const monthUnmarkedCount =
            calendarLessons.filter(
              isUnmarkedPastLesson
            ).length

          const selectedLesson =
            calendarLessons.find(
              (lesson) =>
                lesson.key === selectedCalendarKey
            ) || null

          return (
            <>
              <p
                className={`unmarked-lessons-count ${
                  monthUnmarkedCount === 0 ? 'ok' : ''
                }`}
              >
                {monthUnmarkedCount > 0
                  ? `${formatMonthLabel(
                      unmarkedMonth
                    )}: ${monthUnmarkedCount} ders işaretlenmemiş`
                  : `${formatMonthLabel(
                      unmarkedMonth
                    )}: işaretlenmemiş geçmiş ders yok`}
              </p>

              <div className="lesson-calendar">
                {CALENDAR_WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="lesson-calendar-weekday"
                  >
                    {label}
                  </div>
                ))}

                {getMonthCalendarCells(
                  unmarkedMonth
                ).map((dateKey, index) => {
                  if (!dateKey) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="lesson-calendar-cell empty"
                      />
                    )
                  }

                  const dayLessons =
                    calendarLessons.filter(
                      (lesson) =>
                        lesson.lessonDate === dateKey
                    )

                  return (
                    <div
                      key={dateKey}
                      className={`lesson-calendar-cell ${
                        dateKey === todayDateKey
                          ? 'today'
                          : ''
                      } ${
                        dateKey > todayDateKey
                          ? 'future'
                          : ''
                      }`}
                    >
                      <div className="lesson-calendar-day-row">
                        <span className="lesson-calendar-day">
                          {Number(dateKey.slice(8, 10))}
                        </span>

                        {dateKey <= todayDateKey && (
                          <button
                            type="button"
                            className="lesson-calendar-add"
                            onClick={() =>
                              openBackdatedForm(dateKey)
                            }
                            title="Bu tarihe geçmiş ders ekle"
                            aria-label={`${formatLongDate(
                              dateKey
                            )} tarihine geçmiş ders ekle`}
                          >
                            +
                          </button>
                        )}
                      </div>

                      <div className="lesson-calendar-lessons">
                        {dayLessons.map((lesson) => (
                          <button
                            key={lesson.key}
                            type="button"
                            className={`${getLessonStatusClass(
                              lesson.status,
                              'lesson-calendar-chip'
                            )} ${
                              isUnmarkedPastLesson(lesson)
                                ? 'unmarked'
                                : ''
                            } ${
                              isMakeupLesson(lesson)
                                ? 'makeup'
                                : ''
                            }`}
                            title={`${getLessonTimeRange(
                              lesson
                            )} · ${getTeacherName(
                              lesson
                            )} · ${getLessonDisplaySummary(
                              lesson
                            )}`}
                            onClick={() =>
                              setSelectedCalendarKey(
                                lesson.key
                              )
                            }
                          >
                            <b>{lesson.time}</b>{' '}
                            {getLessonDisplayStudent(
                              lesson
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {selectedLesson && (
                <div
                  className="payment-edit-modal-backdrop"
                  role="presentation"
                  onMouseDown={(event) => {
                    if (
                      event.target ===
                      event.currentTarget
                    ) {
                      setSelectedCalendarKey('')
                    }
                  }}
                >
                  <div
                    className="payment-edit-modal calendar-lesson-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="calendar-lesson-title"
                  >
                    <div className="payment-edit-modal-heading">
                      <div>
                        <span>
                          {formatLongDate(
                            selectedLesson.lessonDate
                          )}
                          {' · '}
                          {getLessonTimeRange(
                            selectedLesson
                          )}
                        </span>
                        <h2 id="calendar-lesson-title">
                          {getLessonDisplaySummary(
                            selectedLesson
                          )}
                        </h2>
                        <p>
                          {getTeacherName(selectedLesson)}
                          {' · '}
                          {isUnmarkedPastLesson(
                            selectedLesson
                          )
                            ? 'İşaretlenmemiş'
                            : getLessonStatusLabel(
                                selectedLesson.status
                              )}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="payment-modal-close-button"
                        onClick={() =>
                          setSelectedCalendarKey('')
                        }
                        aria-label="Pencereyi kapat"
                      >
                        ×
                      </button>
                    </div>

                    {selectedLesson.lessonDate >
                    todayDateKey ? (
                      <p className="unmarked-lessons-empty">
                        Bu ders ileri bir tarihte. Ders günü
                        geldiğinde işaretlenebilir.
                      </p>
                    ) : (
                      <div className="payment-edit-modal-actions">
                        {getLessonActions(
                          selectedLesson
                        ).map((action) => (
                          <button
                            key={action}
                            type="button"
                            className={
                              action === 'Yapıldı' ||
                              action ===
                                'Telafi yapıldı'
                                ? 'save-button'
                                : 'cancel-button'
                            }
                            disabled={Boolean(
                              updatingLessonId
                            )}
                            onClick={async () => {
                              await updateLessonStatus(
                                selectedLesson,
                                action
                              )

                              setSelectedCalendarKey('')
                            }}
                          >
                            {updatingLessonId
                              ? 'Kaydediliyor...'
                              : action === 'Geri al'
                              ? 'İşareti Geri Al'
                              : action}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )
        })()}
        </div>

        {backdatedForm && (
          <div
            className="payment-edit-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeBackdatedForm()
              }
            }}
          >
            <form
              className="payment-edit-modal calendar-lesson-modal backdated-lesson-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="backdated-lesson-title"
              onSubmit={saveBackdatedLesson}
            >
              <div className="payment-edit-modal-heading">
                <div>
                  <span>Geçmiş Tarihli Ders</span>
                  <h2 id="backdated-lesson-title">
                    Geçmiş Ders Ekle
                  </h2>
                  <p>
                    Programda olmayan ama yapılmış bir
                    dersi "Yapıldı" olarak kaydedin. Ders,
                    seçilen tarihle öğretmen hakedişine
                    girer.
                  </p>
                </div>

                <button
                  type="button"
                  className="payment-modal-close-button"
                  onClick={closeBackdatedForm}
                  aria-label="Pencereyi kapat"
                >
                  ×
                </button>
              </div>

              <div className="backdated-form-grid">
                <div className="form-group">
                  <label>Ders Türü</label>
                  <select
                    name="lessonType"
                    value={backdatedForm.lessonType}
                    onChange={handleBackdatedChange}
                  >
                    <option value="individual">
                      Bireysel ders
                    </option>
                    <option value="group">
                      Grup dersi
                    </option>
                  </select>
                </div>

                {backdatedForm.lessonType === 'group' ? (
                  <div className="form-group">
                    <label>Grup Dersi</label>
                    <select
                      name="lessonPlanId"
                      value={backdatedForm.lessonPlanId}
                      onChange={handleBackdatedChange}
                    >
                      <option value="">
                        {groupLessonPlans.length > 0
                          ? 'Grup dersi seçiniz'
                          : 'Planlanmış grup dersi yok'}
                      </option>

                      {groupLessonPlans.map(
                        (lessonPlan) => (
                          <option
                            key={lessonPlan.id}
                            value={lessonPlan.id}
                          >
                            {getGroupName(lessonPlan)}
                            {' · '}
                            {lessonPlan.day}{' '}
                            {lessonPlan.time}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label htmlFor="backdated-student-search">
                        Öğrenci
                      </label>

                      <StudentSearchSelect
                        id="backdated-student-search"
                        students={backdatedStudentOptions}
                        value={backdatedForm.studentId}
                        onChange={(studentId) =>
                          handleBackdatedChange({
                            target: {
                              name: 'studentId',
                              value: studentId
                            }
                          })
                        }
                        getExtraLabel={(student) =>
                          student.isActive === false ||
                          normalizeStatusText(
                            student.status
                          ) === 'pasif'
                            ? '(pasif)'
                            : ''
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label>Paket</label>
                      <select
                        name="packageId"
                        value={backdatedForm.packageId}
                        onChange={handleBackdatedChange}
                        disabled={!backdatedForm.studentId}
                      >
                        <option value="">
                          {backdatedForm.studentId
                            ? backdatedPackageOptions.length > 0
                              ? 'Paket seçiniz'
                              : 'Öğrenciye tanımlı paket yok'
                            : 'Önce öğrenci seçiniz'}
                        </option>

                        {backdatedPackageOptions.map(
                          (item) => (
                            <option
                              key={item.id}
                              value={item.id}
                            >
                              {item.name}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Öğretmen</label>
                  <select
                    name="teacherId"
                    value={backdatedForm.teacherId}
                    onChange={handleBackdatedChange}
                  >
                    <option value="">
                      Öğretmen seçiniz
                    </option>

                    {teachers.map((teacher) => (
                      <option
                        key={teacher.id}
                        value={teacher.id}
                      >
                        {teacher.fullName ||
                          teacher.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Ders Tarihi</label>
                  <input
                    type="date"
                    name="lessonDate"
                    max={todayDateKey}
                    value={backdatedForm.lessonDate}
                    onChange={handleBackdatedChange}
                  />
                </div>

                <div className="form-group">
                  <label>Saat</label>
                  <input
                    type="time"
                    step="300"
                    name="time"
                    value={backdatedForm.time}
                    onChange={handleBackdatedChange}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Not</label>
                  <textarea
                    name="note"
                    value={backdatedForm.note}
                    onChange={handleBackdatedChange}
                    placeholder="Ör. Programa eklenmeyi unutulan ders"
                  />
                </div>
              </div>

              {backdatedEstimate ? (
                <div className="backdated-estimate">
                  <div className="backdated-estimate-head">
                    <span>Tahmini öğretmen hakedişi</span>
                    <strong>
                      {formatMoney(
                        backdatedEstimate.teacherEarning
                      )}
                    </strong>
                  </div>

                  <ul>
                    {backdatedEstimate.rows.map(
                      (row, index) => (
                        <li key={`${row.studentName}-${index}`}>
                          <span>{row.studentName}</span>
                          <b>
                            {formatMoney(row.unitPrice)} / ders
                          </b>
                        </li>
                      )
                    )}
                  </ul>

                  <p>
                    Toplam ders ücreti{' '}
                    {formatMoney(
                      backdatedEstimate.totalUnitPrice
                    )}{' '}
                    × öğretmen yüzdesi %
                    {backdatedEstimate.commissionRate}
                    {backdatedForm.lessonType === 'group'
                      ? ' · Gruptaki her öğrencinin kendi paket ücreti toplanır.'
                      : ''}
                  </p>
                </div>
              ) : (
                <p className="unmarked-lessons-empty">
                  {backdatedForm.lessonType === 'group'
                    ? 'Grup dersi ve öğretmen seçildiğinde hakediş hesabı burada görünür.'
                    : 'Öğrenci, paket ve öğretmen seçildiğinde hakediş hesabı burada görünür.'}
                </p>
              )}

              <div className="payment-edit-modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={closeBackdatedForm}
                  disabled={isSavingBackdated}
                >
                  İptal
                </button>

                <button
                  type="submit"
                  className="save-button"
                  disabled={isSavingBackdated}
                >
                  {isSavingBackdated
                    ? 'Kaydediliyor...'
                    : 'Dersi Kaydet'}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
      </div>
      )}

      <section className="lesson-table-card status-history-card">
        <div className="table-head status-history-head">
          <div>
            <h2>Ders Geçmişi</h2>

            <p>
              Sonuçlanmış ders kayıtları
              Supabase’den sayfa sayfa yüklenir.
            </p>
          </div>

          <span className="lesson-count">
            {historyLoading
              ? '— kayıt'
              : `${historyTotal} kayıt`}
          </span>
        </div>

        <div className="status-history-filters">
          <label>
            Başlangıç Tarihi
            <input
              type="date"
              value={historyStartDate}
              onChange={(event) => {
                setHistoryStartDate(
                  event.target.value
                )
                resetHistoryPage()
              }}
            />
          </label>

          <label>
            Bitiş Tarihi
            <input
              type="date"
              value={historyEndDate}
              onChange={(event) => {
                setHistoryEndDate(
                  event.target.value
                )
                resetHistoryPage()
              }}
            />
          </label>

          <label>
            Sırala
            <select
              value={historySort}
              onChange={(event) => {
                setHistorySort(
                  event.target.value
                )
                resetHistoryPage()
              }}
            >
              <option value="newest">
                En yeni tarih
              </option>
              <option value="oldest">
                En eski tarih
              </option>
            </select>
          </label>

          <label>
            Sayfa başına
            <select
              value={historyPageSize}
              onChange={(event) => {
                setHistoryPageSize(
                  Number(
                    event.target.value
                  )
                )
                setHistoryPage(1)
              }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </label>

          <button
            type="button"
            className="status-history-clear"
            onClick={() => {
              setHistoryStartDate('')
              setHistoryEndDate('')
              setHistorySort('newest')
              setHistoryPage(1)
            }}
          >
            Tarih Filtrelerini Temizle
          </button>
        </div>

        {historyError ? (
          <div className="status-history-message error">
            <span>{historyError}</span>

            <button
              type="button"
              onClick={() =>
                historyQuery.refetch()
              }
            >
              Tekrar Dene
            </button>
          </div>
        ) : (
          <div className="status-history-table-wrapper">
            <table className="lesson-table status-history-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Gün</th>
                  <th>Saat</th>
                  <th>Öğretmen</th>
                  <th>Öğrenci</th>
                  <th>Ders</th>
                  <th>Durum</th>
                  <th>Not</th>
                </tr>
              </thead>

              <tbody>
                {historyLoading ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="empty-table"
                    >
                      Ders geçmişi yükleniyor...
                    </td>
                  </tr>
                ) : historyRows.length > 0 ? (
                  historyRows.map(
                    (lesson) => (
                      <tr key={lesson.id}>
                        <td className="status-history-date-cell">
                          <span className="status-date-text">
                            {lesson.lessonDate
                              ? new Date(
                                  `${lesson.lessonDate}T00:00:00`
                                ).toLocaleDateString(
                                  'tr-TR'
                                )
                              : '—'}
                          </span>
                        </td>

                        <td className="status-history-day-cell">
                          <span className="status-day-text">
                            {lesson.day}
                          </span>
                        </td>

                        <td className="status-history-time-cell">
                          <strong className="status-time-text">
                            {lesson.time}
                          </strong>
                        </td>

                        <td className="status-history-teacher-cell">
                          <span
                            className="status-person-text"
                            title={getTeacherName(
                              lesson
                            )}
                          >
                            {getTeacherName(
                              lesson
                            )}
                          </span>
                        </td>

                        <td className="status-history-student-cell">
                          <span
                            className="status-person-text"
                            title={getLessonDisplaySummary(
                              lesson
                            )}
                          >
                            {getLessonDisplayStudent(
                              lesson
                            )}
                          </span>
                        </td>

                        <td className="status-history-lesson-cell">
                          <div
                            className="status-lesson-detail"
                            title={getLessonTitle(
                              lesson
                            )}
                          >
                            <strong>
                              {getLessonInstrument(
                                lesson
                              )}
                            </strong>
                            <small>
                              {isGroupLessonRecord(
                                lesson
                              )
                                ? `${getGroupStudentCount(
                                    lesson
                                  )} öğrenci`
                                : getLessonTitle(
                                    lesson
                                  )}
                            </small>
                          </div>
                        </td>

                        <td className="status-history-status-cell">
                          <span
                            className={getLessonStatusBadgeClass(
                              lesson.status
                            )}
                          >
                            {getLessonStatusLabel(
                              lesson.status
                            )}
                          </span>
                        </td>

                        <td
                          className={`status-history-note-cell status-note-cell ${
                            lesson.note
                              ? 'has-note'
                              : 'empty-note'
                          }`}
                          title={lesson.note || ''}
                        >
                          <span>
                            {lesson.note || '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  )
                ) : (
                  <tr>
                    <td
                      colSpan="8"
                      className="empty-table"
                    >
                      Seçili filtrelere uygun
                      geçmiş ders kaydı bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="status-history-pagination">
          <span>
            {historyLoading
              ? 'Ders geçmişi yükleniyor...'
              : historyTotal === 0
                ? 'Gösterilecek kayıt yok'
                : `${historyFirstRecord}–${historyLastRecord} / ${historyTotal} kayıt`}
          </span>

          <div>
            <button
              type="button"
              disabled={
                historyPage <= 1 ||
                historyLoading
              }
              onClick={() =>
                setHistoryPage(
                  (current) =>
                    Math.max(
                      1,
                      current - 1
                    )
                )
              }
            >
              Önceki
            </button>

            <span className="status-history-page">
              {historyPage} / {historyTotalPages}
            </span>

            <button
              type="button"
              disabled={
                historyPage >=
                  historyTotalPages ||
                historyLoading
              }
              onClick={() =>
                setHistoryPage(
                  (current) =>
                    Math.min(
                      historyTotalPages,
                      current + 1
                    )
                )
              }
            >
              Sonraki
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default LessonStatusTracking