import { useState } from 'react'

function Packages({
  packages,
  setPackages,
  unsavedChanges
}) {
  const emptyForm = {
    name: '',
    instrument: '',
    duration: '60 dk',
    lessonCount: 1,
    totalPrice: '',
    status: 'Aktif'
  }

  const [showForm, setShowForm] = useState(false)
  const [editingPackageId, setEditingPackageId] = useState(null)
  const [packageForm, setPackageForm] = useState(emptyForm)

  /*
   * Kaydedilmemiş değişiklik yoksa işlem doğrudan çalışır.
   * Formda değişiklik varsa App.jsx içindeki ortak uyarı
   * penceresi açılır.
   */
  const runProtectedAction = (action) => {
    if (unsavedChanges?.requestAction) {
      unsavedChanges.requestAction(action)
      return
    }

    action()
  }

  const instrumentOptions = [
    ...new Set(
      packages
        .map((item) => item.instrument)
        .filter((item) => item && item.trim() !== '')
    )
  ]

  const calculateUnitPrice = (totalPrice, lessonCount) => {
    const price = Number(totalPrice)
    const count = Number(lessonCount)

    if (price <= 0 || count <= 0) {
      return 0
    }

    return price / count
  }

  const formatPrice = (price) => {
    return Number(price || 0).toLocaleString('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })
  }

  const handlePackageChange = (e) => {
    const { name, value } = e.target

    unsavedChanges?.markDirty?.()

    setPackageForm((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const performOpenAddForm = () => {
    unsavedChanges?.markClean?.()

    setPackageForm({
      ...emptyForm,
      duration: '60 dk',
      lessonCount: 1,
      status: 'Aktif'
    })
    setEditingPackageId(null)
    setShowForm(true)
  }

  const openAddForm = () => {
    runProtectedAction(performOpenAddForm)
  }

  const performOpenEditForm = (item) => {
    unsavedChanges?.markClean?.()

    setPackageForm({
      name: item.name || '',
      instrument: item.instrument || '',
      duration: item.duration || '60 dk',
      lessonCount:
        item.lessonCount !== undefined
          ? item.lessonCount
          : 1,
      totalPrice:
        item.totalPrice !== undefined
          ? item.totalPrice
          : '',
      status: item.status || 'Aktif'
    })

    setEditingPackageId(item.id)
    setShowForm(true)
  }

  const openEditForm = (item) => {
    runProtectedAction(() =>
      performOpenEditForm(item)
    )
  }

  const performCloseForm = () => {
    unsavedChanges?.markClean?.()
    setPackageForm(emptyForm)
    setEditingPackageId(null)
    setShowForm(false)
  }

  const closeForm = () => {
    runProtectedAction(performCloseForm)
  }

  const savePackage = (e) => {
    e.preventDefault()

    const trimmedName = packageForm.name.trim()
    const trimmedInstrument = packageForm.instrument.trim()
    const lessonCount = Number(packageForm.lessonCount)
    const totalPrice = Number(packageForm.totalPrice)

    if (trimmedName === '') {
      alert('Paket adı zorunludur.')
      return
    }

    if (trimmedInstrument === '') {
      alert('Enstrüman / branş zorunludur.')
      return
    }

    if (!Number.isInteger(lessonCount) || lessonCount < 1) {
      alert('Paket içindeki ders sayısı 1 veya daha büyük bir tam sayı olmalıdır.')
      return
    }

    if (Number.isNaN(totalPrice) || totalPrice <= 0) {
      alert('Paket ücreti 0’dan büyük olmalıdır.')
      return
    }

    const unitPrice = calculateUnitPrice(totalPrice, lessonCount)

    const packageData = {
      id: editingPackageId || Date.now(),
      name: trimmedName,
      instrument: trimmedInstrument,
      duration: packageForm.duration,
      lessonCount,
      totalPrice,
      unitPrice,
      status: packageForm.status
    }

    if (editingPackageId) {
      setPackages(
        packages.map((item) =>
          item.id === editingPackageId ? packageData : item
        )
      )
    } else {
      setPackages([...packages, packageData])
    }

    /*
     * Kayıt başarıyla tamamlandığı için taslak artık temizdir.
     * performCloseForm doğrudan çağrılır; uyarı gösterilmez.
     */
    unsavedChanges?.markClean?.()
    performCloseForm()
  }

  const deletePackage = (id) => {
    const isConfirmed = window.confirm(
      'Bu paketi silmek istediğinize emin misiniz?'
    )

    if (!isConfirmed) {
      return
    }

    setPackages(packages.filter((item) => item.id !== id))
  }

  const unitPrice = calculateUnitPrice(
    packageForm.totalPrice,
    packageForm.lessonCount
  )

  return (
    <div className="dashboard-shell">
      <section className="page-card">
        <div>
          <span className="page-badge">Paket Yönetimi</span>
          <h1>Ders Paketleri</h1>
          <p>
            Ders paketlerini enstrüman, ders süresi, ders sayısı ve ücret
            bilgileriyle yönetin.
          </p>
        </div>

        <button
          className="manage-button"
          type="button"
          onClick={openAddForm}
        >
          + Paket Ekle
        </button>
      </section>

      {showForm && (
        <section className="student-form-card package-form-card">
          <div className="section-title-row">
            <h2>
              {editingPackageId ? 'Paket Düzenle' : 'Yeni Paket Ekle'}
            </h2>

            <button
              className="edit-section-button"
              type="button"
              onClick={closeForm}
            >
              Kapat
            </button>
          </div>

          <form className="package-form" onSubmit={savePackage}>
            <div className="form-grid">
              <div className="form-group">
                <label>Paket Adı</label>
                <input
                  name="name"
                  value={packageForm.name}
                  onChange={handlePackageChange}
                  placeholder="Örn: Aylık Gitar Özel Ders"
                />
              </div>

              <div className="form-group">
                <label>Enstrüman / Branş</label>
                <input
                  name="instrument"
                  list="instrument-options"
                  value={packageForm.instrument}
                  onChange={handlePackageChange}
                  placeholder="Örn: Gitar"
                />

                <datalist id="instrument-options">
                  {instrumentOptions.map((instrument) => (
                    <option key={instrument} value={instrument} />
                  ))}
                </datalist>
              </div>

              <div className="form-group">
                <label>Bir Dersin Süresi</label>
                <select
                  name="duration"
                  value={packageForm.duration}
                  onChange={handlePackageChange}
                >
                  <option value="30 dk">30 dakika</option>
                  <option value="45 dk">45 dakika</option>
                  <option value="60 dk">60 dakika</option>
                  <option value="90 dk">90 dakika</option>
                </select>
              </div>

              <div className="form-group">
                <label>Paket İçindeki Ders Sayısı</label>
                <input
                  type="number"
                  name="lessonCount"
                  value={packageForm.lessonCount}
                  onChange={handlePackageChange}
                  min="1"
                  step="1"
                  placeholder="Örn: 4"
                />
              </div>

              <div className="form-group">
                <label>Paket Ücreti</label>
                <input
                  type="number"
                  name="totalPrice"
                  value={packageForm.totalPrice}
                  onChange={handlePackageChange}
                  placeholder="Örn: 4000"
                  min="1"
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label>Durum</label>
                <select
                  name="status"
                  value={packageForm.status}
                  onChange={handlePackageChange}
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Pasif">Pasif</option>
                </select>
              </div>

              <div className="form-group full-width">
                <div className="package-calculation-box">
                  <div className="package-summary-description">
                    <span>Paket Özeti</span>
                    <p>
                      Paket içeriği ve birim ders ücreti, girilen bilgilere göre
                      otomatik hesaplanır.
                    </p>
                  </div>

                  <div className="package-calculation-grid package-summary-grid">
                    <div className="package-calculation-item">
                      <small>Toplam Ders</small>
                      <strong>{Number(packageForm.lessonCount || 0)} ders</strong>
                    </div>

                    <div className="package-calculation-item">
                      <small>Bir Dersin Süresi</small>
                      <strong>{packageForm.duration || '60 dk'}</strong>
                    </div>

                    <div className="package-calculation-item">
                      <small>Paket Ücreti</small>
                      <strong>₺{formatPrice(packageForm.totalPrice)}</strong>
                    </div>

                    <div className="package-calculation-item">
                      <small>Birim Ders Ücreti</small>
                      <strong>₺{formatPrice(unitPrice)}</strong>
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
              >
                İptal
              </button>

              <button type="submit" className="save-button">
                {editingPackageId ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="lesson-table-card">
        <div className="table-head">
          <div>
            <h2>Paket Listesi</h2>
            <p>Tanımlı ders paketleri ve paket ücret bilgileri</p>
          </div>

          <button className="lesson-count" type="button">
            {packages.length} paket
          </button>
        </div>

        <table className="lesson-table">
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
            {packages.length > 0 ? (
              packages.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.instrument}</td>
                  <td>{item.duration || '60 dk'}</td>
                  <td>{item.lessonCount}</td>
                  <td>₺{formatPrice(item.totalPrice)}</td>
                  <td>
                    ₺
                    {formatPrice(
                      item.unitPrice !== undefined
                        ? item.unitPrice
                        : calculateUnitPrice(item.totalPrice, item.lessonCount)
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        (item.status || 'Aktif') === 'Aktif'
                          ? 'status-badge paid'
                          : 'status-badge unpaid'
                      }
                    >
                      {item.status || 'Aktif'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="detail-button"
                        type="button"
                        onClick={() => openEditForm(item)}
                      >
                        Düzenle
                      </button>

                      <button
                        className="delete-button"
                        type="button"
                        onClick={() => deletePackage(item.id)}
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="empty-table">
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