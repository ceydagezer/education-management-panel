import { useEffect, useRef, useState } from 'react'
import '../styles/status.css'

function LessonStatusTracking({
  lessons = [],
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
      teacher.status !== 'Pasif'
  )

  const activeStudents = students.filter(
    (student) =>
      student.isActive !== false &&
      student.status !== 'Pasif' &&
      !student.isArchived
  )

  const normalizeSearchText = (value) =>
    String(value || '')
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .trim()

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

  const normalizeStatus = (status) => {
    if (status === 'Telafi') {
      return 'Telafi yapılacak'
    }

    if (status === 'İptal') {
      return 'İptal edildi'
    }

    return status || 'Planlandı'
  }

  const getStatusLabel = (status) => {
    const normalizedStatus =
      normalizeStatus(status)

    if (normalizedStatus === 'Planlandı') {
      return 'Düzenli Ders'
    }

    return normalizedStatus
  }

  const getCompactStatusLabel = (status) => {
    const normalizedStatus =
      normalizeStatus(status)

    switch (normalizedStatus) {
      case 'Yapıldı':
        return 'Yapıldı'

      case 'İptal edildi':
        return 'İptal'

      case 'Telafi yapılacak':
        return 'Telafi'

      case 'Telafi yapıldı':
        return 'Telafi yapıldı'

      default:
        return ''
    }
  }

  const getTeacherName = (lesson) => {
    if (lesson.teacherName) {
      return lesson.teacherName
    }

    if (lesson.teacher) {
      return lesson.teacher
    }

    const teacher = teachers.find(
      (item) =>
        String(item.id) ===
        String(lesson.teacherId)
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

    const teacher = teachers.find(
      (item) =>
        item.fullName === teacherName ||
        item.name === teacherName
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
        String(student.id) ===
        String(makeupForm.studentId)
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
              String(item.id) ===
              String(
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
            String(packageId) ===
            String(item.id)
        )
      )
    }

    if (student.packageId) {
      return packages.filter(
        (item) =>
          String(item.id) ===
          String(student.packageId)
      )
    }

    return []
  }

  const filteredLessons = lessons.filter(
    (lesson) => {
      const lessonStatus =
        normalizeStatus(lesson.status)

      const teacherMatch =
        selectedTeacher === 'all' ||
        String(getTeacherId(lesson)) ===
          String(selectedTeacher)

      const lessonStudent = students.find(
        (student) =>
          String(student.id) ===
          String(lesson.studentId)
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
          ? String(lesson.studentId) ===
            String(selectedStudent)
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
  )

  const sortedLessons = [
    ...filteredLessons
  ].sort((firstLesson, secondLesson) => {
    const firstDayOrder =
      dayOrder[firstLesson.day] ?? 99

    const secondDayOrder =
      dayOrder[secondLesson.day] ?? 99

    const dayDifference =
      firstDayOrder - secondDayOrder

    if (dayDifference !== 0) {
      return dayDifference
    }

    return String(
      firstLesson.time || ''
    ).localeCompare(
      String(secondLesson.time || '')
    )
  })

  const getLessonsByDayAndHour = (
    day,
    hour
  ) => {
    return filteredLessons
      .filter(
        (lesson) =>
          lesson.day === day &&
          lesson.time === hour
      )
      .sort((firstLesson, secondLesson) =>
        getTeacherName(firstLesson).localeCompare(
          getTeacherName(secondLesson),
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

  const getStatusClass = (status) => {
    const normalizedStatus =
      normalizeStatus(status)

    switch (normalizedStatus) {
      case 'Yapıldı':
        return 'status-lesson-card completed'

      case 'İptal edildi':
        return 'status-lesson-card cancelled'

      case 'Telafi yapılacak':
        return 'status-lesson-card makeup-waiting'

      case 'Telafi yapıldı':
        return 'status-lesson-card makeup-completed'

      default:
        return 'status-lesson-card planned'
    }
  }

  const getStatusBadgeClass = (status) => {
    const normalizedStatus =
      normalizeStatus(status)

    switch (normalizedStatus) {
      case 'Yapıldı':
        return 'status-pill completed'

      case 'İptal edildi':
        return 'status-pill cancelled'

      case 'Telafi yapılacak':
        return 'status-pill makeup-waiting'

      case 'Telafi yapıldı':
        return 'status-pill makeup-completed'

      default:
        return 'status-pill planned'
    }
  }

  const isMakeupLesson = (lesson) => {
    const normalizedStatus =
      normalizeStatus(lesson.status)

    return (
      lesson.isMakeup ||
      normalizedStatus ===
        'Telafi yapılacak' ||
      normalizedStatus ===
        'Telafi yapıldı'
    )
  }

  const getLessonActions = (lesson) => {
    const normalizedStatus =
      normalizeStatus(lesson.status)

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

  const updateLessonStatus = (
    lessonId,
    newStatus
  ) => {
    setLessons((currentLessons) =>
      currentLessons.map((lesson) => {
        if (lesson.id !== lessonId) {
          return lesson
        }

        if (newStatus === 'Geri al') {
          return {
            ...lesson,
            status: isMakeupLesson(lesson)
              ? 'Telafi yapılacak'
              : 'Planlandı'
          }
        }

        return {
          ...lesson,
          status: newStatus
        }
      })
    )

    setOpenMenuId(null)
  }

  const deleteMakeupLesson = (
    lessonId
  ) => {
    const confirmDelete =
      window.confirm(
        'Bu telafi dersini kaldırmak istediğinize emin misiniz?'
      )

    if (!confirmDelete) {
      return
    }

    setLessons((currentLessons) =>
      currentLessons.filter(
        (lesson) =>
          lesson.id !== lessonId
      )
    )

    setOpenMenuId(null)
  }

  const handleStudentSearchChange = (event) => {
    setStudentSearch(event.target.value)
    setSelectedStudent('all')
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
            String(item.id) ===
            String(value)
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

      const sameTeacher =
        String(getTeacherId(lesson)) ===
        String(makeupForm.teacherId)

      const sameStudent =
        String(lesson.studentId) ===
        String(makeupForm.studentId)

      const isSameSlot =
        sameDay && sameTime

      const isActiveLesson =
        normalizeStatus(lesson.status) !==
        'İptal edildi'

      return (
        isSameSlot &&
        isActiveLesson &&
        (sameTeacher || sameStudent)
      )
    })
  }

  const saveMakeupLesson = (event) => {
    event.preventDefault()

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

    const selectedTeacherData =
      teachers.find(
        (teacher) =>
          String(teacher.id) ===
          String(makeupForm.teacherId)
      )

    const selectedStudentData =
      students.find(
        (student) =>
          String(student.id) ===
          String(makeupForm.studentId)
      )

    const makeupLesson = {
      id: Date.now(),

      teacherId: Number(
        makeupForm.teacherId
      ),

      teacherName:
        selectedTeacherData?.fullName ||
        selectedTeacherData?.name ||
        '',

      teacher:
        selectedTeacherData?.fullName ||
        selectedTeacherData?.name ||
        '',

      studentId: Number(
        makeupForm.studentId
      ),

      studentName:
        selectedStudentData?.fullName ||
        selectedStudentData?.name ||
        '',

      packageId: Number(
        makeupForm.packageId
      ),

      packageName:
        makeupForm.packageName,

      instrument:
        makeupForm.instrument,

      day: makeupForm.day,
      time: makeupForm.time,

      duration:
        makeupForm.duration ||
        '60 dk',

      status: 'Telafi yapılacak',

      note: makeupForm.note.trim(),

      isMakeup: true,
      relatedLessonId: null
    }

    setLessons((currentLessons) => [
      ...currentLessons,
      makeupLesson
    ])

    /*
     * Telafi dersi ana ders listesine başarıyla kaydedildi.
     * Artık kaybolabilecek bir form taslağı bulunmuyor.
     */
    unsavedChanges?.markClean?.()
    performCloseMakeupForm()
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
              >
                İptal
              </button>

              <button
                type="submit"
                className="save-button"
              >
                Telafi Dersini Kaydet
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
              Haftalık ders programı ve ders
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
              {filteredLessons.length} ders
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
                                  getCompactStatusLabel(
                                    lesson.status
                                  )

                                return (
                                  <div
                                    key={lesson.id}
                                    className={`${getStatusClass(
                                      lesson.status
                                    )} ${
                                      lesson.isMakeup
                                        ? 'makeup-card'
                                        : ''
                                    } ${
                                      openMenuId ===
                                      lesson.id
                                        ? 'menu-open'
                                        : ''
                                    }`}
                                  >
                                    {lesson.isMakeup &&
                                      normalizeStatus(
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
                                              lesson.id
                                            )
                                          }}
                                          title="Telafi dersini kaldır"
                                        >
                                          ×
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
                                              openMenuId ===
                                                lesson.id
                                                ? null
                                                : lesson.id
                                            )
                                          }}
                                          aria-label="Ders işlemleri"
                                        >
                                          ⋯
                                        </button>

                                        {openMenuId ===
                                          lesson.id && (
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
                                                      lesson.id,
                                                      action
                                                    )
                                                  }
                                                >
                                                  {
                                                    action
                                                  }
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

      <section className="lesson-table-card">
        <div className="table-head">
          <div>
            <h2>Ders Durum Listesi</h2>

            <p>
              Seçili filtrelere göre derslerin
              detaylı listesi
            </p>
          </div>

          <button
            type="button"
            className="lesson-count"
          >
            {sortedLessons.length} ders
          </button>
        </div>

        <div className="payment-table-wrapper">
          <table className="lesson-table status-detail-table">
            <thead>
              <tr>
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
              {sortedLessons.length > 0 ? (
                sortedLessons.map(
                  (lesson) => (
                    <tr key={lesson.id}>
                      <td>
                        <span className="status-day-text">
                          {lesson.day}
                        </span>
                      </td>

                      <td>
                        <strong className="status-time-text">
                          {lesson.time}
                        </strong>
                      </td>

                      <td>
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

                      <td>
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

                      <td>
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

                      <td>
                        <span
                          className={getStatusBadgeClass(
                            lesson.status
                          )}
                        >
                          {getStatusLabel(
                            lesson.status
                          )}
                        </span>
                      </td>

                      <td
                        className={`status-note-cell ${
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
                    colSpan="7"
                    className="empty-table"
                  >
                    Seçili filtrelere uygun
                    ders bulunamadı.
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

export default LessonStatusTracking