import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  addStudentToLessonGroup,
  createLessonGroup,
  getLessonGroups,
  getLessonGroupStudents,
  removeStudentFromLessonGroup,
  setLessonGroupActive
} from '../services/groupService'

import '../styles/lessonGroups.css'

const normalizeText = (value) =>
  String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim()

function LessonGroups({
  specialties = [],
  teachers = [],
  students = [],
  packages = [],
  unsavedChanges
}) {
  const emptyForm = {
    name: '',
    specialtyId: '',
    defaultTeacherId: '',
    defaultDurationMinutes: 60,
    capacity: 6,
    isActive: true
  }

  const [form, setForm] =
    useState(emptyForm)

  const [groups, setGroups] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState('')

  const [
    selectedGroupId,
    setSelectedGroupId
  ] = useState('')

  const [
    groupStudents,
    setGroupStudents
  ] = useState([])

  const [
    groupStudentsLoading,
    setGroupStudentsLoading
  ] = useState(false)

  const [
    studentSearch,
    setStudentSearch
  ] = useState('')

  const [
    selectedStudentId,
    setSelectedStudentId
  ] = useState('')

  const [
    selectedStudentPackageId,
    setSelectedStudentPackageId
  ] = useState('')

  const [
    addingStudent,
    setAddingStudent
  ] = useState(false)

  const [
    removingMembershipId,
    setRemovingMembershipId
  ] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadGroups = async () => {
      setLoading(true)
      setError('')

      try {
        const result =
          await getLessonGroups({
            includeInactive: true
          })

        if (isMounted) {
          setGroups(result)
        }
      } catch (loadError) {
        console.error(
          'Ders grupları alınamadı:',
          loadError
        )

        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Ders grupları alınamadı.'
          )
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadGroups()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedGroupId) {
      setGroupStudents([])
      return undefined
    }

    let isMounted = true

    const loadGroupStudents = async () => {
      setGroupStudentsLoading(true)

      try {
        const result =
          await getLessonGroupStudents(
            selectedGroupId
          )

        if (isMounted) {
          setGroupStudents(result)
        }
      } catch (loadError) {
        console.error(
          'Grup öğrencileri alınamadı:',
          loadError
        )

        if (isMounted) {
          alert(
            loadError instanceof Error
              ? loadError.message
              : 'Grup öğrencileri alınamadı.'
          )
        }
      } finally {
        if (isMounted) {
          setGroupStudentsLoading(false)
        }
      }
    }

    loadGroupStudents()

    return () => {
      isMounted = false
    }
  }, [selectedGroupId])

  const selectedGroup =
    groups.find(
      (group) =>
        String(group.id) ===
        String(selectedGroupId)
    ) || null

  const selectedStudent =
    students.find(
      (student) =>
        String(student.id) ===
        String(selectedStudentId)
    ) || null

  const getStudentPackages = (student) => {
    if (!student) {
      return []
    }

    const enrolledPackages =
      Array.isArray(
        student.enrolledPackages
      )
        ? student.enrolledPackages
        : []

    return enrolledPackages
      .filter(
        (item) =>
          item.isActive !== false &&
          normalizeText(item.status) !==
            'sonlandırıldı'
      )
      .map((item) => {
        const packageId =
          item.packageId ||
          item.id ||
          ''

        const packageDetail =
          packages.find(
            (packageItem) =>
              String(packageItem.id) ===
              String(packageId)
          )

        return {
          studentPackageId:
            item.studentPackageId ||
            item.enrollmentId ||
            item.assignmentId ||
            '',

          packageId,

          packageName:
            item.packageName ||
            packageDetail?.name ||
            'Tanımsız Paket',

          specialtyName:
            item.instrument ||
            packageDetail?.instrument ||
            packageDetail?.specialtyName ||
            ''
        }
      })
      .filter(
        (item) =>
          item.studentPackageId
      )
  }

  const selectedStudentPackages =
    useMemo(
      () =>
        getStudentPackages(
          selectedStudent
        ),
      [
        selectedStudent,
        packages
      ]
    )

  const compatiblePackages =
    selectedGroup
      ? selectedStudentPackages.filter(
          (item) =>
            normalizeText(
              item.specialtyName
            ) ===
            normalizeText(
              selectedGroup.specialtyName
            )
        )
      : []

  const existingStudentIds =
    new Set(
      groupStudents.map(
        (item) =>
          String(item.studentId)
      )
    )

  const normalizedSearch =
    normalizeText(studentSearch)

  const studentResults =
    normalizedSearch
      ? students
          .filter(
            (student) =>
              student.isActive !== false &&
              student.isArchived !== true &&
              !existingStudentIds.has(
                String(student.id)
              )
          )
          .filter((student) =>
            normalizeText(
              [
                student.fullName ||
                  student.name,
                student.tcNo,
                student.phone
              ]
                .filter(Boolean)
                .join(' ')
            ).includes(
              normalizedSearch
            )
          )
          .slice(0, 8)
      : []

  const handleChange = (event) => {
    const {
      name,
      value,
      type,
      checked
    } = event.target

    unsavedChanges?.markDirty?.()

    setForm((current) => ({
      ...current,
      [name]:
        type === 'checkbox'
          ? checked
          : value
    }))
  }

  const resetForm = () => {
    setForm(emptyForm)
    unsavedChanges?.markClean?.()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (saving) {
      return
    }

    setSaving(true)

    try {
      const savedGroup =
        await createLessonGroup(form)

      setGroups((current) => [
        ...current,
        savedGroup
      ].sort((first, second) =>
        first.name.localeCompare(
          second.name,
          'tr'
        )
      ))

      resetForm()
    } catch (saveError) {
      console.error(
        'Ders grubu kaydedilemedi:',
        saveError
      )

      alert(
        saveError instanceof Error
          ? saveError.message
          : 'Ders grubu kaydedilemedi.'
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleGroupStatus = async (
    group
  ) => {
    try {
      const updatedGroup =
        await setLessonGroupActive(
          group.id,
          !group.isActive
        )

      setGroups((current) =>
        current.map((item) =>
          item.id === group.id
            ? updatedGroup
            : item
        )
      )
    } catch (statusError) {
      console.error(
        'Grup durumu güncellenemedi:',
        statusError
      )

      alert(
        statusError instanceof Error
          ? statusError.message
          : 'Grup durumu güncellenemedi.'
      )
    }
  }

  const openStudentManager = (
    group
  ) => {
    setSelectedGroupId(group.id)
    setStudentSearch('')
    setSelectedStudentId('')
    setSelectedStudentPackageId('')
  }

  const selectStudent = (
    student
  ) => {
    setSelectedStudentId(student.id)
    setStudentSearch(
      student.fullName ||
      student.name ||
      ''
    )
    setSelectedStudentPackageId('')
  }

  const addStudent = async () => {
    if (!selectedGroup) {
      return
    }

    if (!selectedStudentId) {
      alert('Öğrenci seçilmelidir.')
      return
    }

    if (!selectedStudentPackageId) {
      alert(
        'Öğrencinin gruba uygun paketi seçilmelidir.'
      )
      return
    }

    if (
      groupStudents.length >=
      selectedGroup.capacity
    ) {
      alert(
        'Grubun kontenjanı dolmuştur.'
      )
      return
    }

    setAddingStudent(true)

    try {
      const savedMembership =
        await addStudentToLessonGroup({
          groupId:
            selectedGroup.id,
          studentId:
            selectedStudentId,
          studentPackageId:
            selectedStudentPackageId
        })

      setGroupStudents((current) => [
        ...current,
        savedMembership
      ])

      setStudentSearch('')
      setSelectedStudentId('')
      setSelectedStudentPackageId('')
    } catch (addError) {
      console.error(
        'Öğrenci gruba eklenemedi:',
        addError
      )

      alert(
        addError instanceof Error
          ? addError.message
          : 'Öğrenci gruba eklenemedi.'
      )
    } finally {
      setAddingStudent(false)
    }
  }

  const removeStudent = async (
    membership
  ) => {
    const confirmed =
      window.confirm(
        `${membership.studentName} adlı öğrenciyi gruptan çıkarmak istediğinize emin misiniz?`
      )

    if (!confirmed) {
      return
    }

    setRemovingMembershipId(
      membership.id
    )

    try {
      await removeStudentFromLessonGroup(
        membership.id
      )

      setGroupStudents((current) =>
        current.filter(
          (item) =>
            item.id !==
            membership.id
        )
      )
    } catch (removeError) {
      console.error(
        'Öğrenci gruptan çıkarılamadı:',
        removeError
      )

      alert(
        removeError instanceof Error
          ? removeError.message
          : 'Öğrenci gruptan çıkarılamadı.'
      )
    } finally {
      setRemovingMembershipId('')
    }
  }

  return (
    <div className="dashboard-shell lesson-groups-page">
      <section className="page-card">
        <div>
          <span className="page-badge">
            Grup Yönetimi
          </span>

          <h1>Ders Grupları</h1>

          <p>
            Kalıcı ders gruplarını oluşturun,
            öğrencileri ve paket bağlantılarını
            yönetin.
          </p>
        </div>
      </section>

      <section className="lesson-table-card lesson-group-form-card">
        <div className="section-title-row">
          <div>
            <h2>Yeni Grup Oluştur</h2>

            <p>
              Önce grubun temel bilgilerini
              kaydedin.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="lesson-group-form-grid">
            <div className="form-group">
              <label>Grup Adı</label>

              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Örn. Başlangıç Gitar Grubu"
                required
              />
            </div>

            <div className="form-group">
              <label>Branş</label>

              <select
                name="specialtyId"
                value={form.specialtyId}
                onChange={handleChange}
                required
              >
                <option value="">
                  Branş seçiniz
                </option>

                {specialties.map(
                  (specialty) => (
                    <option
                      key={specialty.id}
                      value={specialty.id}
                    >
                      {specialty.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="form-group">
              <label>
                Varsayılan Öğretmen
              </label>

              <select
                name="defaultTeacherId"
                value={form.defaultTeacherId}
                onChange={handleChange}
              >
                <option value="">
                  Öğretmen seçilmedi
                </option>

                {teachers
                  .filter(
                    (teacher) =>
                      teacher.isActive !== false
                  )
                  .map((teacher) => (
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
              <label>
                Varsayılan Süre
              </label>

              <div className="lesson-group-number-field">
                <input
                  type="number"
                  name="defaultDurationMinutes"
                  min="1"
                  value={form.defaultDurationMinutes}
                  onChange={handleChange}
                  required
                />
                <span>dk</span>
              </div>
            </div>

            <div className="form-group">
              <label>Kontenjan</label>

              <input
                type="number"
                name="capacity"
                min="1"
                value={form.capacity}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group lesson-group-checkbox-field">
              <label className="lesson-group-checkbox">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleChange}
                />
                <span>Aktif grup</span>
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={resetForm}
              disabled={saving}
            >
              Temizle
            </button>

            <button
              type="submit"
              className="save-button"
              disabled={saving}
            >
              {saving
                ? 'Kaydediliyor...'
                : 'Grubu Kaydet'}
            </button>
          </div>
        </form>
      </section>

      <section className="lesson-table-card">
        <div className="table-head">
          <div>
            <h2>Kayıtlı Gruplar</h2>

            <p>
              Grup bilgileri ve öğrenci
              kontenjanları.
            </p>
          </div>

          <span className="lesson-count">
            {groups.length} grup
          </span>
        </div>

        {loading ? (
          <div className="lesson-group-empty">
            Gruplar yükleniyor...
          </div>
        ) : error ? (
          <div className="lesson-group-empty">
            {error}
          </div>
        ) : groups.length === 0 ? (
          <div className="lesson-group-empty">
            Henüz ders grubu oluşturulmadı.
          </div>
        ) : (
          <div className="lesson-group-table-wrap">
            <table className="lesson-table lesson-group-table">
              <thead>
                <tr>
                  <th className="lesson-group-name-column">
                    Grup Adı
                  </th>
                  <th className="lesson-group-specialty-column">
                    Branş
                  </th>
                  <th className="lesson-group-teacher-column">
                    Varsayılan Öğretmen
                  </th>
                  <th className="lesson-group-duration-column">
                    Süre
                  </th>
                  <th className="lesson-group-capacity-column">
                    Kontenjan
                  </th>
                  <th className="lesson-group-status-column">
                    Durum
                  </th>
                  <th className="lesson-group-actions-column">
                    İşlem
                  </th>
                </tr>
              </thead>

              <tbody>
                {groups.map((group) => (
                  <tr key={group.id}>
                    <td className="lesson-group-name-column">
                      <span
                        className="lesson-group-name-text"
                        title={group.name}
                      >
                        {group.name}
                      </span>
                    </td>

                    <td className="lesson-group-specialty-column">
                      <span className="lesson-group-cell-text">
                        {group.specialtyName || '—'}
                      </span>
                    </td>

                    <td className="lesson-group-teacher-column">
                      <span
                        className="lesson-group-cell-text"
                        title={
                          group.defaultTeacherName ||
                          'Atanmadı'
                        }
                      >
                        {group.defaultTeacherName || '—'}
                      </span>
                    </td>

                    <td className="lesson-group-duration-column">
                      <span className="lesson-group-duration-pill">
                        {group.defaultDurationMinutes} dk
                      </span>
                    </td>

                    <td className="lesson-group-capacity-column">
                      <span className="lesson-group-capacity-pill">
                        {group.capacity}
                      </span>
                    </td>

                    <td className="lesson-group-status-column">
                      <span
                        className={`lesson-group-status ${
                          group.isActive
                            ? 'active'
                            : 'passive'
                        }`}
                      >
                        {group.isActive
                          ? 'Aktif'
                          : 'Pasif'}
                      </span>
                    </td>

                    <td className="lesson-group-actions-column">
                      <div className="lesson-group-row-actions">
                        <button
                          type="button"
                          className="lesson-group-manage-button"
                          onClick={() =>
                            openStudentManager(
                              group
                            )
                          }
                        >
                          Öğrencileri Yönet
                        </button>

                        <button
                          type="button"
                          className="cancel-button"
                          onClick={() =>
                            toggleGroupStatus(
                              group
                            )
                          }
                        >
                          {group.isActive
                            ? 'Pasif Yap'
                            : 'Aktif Yap'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedGroup && (
        <div
          className="lesson-group-detail-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedGroupId('')
            }
          }}
        >
          <aside
            className="lesson-group-detail-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lesson-group-detail-title"
          >
            <div className="lesson-group-detail-head">
              <div>
                <span className="lesson-group-detail-badge">
                  Grup Detayı
                </span>

                <h2 id="lesson-group-detail-title">
                  {selectedGroup.name}
                </h2>

                <p>
                  {selectedGroup.specialtyName}
                  {' · '}
                  {groupStudents.length}/
                  {selectedGroup.capacity} öğrenci
                </p>
              </div>

              <button
                type="button"
                className="lesson-group-detail-close"
                onClick={() => setSelectedGroupId('')}
                aria-label="Grup detayını kapat"
              >
                ×
              </button>
            </div>

            <div className="lesson-group-detail-summary">
              <div>
                <span>Varsayılan öğretmen</span>
                <strong>
                  {selectedGroup.defaultTeacherName || 'Atanmadı'}
                </strong>
              </div>

              <div>
                <span>Ders süresi</span>
                <strong>
                  {selectedGroup.defaultDurationMinutes} dk
                </strong>
              </div>

              <div>
                <span>Kontenjan</span>
                <strong>
                  {groupStudents.length}/{selectedGroup.capacity}
                </strong>
              </div>
            </div>

            <div className="lesson-group-detail-body">
              <section className="lesson-group-detail-section">
                <div className="lesson-group-detail-section-head">
                  <div>
                    <h3>Öğrenciler</h3>
                    <p>Gruba kayıtlı öğrenciler ve paketleri.</p>
                  </div>

                  <span className="lesson-group-count-badge">
                    {groupStudents.length} öğrenci
                  </span>
                </div>

                {groupStudentsLoading ? (
                  <div className="lesson-group-empty">
                    Grup öğrencileri yükleniyor...
                  </div>
                ) : groupStudents.length === 0 ? (
                  <div className="lesson-group-empty compact">
                    Bu gruba henüz öğrenci eklenmedi.
                  </div>
                ) : (
                  <div className="lesson-group-member-list">
                    {groupStudents.map((membership) => (
                      <article
                        key={membership.id}
                        className="lesson-group-member-card"
                      >
                        <div className="lesson-group-member-avatar">
                          {membership.studentName
                            .charAt(0)
                            .toLocaleUpperCase('tr-TR') || '?'}
                        </div>

                        <div className="lesson-group-member-info">
                          <strong>{membership.studentName}</strong>
                          <span>
                            {membership.packageName || 'Paket bilgisi yok'}
                          </span>
                          <small>
                            {membership.studentTcNo
                              ? `TC: ${membership.studentTcNo}`
                              : membership.studentPhone || ''}
                          </small>
                        </div>

                        <button
                          type="button"
                          className="lesson-group-remove-button"
                          onClick={() => removeStudent(membership)}
                          disabled={removingMembershipId === membership.id}
                        >
                          {removingMembershipId === membership.id
                            ? 'Çıkarılıyor...'
                            : 'Gruptan Çıkar'}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="lesson-group-detail-section add-student-section">
                <div className="lesson-group-detail-section-head">
                  <div>
                    <h3>Öğrenci Ekle</h3>
                    <p>Ad, TC veya telefon ile öğrenciyi bulun.</p>
                  </div>
                </div>

                <div className="lesson-group-add-student">
                  <div className="lesson-group-search-area">
                    <label>Öğrenci Ara</label>

                    <input
                      value={studentSearch}
                      onChange={(event) => {
                        setStudentSearch(event.target.value)
                        setSelectedStudentId('')
                        setSelectedStudentPackageId('')
                      }}
                      placeholder="Ad, TC veya telefon ile ara"
                    />

                    {normalizedSearch && !selectedStudentId && (
                      <div className="lesson-group-search-results">
                        {studentResults.length > 0 ? (
                          studentResults.map((student) => (
                            <button
                              type="button"
                              key={student.id}
                              onClick={() => selectStudent(student)}
                            >
                              <strong>
                                {student.fullName || student.name}
                              </strong>
                              <span>
                                {student.tcNo
                                  ? `TC: ${student.tcNo}`
                                  : student.phone || 'İletişim bilgisi yok'}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="lesson-group-no-result">
                            Eşleşen öğrenci bulunamadı.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Öğrencinin Uygun Paketi</label>

                    <select
                      value={selectedStudentPackageId}
                      onChange={(event) =>
                        setSelectedStudentPackageId(event.target.value)
                      }
                      disabled={!selectedStudentId}
                    >
                      <option value="">
                        {!selectedStudentId
                          ? 'Önce öğrenci seçiniz'
                          : compatiblePackages.length > 0
                            ? 'Paket seçiniz'
                            : 'Uygun aktif paket bulunamadı'}
                      </option>

                      {compatiblePackages.map((item) => (
                        <option
                          key={item.studentPackageId}
                          value={item.studentPackageId}
                        >
                          {item.packageName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="save-button lesson-group-add-button"
                    onClick={addStudent}
                    disabled={addingStudent || !selectedStudentPackageId}
                  >
                    {addingStudent ? 'Ekleniyor...' : 'Gruba Ekle'}
                  </button>
                </div>

                {selectedStudentId && compatiblePackages.length === 0 && (
                  <div className="lesson-group-warning">
                    Seçilen öğrencinin bu grubun branşına uygun aktif
                    paketi bulunmuyor.
                  </div>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

export default LessonGroups