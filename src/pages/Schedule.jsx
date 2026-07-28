import { useEffect, useRef, useState } from 'react'

import {
  createLessonPlan,
  deleteLessonPlan
} from '../services/lessonService'
import '../styles/schedule.css'

import {
  getCompactLessonStatusLabel,
  getLessonStatusClass,
  isActiveLesson
} from '../utils/lessonHelpers'

import {
  areIdsEqual,
  normalizeSearchText,
  normalizeStatusText
} from '../utils/textHelpers'

function Schedule({
  lessonPlans = [],
  setLessonPlans,
  students = [],
  teachers = [],
  packages = [],
  scheduleLoading = false
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

  const timeSlots = [
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
  const [openMenuId, setOpenMenuId] = useState(null)
  const [expandedCells, setExpandedCells] = useState({})
  const [isSavingLesson, setIsSavingLesson] = useState(false)
  const [deletingLessonId, setDeletingLessonId] = useState(null)

  const studentSearchRef = useRef(null)

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
        student?.phone,
        student?.motherPhone,
        student?.fatherPhone,
        student?.tcNo,
        student?.email
      ]
        .filter(Boolean)
        .join(' ')
    )

  const normalizedStudentSearch = normalizeSearchText(studentSearch)

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

    const lessonStudent = students.find(
      (student) => String(student.id) === String(lesson.studentId)
    )

    const studentMatches =
      selectedStudentFilter !== 'all'
        ? String(lesson.studentId) === String(selectedStudentFilter)
        : !normalizedStudentSearch ||
          getStudentSearchValue({
            ...lessonStudent,
            fullName: getLessonStudentName(lesson)
          }).includes(normalizedStudentSearch)

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

  const handleStudentSelect = (event) => {
    const selectedStudentId = event.target.value

    const student = students.find(
      (item) => String(item.id) === String(selectedStudentId)
    )

    if (!student) {
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
      return
    }

    const studentPackages = getStudentPackages(student)
    const firstStudentPackage = studentPackages[0]

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
      teacherId: firstStudentPackage?.teacherId || '',
      teacher: firstStudentPackage?.teacher || '',
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
      teacherId: selectedPackage.teacherId || '',
      teacher: selectedPackage.teacher || '',
      time: ''
    }))
  }

  const selectTimeSlot = (time) => {
    setLessonForm((currentForm) => ({
      ...currentForm,
      time
    }))
  }

  const getBlockedLesson = (time) => {
    const teacherConflict = lessonForm.teacherId
      ? lessonPlans.find(
          (lesson) =>
            lesson.day === lessonForm.day &&
            lesson.time === time &&
            areIdsEqual(
              lesson.teacherId,
              lessonForm.teacherId
            ) &&
            isActiveLesson(lesson)
        )
      : null

    if (teacherConflict) {
      return {
        message: `Öğretmen dolu · ${getLessonStudentName(
          teacherConflict
        )} / ${getLessonInstrument(teacherConflict)}`
      }
    }

    const studentConflict = lessonForm.studentId
      ? lessonPlans.find(
          (lesson) =>
            lesson.day === lessonForm.day &&
            lesson.time === time &&
            areIdsEqual(
              lesson.studentId,
              lessonForm.studentId
            ) &&
            isActiveLesson(lesson)
        )
      : null

    if (studentConflict) {
      return {
        message: `Öğrenci dolu · ${getLessonTeacherName(
          studentConflict
        )} / ${getLessonInstrument(studentConflict)}`
      }
    }

    return null
  }

  const getLessonsForCell = (day, time) =>
    filteredLessonPlans
      .filter((lesson) => lesson.day === day && lesson.time === time)
      .sort((firstLesson, secondLesson) =>
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

  const toggleCellExpansion = (cellKey) => {
    setExpandedCells((current) => ({
      ...current,
      [cellKey]: !current[cellKey]
    }))
  }

  const handleLessonSubmit = async (event) => {
    event.preventDefault()

    if (isSavingLesson) {
      return
    }

    if (!lessonForm.studentId) {
      alert('Öğrenci seçiniz.')
      return
    }

    if (!lessonForm.packageId) {
      alert('Paket seçiniz.')
      return
    }

    if (!lessonForm.teacherId) {
      alert(
        'Bu pakete atanmış öğretmen bulunamadı. Öğrenci detayından paket öğretmenini seçiniz.'
      )
      return
    }

    if (!lessonForm.day.trim()) {
      alert('Ders günü seçiniz.')
      return
    }

    if (!lessonForm.time.trim()) {
      alert('Ders saati seçiniz.')
      return
    }

    const hasTeacherConflict = lessonPlans.some(
      (lesson) =>
        lesson.day === lessonForm.day &&
        lesson.time === lessonForm.time &&
        areIdsEqual(
          lesson.teacherId,
          lessonForm.teacherId
        ) &&
        isActiveLesson(lesson)
    )

    if (hasTeacherConflict) {
      alert(
        'Bu öğretmenin seçilen gün ve saatte başka bir dersi bulunmaktadır.'
      )
      return
    }

    const hasStudentConflict = lessonPlans.some(
      (lesson) =>
        lesson.day === lessonForm.day &&
        lesson.time === lessonForm.time &&
        areIdsEqual(
          lesson.studentId,
          lessonForm.studentId
        ) &&
        isActiveLesson(lesson)
    )

    if (hasStudentConflict) {
      alert(
        'Bu öğrencinin seçilen gün ve saatte başka bir dersi bulunmaktadır.'
      )
      return
    }

    setIsSavingLesson(true)

    try {
      const savedLesson =
        await createLessonPlan({
          studentId: lessonForm.studentId,
          packageId: lessonForm.packageId,
          teacherId: lessonForm.teacherId,
          day: lessonForm.day,
          time: lessonForm.time,
          duration:
            lessonForm.duration || '60 dk',
          status: 'Planlandı',
          note: '',
          isMakeup: false,
          relatedLessonId: null
        })

      setLessonPlans((currentLessons) => [
        ...currentLessons,
        savedLesson
      ])

      setLessonForm({
        ...emptyLessonForm,
        day: lessonForm.day
      })
    } catch (error) {
      console.error(
        'Ders planı kaydetme hatası:',
        error
      )

      alert(
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

    const isConfirmed = window.confirm(
      'Bu ders planını silmek istediğinize emin misiniz?'
    )

    if (!isConfirmed) {
      return
    }

    setDeletingLessonId(lessonId)

    try {
      await deleteLessonPlan(lessonId)

      setLessonPlans((currentLessons) =>
        currentLessons.filter(
          (lesson) =>
            !areIdsEqual(
              lesson.id,
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

      alert(
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
            Öğrenciye kayıtlı paket ve paket öğretmenine göre haftalık ders planı oluşturun.
          </p>
        </div>

        <button className="manage-button" type="button">
          {scheduleLoading
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
              <p>Öğrenci ve paket seçerek uygun ders saatini belirleyin.</p>
            </div>
          </div>

          <div className="form-grid schedule-form-grid">
            <div className="form-group">
              <label>Öğrenci</label>
              <select
                name="studentId"
                value={lessonForm.studentId}
                onChange={handleStudentSelect}
              >
                <option value="">Öğrenci seçiniz</option>
                {activeStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {getStudentNameFromRecord(student)}
                  </option>
                ))}
              </select>
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

                {studentPackageOptions.map((item) => (
                  <option key={item.packageId} value={item.packageId}>
                    {item.packageName}
                  </option>
                ))}
              </select>
            </div>

            {selectedPackageInfo && (
              <div className="selected-package-box full-width">
                <div>
                  <span>Seçilen Paket</span>
                  <strong>{selectedPackageInfo.packageName}</strong>
                </div>

                <div className="package-mini-grid">
                  <p>
                    <b>Ders:</b> {selectedPackageInfo.instrument || '-'}
                  </p>
                  <p>
                    <b>Öğretmen:</b> {selectedPackageInfo.teacher || '-'}
                  </p>
                  <p>
                    <b>Süre:</b> {selectedPackageInfo.lessonDuration || '-'}
                  </p>
                  <p>
                    <b>Ders Adedi:</b> {selectedPackageInfo.lessonCount || '-'}
                  </p>
                  <p>
                    <b>Ücret:</b> ₺{selectedPackageInfo.monthlyFee || 0}
                  </p>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Gün</label>
              <select
                name="day"
                value={lessonForm.day}
                onChange={handleLessonChange}
              >
                {days.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Seçilen Saat</label>
              <input
                value={lessonForm.time}
                readOnly
                placeholder="Saat seçiniz"
              />
            </div>
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
        </form>

        <section className="schedule-slots-card compact-slots-card">
          <div className="table-head schedule-slots-heading">
            <div>
              <h2>{lessonForm.day} Saat Durumu</h2>
              <p>
                {lessonForm.studentName && lessonForm.teacher
                  ? `${lessonForm.studentName} ve ${lessonForm.teacher} için uygun saatler`
                  : 'Dolu saatleri görmek için öğrenci ve paket seçiniz.'}
              </p>
            </div>
          </div>

          {(lessonForm.studentName ||
            lessonForm.teacher ||
            selectedPackageInfo) && (
            <div className="selected-plan-summary">
              <span>Seçilen Plan Özeti</span>

              <div className="plan-summary-grid">
                <p>
                  <b>Öğrenci:</b> {lessonForm.studentName || '-'}
                </p>
                <p>
                  <b>Öğretmen:</b> {lessonForm.teacher || '-'}
                </p>
                <p>
                  <b>Paket:</b> {lessonForm.packageName || '-'}
                </p>
                <p>
                  <b>Gün:</b> {lessonForm.day}
                </p>
              </div>
            </div>
          )}

          <div className="time-slot-grid compact-time-slot-grid">
            {timeSlots.map((time) => {
              const blockedLesson = getBlockedLesson(time)
              const isSelected = lessonForm.time === time

              return (
                <button
                  key={time}
                  type="button"
                  className={`time-slot compact-time-slot ${
                    blockedLesson ? 'occupied' : ''
                  } ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    if (!lessonForm.studentId) {
                      alert('Saat seçmeden önce öğrenci seçiniz.')
                      return
                    }

                    if (!lessonForm.packageId) {
                      alert('Saat seçmeden önce paket seçiniz.')
                      return
                    }

                    if (!lessonForm.teacher) {
                      alert('Bu pakete atanmış öğretmen bulunamadı.')
                      return
                    }

                    if (!blockedLesson) selectTimeSlot(time)
                  }}
                >
                  <strong>{time}</strong>
                  <span>{blockedLesson ? blockedLesson.message : 'Boş'}</span>
                </button>
              )
            })}
          </div>
        </section>
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
                placeholder="Ad, telefon veya TC ile ara"
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
                          {student.phone ||
                            student.tcNo ||
                            'İletişim bilgisi yok'}
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
          <table className="weekly-schedule-table schedule-weekly-table">
            <thead>
              <tr>
                <th>Saat</th>
                {days.map((day) => (
                  <th key={day}>{day}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {scheduleLoading ? (
                <tr>
                  <td
                    colSpan={days.length + 1}
                    className="empty-table"
                  >
                    Ders programı yükleniyor...
                  </td>
                </tr>
              ) : (
                timeSlots.map((time) => (
                  <tr key={time}>
                    <td className="weekly-time-cell schedule-hour">{time}</td>

                    {days.map((day) => {
                      const cellKey = `${day}-${time}`
                      const cellLessons = getLessonsForCell(day, time)
                      const isExpanded = Boolean(expandedCells[cellKey])
                      const visibleLessons = isExpanded
                        ? cellLessons
                        : cellLessons.slice(0, 2)
                      const hiddenLessonCount = Math.max(
                        0,
                        cellLessons.length - 2
                      )

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
                            {visibleLessons.map((lesson) => {
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
                                      <div className="schedule-teacher-line">
                                        <strong
                                          title={getLessonTeacherName(lesson)}
                                        >
                                          {getLessonTeacherName(lesson)}
                                        </strong>
                                      </div>

                                      <span
                                        title={`${getLessonStudentName(
                                          lesson
                                        )} • ${getLessonInstrument(lesson)}`}
                                      >
                                        {getLessonStudentName(lesson)}
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

                            {cellLessons.length > 2 && (
                              <button
                                type="button"
                                className="schedule-more-button"
                                aria-expanded={isExpanded}
                                onClick={() => toggleCellExpansion(cellKey)}
                              >
                                {isExpanded
                                  ? 'Daralt'
                                  : `+${hiddenLessonCount} ders`}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="weekly-empty schedule-empty-slot">
                            Boş
                          </span>
                        )}
                      </td>
                    )
                    })}
                  </tr>
                ))
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
                        {getLessonStudentName(lesson)}
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