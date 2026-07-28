import { useEffect, useRef, useState } from 'react'

import {
  createLessonOccurrence,
  deleteLessonOccurrence,
  getLessonHistoryPage,
  updateLessonOccurrenceStatus
} from '../services/lessonService'
import '../styles/status.css'

import {
  getCompactLessonStatusLabel,
  getLessonStatusBadgeClass,
  getLessonStatusClass,
  getLessonStatusLabel,
  isActiveLesson,
  isMakeupLesson,
  normalizeLessonStatus
} from '../utils/lessonHelpers'

import {
  areIdsEqual,
  normalizeSearchText,
  normalizeStatusText
} from '../utils/textHelpers'

function LessonStatusTracking({
  lessons = [],
  lessonPlans = [],
  setLessons,
  teachers = [],
  students = [],
  packages = [],
  unsavedChanges
}) {
  const days = [
    'Pazartesi',
    'Salı',
    'Çarşamba',
    'Perşembe',
    'Cuma',
    'Cumartesi',
    'Pazar'
  ]

  const hours = [
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
    '20:00',
    '21:00',
    '22:00'
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

  const emptyMakeupForm = {
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

  const [expandedCells, setExpandedCells] =
    useState({})

  const [updatingLessonId, setUpdatingLessonId] =
    useState(null)

  const [deletingLessonId, setDeletingLessonId] =
    useState(null)

  const [isSavingMakeup, setIsSavingMakeup] =
    useState(false)

  const [
    historyRows,
    setHistoryRows
  ] = useState([])

  const [
    historyTotal,
    setHistoryTotal
  ] = useState(0)

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

  const [
    historyLoading,
    setHistoryLoading
  ] = useState(false)

  const [
    historyError,
    setHistoryError
  ] = useState('')

  const [
    historyReloadKey,
    setHistoryReloadKey
  ] = useState(0)

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
        student?.phone,
        student?.motherPhone,
        student?.fatherPhone,
        student?.tcNo,
        student?.email
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

  const getSelectedStudent = () => {
    return students.find(
      (student) =>
        areIdsEqual(
        student.id,
        makeupForm.studentId
      )
    )
  }

  const getStudentPackageOptions = () => {
    const student = getSelectedStudent()

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

    const lessonStudent = students.find(
      (student) =>
        areIdsEqual(
          student.id,
          lesson.studentId
        )
    )

    const lessonStudentSearchValue =
      normalizeSearchText(
        [
          getStudentName(lesson),
          lessonStudent?.phone,
          lessonStudent?.motherPhone,
          lessonStudent?.fatherPhone,
          lessonStudent?.tcNo,
          lessonStudent?.email
        ]
          .filter(Boolean)
          .join(' ')
      )

    const studentMatch =
      selectedStudent !== 'all'
        ? areIdsEqual(
            lesson.studentId,
            selectedStudent
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

  /*
   * Üst haftalık tablo güncel lesson_plans kayıtlarını gösterir.
   * Occurrence kaydı varsa yalnızca dersin güncel durumunu ekler.
   * Programdan silinen plan bu tablodan hemen çıkar.
   */
  const occurrenceByPlanId = new Map(
    lessons
      .filter(
        (lesson) =>
          lesson.lessonPlanId
      )
      .map(
        (lesson) => [
          String(
            lesson.lessonPlanId
          ),
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
        const occurrence =
          occurrenceByPlanId.get(
            String(lesson.id)
          )

        return {
          ...lesson,
          occurrenceId:
            occurrence?.id || '',
          lessonPlanId:
            lesson.id,
          status:
            occurrence?.status ||
            'Planlandı',
          note:
            occurrence?.note ||
            lesson.note ||
            '',
          isMakeup:
            occurrence?.isMakeup === true
        }
      })

  /*
   * Plan tablosunda yer almayan ve henüz sonuçlanmamış telafi
   * dersleri de güncel haftalık takip tablosunda gösterilir.
   */
  const pendingMakeupLessons =
    lessons.filter((lesson) => {
      const status =
        normalizeLessonStatus(
          lesson.status
        )

      return (
        isMakeupLesson(lesson) &&
        (
          status ===
            'Telafi yapılacak' ||
          status === 'Planlandı'
        )
      )
    })

  const weeklyLessons = [
    ...currentScheduleLessons,
    ...pendingMakeupLessons
  ].filter(matchesCurrentFilters)

  useEffect(() => {
    let isMounted = true

    const timeoutId =
      window.setTimeout(
        async () => {
          setHistoryLoading(true)
          setHistoryError('')

          try {
            const result =
              await getLessonHistoryPage({
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
              })

            if (!isMounted) {
              return
            }

            const totalPages =
              Math.max(
                1,
                Math.ceil(
                  result.total /
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
              return
            }

            setHistoryRows(
              result.data
            )
            setHistoryTotal(
              result.total
            )
          } catch (error) {
            console.error(
              'Ders geçmişi alınamadı:',
              error
            )

            if (isMounted) {
              setHistoryError(
                error instanceof Error
                  ? error.message
                  : 'Ders geçmişi alınamadı.'
              )
            }
          } finally {
            if (isMounted) {
              setHistoryLoading(false)
            }
          }
        },
        150
      )

    return () => {
      isMounted = false
      window.clearTimeout(
        timeoutId
      )
    }
  }, [
    historyPage,
    historyPageSize,
    selectedTeacher,
    selectedStudent,
    selectedStatus,
    historyStartDate,
    historyEndDate,
    historySort,
    historyReloadKey
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

  const getLessonsByDayAndHour = (
    day,
    hour
  ) => {
    return weeklyLessons
      .filter(
        (lesson) =>
          lesson.day === day &&
          lesson.time === hour
      )
      .sort(
        (
          firstLesson,
          secondLesson
        ) =>
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

  const toggleCellExpansion = (cellKey) => {
    setExpandedCells((current) => ({
      ...current,
      [cellKey]: !current[cellKey]
    }))
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
    lessonId,
    newStatus
  ) => {
    if (updatingLessonId) {
      return
    }

    const currentLesson =
      lessons.find(
        (lesson) =>
          areIdsEqual(
            lesson.id,
            lessonId
          )
      ) ||
      weeklyLessons.find(
        (lesson) =>
          areIdsEqual(
            lesson.occurrenceId,
            lessonId
          ) ||
          areIdsEqual(
            lesson.id,
            lessonId
          )
      )

    if (!currentLesson) {
      return
    }

    const statusToSave =
      newStatus === 'Geri al'
        ? (
            isMakeupLesson(currentLesson)
              ? 'Telafi yapılacak'
              : 'Planlandı'
          )
        : newStatus

    setUpdatingLessonId(lessonId)

    try {
      const updatedLesson =
        await updateLessonOccurrenceStatus(
          lessonId,
          statusToSave
        )

      setLessons((currentLessons) =>
        currentLessons.map((lesson) =>
          areIdsEqual(
            lesson.id,
            lessonId
          )
            ? updatedLesson
            : lesson
        )
      )

      setHistoryReloadKey(
        (current) => current + 1
      )

      setOpenMenuId(null)
    } catch (error) {
      console.error(
        'Ders durumu güncelleme hatası:',
        error
      )

      alert(
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
      window.confirm(
        'Bu telafi dersini kaldırmak istediğinize emin misiniz?'
      )

    if (!confirmDelete) {
      return
    }

    setDeletingLessonId(lessonId)

    try {
      await deleteLessonOccurrence(lessonId)

      setLessons((currentLessons) =>
        currentLessons.filter(
          (lesson) =>
            !areIdsEqual(
              lesson.id,
              lessonId
            )
        )
      )

      setHistoryReloadKey(
        (current) => current + 1
      )

      setOpenMenuId(null)
    } catch (error) {
      console.error(
        'Telafi dersi silme hatası:',
        error
      )

      alert(
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

  const hasConflict = () => {
    return lessons.some((lesson) => {
      const sameDay =
        lesson.day === makeupForm.day

      const sameTime =
        lesson.time === makeupForm.time

      const sameTeacher = areIdsEqual(
        getTeacherId(lesson),
        makeupForm.teacherId
      )

      const sameStudent = areIdsEqual(
        lesson.studentId,
        makeupForm.studentId
      )

      const isSameSlot =
        sameDay && sameTime

      return (
        isSameSlot &&
        isActiveLesson(lesson) &&
        (sameTeacher || sameStudent)
      )
    })
  }

  const saveMakeupLesson = async (event) => {
    event.preventDefault()

    if (isSavingMakeup) {
      return
    }

    if (!makeupForm.studentId) {
      alert('Öğrenci seçilmelidir.')
      return
    }

    if (!makeupForm.teacherId) {
      alert('Öğretmen seçilmelidir.')
      return
    }

    if (!makeupForm.packageId) {
      alert(
        'Öğrenciye tanımlı bir paket seçilmelidir.'
      )
      return
    }

    if (!makeupForm.day) {
      alert('Gün seçilmelidir.')
      return
    }

    if (!makeupForm.time) {
      alert('Saat seçilmelidir.')
      return
    }

    if (hasConflict()) {
      alert(
        'Seçilen gün ve saatte öğretmen veya öğrenci için çakışma bulunmaktadır.'
      )
      return
    }

    setIsSavingMakeup(true)

    try {
      const savedLesson =
        await createLessonOccurrence({
          teacherId:
            makeupForm.teacherId,
          studentId:
            makeupForm.studentId,
          packageId:
            makeupForm.packageId,
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

      setLessons((currentLessons) => [
        ...currentLessons,
        savedLesson
      ])

      unsavedChanges?.markClean?.()
      performCloseMakeupForm()
    } catch (error) {
      console.error(
        'Telafi dersi kaydetme hatası:',
        error
      )

      alert(
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
                placeholder="Ad, telefon veya TC ile ara"
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
                Öğrenciye tanımlı paketlerden
                birini seçerek telafi dersini
                planlayın.
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
                <label>Öğrenci</label>

                <select
                  name="studentId"
                  value={makeupForm.studentId}
                  onChange={handleMakeupChange}
                >
                  <option value="">
                    Öğrenci seçiniz
                  </option>

                  {activeStudents.map(
                    (student) => (
                      <option
                        key={student.id}
                        value={student.id}
                      >
                        {student.fullName ||
                          student.name}
                      </option>
                    )
                  )}
                </select>
              </div>

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

                <select
                  name="time"
                  value={makeupForm.time}
                  onChange={handleMakeupChange}
                >
                  {hours.map((hour) => (
                    <option
                      key={hour}
                      value={hour}
                    >
                      {hour}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width">
                {makeupForm.packageId ? (
                  <div className="selected-package-card">
                    <span>Seçilen Paket</span>

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
                    </div>
                  </div>
                ) : (
                  <div className="selected-package-card empty">
                    <span>
                      Öğrenci ve paket seçimi
                      tamamlandığında ders
                      bilgileri burada
                      görüntülenecektir.
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
          <table className="weekly-schedule-table status-weekly-table">
            <thead>
              <tr>
                <th>Saat</th>

                {days.map((day) => (
                  <th key={day}>
                    {day}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {hours.map((hour) => (
                <tr key={hour}>
                  <td className="schedule-hour">
                    {hour}
                  </td>

                  {days.map((day) => {
                    const cellKey = `${day}-${hour}`

                    const cellLessons =
                      getLessonsByDayAndHour(
                        day,
                        hour
                      )

                    const isExpanded =
                      Boolean(
                        expandedCells[cellKey]
                      )

                    const visibleLessons =
                      isExpanded
                        ? cellLessons
                        : cellLessons.slice(0, 2)

                    const hiddenLessonCount =
                      Math.max(
                        0,
                        cellLessons.length - 2
                      )

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
                            {visibleLessons.map(
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
                                          title={`${getStudentName(
                                            lesson
                                          )} • ${getLessonInstrument(
                                            lesson
                                          )}`}
                                        >
                                          {getStudentName(
                                            lesson
                                          )}
                                          <b>•</b>
                                          {getLessonInstrument(
                                            lesson
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
                                                      lesson.occurrenceId ||
                                                        lesson.id,
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

                            {cellLessons.length > 2 && (
                              <button
                                type="button"
                                className="status-more-button"
                                aria-expanded={
                                  isExpanded
                                }
                                onClick={() =>
                                  toggleCellExpansion(
                                    cellKey
                                  )
                                }
                              >
                                {isExpanded
                                  ? 'Daralt'
                                  : `+${hiddenLessonCount} ders`}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="empty-slot">
                            Boş
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
            {historyTotal} kayıt
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
                setHistoryReloadKey(
                  (current) =>
                    current + 1
                )
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
                            title={getStudentName(
                              lesson
                            )}
                          >
                            {getStudentName(
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
                              {getLessonTitle(
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
            {historyFirstRecord}–{historyLastRecord}
            {' / '}
            {historyTotal} kayıt
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