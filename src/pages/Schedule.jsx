import { useEffect, useRef, useState } from 'react'
import {
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

import {
  createGroupLessonPlan,
  createLessonPlan,
  deleteLessonPlan,
  getLessonPlanStudents
} from '../services/lessonService'

import {
  getLessonGroups,
  getLessonGroupStudents
} from '../services/groupService'
import '../styles/schedule.css'

import {
  doTimeRangesOverlap,
  getCompactLessonStatusLabel,
  getLessonDurationMinutes,
  getLessonStatusClass,
  getLessonTimeRange,
  groupLessonsByStartTime,
  isActiveLesson,
  minutesToTime,
  parseDurationMinutes,
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
const LESSON_GROUPS_QUERY_KEY = [
  'lesson-groups',
  'list',
  {
    includeInactive: true
  }
]

const LESSON_PLAN_STUDENTS_QUERY_KEY = [
  'lesson-plan-students',
  'active'
]

const getLessonGroupStudentsQueryKey = (
  groupId
) => [
  'lesson-groups',
  'students',
  String(groupId || '')
]

function Schedule({
  lessonPlans = [],
  setLessonPlans,
  students = [],
  teachers = [],
  packages = [],
  scheduleLoading = false
}) {
  const queryClient = useQueryClient()

  const days = [
    'Pazartesi',
    'Salı',
    'Çarşamba',
    'Perşembe',
    'Cuma',
    'Cumartesi',
    'Pazar'
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

  const emptyLessonForm = {
    lessonType: 'individual',
    groupId: '',
    groupName: '',
    capacity: '6',
    participants: [],
    studentId: '',
    studentName: '',
    packageId: '',
    packageName: '',
    instrument: '',
    duration: '',
    lessonCount: '',
    totalPrice: '',
    teacherId: '',
    teacher: '',
    day: 'Pazartesi',
    time: ''
  }

  const [lessonForm, setLessonForm] = useState(emptyLessonForm)
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [selectedStudentFilter, setSelectedStudentFilter] = useState('all')
  const [studentSearch, setStudentSearch] = useState('')
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false)
  const [lessonStudentSearch, setLessonStudentSearch] = useState('')
  const [showLessonStudentSuggestions, setShowLessonStudentSuggestions] = useState(false)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [isSavingLesson, setIsSavingLesson] = useState(false)
  const [deletingLessonId, setDeletingLessonId] = useState(null)

  /*
   * Program ekranından çıkıp geri dönüldüğünde grup/katılımcı
   * verilerini yeniden boş loading durumuna düşürme. Son gerçek veri
   * TanStack Query cache'inden anında gösterilir; stale olduğunda
   * arka planda sessizce güncellenir.
   */
  const lessonPlanStudentsQuery = useQuery({
    queryKey:
      LESSON_PLAN_STUDENTS_QUERY_KEY,
    queryFn:
      getLessonPlanStudents
  })

  const lessonPlanStudents =
    lessonPlanStudentsQuery.data ?? []

  const groupLinksLoading =
    lessonPlanStudentsQuery.isPending &&
    lessonPlanStudentsQuery.data ===
      undefined

  /*
   * Ders Grupları sayfasıyla aynı query key kullanılır. Böylece orada
   * eklenen/pasife alınan gruplar Program ekranına geçildiğinde aynı
   * cache üzerinden görülebilir.
   */
  const lessonGroupsQuery = useQuery({
    queryKey:
      LESSON_GROUPS_QUERY_KEY,
    queryFn: () =>
      getLessonGroups({
        includeInactive: true
      })
  })

  const lessonGroups =
    (
      lessonGroupsQuery.data ?? []
    ).filter(
      (group) =>
        group.isActive !== false
    )

  const lessonGroupsLoading =
    lessonGroupsQuery.isPending &&
    lessonGroupsQuery.data ===
      undefined

  const [selectedGroupLoading, setSelectedGroupLoading] =
    useState(false)

  const studentSearchRef = useRef(null)
  const lessonStudentSearchRef = useRef(null)

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

  const getTeacherNameFromRecord = (teacher) =>
    teacher?.fullName || teacher?.name || ''

  const getStudentNameFromRecord = (student) =>
    student?.fullName || student?.name || ''

  const getLessonTeacherName = (lesson) => {
    if (lesson.teacherName) return lesson.teacherName
    if (lesson.teacher) return lesson.teacher

    const teacher = teachers.find(
      (item) => String(item.id) === String(lesson.teacherId)
    )

    return getTeacherNameFromRecord(teacher) || '-'
  }

  const getLessonStudentName = (lesson) => {
    if (lesson.studentName) return lesson.studentName

    const student = students.find(
      (item) => String(item.id) === String(lesson.studentId)
    )

    return getStudentNameFromRecord(student) || '-'
  }

  const getLessonInstrument = (lesson) => {
    if (lesson.instrument) return lesson.instrument

    const packageDetail = packages.find(
      (item) => String(item.id) === String(lesson.packageId)
    )

    return packageDetail?.instrument || lesson.lessonName || 'Ders'
  }

  const getStudentSearchValue = (student) =>
    normalizeSearchText(
      [
        getStudentNameFromRecord(student),
        student?.tcNo
      ]
        .filter(Boolean)
        .join(' ')
    )

  const normalizedStudentSearch = normalizeSearchText(studentSearch)
  const normalizedLessonStudentSearch =
    normalizeSearchText(lessonStudentSearch)

  const lessonStudentSuggestions = activeStudents
    .filter((student) => {
      if (!normalizedLessonStudentSearch) return false

      return getStudentSearchValue(student).includes(
        normalizedLessonStudentSearch
      )
    })
    .sort((firstStudent, secondStudent) =>
      getStudentNameFromRecord(firstStudent).localeCompare(
        getStudentNameFromRecord(secondStudent),
        'tr'
      )
    )
    .slice(0, 8)

  // Yeni ders eklerken yalnızca aktif öğrenciler kullanılır.
  // Ancak program filtresinde geçmiş/arsivli öğrencilerin dersleri de
  // aranabilsin diye öneriler tüm öğrenci kayıtlarından oluşturulur.
  const studentSuggestions = students
    .filter((student) => {
      if (!normalizedStudentSearch) return false
      return getStudentSearchValue(student).includes(normalizedStudentSearch)
    })
    .sort((firstStudent, secondStudent) =>
      getStudentNameFromRecord(firstStudent).localeCompare(
        getStudentNameFromRecord(secondStudent),
        'tr'
      )
    )
    .slice(0, 8)

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target

      if (
        !(target instanceof Element) ||
        !target.closest('.schedule-lesson-action-wrapper')
      ) {
        setOpenMenuId(null)
      }

      if (
        studentSearchRef.current &&
        !studentSearchRef.current.contains(target)
      ) {
        setShowStudentSuggestions(false)
      }

      if (
        lessonStudentSearchRef.current &&
        !lessonStudentSearchRef.current.contains(target)
      ) {
        setShowLessonStudentSuggestions(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenMenuId(null)
        setShowStudentSuggestions(false)
        setShowLessonStudentSuggestions(false)
      }
    }

    const handleScroll = () => {
      setOpenMenuId(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [])

  const selectedStudent = students.find(
    (student) => String(student.id) === String(lessonForm.studentId)
  )

  const getStudentPackages = (student) => {
    if (!student) return []

    if (
      Array.isArray(student.enrolledPackages) &&
      student.enrolledPackages.length > 0
    ) {
      return student.enrolledPackages.map((item) => {
        const packageDetail = packages.find(
          (packageItem) =>
            String(packageItem.id) === String(item.packageId)
        )

        const teacherId = item.teacherId || packageDetail?.teacherId || ''
        const teacherRecord = teachers.find(
          (teacher) => String(teacher.id) === String(teacherId)
        )

        return {
          studentPackageId:
            item.studentPackageId ||
            item.id ||
            '',
          packageId: item.packageId ?? packageDetail?.id ?? '',
          packageName:
            item.packageName ||
            item.name ||
            packageDetail?.name ||
            packageDetail?.packageName ||
            '',
          instrument:
            item.instrument || packageDetail?.instrument || '',
          lessonDuration:
            item.lessonDuration ||
            item.duration ||
            packageDetail?.lessonDuration ||
            packageDetail?.duration ||
            '',
          lessonCount:
            item.lessonCount || packageDetail?.lessonCount || '',
          monthlyFee:
            item.agreedPrice ||
            item.monthlyFee ||
            item.totalPrice ||
            packageDetail?.monthlyFee ||
            packageDetail?.totalPrice ||
            '',
          teacherId,
          teacher:
            item.teacher ||
            item.teacherName ||
            getTeacherNameFromRecord(teacherRecord) ||
            packageDetail?.teacher ||
            packageDetail?.teacherName ||
            ''
        }
      })
    }

    if (student.packageId) {
      const packageDetail = packages.find(
        (item) => String(item.id) === String(student.packageId)
      )

      const teacherId =
        student.teacherId || packageDetail?.teacherId || ''
      const teacherRecord = teachers.find(
        (teacher) => String(teacher.id) === String(teacherId)
      )

      return [
        {
          studentPackageId:
            student.studentPackageId ||
            student.packageEnrollmentId ||
            '',
          packageId: student.packageId,
          packageName:
            student.packageName ||
            packageDetail?.name ||
            packageDetail?.packageName ||
            '',
          instrument:
            student.instrument || packageDetail?.instrument || '',
          lessonDuration:
            student.lessonDuration ||
            packageDetail?.lessonDuration ||
            packageDetail?.duration ||
            '',
          lessonCount:
            student.lessonCount || packageDetail?.lessonCount || '',
          monthlyFee:
            student.monthlyFee ||
            student.totalPrice ||
            packageDetail?.monthlyFee ||
            packageDetail?.totalPrice ||
            '',
          teacherId,
          teacher:
            student.teacher ||
            student.teacherName ||
            getTeacherNameFromRecord(teacherRecord) ||
            packageDetail?.teacher ||
            packageDetail?.teacherName ||
            ''
        }
      ]
    }

    return []
  }

  const studentPackageOptions = getStudentPackages(selectedStudent)

  const selectedPackageInfo = lessonForm.packageId
    ? studentPackageOptions.find(
        (item) => String(item.packageId) === String(lessonForm.packageId)
      )
    : null

  const isGroupMode =
    lessonForm.lessonType === 'group'

  const getParticipantLinksForLesson = (
    lessonId
  ) =>
    lessonPlanStudents.filter(
      (link) =>
        areIdsEqual(
          link.lessonPlanId,
          lessonId
        ) &&
        link.isActive !== false
    )

  const getLessonStudentIds = (lesson) => {
    if (lesson.isGroupLesson) {
      const linkedIds =
        getParticipantLinksForLesson(
          lesson.id
        ).map(
          (link) => link.studentId
        )

      if (linkedIds.length > 0) {
        return linkedIds
      }
    }

    return lesson.studentId
      ? [lesson.studentId]
      : []
  }

  const getGroupParticipantNames = (
    lesson
  ) =>
    getLessonStudentIds(lesson)
      .map((studentId) => {
        const student = students.find(
          (item) =>
            areIdsEqual(
              item.id,
              studentId
            )
        )

        return getStudentNameFromRecord(
          student
        )
      })
      .filter(Boolean)

  const getLessonDisplayStudent = (
    lesson
  ) => {
    if (!lesson.isGroupLesson) {
      return getLessonStudentName(
        lesson
      )
    }

    const names =
      getGroupParticipantNames(
        lesson
      )

    return names.length > 0
      ? `${lesson.groupName || 'Grup Dersi'} · ${names.length} öğrenci`
      : lesson.groupName ||
        'Grup Dersi'
  }

  const sortedLessonPlans = [...lessonPlans].sort((a, b) => {
    const dayDifference =
      (dayOrder[a.day] ?? 99) - (dayOrder[b.day] ?? 99)

    if (dayDifference !== 0) return dayDifference

    return String(a.time || '').localeCompare(String(b.time || ''))
  })

  const filteredLessonPlans = sortedLessonPlans.filter((lesson) => {
    const teacherMatches =
      teacherFilter === 'all' ||
      String(lesson.teacherId || '') === String(teacherFilter) ||
      getLessonTeacherName(lesson) === teacherFilter

    const lessonStudentIds =
      getLessonStudentIds(lesson)

    const lessonStudents =
      lessonStudentIds
        .map((studentId) =>
          students.find(
            (student) =>
              areIdsEqual(
                student.id,
                studentId
              )
          )
        )
        .filter(Boolean)

    const groupSearchValue =
      normalizeSearchText(
        lessonStudents
          .map((student) =>
            getStudentSearchValue(
              student
            )
          )
          .join(' ')
      )

    const studentMatches =
      selectedStudentFilter !== 'all'
        ? lessonStudentIds.some(
            (studentId) =>
              areIdsEqual(
                studentId,
                selectedStudentFilter
              )
          )
        : !normalizedStudentSearch ||
          groupSearchValue.includes(
            normalizedStudentSearch
          )

    return teacherMatches && studentMatches
  })

  const handleLessonChange = (event) => {
    const { name, value } = event.target

    if (name === 'day') {
      setLessonForm((currentForm) => ({
        ...currentForm,
        day: value,
        time: ''
      }))
      return
    }

    setLessonForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }))
  }

  const clearLessonStudentSelection = () => {
    setLessonStudentSearch('')
    setShowLessonStudentSuggestions(false)

    setLessonForm((currentForm) => ({
      ...currentForm,
      studentId: '',
      studentName: '',
      packageId: '',
      packageName: '',
      instrument: '',
      duration: '',
      lessonCount: '',
      totalPrice: '',
      teacherId: '',
      teacher: '',
      time: ''
    }))
  }

  const handleLessonStudentSearchChange = (event) => {
    setLessonStudentSearch(event.target.value)
    setShowLessonStudentSuggestions(true)

    if (lessonForm.studentId) {
      setLessonForm((currentForm) => ({
        ...currentForm,
        studentId: '',
        studentName: '',
        packageId: '',
        packageName: '',
        instrument: '',
        duration: '',
        lessonCount: '',
        totalPrice: '',
        teacherId: '',
        teacher: '',
        time: ''
      }))
    }
  }

  const selectLessonStudent = (student) => {
    if (!student) {
      clearLessonStudentSelection()
      return
    }

    const studentPackages = getStudentPackages(student)
    const firstStudentPackage = studentPackages[0]

    setLessonStudentSearch(
      getStudentNameFromRecord(student)
    )
    setShowLessonStudentSuggestions(false)

    setLessonForm((currentForm) => ({
      ...currentForm,
      studentId: student.id,
      studentName: getStudentNameFromRecord(student),
      packageId: firstStudentPackage?.packageId || '',
      packageName: firstStudentPackage?.packageName || '',
      instrument: firstStudentPackage?.instrument || '',
      duration: firstStudentPackage?.lessonDuration || '',
      lessonCount: firstStudentPackage?.lessonCount || '',
      totalPrice: firstStudentPackage?.monthlyFee || '',
      teacherId: '',
      teacher: '',
      time: ''
    }))
  }

  const handlePackageSelect = (event) => {
    const selectedPackageId = event.target.value

    const selectedPackage = studentPackageOptions.find(
      (item) => String(item.packageId) === String(selectedPackageId)
    )

    if (!selectedPackage) {
      setLessonForm((currentForm) => ({
        ...currentForm,
        packageId: '',
        packageName: '',
        instrument: '',
        duration: '',
        lessonCount: '',
        totalPrice: '',
        teacherId: '',
        teacher: '',
        time: ''
      }))
      return
    }

    setLessonForm((currentForm) => ({
      ...currentForm,
      packageId: selectedPackage.packageId,
      packageName: selectedPackage.packageName,
      instrument: selectedPackage.instrument,
      duration: selectedPackage.lessonDuration,
      lessonCount: selectedPackage.lessonCount,
      totalPrice: selectedPackage.monthlyFee,
      teacherId: '',
      teacher: '',
      time: ''
    }))
  }

  const handleLessonTypeChange = (
    event
  ) => {
    const lessonType =
      event.target.value

    setLessonForm({
      ...emptyLessonForm,
      lessonType,
      day: lessonForm.day
    })
    setLessonStudentSearch('')
    setShowLessonStudentSuggestions(false)
  }

  const handleSavedGroupSelect = async (
    event
  ) => {
    const groupId =
      event.target.value

    if (!groupId) {
      setLessonForm((currentForm) => ({
        ...emptyLessonForm,
        lessonType: 'group',
        day: currentForm.day
      }))
      return
    }

    const selectedGroup =
      lessonGroups.find(
        (group) =>
          areIdsEqual(
            group.id,
            groupId
          )
      )

    if (!selectedGroup) {
      return
    }

    setSelectedGroupLoading(true)

    try {
      const memberships =
        await queryClient.fetchQuery({
          queryKey:
            getLessonGroupStudentsQueryKey(
              selectedGroup.id
            ),
          queryFn: () =>
            getLessonGroupStudents(
              selectedGroup.id
            ),
          staleTime: 30_000
        })

      if (memberships.length === 0) {
        notify(
          'Bu grupta aktif öğrenci yok. Ders planlamak için gruba en az bir öğrenci ekleyiniz.'
        )
      }

      const participants =
        memberships.map(
          (membership) => ({
            studentId:
              membership.studentId,
            studentName:
              membership.studentName,
            packageId:
              membership.packageId,
            packageName:
              membership.packageName,
            studentPackageId:
              membership.studentPackageId,
            instrument:
              membership.specialtyName ||
              selectedGroup.specialtyName,
            duration:
              `${selectedGroup.defaultDurationMinutes} dk`
          })
        )

      setLessonForm((currentForm) => ({
        ...currentForm,
        groupId:
          selectedGroup.id,
        groupName:
          selectedGroup.name,
        capacity:
          String(
            selectedGroup.capacity
          ),
        participants,
        teacherId:
          selectedGroup.defaultTeacherId ||
          '',
        teacher:
          selectedGroup.defaultTeacherName ||
          '',
        duration:
          `${selectedGroup.defaultDurationMinutes} dk`,
        instrument:
          selectedGroup.specialtyName ||
          '',
        packageName:
          selectedGroup.name,
        time: ''
      }))
    } catch (error) {
      console.error(
        'Grup öğrencileri alınamadı:',
        error
      )

      notify(
        error instanceof Error
          ? error.message
          : 'Grup öğrencileri alınamadı.'
      )
    } finally {
      setSelectedGroupLoading(false)
    }
  }

  /*
   * Seçilen gün için öğretmenin ve öğrencilerin dolu olduğu dersler.
   * Saat elle yazıldığı için çakışma, dersin başlangıç ve bitişine
   * (başlangıç + süre) göre hesaplanır.
   */
  const getSelectedStudentIds = () =>
    isGroupMode
      ? lessonForm.participants.map(
          (participant) =>
            participant.studentId
        )
      : lessonForm.studentId
        ? [lessonForm.studentId]
        : []

  const isLessonForSelectedTeacher = (lesson) =>
    Boolean(lessonForm.teacherId) &&
    areIdsEqual(
      lesson.teacherId,
      lessonForm.teacherId
    )

  const isLessonForSelectedStudents = (lesson) => {
    const selectedStudentIds =
      getSelectedStudentIds()

    return getLessonStudentIds(
      lesson
    ).some((studentId) =>
      selectedStudentIds.some(
        (selectedId) =>
          areIdsEqual(
            studentId,
            selectedId
          )
      )
    )
  }

  const getBusyLessonsForSelectedDay = () =>
    lessonPlans
      .filter(
        (lesson) =>
          lesson.day === lessonForm.day &&
          isActiveLesson(lesson) &&
          (
            isLessonForSelectedTeacher(lesson) ||
            isLessonForSelectedStudents(lesson)
          )
      )
      .sort(
        (firstLesson, secondLesson) =>
          (timeToMinutes(firstLesson.time) ?? 0) -
          (timeToMinutes(secondLesson.time) ?? 0)
      )

  const getBlockedLesson = (time) => {
    if (timeToMinutes(time) === null) {
      return null
    }

    const formDuration =
      parseDurationMinutes(
        lessonForm.duration
      )

    const overlaps = (lesson) =>
      doTimeRangesOverlap(
        time,
        formDuration,
        lesson.time,
        getLessonDurationMinutes(lesson)
      )

    const sameDayLessons =
      lessonPlans.filter(
        (lesson) =>
          lesson.day === lessonForm.day &&
          isActiveLesson(lesson) &&
          overlaps(lesson)
      )

    const teacherConflict =
      sameDayLessons.find(
        isLessonForSelectedTeacher
      )

    if (teacherConflict) {
      return {
        message:
          teacherConflict.isGroupLesson
            ? `Öğretmen dolu · ${getLessonTimeRange(
                teacherConflict
              )} · ${
                teacherConflict.groupName ||
                'Grup dersi'
              }`
            : `Öğretmen dolu · ${getLessonTimeRange(
                teacherConflict
              )} · ${getLessonStudentName(
                teacherConflict
              )} / ${getLessonInstrument(
                teacherConflict
              )}`
      }
    }

    const studentConflict =
      sameDayLessons.find(
        isLessonForSelectedStudents
      )

    if (studentConflict) {
      return {
        message:
          studentConflict.isGroupLesson
            ? `Öğrenci dolu · ${getLessonTimeRange(
                studentConflict
              )} · ${
                studentConflict.groupName ||
                'Grup dersi'
              }`
            : `Öğrenci dolu · ${getLessonTimeRange(
                studentConflict
              )} · ${getLessonTeacherName(
                studentConflict
              )} / ${getLessonInstrument(
                studentConflict
              )}`
      }
    }

    return null
  }

  const getSelectedTimeRange = () => {
    const startMinutes =
      timeToMinutes(lessonForm.time)

    if (startMinutes === null) {
      return ''
    }

    return `${minutesToTime(startMinutes)}–${minutesToTime(
      startMinutes +
        parseDurationMinutes(
          lessonForm.duration
        )
    )}`
  }

  const getTimeInputBlocker = () => {
    if (isGroupMode) {
      if (!lessonForm.groupId) {
        return 'Saat yazmadan önce kayıtlı bir grup seçiniz.'
      }

      if (!lessonForm.teacherId) {
        return 'Saat yazmadan önce öğretmen seçiniz.'
      }

      if (lessonForm.participants.length === 0) {
        return 'Seçilen grupta aktif öğrenci yok.'
      }

      return ''
    }

    if (!lessonForm.studentId) {
      return 'Saat yazmadan önce öğrenci seçiniz.'
    }

    if (!lessonForm.packageId) {
      return 'Saat yazmadan önce paket seçiniz.'
    }

    if (!lessonForm.teacherId) {
      return 'Saat yazmadan önce öğretmen seçiniz.'
    }

    return ''
  }

  /*
   * Haftalık tablo gün sütunlarından oluşur: her günün dersleri
   * saat sırasıyla alt alta listelenir.
   */
  const getLessonsForCell = (day) =>
    filteredLessonPlans
      .filter((lesson) => lesson.day === day)
      .sort(
        (firstLesson, secondLesson) =>
          (timeToMinutes(firstLesson.time) ?? 0) -
            (timeToMinutes(secondLesson.time) ?? 0) ||
          getLessonTeacherName(firstLesson).localeCompare(
            getLessonTeacherName(secondLesson),
            'tr'
          )
      )

  const clearFilters = () => {
    setTeacherFilter('all')
    setSelectedStudentFilter('all')
    setStudentSearch('')
    setShowStudentSuggestions(false)
    setOpenMenuId(null)
  }

  const handleStudentSearchChange = (event) => {
    setStudentSearch(event.target.value)
    setSelectedStudentFilter('all')
    setShowStudentSuggestions(true)
  }

  const selectStudentFilter = (student) => {
    setSelectedStudentFilter(String(student.id))
    setStudentSearch(getStudentNameFromRecord(student))
    setShowStudentSuggestions(false)
  }

  const clearStudentFilter = () => {
    setSelectedStudentFilter('all')
    setStudentSearch('')
    setShowStudentSuggestions(false)
  }

  const handleLessonSubmit = async (
    event
  ) => {
    event.preventDefault()

    if (isSavingLesson) {
      return
    }

    if (isGroupMode) {
      if (!lessonForm.groupId) {
        notify('Kayıtlı bir ders grubu seçiniz.')
        return
      }

      if (!lessonForm.teacherId) {
        notify('Öğretmen seçiniz.')
        return
      }

      if (lessonForm.participants.length === 0) {
        notify(
          'Seçilen grupta aktif öğrenci yok. Gruba en az bir öğrenci ekleyiniz.'
        )
        return
      }
    } else {
      if (!lessonForm.studentId) {
        notify('Öğrenci seçiniz.')
        return
      }

      if (!lessonForm.packageId) {
        notify('Paket seçiniz.')
        return
      }

      if (!lessonForm.teacherId) {
        notify('Öğretmen seçiniz.')
        return
      }
    }

    if (!lessonForm.day.trim()) {
      notify('Ders günü seçiniz.')
      return
    }

    if (!lessonForm.time.trim()) {
      notify('Ders saati seçiniz.')
      return
    }

    const blockedLesson =
      getBlockedLesson(
        lessonForm.time
      )

    if (blockedLesson) {
      notify(blockedLesson.message)
      return
    }

    setIsSavingLesson(true)

    try {
      let savedLesson

      if (isGroupMode) {
        savedLesson =
          await createGroupLessonPlan({
            groupId:
              lessonForm.groupId,
            groupName:
              lessonForm.groupName,
            capacity:
              Number(
                lessonForm.capacity
              ),
            teacherId:
              lessonForm.teacherId,
            day:
              lessonForm.day,
            time:
              lessonForm.time,
            duration:
              lessonForm.duration ||
              '60 dk',
            status:
              'Planlandı',
            note: '',
            participants:
              lessonForm.participants
          })

        savedLesson = {
          ...savedLesson,
          teacher:
            getTeacherNameFromRecord(
              teachers.find(
                (teacher) =>
                  areIdsEqual(
                    teacher.id,
                    lessonForm.teacherId
                  )
              )
            ),
          teacherName:
            getTeacherNameFromRecord(
              teachers.find(
                (teacher) =>
                  areIdsEqual(
                    teacher.id,
                    lessonForm.teacherId
                  )
              )
            ),
          participants:
            lessonForm.participants,
          studentIds:
            lessonForm.participants.map(
              (participant) =>
                participant.studentId
            ),
          studentCount:
            lessonForm.participants.length,
          packageName:
            lessonForm.participants[0]
              ?.packageName ||
            '',
          instrument:
            lessonForm.participants[0]
              ?.instrument ||
            ''
        }

        queryClient.setQueryData(
          LESSON_PLAN_STUDENTS_QUERY_KEY,
          (currentLinks = []) => [
            ...currentLinks,
            ...savedLesson.participants.map(
              (participant) => ({
                id:
                  participant.id ||
                  `${savedLesson.id}-${participant.studentId}`,
                lessonPlanId:
                  savedLesson.id,
                studentId:
                  participant.studentId,
                studentPackageId:
                  participant.studentPackageId,
                isActive: true
              })
            )
          ]
        )
      } else {
        savedLesson =
          await createLessonPlan({
            studentId:
              lessonForm.studentId,
            packageId:
              lessonForm.packageId,
            teacherId:
              lessonForm.teacherId,
            day:
              lessonForm.day,
            time:
              lessonForm.time,
            duration:
              lessonForm.duration ||
              '60 dk',
            status:
              'Planlandı',
            note: '',
            isMakeup: false,
            relatedLessonId: null
          })
      }

      notify.success('Ders planı kaydedildi.')

      setLessonPlans(
        (currentLessons) => [
          ...currentLessons,
          savedLesson
        ]
      )

      setLessonForm({
        ...emptyLessonForm,
        lessonType:
          lessonForm.lessonType,
        day:
          lessonForm.day
      })
      setLessonStudentSearch('')
      setShowLessonStudentSuggestions(false)
    } catch (error) {
      console.error(
        'Ders planı kaydetme hatası:',
        error
      )

      notify(
        error instanceof Error
          ? error.message
          : 'Ders planı kaydedilemedi.'
      )
    } finally {
      setIsSavingLesson(false)
    }
  }

  const deleteLesson = async (lessonId) => {
    if (deletingLessonId) {
      return
    }

    const isConfirmed = await confirmDialog(
      'Bu ders planını silmek istediğinize emin misiniz?'
    )

    if (!isConfirmed) {
      return
    }

    setDeletingLessonId(lessonId)

    try {
      await deleteLessonPlan(lessonId)

      notify.success('Ders planı silindi.')

      setLessonPlans((currentLessons) =>
        currentLessons.filter(
          (lesson) =>
            !areIdsEqual(
              lesson.id,
              lessonId
            )
        )
      )

      queryClient.setQueryData(
        LESSON_PLAN_STUDENTS_QUERY_KEY,
        (currentLinks = []) =>
          currentLinks.filter(
            (link) =>
              !areIdsEqual(
                link.lessonPlanId,
                lessonId
              )
          )
      )

      setOpenMenuId(null)
    } catch (error) {
      console.error(
        'Ders planı silme hatası:',
        error
      )

      notify(
        error instanceof Error
          ? error.message
          : 'Ders planı silinemedi.'
      )
    } finally {
      setDeletingLessonId(null)
    }
  }

  return (
    <div className="dashboard-shell">
      <section className="page-card">
        <div>
          <span className="page-badge">Ders Programı</span>
          <h1>Ders Programı Yönetimi</h1>
          <p>
            Bireysel öğrenciler veya kayıtlı ders grupları için haftalık program oluşturun.
          </p>
        </div>

        <button className="manage-button" type="button">
          {scheduleLoading ||
          groupLinksLoading
            ? '— ders'
            : `${lessonPlans.length} ders`}
        </button>
      </section>

      <section className="schedule-layout">
        <form
          className="schedule-form-card compact-schedule-form"
          onSubmit={handleLessonSubmit}
        >
          <div className="schedule-card-heading">
            <div>
              <span>Yeni Kayıt</span>
              <h2>Yeni Ders Ekle</h2>
              <p>Bireysel öğrenci veya kayıtlı grup seçerek uygun ders saatini belirleyin.</p>
            </div>
          </div>

          <div className="form-grid schedule-form-grid">
            <div className="form-group full-width">
              <label>Ders Türü</label>
              <select
                value={lessonForm.lessonType}
                onChange={handleLessonTypeChange}
              >
                <option value="individual">
                  Bireysel Ders
                </option>
                <option value="group">
                  Grup Dersi
                </option>
              </select>
            </div>

            {isGroupMode ? (
              <>
                <div className="form-group full-width">
                  <label>Kayıtlı Ders Grubu</label>

                  <select
                    value={lessonForm.groupId}
                    onChange={handleSavedGroupSelect}
                    disabled={
                      lessonGroupsLoading ||
                      selectedGroupLoading
                    }
                  >
                    <option value="">
                      {lessonGroupsLoading
                        ? 'Gruplar yükleniyor...'
                        : 'Grup seçiniz'}
                    </option>

                    {lessonGroups.map(
                      (group) => (
                        <option
                          key={group.id}
                          value={group.id}
                        >
                          {group.name}
                          {' · '}
                          {group.specialtyName}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {lessonForm.groupId && (
                  <div className="selected-package-box full-width">
                    <div>
                      <span>Seçilen Grup</span>
                      <strong>
                        {lessonForm.groupName}
                      </strong>
                    </div>

                    <div className="package-mini-grid">
                      <p>
                        <b>Branş:</b>{' '}
                        {lessonForm.instrument ||
                          '-'}
                      </p>

                      <p>
                        <b>Öğrenci:</b>{' '}
                        {lessonForm.participants.length}
                      </p>

                      <p>
                        <b>Kontenjan:</b>{' '}
                        {lessonForm.capacity}
                      </p>

                      <p>
                        <b>Süre:</b>{' '}
                        {lessonForm.duration ||
                          '-'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>Öğretmen</label>

                  <select
                    name="teacherId"
                    value={lessonForm.teacherId}
                    onChange={handleLessonChange}
                    disabled={!lessonForm.groupId}
                  >
                    <option value="">
                      {!lessonForm.groupId
                        ? 'Önce grup seçiniz'
                        : 'Öğretmen seçiniz'}
                    </option>

                    {activeTeachers.map(
                      (teacher) => (
                        <option
                          key={teacher.id}
                          value={teacher.id}
                        >
                          {getTeacherNameFromRecord(
                            teacher
                          )}
                        </option>
                      )
                    )}
                  </select>
                </div>

              </>
            ) : (
              <>
                <div
                  className="form-group schedule-student-filter-group"
                  ref={lessonStudentSearchRef}
                >
                  <label htmlFor="lesson-student-search">
                    Öğrenci
                  </label>

                  <div className="schedule-student-search-control">
                    <span
                      className="schedule-student-search-icon"
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-4-4" />
                      </svg>
                    </span>

                    <input
                      id="lesson-student-search"
                      type="text"
                      value={lessonStudentSearch}
                      onChange={handleLessonStudentSearchChange}
                      onFocus={() =>
                        setShowLessonStudentSuggestions(true)
                      }
                      placeholder="Ad veya TC yazarak ara"
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={showLessonStudentSuggestions}
                      aria-controls="lesson-student-results"
                    />

                    {lessonStudentSearch && (
                      <button
                        type="button"
                        className="schedule-student-search-clear"
                        onClick={clearLessonStudentSelection}
                        aria-label="Seçili öğrenciyi temizle"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {showLessonStudentSuggestions &&
                    normalizedLessonStudentSearch && (
                    <div
                      id="lesson-student-results"
                      className="schedule-student-search-results"
                      role="listbox"
                    >
                      {lessonStudentSuggestions.length > 0 ? (
                        lessonStudentSuggestions.map((student) => (
                          <button
                            type="button"
                            className={`schedule-student-search-result ${
                              String(lessonForm.studentId) ===
                              String(student.id)
                                ? 'selected'
                                : ''
                            }`}
                            key={student.id}
                            onClick={() =>
                              selectLessonStudent(student)
                            }
                            role="option"
                            aria-selected={
                              String(lessonForm.studentId) ===
                              String(student.id)
                            }
                          >
                            <span className="schedule-student-result-avatar">
                              {getStudentNameFromRecord(student)
                                .charAt(0)
                                .toLocaleUpperCase('tr-TR') || '?'}
                            </span>

                            <span className="schedule-student-result-content">
                              <strong>
                                {getStudentNameFromRecord(student)}
                              </strong>
                              <small>
                                {student.tcNo
                                  ? `TC: ${student.tcNo}`
                                  : 'TC bilgisi yok'}
                              </small>
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="schedule-student-search-empty">
                          Eşleşen aktif öğrenci bulunamadı.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Paket</label>
                  <select
                    name="packageId"
                    value={lessonForm.packageId}
                    onChange={handlePackageSelect}
                    disabled={!lessonForm.studentId}
                  >
                    <option value="">
                      {lessonForm.studentId
                        ? 'Paket seçiniz'
                        : 'Önce öğrenci seçiniz'}
                    </option>

                    {studentPackageOptions.map(
                      (item) => (
                        <option
                          key={item.packageId}
                          value={item.packageId}
                        >
                          {item.packageName}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {selectedPackageInfo && (
                  <div className="selected-package-box full-width">
                    <div>
                      <span>Seçilen Paket</span>
                      <strong>
                        {selectedPackageInfo.packageName}
                      </strong>
                    </div>

                    <div className="package-mini-grid">
                      <p>
                        <b>Ders:</b>{' '}
                        {selectedPackageInfo.instrument ||
                          '-'}
                      </p>
                      <p>
                        <b>Paket Öğretmeni:</b>{' '}
                        {selectedPackageInfo.teacher ||
                          '-'}
                      </p>
                      <p>
                        <b>Süre:</b>{' '}
                        {selectedPackageInfo.lessonDuration ||
                          '-'}
                      </p>
                      <p>
                        <b>Ders Adedi:</b>{' '}
                        {selectedPackageInfo.lessonCount ||
                          '-'}
                      </p>
                      <p>
                        <b>Ücret:</b>{' '}
                        ₺{selectedPackageInfo.monthlyFee ||
                          0}
                      </p>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>Öğretmen</label>

                  <select
                    name="teacherId"
                    value={lessonForm.teacherId}
                    onChange={handleLessonChange}
                    disabled={!lessonForm.packageId}
                  >
                    <option value="">
                      {!lessonForm.packageId
                        ? 'Önce paket seçiniz'
                        : 'Öğretmen seçiniz'}
                    </option>

                    {activeTeachers.map(
                      (teacher) => (
                        <option
                          key={teacher.id}
                          value={teacher.id}
                        >
                          {getTeacherNameFromRecord(
                            teacher
                          )}
                        </option>
                      )
                    )}
                  </select>
                </div>

              </>
            )}
          </div>

          <div className="schedule-time-section">
            <div className="form-group schedule-day-group">
              <label>Gün</label>
              <div
                className="schedule-day-picker"
                role="radiogroup"
                aria-label="Ders günü"
              >
                {days.map((day) => (
                  <button
                    key={day}
                    type="button"
                    role="radio"
                    aria-checked={lessonForm.day === day}
                    className={`schedule-day-chip ${
                      lessonForm.day === day ? 'active' : ''
                    }`}
                    onClick={() =>
                      handleLessonChange({
                        target: { name: 'day', value: day }
                      })
                    }
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group schedule-time-group">
              <label htmlFor="lesson-time">Ders Saati</label>
              <input
                id="lesson-time"
                type="time"
                step="300"
                value={lessonForm.time}
                disabled={Boolean(
                  getTimeInputBlocker()
                )}
                onChange={(event) =>
                  setLessonForm((currentForm) => ({
                    ...currentForm,
                    time: event.target.value
                  }))
                }
              />
            </div>
          </div>

          <div className="schedule-form-footer">
            <div className="manual-time-panel">
              {(() => {
                const inputBlocker =
                  getTimeInputBlocker()

                if (inputBlocker) {
                  return (
                    <p className="manual-time-status pending">
                      {inputBlocker}
                    </p>
                  )
                }

                const blockedLesson =
                  lessonForm.time
                    ? getBlockedLesson(
                        lessonForm.time
                      )
                    : null

                const busyLessons =
                  getBusyLessonsForSelectedDay()

                return (
                  <>
                    {!lessonForm.time ? (
                      <p className="manual-time-status pending">
                        Ders saatini yazınız (ör. 14:30). Ders süresi:{' '}
                        {parseDurationMinutes(
                          lessonForm.duration
                        )}{' '}
                        dk.
                      </p>
                    ) : blockedLesson ? (
                      <p className="manual-time-status blocked">
                        {getSelectedTimeRange()} uygun değil ·{' '}
                        {blockedLesson.message}
                      </p>
                    ) : (
                      <p className="manual-time-status available">
                        {getSelectedTimeRange()} uygun.
                      </p>
                    )}

                    {busyLessons.length > 0 && (
                      <div className="manual-time-busy">
                        <span>{lessonForm.day} dolu saatler:</span>

                        <ul>
                          {busyLessons.map((lesson) => (
                            <li
                              key={lesson.id}
                              title={
                                lesson.isGroupLesson
                                  ? lesson.groupName ||
                                    'Grup dersi'
                                  : `${getLessonStudentName(
                                      lesson
                                    )} / ${getLessonInstrument(
                                      lesson
                                    )}`
                              }
                            >
                              <b>{getLessonTimeRange(lesson)}</b>
                              <span>
                                {isLessonForSelectedTeacher(lesson)
                                  ? 'Öğretmen'
                                  : 'Öğrenci'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            <button
              className="save-button schedule-save-button"
              type="submit"
              disabled={
                isSavingLesson ||
                scheduleLoading
              }
            >
              {isSavingLesson
                ? 'Kaydediliyor...'
                : 'Ders Planını Kaydet'}
            </button>
          </div>
        </form>

      </section>

      <section className="lesson-table-card schedule-filter-card">
        <div className="schedule-filter-grid">
          <div className="form-group">
            <label>Öğretmene Göre Filtrele</label>
            <select
              value={teacherFilter}
              onChange={(event) => setTeacherFilter(event.target.value)}
            >
              <option value="all">Tüm öğretmenler</option>
              {activeTeachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {getTeacherNameFromRecord(teacher)}
                </option>
              ))}
            </select>
          </div>

          <div
            className="form-group schedule-student-filter-group"
            ref={studentSearchRef}
          >
            <label htmlFor="schedule-student-search">Öğrenci Ara</label>

            <div className="schedule-student-search-control">
              <span className="schedule-student-search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4-4" />
                </svg>
              </span>

              <input
                id="schedule-student-search"
                type="text"
                value={studentSearch}
                onChange={handleStudentSearchChange}
                onFocus={() => setShowStudentSuggestions(true)}
                placeholder="Ad veya TC ile ara"
                autoComplete="off"
                role="combobox"
                aria-expanded={showStudentSuggestions}
                aria-controls="schedule-student-results"
              />

              {studentSearch && (
                <button
                  type="button"
                  className="schedule-student-search-clear"
                  onClick={clearStudentFilter}
                  aria-label="Öğrenci filtresini temizle"
                >
                  ×
                </button>
              )}
            </div>

            {showStudentSuggestions && normalizedStudentSearch && (
              <div
                id="schedule-student-results"
                className="schedule-student-search-results"
                role="listbox"
              >
                {studentSuggestions.length > 0 ? (
                  studentSuggestions.map((student) => (
                    <button
                      type="button"
                      className={`schedule-student-search-result ${
                        String(selectedStudentFilter) === String(student.id)
                          ? 'selected'
                          : ''
                      }`}
                      key={student.id}
                      onClick={() => selectStudentFilter(student)}
                      role="option"
                      aria-selected={
                        String(selectedStudentFilter) === String(student.id)
                      }
                    >
                      <span className="schedule-student-result-avatar">
                        {getStudentNameFromRecord(student)
                          .charAt(0)
                          .toLocaleUpperCase('tr-TR') || '?'}
                      </span>

                      <span className="schedule-student-result-content">
                        <strong>{getStudentNameFromRecord(student)}</strong>
                        <small>
                          {student.tcNo
                            ? `TC: ${student.tcNo}`
                            : 'TC bilgisi yok'}
                        </small>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="schedule-student-search-empty">
                    Eşleşen öğrenci bulunamadı.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>&nbsp;</label>
            <button
              type="button"
              className="cancel-button"
              onClick={clearFilters}
            >
              Filtreleri Temizle
            </button>
          </div>
        </div>
      </section>

      <section className="weekly-schedule-card schedule-weekly-card">
        <div className="table-head">
          <div>
            <h2>Haftalık Ders Programı</h2>
            <p>
              Tüm dersleri haftalık tablo olarak görüntüleyin. Öğretmen veya öğrenciye göre filtreleyebilirsiniz.
            </p>
          </div>

          <button className="lesson-count" type="button">
            {scheduleLoading
              ? '— ders'
              : `${filteredLessonPlans.length} ders`}
          </button>
        </div>

        <div className="weekly-table-wrapper schedule-weekly-wrapper">
          <table className="weekly-schedule-table schedule-weekly-table day-column-table">
            <thead>
              <tr>
                {days.map((day) => (
                  <th key={day}>{day}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {scheduleLoading ? (
                <tr>
                  <td
                    colSpan={days.length}
                    className="empty-table"
                  >
                    Ders programı yükleniyor...
                  </td>
                </tr>
              ) : (
                <tr className="day-column-row">

                    {days.map((day) => {
                      const cellKey = day
                      const cellLessons = getLessonsForCell(day)
                      const visibleLessons = cellLessons

                      return (
                        <td
                          key={cellKey}
                          className={
                            cellLessons.length > 0
                              ? 'schedule-cell-has-lessons'
                              : ''
                          }
                        >
                          {cellLessons.length > 0 ? (
                            <div className="schedule-cell-stack">
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

                                  {timeGroup.lessons.map((lesson) => {
                              const compactStatus = getCompactLessonStatusLabel(
                                lesson.status
                              )

                              return (
                                <div
                                  key={lesson.id}
                                  className={`${getLessonStatusClass(
                                    lesson.status,
                                    'schedule-lesson-card'
                                  )} ${
                                    areIdsEqual(openMenuId, lesson.id) ? 'menu-open' : ''
                                  }`}
                                >
                                  <div className="schedule-card-top">
                                    <div className="schedule-card-text">
                                      <small className="schedule-card-time">
                                        {getLessonTimeRange(lesson)}
                                      </small>

                                      <div className="schedule-teacher-line">
                                        <strong
                                          title={getLessonTeacherName(lesson)}
                                        >
                                          {getLessonTeacherName(lesson)}
                                        </strong>
                                      </div>

                                      <span
                                        title={`${getLessonDisplayStudent(
                                          lesson
                                        )} • ${getLessonInstrument(lesson)}`}
                                      >
                                        {getLessonDisplayStudent(lesson)}
                                        <b>•</b>
                                        {getLessonInstrument(lesson)}
                                      </span>

                                      {compactStatus && <em>{compactStatus}</em>}
                                    </div>

                                    <div className="schedule-lesson-action-wrapper">
                                      <button
                                        type="button"
                                        className="schedule-lesson-menu-button"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          setOpenMenuId(
                                            areIdsEqual(openMenuId, lesson.id)
                                              ? null
                                              : lesson.id
                                          )
                                        }}
                                        aria-label="Ders işlemleri"
                                      >
                                        ⋯
                                      </button>

                                      {areIdsEqual(openMenuId, lesson.id) && (
                                        <div className="schedule-lesson-action-menu">
                                          <button
                                            type="button"
                                            className="danger"
                                            onClick={() => deleteLesson(lesson.id)}
                                            disabled={
                                              areIdsEqual(
                                                deletingLessonId,
                                                lesson.id
                                              )
                                            }
                                          >
                                            {areIdsEqual(
                                              deletingLessonId,
                                              lesson.id
                                            )
                                              ? 'Siliniyor...'
                                              : 'Dersi Sil'}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                                </div>
                              )
                            )}

                          </div>
                        ) : (
                          <span className="weekly-empty schedule-empty-slot">
                            Ders yok
                          </span>
                        )}
                      </td>
                    )
                    })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="lesson-table-card schedule-list-card">
        <div className="table-head">
          <div>
            <h2>Tüm Ders Listesi</h2>
            <p>Seçili filtrelere göre kayıtlı derslerin detaylı görünümü</p>
          </div>

          <button className="lesson-count" type="button">
            {scheduleLoading
              ? '— ders'
              : `${filteredLessonPlans.length} ders`}
          </button>
        </div>

        <div className="payment-table-wrapper">
          <table className="lesson-table schedule-detail-table">
            <thead>
              <tr>
                <th>Gün</th>
                <th>Saat</th>
                <th>Öğretmen</th>
                <th>Öğrenci</th>
                <th>Ders</th>
                <th>Süre</th>
                <th>İşlem</th>
              </tr>
            </thead>

            <tbody>
              {scheduleLoading ? (
                <tr>
                  <td
                    colSpan="7"
                    className="empty-table"
                  >
                    Ders programı yükleniyor...
                  </td>
                </tr>
              ) : filteredLessonPlans.length > 0 ? (
                filteredLessonPlans.map((lesson) => (
                  <tr key={lesson.id}>
                    <td>
                      <span className="schedule-day-text">{lesson.day}</span>
                    </td>
                    <td>
                      <span className="schedule-time-text">{lesson.time}</span>
                    </td>
                    <td>
                      <span className="schedule-person-text">
                        {getLessonTeacherName(lesson)}
                      </span>
                    </td>
                    <td>
                      <span className="schedule-person-text">
                        {getLessonDisplayStudent(lesson)}
                      </span>
                    </td>
                    <td>
                      <div className="schedule-lesson-detail">
                        <strong>{getLessonInstrument(lesson)}</strong>
                        <small>{lesson.packageName || 'Paket bilgisi yok'}</small>
                      </div>
                    </td>
                    <td>
                      <span className="schedule-duration-pill">
                        {lesson.duration || '-'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="schedule-table-delete-button"
                        type="button"
                        onClick={() => deleteLesson(lesson.id)}
                        disabled={
                          areIdsEqual(
                            deletingLessonId,
                            lesson.id
                          )
                        }
                      >
                        {areIdsEqual(
                          deletingLessonId,
                          lesson.id
                        )
                          ? 'Siliniyor...'
                          : 'Sil'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty-table">
                    Filtreye uygun ders programı bulunmamaktadır.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default Schedule