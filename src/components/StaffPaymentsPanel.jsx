import {
  useEffect,
  useMemo,
  useState
} from 'react'

import RequiredStar
  from './RequiredStar'

import {
  cancelStaffPayment,
  createStaffPayment,
  getStaffPaymentsPage
} from '../services/financeService'

import {
  formatDate,
  formatPrice,
  getTodayKey
} from '../utils/dateHelpers'

const paymentTypes = [
  'Maaş',
  'Avans',
  'Prim',
  'Fazla Mesai',
  'Yol / Yemek',
  'Diğer'
]

const paymentMethods = [
  'Nakit',
  'Havale / EFT',
  'Kredi Kartı',
  'Banka Kartı'
]

function StaffPaymentsPanel({
  onChanged = () => {},
  unsavedChanges
}) {
  const today = getTodayKey()

  const emptyForm = useMemo(
    () => ({
      staffName: '',
      roleTitle: '',
      paymentType: '',
      paymentPeriod: '',
      amount: '',
      paymentDate: today,
      paymentMethod: '',
      referenceNumber: '',
      note: ''
    }),
    [today]
  )

  const [showForm, setShowForm] =
    useState(false)

  const [form, setForm] =
    useState(emptyForm)

  const [formDirty, setFormDirty] =
    useState(false)

  const [isSaving, setIsSaving] =
    useState(false)

  const [
    cancellingId,
    setCancellingId
  ] = useState(null)

  const [rows, setRows] =
    useState([])

  const [total, setTotal] =
    useState(0)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [reloadKey, setReloadKey] =
    useState(0)

  const [page, setPage] =
    useState(1)

  const [pageSize, setPageSize] =
    useState(10)

  const [searchText, setSearchText] =
    useState('')

  const [paymentType, setPaymentType] =
    useState('')

  const [
    paymentMethod,
    setPaymentMethod
  ] = useState('')

  const [startDate, setStartDate] =
    useState('')

  const [endDate, setEndDate] =
    useState('')

  const [sortOption, setSortOption] =
    useState('newest')

  useEffect(() => {
    let mounted = true

    const timeoutId =
      window.setTimeout(
        async () => {
          setLoading(true)
          setError('')

          try {
            const result =
              await getStaffPaymentsPage({
                page,
                pageSize,
                searchText,
                paymentType,
                paymentMethod,
                startDate,
                endDate,
                sortOption
              })

            if (!mounted) {
              return
            }

            const totalPages =
              Math.max(
                1,
                Math.ceil(
                  result.total /
                    pageSize
                )
              )

            if (page > totalPages) {
              setPage(totalPages)
              return
            }

            setRows(result.data)
            setTotal(result.total)
          } catch (loadError) {
            console.error(
              'Personel ödemeleri alınamadı:',
              loadError
            )

            if (mounted) {
              setError(
                loadError instanceof Error
                  ? loadError.message
                  : 'Personel ödemeleri alınamadı.'
              )
            }
          } finally {
            if (mounted) {
              setLoading(false)
            }
          }
        },
        searchText.trim()
          ? 350
          : 0
      )

    return () => {
      mounted = false
      window.clearTimeout(
        timeoutId
      )
    }
  }, [
    page,
    pageSize,
    searchText,
    paymentType,
    paymentMethod,
    startDate,
    endDate,
    sortOption,
    reloadKey
  ])

  const updateDirty = (dirty) => {
    setFormDirty(dirty)

    if (dirty) {
      unsavedChanges?.markDirty?.()
    } else {
      unsavedChanges?.markClean?.()
    }
  }

  const changeForm = (
    fieldName,
    value
  ) => {
    updateDirty(true)

    setForm((current) => ({
      ...current,
      [fieldName]: value
    }))
  }

  const performCloseForm = () => {
    setForm(emptyForm)
    setShowForm(false)
    updateDirty(false)
  }

  const closeForm = () => {
    if (
      formDirty &&
      unsavedChanges?.requestAction
    ) {
      unsavedChanges.requestAction(
        performCloseForm
      )
      return
    }

    performCloseForm()
  }

  const toggleForm = () => {
    if (showForm) {
      closeForm()
      return
    }

    setForm(emptyForm)
    updateDirty(false)
    setShowForm(true)
  }

  const savePayment = async (
    event
  ) => {
    event.preventDefault()

    if (isSaving) {
      return
    }

    const amount =
      Number(form.amount)

    if (!form.staffName.trim()) {
      alert(
        'Personel adı zorunludur.'
      )
      return
    }

    if (!form.roleTitle.trim()) {
      alert(
        'Personelin görevi zorunludur.'
      )
      return
    }

    if (!form.paymentType) {
      alert(
        'Ödeme türü seçiniz.'
      )
      return
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      alert(
        'Ödeme tutarı 0’dan büyük olmalıdır.'
      )
      return
    }

    if (!form.paymentDate) {
      alert(
        'Ödeme tarihi seçiniz.'
      )
      return
    }

    if (!form.paymentMethod) {
      alert(
        'Ödeme yöntemi seçiniz.'
      )
      return
    }

    setIsSaving(true)

    try {
      await createStaffPayment({
        ...form,
        staffName:
          form.staffName.trim(),
        roleTitle:
          form.roleTitle.trim(),
        amount,
        paymentPeriod:
          form.paymentPeriod.trim(),
        referenceNumber:
          form.referenceNumber.trim(),
        note:
          form.note.trim()
      })

      setPage(1)
      setReloadKey(
        (current) =>
          current + 1
      )

      onChanged()
      performCloseForm()
    } catch (saveError) {
      console.error(
        'Personel ödemesi kaydedilemedi:',
        saveError
      )

      alert(
        saveError instanceof Error
          ? saveError.message
          : 'Personel ödemesi kaydedilemedi.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const cancelPayment =
    async (payment) => {
      if (
        String(cancellingId) ===
        String(payment.id)
      ) {
        return
      }

      const confirmed =
        window.confirm(
          `${payment.staffName} için girilen ${payment.paymentType.toLocaleLowerCase('tr-TR')} ödemesi iptal edilecek. Devam edilsin mi?`
        )

      if (!confirmed) {
        return
      }

      setCancellingId(
        payment.id
      )

      try {
        await cancelStaffPayment(
          payment.id
        )

        setRows((current) =>
          current.filter(
            (item) =>
              String(item.id) !==
              String(payment.id)
          )
        )

        setTotal((current) =>
          Math.max(
            0,
            current - 1
          )
        )

        if (
          rows.length === 1 &&
          page > 1
        ) {
          setPage(
            (current) =>
              Math.max(
                1,
                current - 1
              )
          )
        }

        onChanged()
      } catch (cancelError) {
        console.error(
          'Personel ödemesi iptal edilemedi:',
          cancelError
        )

        alert(
          cancelError instanceof Error
            ? cancelError.message
            : 'Personel ödemesi iptal edilemedi.'
        )
      } finally {
        setCancellingId(null)
      }
    }

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total / pageSize
      )
    )

  const firstRecord =
    total === 0
      ? 0
      : (
          page - 1
        ) *
          pageSize +
        1

  const lastRecord =
    Math.min(
      page * pageSize,
      total
    )

  const clearFilters = () => {
    setSearchText('')
    setPaymentType('')
    setPaymentMethod('')
    setStartDate('')
    setEndDate('')
    setSortOption('newest')
    setPage(1)
  }

  return (
    <section className="finance-table-card">
      <div className="finance-section-heading">
        <div>
          <span className="finance-section-kicker">
            Personel Giderleri
          </span>

          <h2>Personel Ödemeleri</h2>

          <p>
            Maaş, avans, prim, fazla mesai ve diğer personel
            ödemelerini kaydedin.
          </p>
        </div>

        <button
          type="button"
          className="finance-primary-button"
          onClick={toggleForm}
        >
          + Personel Ödemesi Ekle
        </button>
      </div>

      {showForm && (
        <form
          className="finance-entry-form"
          onSubmit={savePayment}
        >
          <div className="finance-entry-form-heading">
            <h3>Yeni Personel Ödemesi</h3>
            <p>
              Personele yapılan gerçekleşmiş ödemeyi kaydedin.
            </p>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>
                Personel Adı <RequiredStar />
              </label>

              <input
                value={form.staffName}
                onChange={(event) =>
                  changeForm(
                    'staffName',
                    event.target.value
                  )
                }
                placeholder="Örn: Meltem Yılmaz"
              />
            </div>

            <div className="form-group">
              <label>
                Görevi <RequiredStar />
              </label>

              <input
                value={form.roleTitle}
                onChange={(event) =>
                  changeForm(
                    'roleTitle',
                    event.target.value
                  )
                }
                placeholder="Örn: Sekreter"
              />
            </div>

            <div className="form-group">
              <label>
                Ödeme Türü <RequiredStar />
              </label>

              <select
                value={form.paymentType}
                onChange={(event) =>
                  changeForm(
                    'paymentType',
                    event.target.value
                  )
                }
              >
                <option value="">
                  Ödeme türü seçiniz
                </option>

                {paymentTypes.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="form-group">
              <label>Dönem</label>

              <input
                value={form.paymentPeriod}
                onChange={(event) =>
                  changeForm(
                    'paymentPeriod',
                    event.target.value
                  )
                }
                placeholder="Örn: Ağustos 2026"
              />
            </div>

            <div className="form-group">
              <label>
                Tutar <RequiredStar />
              </label>

              <input
                type="number"
                value={form.amount}
                onChange={(event) =>
                  changeForm(
                    'amount',
                    event.target.value
                  )
                }
                min="0.01"
                step="0.01"
                placeholder="Örn: 25000"
              />
            </div>

            <div className="form-group">
              <label>
                Ödeme Tarihi <RequiredStar />
              </label>

              <input
                type="date"
                value={form.paymentDate}
                onChange={(event) =>
                  changeForm(
                    'paymentDate',
                    event.target.value
                  )
                }
              />
            </div>

            <div className="form-group">
              <label>
                Ödeme Yöntemi <RequiredStar />
              </label>

              <select
                value={form.paymentMethod}
                onChange={(event) =>
                  changeForm(
                    'paymentMethod',
                    event.target.value
                  )
                }
              >
                <option value="">
                  Seçiniz
                </option>

                {paymentMethods.map(
                  (method) => (
                    <option
                      key={method}
                      value={method}
                    >
                      {method}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="form-group">
              <label>
                Dekont / İşlem Numarası
              </label>

              <input
                value={form.referenceNumber}
                onChange={(event) =>
                  changeForm(
                    'referenceNumber',
                    event.target.value
                  )
                }
                placeholder="İsteğe bağlı"
              />
            </div>

            <div className="form-group full-width">
              <label>Not</label>

              <textarea
                value={form.note}
                onChange={(event) =>
                  changeForm(
                    'note',
                    event.target.value
                  )
                }
                placeholder="Ödemeyle ilgili açıklama"
              />
            </div>
          </div>

          <div className="form-actions finance-form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={closeForm}
            >
              İptal
            </button>

            <button
              type="submit"
              className="save-button"
              disabled={isSaving}
            >
              {isSaving
                ? 'Kaydediliyor...'
                : 'Ödemeyi Kaydet'}
            </button>
          </div>
        </form>
      )}

      <div className="finance-income-filter-panel">
        <div className="finance-income-filter-grid">
          <div className="form-group">
            <label>Personel Ödemesi Ara</label>

            <input
              value={searchText}
              onChange={(event) => {
                setSearchText(
                  event.target.value
                )
                setPage(1)
              }}
              placeholder="Personel, görev, dönem veya not"
            />
          </div>

          <div className="form-group">
            <label>Ödeme Türü</label>

            <select
              value={paymentType}
              onChange={(event) => {
                setPaymentType(
                  event.target.value
                )
                setPage(1)
              }}
            >
              <option value="">
                Tüm türler
              </option>

              {paymentTypes.map(
                (type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="form-group">
            <label>Ödeme Yöntemi</label>

            <select
              value={paymentMethod}
              onChange={(event) => {
                setPaymentMethod(
                  event.target.value
                )
                setPage(1)
              }}
            >
              <option value="">
                Tüm yöntemler
              </option>

              {paymentMethods.map(
                (method) => (
                  <option
                    key={method}
                    value={method}
                  >
                    {method}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="form-group">
            <label>Başlangıç Tarihi</label>

            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(
                  event.target.value
                )
                setPage(1)
              }}
            />
          </div>

          <div className="form-group">
            <label>Bitiş Tarihi</label>

            <input
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(
                  event.target.value
                )
                setPage(1)
              }}
            />
          </div>
        </div>

        <div className="staff-payment-filter-footer">
          <button
            type="button"
            className="cancel-button"
            onClick={clearFilters}
          >
            Filtreleri Temizle
          </button>

          <div className="staff-payment-filter-actions">
            <div className="form-group staff-payment-sort-control">
              <label>Sırala</label>

              <select
                value={sortOption}
                onChange={(event) => {
                  setSortOption(
                    event.target.value
                  )
                  setPage(1)
                }}
              >
                <option value="newest">
                  En yeni tarih
                </option>
                <option value="oldest">
                  En eski tarih
                </option>
                <option value="amountDesc">
                  Tutar yüksek-düşük
                </option>
                <option value="amountAsc">
                  Tutar düşük-yüksek
                </option>
                <option value="staffAsc">
                  Personel A-Z
                </option>
                <option value="staffDesc">
                  Personel Z-A
                </option>
              </select>
            </div>

            <div className="form-group staff-payment-page-size-control">
              <label>Sayfa başına</label>

              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(
                    Number(
                      event.target.value
                    )
                  )
                  setPage(1)
                }}
              >
                <option value="10">10 kayıt</option>
                <option value="25">25 kayıt</option>
                <option value="50">50 kayıt</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="payment-table-wrapper">
        <table className="lesson-table finance-data-table">
          <thead>
            <tr>
              <th>Personel</th>
              <th>Görev</th>
              <th>Ödeme Türü</th>
              <th>Dönem</th>
              <th>Tutar</th>
              <th>Ödeme Tarihi</th>
              <th>Yöntem</th>
              <th>İşlem</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="8"
                  className="empty-table"
                >
                  Personel ödemeleri yükleniyor...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan="8"
                  className="empty-table"
                >
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan="8"
                  className="empty-table"
                >
                  Personel ödeme kaydı bulunmamaktadır.
                </td>
              </tr>
            ) : (
              rows.map(
                (payment) => (
                  <tr key={payment.id}>
                    <td>
                      <strong>
                        {payment.staffName}
                      </strong>
                    </td>

                    <td>
                      {payment.roleTitle}
                    </td>

                    <td>
                      {payment.paymentType}
                    </td>

                    <td>
                      {payment.paymentPeriod || '-'}
                    </td>

                    <td>
                      <strong>
                        ₺{formatPrice(
                          payment.amount
                        )}
                      </strong>
                    </td>

                    <td>
                      {formatDate(
                        payment.paymentDate
                      )}
                    </td>

                    <td>
                      {payment.paymentMethod}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="delete-button"
                        onClick={() =>
                          cancelPayment(
                            payment
                          )
                        }
                        disabled={
                          String(cancellingId) ===
                          String(payment.id)
                        }
                      >
                        {String(cancellingId) ===
                        String(payment.id)
                          ? 'İptal Ediliyor...'
                          : 'İptal Et'}
                      </button>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>

      <div className="finance-pagination">
        <span>
          {loading
            ? 'Kayıtlar yükleniyor...'
            : total === 0
              ? 'Gösterilecek kayıt yok'
              : `${firstRecord}–${lastRecord} / ${total} kayıt`}
        </span>

        <div>
          <button
            type="button"
            className="payment-pagination-button"
            onClick={() =>
              setPage(
                (current) =>
                  Math.max(
                    1,
                    current - 1
                  )
              )
            }
            disabled={
              page === 1 ||
              loading
            }
          >
            Önceki
          </button>

          <span className="finance-pagination-current">
            {page} / {totalPages}
          </span>

          <button
            type="button"
            className="payment-pagination-button"
            onClick={() =>
              setPage(
                (current) =>
                  Math.min(
                    totalPages,
                    current + 1
                  )
              )
            }
            disabled={
              page === totalPages ||
              loading ||
              total === 0
            }
          >
            Sonraki
          </button>
        </div>
      </div>
    </section>
  )
}

export default StaffPaymentsPanel