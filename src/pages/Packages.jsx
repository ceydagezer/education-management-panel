import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  LoadingButton
} from '../components/AsyncState'

import {
  createPackage,
  createSpecialty,
  setPackageActiveStatus,
  updatePackage
} from '../services/catalogService'

import {
  formatPrice
} from '../utils/dateHelpers'

import {
  areIdsEqual,
  normalizeSearchText,
  normalizeStatusText
} from '../utils/textHelpers'

const PACKAGE_DRAFT_KEY =
  'arti-akademi-package-draft'

const EMPTY_PACKAGE_FORM = {
  name: '',
  specialtyId: '',
  instrument: '',
  duration: '60 dk',
  lessonCount: 1,
  totalPrice: ''
}

const getSpecialtyId = (specialty) =>
  typeof specialty === 'string'
    ? specialty
    : specialty?.id ?? specialty?.name ?? ''

const getSpecialtyName = (specialty) =>
  typeof specialty === 'string'
    ? specialty
    : specialty?.name ?? ''

const formatSpecialtyName = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR')
    .replace(
      /(^|\s)([a-zçğıöşü])/g,
      (_, space, letter) =>
        `${space}${letter.toLocaleUpperCase(
          'tr-TR'
        )}`
    )

function Packages({
  packages = [],
  setPackages = () => {},
  specialties = [],
  setSpecialties = () => {},
  packagesLoading = false,
  unsavedChanges
}) {
  const unsavedChangesRef =
    useRef(unsavedChanges)

  useEffect(() => {
    unsavedChangesRef.current =
      unsavedChanges
  }, [unsavedChanges])

  const [showForm, setShowForm] =
    useState(false)

  const [
    editingPackageId,
    setEditingPackageId
  ] = useState(null)

  const [packageForm, setPackageForm] =
    useState(EMPTY_PACKAGE_FORM)

  const [isSaving, setIsSaving] =
    useState(false)

  const [
    deletingPackageId,
    setDeletingPackageId
  ] = useState(null)

  const [actionError, setActionError] =
    useState('')

  const [
    specialtyInput,
    setSpecialtyInput
  ] = useState('')

  const [
    isSavingSpecialty,
    setIsSavingSpecialty
  ] = useState(false)

  const runProtectedAction = (action) => {
    if (unsavedChanges?.requestAction) {
      unsavedChanges.requestAction(action)
      return
    }

    action()
  }

  const specialtyOptions = useMemo(
    () =>
      specialties
        .filter(
          (specialty) =>
            specialty?.isActive !== false
        )
        .map((specialty) => ({
          id: String(
            getSpecialtyId(specialty)
          ),
          name:
            getSpecialtyName(specialty)
        }))
        .filter(
          (specialty) =>
            specialty.id &&
            specialty.name
        )
        .sort((a, b) =>
          a.name.localeCompare(
            b.name,
            'tr-TR'
          )
        ),
    [specialties]
  )

  const exactSpecialtyMatch =
    useMemo(() => {
      const normalizedInput =
        normalizeSearchText(
          specialtyInput
        )

      if (!normalizedInput) {
        return null
      }

      return (
        specialtyOptions.find(
          (specialty) =>
            normalizeSearchText(
              specialty.name
            ) === normalizedInput
        ) ?? null
      )
    }, [
      specialtyInput,
      specialtyOptions
    ])

  const canCreateSpecialty =
    specialtyInput.trim() !== '' &&
    !exactSpecialtyMatch

  useEffect(() => {
    try {
      const savedDraft =
        sessionStorage.getItem(
          PACKAGE_DRAFT_KEY
        )

      if (!savedDraft) {
        return
      }

      const parsedDraft =
        JSON.parse(savedDraft)

      if (!parsedDraft?.packageForm) {
        return
      }

      const restoredForm = {
        ...EMPTY_PACKAGE_FORM,
        ...parsedDraft.packageForm
      }

      setPackageForm(restoredForm)
      setSpecialtyInput(
        restoredForm.instrument || ''
      )

      setEditingPackageId(
        parsedDraft.editingPackageId ??
          null
      )

      setShowForm(true)
      unsavedChangesRef.current
        ?.markDirty?.()
    } catch (error) {
      console.error(
        'Paket taslağı okunamadı:',
        error
      )

      sessionStorage.removeItem(
        PACKAGE_DRAFT_KEY
      )
    }
  }, [])

  useEffect(() => {
    if (!showForm) {
      return
    }

    try {
      sessionStorage.setItem(
        PACKAGE_DRAFT_KEY,
        JSON.stringify({
          packageForm,
          editingPackageId
        })
      )
    } catch (error) {
      console.error(
        'Paket taslağı kaydedilemedi:',
        error
      )
    }
  }, [
    showForm,
    packageForm,
    editingPackageId
  ])

  const clearPackageDraft = () => {
    sessionStorage.removeItem(
      PACKAGE_DRAFT_KEY
    )
  }

  const calculateUnitPrice = (
    totalPrice,
    lessonCount
  ) => {
    const price = Number(totalPrice)
    const count = Number(lessonCount)

    if (
      !Number.isFinite(price) ||
      !Number.isFinite(count) ||
      price <= 0 ||
      count <= 0
    ) {
      return 0
    }

    return price / count
  }

  const selectSpecialty = (
    specialty
  ) => {
    if (!specialty) {
      setPackageForm((current) => ({
        ...current,
        specialtyId: '',
        instrument:
          specialtyInput.trim()
      }))

      return
    }

    setSpecialtyInput(
      specialty.name
    )

    setPackageForm((current) => ({
      ...current,
      specialtyId:
        specialty.id,
      instrument:
        specialty.name
    }))
  }

  const handleSpecialtyInputChange = (
    event
  ) => {
    const value = event.target.value

    setSpecialtyInput(value)
    setActionError('')
    unsavedChanges?.markDirty?.()

    const matchedSpecialty =
      specialtyOptions.find(
        (specialty) =>
          normalizeSearchText(
            specialty.name
          ) ===
          normalizeSearchText(
            value
          )
      )

    if (matchedSpecialty) {
      selectSpecialty(
        matchedSpecialty
      )
      return
    }

    setPackageForm((current) => ({
      ...current,
      specialtyId: '',
      instrument: value
    }))
  }

  const handleSpecialtyBlur = () => {
    if (exactSpecialtyMatch) {
      selectSpecialty(
        exactSpecialtyMatch
      )
    }
  }

  const saveNewSpecialty = async () => {
    const formattedName =
      formatSpecialtyName(
        specialtyInput
      )

    if (!formattedName) {
      setActionError(
        'Branş adı boş bırakılamaz.'
      )
      return
    }

    const existingSpecialty =
      specialtyOptions.find(
        (specialty) =>
          normalizeSearchText(
            specialty.name
          ) ===
          normalizeSearchText(
            formattedName
          )
      )

    if (existingSpecialty) {
      selectSpecialty(
        existingSpecialty
      )
      return
    }

    setIsSavingSpecialty(true)
    setActionError('')

    try {
      const savedSpecialty =
        await createSpecialty(
          formattedName
        )

      setSpecialties((current) => [
        ...current,
        savedSpecialty
      ])

      setSpecialtyInput(
        savedSpecialty.name
      )

      setPackageForm((current) => ({
        ...current,
        specialtyId: String(
          savedSpecialty.id
        ),
        instrument:
          savedSpecialty.name
      }))

      unsavedChanges?.markDirty?.()
    } catch (error) {
      console.error(
        'Branş kaydetme hatası:',
        error
      )

      setActionError(
        error instanceof Error
          ? error.message
          : 'Branş kaydedilemedi.'
      )
    } finally {
      setIsSavingSpecialty(false)
    }
  }

  const handlePackageChange = (event) => {
    const { name, value } = event.target

    setActionError('')
    unsavedChanges?.markDirty?.()

    setPackageForm((current) => ({
      ...current,
      [name]: value
    }))
  }

  const performOpenAddForm = () => {
    unsavedChanges?.markClean?.()
    clearPackageDraft()

    setPackageForm(EMPTY_PACKAGE_FORM)
    setSpecialtyInput('')
    setEditingPackageId(null)
    setActionError('')
    setShowForm(true)
  }

  const openAddForm = () => {
    runProtectedAction(
      performOpenAddForm
    )
  }

  const performOpenEditForm = (item) => {
    unsavedChanges?.markClean?.()
    clearPackageDraft()

    const matchedSpecialty =
      specialties.find((specialty) =>
        areIdsEqual(
          getSpecialtyId(specialty),
          item.specialtyId ??
            item.specialty_id
        ) ||
        normalizeSearchText(
          getSpecialtyName(specialty)
        ) ===
          normalizeSearchText(
            item.instrument
          )
      )

    const instrumentName =
      item.instrument ||
      getSpecialtyName(
        matchedSpecialty
      ) ||
      ''

    setPackageForm({
      name: item.name || '',
      specialtyId: String(
        item.specialtyId ??
          item.specialty_id ??
          getSpecialtyId(
            matchedSpecialty
          ) ??
          ''
      ),
      instrument:
        instrumentName,
      duration:
        item.duration ||
        `${
          item.durationMinutes || 60
        } dk`,
      lessonCount:
        item.lessonCount !== undefined
          ? item.lessonCount
          : 1,
      totalPrice:
        item.totalPrice !== undefined
          ? item.totalPrice
          : ''
    })

    setSpecialtyInput(
      instrumentName
    )

    setEditingPackageId(item.id)
    setActionError('')
    setShowForm(true)
  }

  const openEditForm = (item) => {
    runProtectedAction(() =>
      performOpenEditForm(item)
    )
  }

  const performCloseForm = () => {
    unsavedChanges?.markClean?.()
    clearPackageDraft()

    setPackageForm(EMPTY_PACKAGE_FORM)
    setSpecialtyInput('')
    setEditingPackageId(null)
    setActionError('')
    setShowForm(false)
  }

  const closeForm = () => {
    if (
      isSaving ||
      isSavingSpecialty
    ) {
      return
    }

    runProtectedAction(
      performCloseForm
    )
  }

  const validateForm = () => {
    const trimmedName =
      packageForm.name.trim()

    const lessonCount = Number(
      packageForm.lessonCount
    )

    const totalPrice = Number(
      packageForm.totalPrice
    )

    if (!trimmedName) {
      alert('Paket adı zorunludur.')
      return null
    }

    if (
      !packageForm.specialtyId
    ) {
      alert(
        'Listeden bir branş seçin veya yazdığınız yeni branşı önce kaydedin.'
      )
      return null
    }

    if (
      !Number.isInteger(lessonCount) ||
      lessonCount < 1
    ) {
      alert(
        'Paket içindeki ders sayısı 1 veya daha büyük bir tam sayı olmalıdır.'
      )
      return null
    }

    if (
      !Number.isFinite(totalPrice) ||
      totalPrice <= 0
    ) {
      alert(
        'Paket ücreti 0’dan büyük olmalıdır.'
      )
      return null
    }

    const sameNamePackages =
      packages.filter(
        (item) =>
          !areIdsEqual(
            item.id,
            editingPackageId
          ) &&
          normalizeSearchText(
            item.name
          ) ===
            normalizeSearchText(
              trimmedName
            )
      )

    const activeDuplicate =
      sameNamePackages.find(
        (item) =>
          item.isActive !== false &&
          normalizeStatusText(
            item.status
          ) !== 'pasif'
      )

    if (activeDuplicate) {
      alert(
        'Bu paket adıyla aktif bir kayıt bulunmaktadır.'
      )
      return null
    }

    const archivedMatch =
      sameNamePackages.find(
        (item) =>
          item.isActive === false ||
          normalizeStatusText(
            item.status
          ) === 'pasif'
      ) ?? null

    return {
      formData: {
        ...packageForm,
        name: trimmedName,
        lessonCount,
        totalPrice
      },
      archivedMatch
    }
  }

  const savePackage = async (event) => {
    event.preventDefault()

    const validationResult =
      validateForm()

    if (!validationResult) {
      return
    }

    const {
      formData,
      archivedMatch
    } = validationResult

    if (
      !editingPackageId &&
      archivedMatch
    ) {
      const shouldRestore =
        window.confirm(
          `${archivedMatch.name} adlı paket daha önce silinmiş. Yeni bilgilerle geri yüklensin mi?`
        )

      if (!shouldRestore) {
        return
      }
    }

    setIsSaving(true)
    setActionError('')

    try {
      let savedPackage

      if (editingPackageId) {
        savedPackage =
          await updatePackage(
            editingPackageId,
            formData
          )
      } else if (archivedMatch) {
        await updatePackage(
          archivedMatch.id,
          formData
        )

        savedPackage =
          await setPackageActiveStatus(
            archivedMatch.id,
            true
          )
      } else {
        savedPackage =
          await createPackage(
            formData
          )
      }

      setPackages((current) => {
        const targetId =
          editingPackageId ??
          archivedMatch?.id

        if (targetId) {
          return current.map((item) =>
            areIdsEqual(
              item.id,
              targetId
            )
              ? savedPackage
              : item
          )
        }

        return [
          savedPackage,
          ...current
        ]
      })

      unsavedChanges?.markClean?.()
      performCloseForm()
    } catch (error) {
      console.error(
        'Paket kaydetme hatası:',
        error
      )

      setActionError(
        error instanceof Error
          ? error.message
          : 'Paket kaydedilemedi.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const deletePackage = async (
    packageItem
  ) => {
    const isConfirmed = window.confirm(
      `${packageItem.name} paketini silmek istediğinize emin misiniz? Paket geçmiş kayıtlarda kullanılıyorsa veritabanından tamamen kaldırılmayacak, arşivlenecektir.`
    )

    if (!isConfirmed) {
      return
    }

    setDeletingPackageId(
      packageItem.id
    )
    setActionError('')

    try {
      await setPackageActiveStatus(
        packageItem.id,
        false
      )

      setPackages((current) =>
        current.map((item) =>
          areIdsEqual(
            item.id,
            packageItem.id
          )
            ? {
                ...item,
                isActive: false,
                status: 'Pasif'
              }
            : item
        )
      )
    } catch (error) {
      console.error(
        'Paket silme hatası:',
        error
      )

      setActionError(
        error instanceof Error
          ? error.message
          : 'Paket silinemedi.'
      )
    } finally {
      setDeletingPackageId(null)
    }
  }

  const activePackages = packages.filter(
    (item) =>
      item.isActive !== false &&
      normalizeStatusText(
        item.status
      ) !== 'pasif'
  )

  const unitPrice =
    calculateUnitPrice(
      packageForm.totalPrice,
      packageForm.lessonCount
    )

  return (
    <div className="dashboard-shell">
      <section className="page-card">
        <div>
          <span className="page-badge">
            Paket Yönetimi
          </span>

          <h1>Ders Paketleri</h1>

          <p>
            Ders paketlerini enstrüman,
            ders süresi, ders sayısı ve
            ücret bilgileriyle yönetin.
          </p>
        </div>

        <button
          className="manage-button"
          type="button"
          onClick={openAddForm}
          disabled={isSaving}
        >
          + Paket Ekle
        </button>
      </section>

      {actionError && (
        <div
          className="finance-empty-warning"
          role="alert"
        >
          {actionError}
        </div>
      )}

      {showForm && (
        <section className="student-form-card package-form-card">
          <div className="section-title-row">
            <h2>
              {editingPackageId
                ? 'Paket Düzenle'
                : 'Yeni Paket Ekle'}
            </h2>

            <button
              className="edit-section-button"
              type="button"
              onClick={closeForm}
              disabled={
                isSaving ||
                isSavingSpecialty
              }
            >
              Kapat
            </button>
          </div>

          <form
            className="package-form"
            onSubmit={savePackage}
          >
            <div className="form-grid">
              <div className="form-group">
                <label>Paket Adı</label>

                <input
                  name="name"
                  value={packageForm.name}
                  onChange={handlePackageChange}
                  placeholder="Örn: Aylık Gitar Özel Ders"
                  disabled={isSaving}
                />
              </div>

              <div className="form-group">
                <label>
                  Enstrüman / Branş
                </label>

                <div className="specialty-inline-row">
                  <input
                    list="package-specialty-options"
                    value={specialtyInput}
                    onChange={
                      handleSpecialtyInputChange
                    }
                    onBlur={
                      handleSpecialtyBlur
                    }
                    placeholder="Branş ara veya yaz"
                    disabled={
                      isSaving ||
                      isSavingSpecialty
                    }
                  />

                  <datalist id="package-specialty-options">
                    {specialtyOptions.map(
                      (specialty) => (
                        <option
                          key={specialty.id}
                          value={
                            specialty.name
                          }
                        />
                      )
                    )}
                  </datalist>

                  {canCreateSpecialty && (
                    <LoadingButton
                      type="button"
                      className="edit-section-button specialty-add-button"
                      loading={
                        isSavingSpecialty
                      }
                      loadingText="Ekleniyor..."
                      disabled={isSaving}
                      onClick={
                        saveNewSpecialty
                      }
                    >
                      + “
                      {formatSpecialtyName(
                        specialtyInput
                      )}
                      ” Ekle
                    </LoadingButton>
                  )}
                </div>

                {exactSpecialtyMatch && (
                  <small className="field-help-text">
                    Mevcut branş seçildi:
                    {' '}
                    {exactSpecialtyMatch.name}
                  </small>
                )}

                {!exactSpecialtyMatch &&
                  specialtyInput.trim() && (
                    <small className="field-help-text">
                      Bu branş henüz kayıtlı
                      değil. Ekle düğmesine
                      basarak kaydedin.
                    </small>
                  )}

                {!specialtyInput.trim() &&
                  specialtyOptions.length ===
                    0 && (
                  <small className="field-help-text">
                    Henüz branş
                    tanımlanmadı. Branş adını
                    yazarak ekleyebilirsiniz.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>
                  Bir Dersin Süresi
                </label>

                <select
                  name="duration"
                  value={
                    packageForm.duration
                  }
                  onChange={
                    handlePackageChange
                  }
                  disabled={isSaving}
                >
                  <option value="30 dk">
                    30 dakika
                  </option>
                  <option value="45 dk">
                    45 dakika
                  </option>
                  <option value="60 dk">
                    60 dakika
                  </option>
                  <option value="90 dk">
                    90 dakika
                  </option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  Paket İçindeki Ders Sayısı
                </label>

                <input
                  type="number"
                  name="lessonCount"
                  value={
                    packageForm.lessonCount
                  }
                  onChange={
                    handlePackageChange
                  }
                  min="1"
                  step="1"
                  placeholder="Örn: 4"
                  disabled={isSaving}
                />
              </div>

              <div className="form-group">
                <label>Paket Ücreti</label>

                <input
                  type="number"
                  name="totalPrice"
                  value={
                    packageForm.totalPrice
                  }
                  onChange={
                    handlePackageChange
                  }
                  placeholder="Örn: 4000"
                  min="1"
                  step="0.01"
                  disabled={isSaving}
                />
              </div>

              <div className="form-group">
                <label>Durum</label>

                <input
                  value={
                    editingPackageId
                      ? 'Durum listeden değiştirilir'
                      : 'Yeni paket aktif oluşturulur'
                  }
                  readOnly
                />
              </div>

              <div className="form-group full-width">
                <div className="package-calculation-box">
                  <div className="package-summary-description">
                    <span>
                      Paket Özeti
                    </span>

                    <p>
                      Paket içeriği ve birim
                      ders ücreti, girilen
                      bilgilere göre otomatik
                      hesaplanır.
                    </p>
                  </div>

                  <div className="package-calculation-grid package-summary-grid">
                    <div className="package-calculation-item">
                      <small>
                        Toplam Ders
                      </small>

                      <strong>
                        {Number(
                          packageForm.lessonCount ||
                            0
                        )}{' '}
                        ders
                      </strong>
                    </div>

                    <div className="package-calculation-item">
                      <small>
                        Bir Dersin Süresi
                      </small>

                      <strong>
                        {packageForm.duration ||
                          '60 dk'}
                      </strong>
                    </div>

                    <div className="package-calculation-item">
                      <small>
                        Paket Ücreti
                      </small>

                      <strong>
                        ₺
                        {formatPrice(
                          packageForm.totalPrice
                        )}
                      </strong>
                    </div>

                    <div className="package-calculation-item">
                      <small>
                        Birim Ders Ücreti
                      </small>

                      <strong>
                        ₺
                        {formatPrice(
                          unitPrice
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-actions package-form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={closeForm}
                disabled={
                  isSaving ||
                  isSavingSpecialty
                }
              >
                İptal
              </button>

              <LoadingButton
                type="submit"
                className="save-button"
                loading={isSaving}
                loadingText={
                  editingPackageId
                    ? 'Güncelleniyor...'
                    : 'Kaydediliyor...'
                }
                disabled={
                  isSavingSpecialty
                }
              >
                {editingPackageId
                  ? 'Güncelle'
                  : 'Kaydet'}
              </LoadingButton>
            </div>
          </form>
        </section>
      )}

      <section className="lesson-table-card">
        <div className="table-head">
          <div>
            <h2>Paket Listesi</h2>

            <p>
              Tanımlı ders paketleri ve
              paket ücret bilgileri
            </p>
          </div>

          <button
            className="lesson-count"
            type="button"
          >
            {packagesLoading
              ? '— paket'
              : `${activePackages.length} paket`}
          </button>
        </div>

        <table className="lesson-table package-list-table">
          <thead>
            <tr>
              <th>Paket Adı</th>
              <th>Enstrüman</th>
              <th>Bir Dersin Süresi</th>
              <th>Ders Sayısı</th>
              <th>Paket Ücreti</th>
              <th>Birim Ders Ücreti</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>

          <tbody>
            {packagesLoading ? (
              <tr>
                <td
                  colSpan="8"
                  className="empty-table"
                >
                  Paketler yükleniyor...
                </td>
              </tr>
            ) : activePackages.length > 0 ? (
              activePackages.map((item) => {
                const isDeleting =
                  areIdsEqual(
                    deletingPackageId,
                    item.id
                  )

                return (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>
                      {item.instrument || '-'}
                    </td>
                    <td>
                      {item.duration ||
                        '60 dk'}
                    </td>
                    <td>
                      {item.lessonCount}
                    </td>
                    <td>
                      ₺
                      {formatPrice(
                        item.totalPrice
                      )}
                    </td>
                    <td>
                      ₺
                      {formatPrice(
                        item.unitPrice !==
                          undefined
                          ? item.unitPrice
                          : calculateUnitPrice(
                              item.totalPrice,
                              item.lessonCount
                            )
                      )}
                    </td>
                    <td>
                      <span className="status-badge paid">
                        Aktif
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="detail-button"
                          type="button"
                          onClick={() =>
                            openEditForm(item)
                          }
                          disabled={
                            isDeleting ||
                            isSaving
                          }
                        >
                          Düzenle
                        </button>

                        <LoadingButton
                          className="delete-button"
                          type="button"
                          loading={isDeleting}
                          loadingText="Siliniyor..."
                          disabled={isSaving}
                          onClick={() =>
                            deletePackage(item)
                          }
                        >
                          Sil
                        </LoadingButton>
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td
                  colSpan="8"
                  className="empty-table"
                >
                  Henüz paket tanımlanmadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export default Packages