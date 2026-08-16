import {
  useEffect,
  useMemo,
  useState
} from 'react'
import {
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

import {
  addStudentToLessonGroup,
  createLessonGroup,
  getLessonGroups,
  getLessonGroupStudentPackages,
  getLessonGroupStudents,
  removeStudentFromLessonGroup,
  searchLessonGroupStudents,
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
  unsavedChanges
}) {
  const queryClient = useQueryClient()
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

  const [saving, setSaving] =
    useState(false)

  const [
    selectedGroupId,
    setSelectedGroupId
  ] = useState('')

  const [
    studentSearch,
    setStudentSearch
  ] = useState('')

  const [
    studentResults,
    setStudentResults
  ] = useState([])

  const [
    studentSearchLoading,
    setStudentSearchLoading
  ] = useState(false)

  const [
    studentSearchError,
    setStudentSearchError
  ] = useState('')

  const [
    selectedStudentPackages,
    setSelectedStudentPackages
  ] = useState([])

  const [
    studentPackagesLoading,
    setStudentPackagesLoading
  ] = useState(false)

  const [
    studentPackagesError,
    setStudentPackagesError
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

  const lessonGroupsQuery = useQuery({
    queryKey: [
      'lesson-groups',
      'list',
      {
        includeInactive: true
      }
    ],
    queryFn: () =>
      getLessonGroups({
        includeInactive: true
      })
  })

  const groups =
    lessonGroupsQuery.data ?? []

  const loading =
    lessonGroupsQuery.isPending &&
    !lessonGroupsQuery.data

  const error =
    !lessonGroupsQuery.data &&
    lessonGroupsQuery.error
      ? (
          lessonGroupsQuery.error instanceof Error
            ? lessonGroupsQuery.error.message
            : 'Ders grupları alınamadı.'
        )
      : ''

  const groupStudentsQuery = useQuery({
    queryKey: [
      'lesson-groups',
      'students',
      String(selectedGroupId || '')
    ],
    queryFn: () =>
      getLessonGroupStudents(
        selectedGroupId
      ),
    enabled: Boolean(selectedGroupId)
  })

  const groupStudents =
    selectedGroupId
      ? (groupStudentsQuery.data ?? [])
      : []

  const groupStudentsLoading =
    Boolean(selectedGroupId) &&
    groupStudentsQuery.isPending &&
    !groupStudentsQuery.data

  const groupStudentsError =
    selectedGroupId &&
    !groupStudentsQuery.data &&
    groupStudentsQuery.error
      ? (
          groupStudentsQuery.error instanceof Error
            ? groupStudentsQuery.error.message
            : 'Grup öğrencileri alınamadı.'
        )
      : ''

  const selectedGroup =
    groups.find(
      (group) =>
        String(group.id) ===
        String(selectedGroupId)
    ) || null

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
    useMemo(
      () =>
        new Set(
          groupStudents.map(
            (item) =>
              String(item.studentId)
          )
        ),
      [groupStudents]
    )

  const normalizedSearch =
    normalizeText(studentSearch)

  useEffect(() => {
    if (
      !selectedGroupId ||
      selectedStudentId ||
      normalizedSearch.length < 2
    ) {
      setStudentResults([])
      setStudentSearchLoading(false)
      setStudentSearchError('')
      return undefined
    }

    let isMounted = true

    const timeoutId =
      window.setTimeout(
        async () => {
          setStudentSearchLoading(true)
          setStudentSearchError('')

          try {
            const result =
              await searchLessonGroupStudents(
                studentSearch,
                {
                  limit: 12
                }
              )

            if (!isMounted) {
              return
            }

            setStudentResults(
              result
                .filter(
                  (student) =>
                    !existingStudentIds.has(
                      String(student.id)
                    )
                )
                .slice(0, 8)
            )
          } catch (searchError) {
            console.error(
              'Öğrenci araması yapılamadı:',
              searchError
            )

            if (isMounted) {
              setStudentResults([])
              setStudentSearchError(
                searchError instanceof Error
                  ? searchError.message
                  : 'Öğrenci araması yapılamadı.'
              )
            }
          } finally {
            if (isMounted) {
              setStudentSearchLoading(false)
            }
          }
        },
        250
      )

    return () => {
      isMounted = false
      window.clearTimeout(timeoutId)
    }
  }, [
    selectedGroupId,
    selectedStudentId,
    normalizedSearch,
    studentSearch,
    existingStudentIds
  ])

  useEffect(() => {
    if (!selectedStudentId) {
      setSelectedStudentPackages([])
      setStudentPackagesLoading(false)
      setStudentPackagesError('')
      return undefined
    }

    let isMounted = true

    const loadStudentPackages = async () => {
      setStudentPackagesLoading(true)
      setStudentPackagesError('')

      try {
        const result =
          await getLessonGroupStudentPackages(
            selectedStudentId
          )

        if (isMounted) {
          setSelectedStudentPackages(
            result
          )
        }
      } catch (packageError) {
        console.error(
          'Öğrenci paketleri alınamadı:',
          packageError
        )

        if (isMounted) {
          setSelectedStudentPackages([])
          setStudentPackagesError(
            packageError instanceof Error
              ? packageError.message
              : 'Öğrenci paketleri alınamadı.'
          )
        }
      } finally {
        if (isMounted) {
          setStudentPackagesLoading(false)
        }
      }
    }

    loadStudentPackages()

    return () => {
      isMounted = false
    }
  }, [selectedStudentId])

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

      queryClient.setQueryData(
        [
          'lesson-groups',
          'list',
          {
            includeInactive: true
          }
        ],
        (current = []) => [
          ...current,
          savedGroup
        ].sort((first, second) =>
          first.name.localeCompare(
            second.name,
            'tr'
          )
        )
      )

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

      queryClient.setQueryData(
        [
          'lesson-groups',
          'list',
          {
            includeInactive: true
          }
        ],
        (current = []) =>
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
    setStudentResults([])
    setStudentSearchError('')
    setSelectedStudentId('')
    setSelectedStudentPackages([])
    setStudentPackagesError('')
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
    setStudentResults([])
    setStudentSearchError('')
    setSelectedStudentPackages([])
    setStudentPackagesError('')
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

      queryClient.setQueryData(
        [
          'lesson-groups',
          'students',
          String(selectedGroup.id)
        ],
        (current = []) => [
          ...current,
          savedMembership
        ]
      )

      setStudentSearch('')
      setStudentResults([])
      setStudentSearchError('')
        setSelectedStudentId('')
      setSelectedStudentPackages([])
      setStudentPackagesError('')
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

      queryClient.setQueryData(
        [
          'lesson-groups',
          'students',
          String(selectedGroupId)
        ],
        (current = []) =>
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

        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="lesson-group-form-grid">
            <div className="form-group">
              <label>Grup Adı</label>

              <input
                autoComplete="off"
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
                  autoComplete="off"
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
                autoComplete="off"
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
                ) : groupStudentsError ? (
                  <div className="lesson-group-empty">
                    {groupStudentsError}
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
                    <p>Ad veya TC ile öğrenciyi bulun.</p>
                  </div>
                </div>

                <div className="lesson-group-add-student">
                  <div className="lesson-group-search-area">
                    <label>Öğrenci Ara</label>

                    <input
                      value={studentSearch}
                      onChange={(event) => {
                        setStudentSearch(event.target.value)
                        setStudentResults([])
                        setStudentSearchError('')
                        setSelectedStudentId('')
                        setSelectedStudentPackages([])
                        setStudentPackagesError('')
                        setSelectedStudentPackageId('')
                      }}
                      placeholder="Ad veya TC ile ara"
                    />

                    {normalizedSearch.length >= 2 &&
                      !selectedStudentId && (
                      <div className="lesson-group-search-results">
                        {studentSearchLoading ? (
                          <div className="lesson-group-no-result">
                            Öğrenciler aranıyor...
                          </div>
                        ) : studentSearchError ? (
                          <div className="lesson-group-no-result">
                            {studentSearchError}
                          </div>
                        ) : studentResults.length > 0 ? (
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
                                  : 'TC bilgisi yok'}
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
                      disabled={
                        !selectedStudentId ||
                        studentPackagesLoading
                      }
                    >
                      <option value="">
                        {!selectedStudentId
                          ? 'Önce öğrenci seçiniz'
                          : studentPackagesLoading
                            ? 'Paketler yükleniyor...'
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

                {selectedStudentId &&
                  !studentPackagesLoading &&
                  studentPackagesError && (
                  <div className="lesson-group-warning">
                    {studentPackagesError}
                  </div>
                )}

                {selectedStudentId &&
                  !studentPackagesLoading &&
                  !studentPackagesError &&
                  compatiblePackages.length === 0 && (
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