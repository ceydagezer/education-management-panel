import {
  Fragment,
  useEffect,
  useState
} from 'react'

import {
  getAllFinanceIncomeExpenseReportRows,
  getAllStaffPaymentsReportRows,
  getAllStudentPaymentReportRows,
  getAllStudentTrackingReportRows,
  getAllTeacherEarningsReportRows,
  getAllTeacherPaymentsReportRows,
  getAllTeacherTrackingReportRows,
  getFinanceIncomeExpenseReportPage,
  getFinanceIncomeExpenseReportSummary,
  getStaffPaymentsReportPage,
  getStudentPaymentReportPage,
  getStudentTrackingReportPage,
  getTeacherEarningReportDetails,
  getTeacherEarningsReportPage,
  getTeacherPaymentsReportPage,
  getTeacherTrackingDetails,
  getTeacherTrackingReportPage
} from '../services/reportService'

import {
  formatDate,
  getTodayKey
} from '../utils/dateHelpers'

import '../styles/reports.css'

const reportGroups = [
  {
    id: 'student',
    label: 'Öğrenci Raporları',
    items: [
      {
        id: 'student-tracking',
        label: 'Öğrenci Takip',
        title: 'Öğrenci Takip Raporu',
        description:
          'Öğrencilerin cinsiyet, öğretmen, paket, grup ve kayıt bilgilerini görüntüleyin.'
      },
      {
        id: 'student-payments',
        label: 'Öğrenci Ödeme',
        title: 'Öğrenci Ödeme Raporu',
        description:
          'Öğrencilerin paket ücretlerini, yapılan tahsilatları ve kalan tutarlarını görüntüleyin.'
      }
    ]
  },
  {
    id: 'teacher',
    label: 'Öğretmen Raporları',
    items: [
      {
        id: 'teacher-tracking',
        label: 'Öğretmen Takip',
        title: 'Öğretmen Takip Raporu',
        description:
          'Öğretmenlerin branşlarını, öğrencilerini, paketlerini ve öğrenci kayıt tarihlerini inceleyin.'
      },
      {
        id: 'teacher-earnings',
        label: 'Öğretmen Hakediş',
        title: 'Öğretmen Hakediş Raporu',
        description:
          'Öğretmenlerin yapılan ders, hakediş, ödenen ve kalan tutarlarını inceleyin.'
      },
      {
        id: 'teacher-payments',
        label: 'Öğretmen Ödemeleri',
        title: 'Öğretmen Ödemeleri Raporu',
        description:
          'Öğretmenlere yapılan ödeme hareketlerini görüntüleyin.'
      }
    ]
  },
  {
    id: 'finance',
    label: 'Finans Raporları',
    items: [
      {
        id: 'staff-payments',
        label: 'Personel Ödemeleri',
        title: 'Personel Ödemeleri Raporu',
        description:
          'Maaş, avans, prim ve diğer personel ödemelerini görüntüleyin.'
      },
      {
        id: 'income-expense',
        label: 'Gelir-Gider',
        title: 'Gelir-Gider Raporu',
        description:
          'Gelirleri, giderleri ve net bakiyeyi tek raporda inceleyin.'
      }
    ]
  }
]

const reportTabs = reportGroups.flatMap(
  (group) => group.items
)

function getReadableGender(gender) {
  const normalizedGender =
    String(gender || '')
      .trim()
      .toLocaleLowerCase('tr-TR')

  if (
    normalizedGender === 'kadın' ||
    normalizedGender === 'kadin' ||
    normalizedGender === 'female'
  ) {
    return 'Kadın'
  }

  if (
    normalizedGender === 'erkek' ||
    normalizedGender === 'male'
  ) {
    return 'Erkek'
  }

  return gender || '-'
}

function formatCurrency(value) {
  return new Intl.NumberFormat(
    'tr-TR',
    {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(
    Number(value || 0)
  )
}

function getReadablePaymentPeriod(value) {
  const normalizedValue =
    String(value || '')
      .trim()
      .toLocaleLowerCase('tr-TR')

  const labels = {
    monthly: 'Aylık',
    aylık: 'Aylık',
    aylik: 'Aylık',
    weekly: 'Haftalık',
    haftalık: 'Haftalık',
    haftalik: 'Haftalık',
    one_time: 'Tek Seferlik',
    'tek seferlik': 'Tek Seferlik',
    installment: 'Taksitli',
    taksitli: 'Taksitli'
  }

  return (
    labels[normalizedValue] ||
    value ||
    '-'
  )
}

function getPaymentStatusClass(status) {
  const normalizedStatus =
    String(status || '')
      .trim()
      .toLocaleLowerCase('tr-TR')

  if (
    normalizedStatus === 'ödendi'
  ) {
    return 'paid'
  }

  if (
    normalizedStatus.includes(
      'gecikmiş'
    )
  ) {
    return 'overdue'
  }

  if (
    normalizedStatus === 'kısmi'
  ) {
    return 'partial'
  }

  if (
    normalizedStatus ===
    'ödeme günü bugün'
  ) {
    return 'today'
  }

  if (
    normalizedStatus.includes(
      'girilmedi'
    )
  ) {
    return 'missing'
  }

  return 'waiting'
}


function formatPercentage(value) {
  const numericValue =
    Number(value || 0)

  return `%${new Intl.NumberFormat(
    'tr-TR',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  ).format(numericValue)}`
}

function getReadableLessonStatus(value) {
  const normalizedValue =
    String(value || '')
      .trim()
      .toLocaleLowerCase('tr-TR')

  const labels = {
    done: 'Yapıldı',
    completed: 'Yapıldı',
    yapıldı: 'Yapıldı',
    yapildi: 'Yapıldı',
    makeup_done:
      'Telafi Yapıldı',
    makeup_completed:
      'Telafi Yapıldı',
    'telafi yapıldı':
      'Telafi Yapıldı',
    'telafi yapildi':
      'Telafi Yapıldı'
  }

  return (
    labels[normalizedValue] ||
    value ||
    '-'
  )
}

function getTeacherEarningStatusClass(
  className
) {
  if (className === 'paid') {
    return 'paid'
  }

  if (className === 'partial') {
    return 'partial'
  }

  if (className === 'waiting') {
    return 'waiting'
  }

  return 'missing'
}

async function getPdfMake() {
  const [
    pdfMakeModule,
    pdfFontsModule
  ] = await Promise.all([
    import(
      'pdfmake/build/pdfmake'
    ),
    import(
      'pdfmake/build/vfs_fonts'
    )
  ])

  const pdfMake =
    pdfMakeModule.default ||
    pdfMakeModule

  const pdfFonts =
    pdfFontsModule.default ||
    pdfFontsModule

  const virtualFonts =
    pdfFonts?.pdfMake?.vfs ||
    pdfFonts?.vfs ||
    pdfFonts

  if (
    typeof pdfMake
      .addVirtualFileSystem ===
    'function'
  ) {
    pdfMake.addVirtualFileSystem(
      virtualFonts
    )
  } else {
    pdfMake.vfs =
      virtualFonts
  }

  return pdfMake
}

async function downloadWorkbook(
  workbook,
  fileName
) {
  const buffer =
    await workbook.xlsx.writeBuffer()

  const blob =
    new Blob(
      [buffer],
      {
        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    )

  const url =
    URL.createObjectURL(blob)

  const link =
    document.createElement('a')

  link.href = url
  link.download = fileName

  document.body.appendChild(link)

  link.click()
  link.remove()

  window.setTimeout(
    () => {
      URL.revokeObjectURL(url)
    },
    100
  )
}

function ReportExportButtons({
  exporting,
  loading,
  onExcel,
  onPdf
}) {
  return (
    <div className="student-report-actions">
      <button
        type="button"
        className="report-excel-button"
        onClick={onExcel}
        disabled={
          Boolean(exporting) ||
          loading
        }
      >
        {exporting === 'excel'
          ? 'Excel hazırlanıyor...'
          : 'Excel İndir'}
      </button>

      <button
        type="button"
        className="report-pdf-button"
        onClick={onPdf}
        disabled={
          Boolean(exporting) ||
          loading
        }
      >
        {exporting === 'pdf'
          ? 'PDF hazırlanıyor...'
          : 'PDF İndir'}
      </button>
    </div>
  )
}

function ReportPagination({
  total,
  page,
  pageSize,
  loading,
  onPageChange
}) {
  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total / pageSize
      )
    )

  return (
    <div className="report-pagination">
      <span>
        {total === 0
          ? 'Gösterilecek kayıt yok'
          : `${total} kayıt`}
      </span>

      <div>
        <button
          type="button"
          className="payment-pagination-button"
          onClick={() =>
            onPageChange(
              Math.max(
                1,
                page - 1
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

        <strong>
          {page} / {totalPages}
        </strong>

        <button
          type="button"
          className="payment-pagination-button"
          onClick={() =>
            onPageChange(
              Math.min(
                totalPages,
                page + 1
              )
            )
          }
          disabled={
            page === totalPages ||
            total === 0 ||
            loading
          }
        >
          Sonraki
        </button>
      </div>
    </div>
  )
}

function StudentTrackingReport() {
  const [rows, setRows] =
    useState([])

  const [total, setTotal] =
    useState(0)

  const [page, setPage] =
    useState(1)

  const [pageSize, setPageSize] =
    useState(10)

  const [
    searchText,
    setSearchText
  ] = useState('')

  const [
    studentStatus,
    setStudentStatus
  ] = useState('active')

  const [
    sortOption,
    setSortOption
  ] = useState('nameAsc')

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [exporting, setExporting] =
    useState('')

  useEffect(() => {
    let isMounted = true

    const timeoutId =
      window.setTimeout(
        async () => {
          setLoading(true)
          setError('')

          try {
            const result =
              await getStudentTrackingReportPage({
                page,
                pageSize,
                searchText,
                studentStatus,
                sortOption
              })

            if (!isMounted) {
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

            if (
              page >
              totalPages
            ) {
              setPage(totalPages)
              return
            }

            setRows(result.data)
            setTotal(result.total)
          } catch (loadError) {
            console.error(
              'Öğrenci takip raporu yüklenemedi:',
              loadError
            )

            if (isMounted) {
              setError(
                loadError instanceof Error
                  ? loadError.message
                  : 'Öğrenci takip raporu yüklenemedi.'
              )
            }
          } finally {
            if (isMounted) {
              setLoading(false)
            }
          }
        },
        searchText.trim()
          ? 350
          : 0
      )

    return () => {
      isMounted = false

      window.clearTimeout(
        timeoutId
      )
    }
  }, [
    page,
    pageSize,
    searchText,
    studentStatus,
    sortOption
  ])

  const exportFilters = {
    searchText,
    studentStatus
  }

  const clearFilters = () => {
    setSearchText('')
    setStudentStatus('active')
    setSortOption('nameAsc')
    setPage(1)
  }

  const exportExcel =
    async () => {
      if (exporting) {
        return
      }

      setExporting('excel')

      try {
        const exportRows =
          await getAllStudentTrackingReportRows(
            exportFilters
          )

        if (
          exportRows.length === 0
        ) {
          alert(
            'Excel’e aktarılacak kayıt bulunmamaktadır.'
          )

          return
        }

        const excelModule =
          await import('exceljs')

        const ExcelJS =
          excelModule.default ||
          excelModule

        const workbook =
          new ExcelJS.Workbook()

        const worksheet =
          workbook.addWorksheet(
            'Öğrenci Takip'
          )

        worksheet.columns = [
          {
            header: 'Öğrenci',
            key: 'studentName',
            width: 28
          },
          {
            header: 'Cinsiyet',
            key: 'gender',
            width: 14
          },
          {
            header: 'Öğretmen',
            key: 'teacherNames',
            width: 28
          },
          {
            header: 'Paketler',
            key: 'packageNames',
            width: 34
          },
          {
            header: 'Grup',
            key: 'groupNames',
            width: 26
          },
          {
            header: 'Kayıt Tarihi',
            key: 'registerDate',
            width: 16
          },
          {
            header: 'Durum',
            key: 'status',
            width: 13
          }
        ]

        exportRows.forEach(
          (row) => {
            worksheet.addRow({
              studentName:
                row.studentName,

              gender:
                getReadableGender(
                  row.gender
                ),

              teacherNames:
                row.teacherNames ||
                '-',

              packageNames:
                row.packageNames ||
                '-',

              groupNames:
                row.groupNames ||
                '-',

              registerDate:
                row.registerDate
                  ? formatDate(
                      row.registerDate
                    )
                  : '-',

              status:
                row.studentIsActive
                  ? 'Aktif'
                  : 'Pasif'
            })
          }
        )

        worksheet.getRow(
          1
        ).font = {
          bold: true
        }

        worksheet.views = [
          {
            state: 'frozen',
            ySplit: 1
          }
        ]

        worksheet.autoFilter = {
          from: 'A1',
          to: 'G1'
        }

        await downloadWorkbook(
          workbook,
          `ogrenci-takip-raporu-${getTodayKey()}.xlsx`
        )
      } catch (exportError) {
        console.error(
          'Öğrenci takip Excel hatası:',
          exportError
        )

        alert(
          exportError instanceof Error
            ? exportError.message
            : 'Excel dosyası oluşturulamadı.'
        )
      } finally {
        setExporting('')
      }
    }

  const exportPdf =
    async () => {
      if (exporting) {
        return
      }

      setExporting('pdf')

      try {
        const exportRows =
          await getAllStudentTrackingReportRows(
            exportFilters
          )

        if (
          exportRows.length === 0
        ) {
          alert(
            'PDF’e aktarılacak kayıt bulunmamaktadır.'
          )

          return
        }

        const pdfMake =
          await getPdfMake()

        const tableBody = [
          [
            {
              text: 'Öğrenci',
              bold: true
            },
            {
              text: 'Cinsiyet',
              bold: true
            },
            {
              text: 'Öğretmen',
              bold: true
            },
            {
              text: 'Paketler',
              bold: true
            },
            {
              text: 'Grup',
              bold: true
            },
            {
              text: 'Kayıt Tarihi',
              bold: true
            },
            {
              text: 'Durum',
              bold: true
            }
          ],

          ...exportRows.map(
            (row) => [
              row.studentName,

              getReadableGender(
                row.gender
              ),

              row.teacherNames ||
                '-',

              row.packageNames ||
                '-',

              row.groupNames ||
                '-',

              row.registerDate
                ? formatDate(
                    row.registerDate
                  )
                : '-',

              row.studentIsActive
                ? 'Aktif'
                : 'Pasif'
            ]
          )
        ]

        pdfMake
          .createPdf({
            pageSize: 'A4',

            pageOrientation:
              'landscape',

            pageMargins:
              [24, 52, 24, 34],

            header: {
              margin:
                [24, 16, 24, 0],

              columns: [
                {
                  text:
                    'ARTI AKADEMİ',

                  bold: true,

                  color:
                    '#0B84A5'
                },
                {
                  text:
                    'ÖĞRENCİ TAKİP RAPORU',

                  alignment:
                    'right',

                  bold: true
                }
              ]
            },

            content: [
              {
                table: {
                  headerRows: 1,

                  widths: [
                    105,
                    52,
                    95,
                    125,
                    90,
                    62,
                    45
                  ],

                  body:
                    tableBody
                },

                layout:
                  'lightHorizontalLines'
              }
            ],

            defaultStyle: {
              font: 'Roboto',
              fontSize: 8,
              alignment: 'center'
            }
          })
          .download(
            `ogrenci-takip-raporu-${getTodayKey()}.pdf`
          )
      } catch (exportError) {
        console.error(
          'Öğrenci takip PDF hatası:',
          exportError
        )

        alert(
          exportError instanceof Error
            ? exportError.message
            : 'PDF dosyası oluşturulamadı.'
        )
      } finally {
        setExporting('')
      }
    }

  return (
    <>
      <ReportExportButtons
        exporting={exporting}
        loading={loading}
        onExcel={exportExcel}
        onPdf={exportPdf}
      />

      <div className="report-toolbar">
        <div className="report-filter-grid student-report-filter-grid">
          <div className="form-group">
            <label>
              Öğrenci Ara
            </label>

            <input
              value={searchText}
              onChange={(event) => {
                setSearchText(
                  event.target.value
                )

                setPage(1)
              }}
              placeholder="Öğrenci, öğretmen, paket veya grup"
            />
          </div>

          <div className="form-group">
            <label>
              Öğrenci Durumu
            </label>

            <select
              value={studentStatus}
              onChange={(event) => {
                setStudentStatus(
                  event.target.value
                )

                setPage(1)
              }}
            >
              <option value="active">
                Aktif öğrenciler
              </option>

              <option value="passive">
                Pasif öğrenciler
              </option>

              <option value="all">
                Tüm öğrenciler
              </option>
            </select>
          </div>
        </div>

        <div className="report-toolbar-footer">
          <button
            type="button"
            className="cancel-button"
            onClick={clearFilters}
          >
            Filtreleri Temizle
          </button>

          <div className="report-toolbar-actions">
            <select
              value={sortOption}
              onChange={(event) => {
                setSortOption(
                  event.target.value
                )

                setPage(1)
              }}
            >
              <option value="nameAsc">
                Öğrenci A-Z
              </option>

              <option value="nameDesc">
                Öğrenci Z-A
              </option>

              <option value="newest">
                En yeni kayıt
              </option>

              <option value="oldest">
                En eski kayıt
              </option>
            </select>

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
              <option value="10">
                10 kayıt
              </option>

              <option value="25">
                25 kayıt
              </option>

              <option value="50">
                50 kayıt
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className="report-table-wrapper">
        <table className="report-table student-tracking-report-table">
          <thead>
            <tr>
              <th>Öğrenci</th>
              <th>Cinsiyet</th>
              <th>Öğretmen</th>
              <th>Paketler</th>
              <th>Grup</th>
              <th>Kayıt Tarihi</th>
              <th>Durum</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="7"
                  className="empty-table"
                >
                  Rapor yükleniyor...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan="7"
                  className="empty-table"
                >
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan="7"
                  className="empty-table"
                >
                  Filtrelere uygun öğrenci kaydı bulunamadı.
                </td>
              </tr>
            ) : (
              rows.map(
                (row) => (
                  <tr
                    key={
                      row.studentId
                    }
                  >
                    <td>
                      <strong>
                        {row.studentName}
                      </strong>
                    </td>

                    <td>
                      {getReadableGender(
                        row.gender
                      )}
                    </td>

                    <td>
                      {row.teacherNames ||
                        '-'}
                    </td>

                    <td>
                      {row.packageNames ||
                        '-'}
                    </td>

                    <td>
                      {row.groupNames ||
                        '-'}
                    </td>

                    <td>
                      {row.registerDate
                        ? formatDate(
                            row.registerDate
                          )
                        : '-'}
                    </td>

                    <td>
                      <span
                        className={`report-status-badge ${
                          row.studentIsActive
                            ? 'active'
                            : 'passive'
                        }`}
                      >
                        {row.studentIsActive
                          ? 'Aktif'
                          : 'Pasif'}
                      </span>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>

      <ReportPagination
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
      />
    </>
  )
}

function StudentPaymentReport() {
  const [rows, setRows] =
    useState([])

  const [total, setTotal] =
    useState(0)

  const [page, setPage] =
    useState(1)

  const [pageSize, setPageSize] =
    useState(10)

  const [
    searchText,
    setSearchText
  ] = useState('')

  const [
    studentStatus,
    setStudentStatus
  ] = useState('active')

  const [
    paymentStatus,
    setPaymentStatus
  ] = useState('all')

  const [
    sortOption,
    setSortOption
  ] = useState('nameAsc')

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [exporting, setExporting] =
    useState('')

  useEffect(() => {
    let isMounted = true

    const timeoutId =
      window.setTimeout(
        async () => {
          setLoading(true)
          setError('')

          try {
            const result =
              await getStudentPaymentReportPage({
                page,
                pageSize,
                searchText,
                studentStatus,
                paymentStatus,
                sortOption
              })

            if (!isMounted) {
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

            if (
              page >
              totalPages
            ) {
              setPage(totalPages)
              return
            }

            setRows(result.data)
            setTotal(result.total)
          } catch (loadError) {
            console.error(
              'Öğrenci ödeme raporu yüklenemedi:',
              loadError
            )

            if (isMounted) {
              setError(
                loadError instanceof Error
                  ? loadError.message
                  : 'Öğrenci ödeme raporu yüklenemedi.'
              )
            }
          } finally {
            if (isMounted) {
              setLoading(false)
            }
          }
        },
        searchText.trim()
          ? 350
          : 0
      )

    return () => {
      isMounted = false

      window.clearTimeout(
        timeoutId
      )
    }
  }, [
    page,
    pageSize,
    searchText,
    studentStatus,
    paymentStatus,
    sortOption
  ])

  const exportFilters = {
    searchText,
    studentStatus,
    paymentStatus
  }

  const clearFilters = () => {
    setSearchText('')
    setStudentStatus('active')
    setPaymentStatus('all')
    setSortOption('nameAsc')
    setPage(1)
  }

  const exportExcel =
    async () => {
      if (exporting) {
        return
      }

      setExporting('excel')

      try {
        const exportRows =
          await getAllStudentPaymentReportRows(
            exportFilters
          )

        if (
          exportRows.length === 0
        ) {
          alert(
            'Excel’e aktarılacak ödeme kaydı bulunmamaktadır.'
          )

          return
        }

        const excelModule =
          await import('exceljs')

        const ExcelJS =
          excelModule.default ||
          excelModule

        const workbook =
          new ExcelJS.Workbook()

        const worksheet =
          workbook.addWorksheet(
            'Öğrenci Ödeme'
          )

        worksheet.columns = [
          {
            header: 'Öğrenci',
            key: 'studentName',
            width: 28
          },
          {
            header: 'Paket',
            key: 'packageName',
            width: 28
          },
          {
            header: 'Öğretmen',
            key: 'teacherName',
            width: 24
          },
          {
            header: 'Ödeme Dönemi',
            key: 'paymentPeriod',
            width: 16
          },
          {
            header: 'Paket Ücreti',
            key: 'agreedPrice',
            width: 17
          },
          {
            header: 'Ödenen',
            key: 'paidAmount',
            width: 17
          },
          {
            header: 'Kalan',
            key: 'remainingAmount',
            width: 17
          },
          {
            header: 'Son Ödeme',
            key: 'lastPaymentDate',
            width: 16
          },
          {
            header: 'Sonraki Ödeme',
            key: 'nextPaymentDate',
            width: 17
          },
          {
            header: 'Ödeme Durumu',
            key: 'paymentStatus',
            width: 22
          }
        ]

        exportRows.forEach(
          (row) => {
            worksheet.addRow({
              studentName:
                row.studentName,

              packageName:
                row.packageName ||
                '-',

              teacherName:
                row.teacherName ||
                '-',

              paymentPeriod:
                getReadablePaymentPeriod(
                  row.paymentPeriod
                ),

              agreedPrice:
                row.agreedPrice,

              paidAmount:
                row.paidAmount,

              remainingAmount:
                row.remainingAmount,

              lastPaymentDate:
                row.lastPaymentDate
                  ? formatDate(
                      row.lastPaymentDate
                    )
                  : '-',

              nextPaymentDate:
                row.nextPaymentDate
                  ? formatDate(
                      row.nextPaymentDate
                    )
                  : '-',

              paymentStatus:
                row.paymentStatus ||
                '-'
            })
          }
        )

        worksheet.getRow(
          1
        ).font = {
          bold: true
        }

        worksheet.getColumn(
          'agreedPrice'
        ).numFmt =
          '#,##0.00 [$₺-tr-TR]'

        worksheet.getColumn(
          'paidAmount'
        ).numFmt =
          '#,##0.00 [$₺-tr-TR]'

        worksheet.getColumn(
          'remainingAmount'
        ).numFmt =
          '#,##0.00 [$₺-tr-TR]'

        worksheet.views = [
          {
            state: 'frozen',
            ySplit: 1
          }
        ]

        worksheet.autoFilter = {
          from: 'A1',
          to: 'J1'
        }

        await downloadWorkbook(
          workbook,
          `ogrenci-odeme-raporu-${getTodayKey()}.xlsx`
        )
      } catch (exportError) {
        console.error(
          'Öğrenci ödeme Excel hatası:',
          exportError
        )

        alert(
          exportError instanceof Error
            ? exportError.message
            : 'Excel dosyası oluşturulamadı.'
        )
      } finally {
        setExporting('')
      }
    }

  const exportPdf =
    async () => {
      if (exporting) {
        return
      }

      setExporting('pdf')

      try {
        const exportRows =
          await getAllStudentPaymentReportRows(
            exportFilters
          )

        if (
          exportRows.length === 0
        ) {
          alert(
            'PDF’e aktarılacak ödeme kaydı bulunmamaktadır.'
          )

          return
        }

        const pdfMake =
          await getPdfMake()

        const tableBody = [
          [
            {
              text: 'Öğrenci',
              bold: true
            },
            {
              text: 'Paket',
              bold: true
            },
            {
              text: 'Öğretmen',
              bold: true
            },
            {
              text: 'Dönem',
              bold: true
            },
            {
              text: 'Ücret',
              bold: true
            },
            {
              text: 'Ödenen',
              bold: true
            },
            {
              text: 'Kalan',
              bold: true
            },
            {
              text: 'Son Ödeme',
              bold: true
            },
            {
              text: 'Sonraki',
              bold: true
            },
            {
              text: 'Durum',
              bold: true
            }
          ],

          ...exportRows.map(
            (row) => [
              row.studentName,

              row.packageName ||
                '-',

              row.teacherName ||
                '-',

              getReadablePaymentPeriod(
                row.paymentPeriod
              ),

              formatCurrency(
                row.agreedPrice
              ),

              formatCurrency(
                row.paidAmount
              ),

              formatCurrency(
                row.remainingAmount
              ),

              row.lastPaymentDate
                ? formatDate(
                    row.lastPaymentDate
                  )
                : '-',

              row.nextPaymentDate
                ? formatDate(
                    row.nextPaymentDate
                  )
                : '-',

              row.paymentStatus ||
                '-'
            ]
          )
        ]

        pdfMake
          .createPdf({
            pageSize: 'A4',

            pageOrientation:
              'landscape',

            pageMargins:
              [20, 52, 20, 32],

            header: {
              margin:
                [20, 16, 20, 0],

              columns: [
                {
                  text:
                    'ARTI AKADEMİ',

                  bold: true,

                  color:
                    '#0B84A5'
                },
                {
                  text:
                    'ÖĞRENCİ ÖDEME RAPORU',

                  alignment:
                    'right',

                  bold: true
                }
              ]
            },

            content: [
              {
                table: {
                  headerRows: 1,

                  widths: [
                    75,
                    72,
                    65,
                    42,
                    55,
                    55,
                    55,
                    52,
                    52,
                    66
                  ],

                  body:
                    tableBody
                },

                layout:
                  'lightHorizontalLines'
              }
            ],

            defaultStyle: {
              font: 'Roboto',
              fontSize: 6.8,
              alignment: 'center'
            }
          })
          .download(
            `ogrenci-odeme-raporu-${getTodayKey()}.pdf`
          )
      } catch (exportError) {
        console.error(
          'Öğrenci ödeme PDF hatası:',
          exportError
        )

        alert(
          exportError instanceof Error
            ? exportError.message
            : 'PDF dosyası oluşturulamadı.'
        )
      } finally {
        setExporting('')
      }
    }

  return (
    <>
      <ReportExportButtons
        exporting={exporting}
        loading={loading}
        onExcel={exportExcel}
        onPdf={exportPdf}
      />

      <div className="report-toolbar">
        <div className="report-filter-grid student-payment-filter-grid">
          <div className="form-group">
            <label>
              Öğrenci Ara
            </label>

            <input
              value={searchText}
              onChange={(event) => {
                setSearchText(
                  event.target.value
                )

                setPage(1)
              }}
              placeholder="Öğrenci, paket veya öğretmen"
            />
          </div>

          <div className="form-group">
            <label>
              Öğrenci Durumu
            </label>

            <select
              value={studentStatus}
              onChange={(event) => {
                setStudentStatus(
                  event.target.value
                )

                setPage(1)
              }}
            >
              <option value="active">
                Aktif öğrenciler
              </option>

              <option value="passive">
                Pasif öğrenciler
              </option>

              <option value="all">
                Tüm öğrenciler
              </option>
            </select>
          </div>

          <div className="form-group">
            <label>
              Ödeme Durumu
            </label>

            <select
              value={paymentStatus}
              onChange={(event) => {
                setPaymentStatus(
                  event.target.value
                )

                setPage(1)
              }}
            >
              <option value="all">
                Tüm ödeme durumları
              </option>

              <option value="Ödendi">
                Ödendi
              </option>

              <option value="Kısmi">
                Kısmi
              </option>

              <option value="Kısmi ve Gecikmiş">
                Kısmi ve Gecikmiş
              </option>

              <option value="Gecikmiş">
                Gecikmiş
              </option>

              <option value="Ödeme Günü Bugün">
                Ödeme Günü Bugün
              </option>

              <option value="Bekliyor">
                Bekliyor
              </option>

              <option value="Tarih Girilmedi">
                Tarih Girilmedi
              </option>

              <option value="Ücret Girilmedi">
                Ücret Girilmedi
              </option>
            </select>
          </div>
        </div>

        <div className="report-toolbar-footer">
          <button
            type="button"
            className="cancel-button"
            onClick={clearFilters}
          >
            Filtreleri Temizle
          </button>

          <div className="report-toolbar-actions">
            <select
              value={sortOption}
              onChange={(event) => {
                setSortOption(
                  event.target.value
                )

                setPage(1)
              }}
            >
              <option value="nameAsc">
                Öğrenci A-Z
              </option>

              <option value="nameDesc">
                Öğrenci Z-A
              </option>

              <option value="highestPrice">
                Paket ücreti yüksek
              </option>

              <option value="lowestPrice">
                Paket ücreti düşük
              </option>

              <option value="highestRemaining">
                Kalan tutar yüksek
              </option>

              <option value="lowestRemaining">
                Kalan tutar düşük
              </option>

              <option value="newestPayment">
                Son ödeme en yeni
              </option>

              <option value="oldestPayment">
                Son ödeme en eski
              </option>

              <option value="nextPaymentAsc">
                Sonraki ödeme yakın
              </option>

              <option value="nextPaymentDesc">
                Sonraki ödeme uzak
              </option>
            </select>

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
              <option value="10">
                10 kayıt
              </option>

              <option value="25">
                25 kayıt
              </option>

              <option value="50">
                50 kayıt
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className="report-table-wrapper">
        <table className="report-table student-payment-report-table">
          <thead>
            <tr>
              <th>Öğrenci</th>
              <th>Paket</th>
              <th>Öğretmen</th>
              <th>Dönem</th>
              <th>Paket Ücreti</th>
              <th>Ödenen</th>
              <th>Kalan</th>
              <th>Son Ödeme</th>
              <th>Sonraki Ödeme</th>
              <th>Ödeme Durumu</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="10"
                  className="empty-table"
                >
                  Ödeme raporu yükleniyor...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan="10"
                  className="empty-table"
                >
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan="10"
                  className="empty-table"
                >
                  Filtrelere uygun ödeme kaydı bulunamadı.
                </td>
              </tr>
            ) : (
              rows.map(
                (row) => (
                  <tr
                    key={
                      row.studentPackageId
                    }
                  >
                    <td>
                      <strong>
                        {row.studentName}
                      </strong>
                    </td>

                    <td>
                      {row.packageName ||
                        '-'}
                    </td>

                    <td>
                      {row.teacherName ||
                        '-'}
                    </td>

                    <td>
                      {getReadablePaymentPeriod(
                        row.paymentPeriod
                      )}
                    </td>

                    <td>
                      {formatCurrency(
                        row.agreedPrice
                      )}
                    </td>

                    <td>
                      <strong className="report-paid-amount">
                        {formatCurrency(
                          row.paidAmount
                        )}
                      </strong>
                    </td>

                    <td>
                      <strong className="report-remaining-amount">
                        {formatCurrency(
                          row.remainingAmount
                        )}
                      </strong>
                    </td>

                    <td>
                      {row.lastPaymentDate
                        ? formatDate(
                            row.lastPaymentDate
                          )
                        : '-'}
                    </td>

                    <td>
                      {row.nextPaymentDate
                        ? formatDate(
                            row.nextPaymentDate
                          )
                        : '-'}
                    </td>

                    <td>
                      <span
                        className={`report-payment-status ${getPaymentStatusClass(
                          row.paymentStatus
                        )}`}
                      >
                        {row.paymentStatus ||
                          '-'}
                      </span>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>

      <ReportPagination
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
      />
    </>
  )
}

function TeacherTrackingReport() {
  const [rows, setRows] =
    useState([])

  const [total, setTotal] =
    useState(0)

  const [page, setPage] =
    useState(1)

  const [pageSize, setPageSize] =
    useState(10)

  const [
    searchText,
    setSearchText
  ] = useState('')

  const [
    teacherStatus,
    setTeacherStatus
  ] = useState('active')

  const [
    specialtyText,
    setSpecialtyText
  ] = useState('')

  const [
    packageText,
    setPackageText
  ] = useState('')

  const [
    sortOption,
    setSortOption
  ] = useState('nameAsc')

  const [
    expandedTeacherId,
    setExpandedTeacherId
  ] = useState('')

  const [
    teacherDetails,
    setTeacherDetails
  ] = useState({})

  const [
    detailLoadingId,
    setDetailLoadingId
  ] = useState('')

  const [
    detailErrors,
    setDetailErrors
  ] = useState({})

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [exporting, setExporting] =
    useState('')

  useEffect(() => {
    let isMounted = true

    const timeoutId =
      window.setTimeout(
        async () => {
          setLoading(true)
          setError('')

          try {
            const result =
              await getTeacherTrackingReportPage({
                page,
                pageSize,
                searchText,
                teacherStatus,
                specialtyText,
                packageText,
                sortOption
              })

            if (!isMounted) {
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
              'Öğretmen takip raporu yüklenemedi:',
              loadError
            )

            if (isMounted) {
              setError(
                loadError instanceof Error
                  ? loadError.message
                  : 'Öğretmen takip raporu yüklenemedi.'
              )
            }
          } finally {
            if (isMounted) {
              setLoading(false)
            }
          }
        },
        searchText.trim() ||
        specialtyText.trim() ||
        packageText.trim()
          ? 350
          : 0
      )

    return () => {
      isMounted = false

      window.clearTimeout(
        timeoutId
      )
    }
  }, [
    page,
    pageSize,
    searchText,
    teacherStatus,
    specialtyText,
    packageText,
    sortOption
  ])

  useEffect(() => {
    setExpandedTeacherId('')
  }, [
    page,
    pageSize,
    searchText,
    teacherStatus,
    specialtyText,
    packageText,
    sortOption
  ])

  const exportFilters = {
    searchText,
    teacherStatus,
    specialtyText,
    packageText
  }

  const clearFilters = () => {
    setSearchText('')
    setTeacherStatus('active')
    setSpecialtyText('')
    setPackageText('')
    setSortOption('nameAsc')
    setPage(1)
    setExpandedTeacherId('')
  }

  const toggleTeacherDetails =
    async (teacherId) => {
      if (
        expandedTeacherId ===
        teacherId
      ) {
        setExpandedTeacherId('')
        return
      }

      setExpandedTeacherId(
        teacherId
      )

      if (
        teacherDetails[teacherId]
      ) {
        return
      }

      setDetailLoadingId(
        teacherId
      )

      setDetailErrors(
        (current) => ({
          ...current,
          [teacherId]: ''
        })
      )

      try {
        const details =
          await getTeacherTrackingDetails(
            teacherId
          )

        setTeacherDetails(
          (current) => ({
            ...current,
            [teacherId]: details
          })
        )
      } catch (detailError) {
        console.error(
          'Öğretmen detayları yüklenemedi:',
          detailError
        )

        setDetailErrors(
          (current) => ({
            ...current,

            [teacherId]:
              detailError instanceof Error
                ? detailError.message
                : 'Öğretmen detayları yüklenemedi.'
          })
        )
      } finally {
        setDetailLoadingId('')
      }
    }

  const exportExcel =
    async () => {
      if (exporting) {
        return
      }

      setExporting('excel')

      try {
        const exportRows =
          await getAllTeacherTrackingReportRows(
            exportFilters
          )

        if (
          exportRows.length === 0
        ) {
          alert(
            'Excel’e aktarılacak öğretmen kaydı bulunmamaktadır.'
          )

          return
        }

        const excelModule =
          await import('exceljs')

        const ExcelJS =
          excelModule.default ||
          excelModule

        const workbook =
          new ExcelJS.Workbook()

        const worksheet =
          workbook.addWorksheet(
            'Öğretmen Takip'
          )

        worksheet.columns = [
          {
            header: 'Öğretmen',
            key: 'teacherName',
            width: 27
          },
          {
            header: 'Branşlar',
            key: 'specialtyNames',
            width: 26
          },
          {
            header: 'Durum',
            key: 'teacherStatus',
            width: 14
          },
          {
            header:
              'Bireysel Öğrenci',
            key:
              'individualStudentCount',
            width: 18
          },
          {
            header:
              'Grup Öğrencisi',
            key:
              'groupStudentCount',
            width: 18
          },
          {
            header: 'Grup Sayısı',
            key: 'groupCount',
            width: 15
          },
          {
            header:
              'Haftalık Ders',
            key: 'weeklyLessonCount',
            width: 16
          },
          {
            header: 'Kayıt Türü',
            key: 'recordType',
            width: 15
          },
          {
            header:
              'Öğrenci / Grup',
            key: 'studentGroup',
            width: 36
          },
          {
            header: 'Paket',
            key: 'packageName',
            width: 29
          },
          {
            header:
              'Öğrenci Kayıt Tarihi',
            key: 'studentRegisterDate',
            width: 22
          }
        ]

        exportRows.forEach(
          (teacher) => {
            const details =
              teacher.details || []

            const firstRowNumber =
              worksheet.rowCount + 1

            if (
              details.length === 0
            ) {
              worksheet.addRow({
                teacherName:
                  teacher.teacherName,

                specialtyNames:
                  teacher.specialtyNames ||
                  '-',

                teacherStatus:
                  teacher.teacherIsActive
                    ? 'Aktif'
                    : 'Pasif',

                individualStudentCount:
                  teacher.individualStudentCount,

                groupStudentCount:
                  teacher.groupStudentCount,

                groupCount:
                  teacher.groupCount,

                weeklyLessonCount:
                  teacher.weeklyLessonCount,

                recordType: '-',
                studentGroup: '-',
                packageName: '-',
                studentRegisterDate:
                  '-'
              })

              return
            }

            details.forEach(
              (
                detail,
                detailIndex
              ) => {
                const isFirstDetail =
                  detailIndex === 0

                worksheet.addRow({
                  teacherName:
                    isFirstDetail
                      ? teacher.teacherName
                      : '',

                  specialtyNames:
                    isFirstDetail
                      ? teacher.specialtyNames ||
                        '-'
                      : '',

                  teacherStatus:
                    isFirstDetail
                      ? teacher.teacherIsActive
                        ? 'Aktif'
                        : 'Pasif'
                      : '',

                  individualStudentCount:
                    isFirstDetail
                      ? teacher.individualStudentCount
                      : '',

                  groupStudentCount:
                    isFirstDetail
                      ? teacher.groupStudentCount
                      : '',

                  groupCount:
                    isFirstDetail
                      ? teacher.groupCount
                      : '',

                  weeklyLessonCount:
                    isFirstDetail
                      ? teacher.weeklyLessonCount
                      : '',

                  recordType:
                    detail.recordTypeLabel ||
                    '-',

                  studentGroup:
                    detail.recordType ===
                    'group'
                      ? `${detail.groupName || '-'} — ${detail.studentName || '-'}`
                      : detail.studentName ||
                        '-',

                  packageName:
                    detail.packageName ||
                    '-',

                  studentRegisterDate:
                    detail.studentRegisterDate
                      ? formatDate(
                          detail.studentRegisterDate
                        )
                      : '-'
                })
              }
            )

            const lastRowNumber =
              worksheet.rowCount

            if (
              lastRowNumber >
              firstRowNumber
            ) {
              for (
                let columnNumber = 1;
                columnNumber <= 7;
                columnNumber += 1
              ) {
                worksheet.mergeCells(
                  firstRowNumber,
                  columnNumber,
                  lastRowNumber,
                  columnNumber
                )
              }
            }

            for (
              let rowNumber =
                firstRowNumber;
              rowNumber <=
              lastRowNumber;
              rowNumber += 1
            ) {
              worksheet.getRow(
                rowNumber
              ).alignment = {
                vertical: 'middle',
                wrapText: true
              }
            }
          }
        )

        worksheet.getRow(
          1
        ).font = {
          bold: true
        }

        worksheet.getRow(
          1
        ).alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        }

        ;[
          'teacherStatus',
          'individualStudentCount',
          'groupStudentCount',
          'groupCount',
          'weeklyLessonCount',
          'recordType',
          'studentRegisterDate'
        ].forEach((columnKey) => {
          worksheet.getColumn(
            columnKey
          ).alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true
          }
        })

        worksheet.views = [
          {
            state: 'frozen',
            ySplit: 1
          }
        ]

        worksheet.autoFilter = {
          from: 'A1',
          to: 'K1'
        }

        await downloadWorkbook(
          workbook,
          `ogretmen-takip-raporu-${getTodayKey()}.xlsx`
        )
      } catch (exportError) {
        console.error(
          'Öğretmen takip Excel hatası:',
          exportError
        )

        alert(
          exportError instanceof Error
            ? exportError.message
            : 'Excel dosyası oluşturulamadı.'
        )
      } finally {
        setExporting('')
      }
    }

  const exportPdf =
    async () => {
      if (exporting) {
        return
      }

      setExporting('pdf')

      try {
        const exportRows =
          await getAllTeacherTrackingReportRows(
            exportFilters
          )

        if (
          exportRows.length === 0
        ) {
          alert(
            'PDF’e aktarılacak öğretmen kaydı bulunmamaktadır.'
          )

          return
        }

        const pdfMake =
          await getPdfMake()

        const summaryBlockLayout = {
          hLineWidth: (
            lineIndex,
            node
          ) => {
            if (
              lineIndex === 0 ||
              lineIndex ===
                node.table.body.length
            ) {
              return 0.65
            }

            if (
              lineIndex === 1
            ) {
              return 0.45
            }

            return 0
          },

          vLineWidth: (
            lineIndex,
            node
          ) =>
            lineIndex === 0 ||
            lineIndex ===
              node.table.widths.length
              ? 0.65
              : 0,

          hLineColor: (
            lineIndex,
            node
          ) =>
            lineIndex === 0 ||
            lineIndex ===
              node.table.body.length
              ? '#9CA3AF'
              : '#C9CED5',

          vLineColor: () =>
            '#9CA3AF',

          paddingLeft: () =>
            7,

          paddingRight: () =>
            7,

          paddingTop: () =>
            6,

          paddingBottom: () =>
            6
        }

        const detailBlockLayout = {
          hLineWidth: (
            lineIndex,
            node
          ) => {
            if (
              lineIndex === 0 ||
              lineIndex ===
                node.table.body.length
            ) {
              return 0.65
            }

            if (
              lineIndex === 1
            ) {
              return 0.45
            }

            return 0.18
          },

          vLineWidth: (
            lineIndex,
            node
          ) =>
            lineIndex === 0 ||
            lineIndex ===
              node.table.widths.length
              ? 0.65
              : 0,

          hLineColor: (
            lineIndex,
            node
          ) => {
            if (
              lineIndex === 0 ||
              lineIndex ===
                node.table.body.length
            ) {
              return '#9CA3AF'
            }

            if (
              lineIndex === 1
            ) {
              return '#C2C8CF'
            }

            return '#E4E7EB'
          },

          vLineColor: () =>
            '#9CA3AF',

          paddingLeft: () =>
            7,

          paddingRight: () =>
            7,

          paddingTop: () =>
            5,

          paddingBottom: () =>
            5
        }

        const content = []

        exportRows.forEach(
          (teacher) => {
            content.push({
              table: {
                widths: [
                  '*',
                  '*',
                  '*',
                  '*',
                  '*',
                  '*'
                ],

                body: [
                  [
                    {
                      text:
                        `ÖĞRETMEN — ${teacher.teacherName}`,

                      colSpan: 6,

                      bold: true,

                      fontSize: 9,

                      alignment:
                        'left',

                      margin:
                        [2, 1, 0, 1]
                    },
                    {},
                    {},
                    {},
                    {},
                    {}
                  ],

                  [
                    {
                      text:
                        'Branşlar',

                      bold: true
                    },
                    {
                      text:
                        'Durum',

                      bold: true
                    },
                    {
                      text:
                        'Bireysel Öğrenci',

                      bold: true
                    },
                    {
                      text:
                        'Grup Öğrencisi',

                      bold: true
                    },
                    {
                      text:
                        'Grup Sayısı',

                      bold: true
                    },
                    {
                      text:
                        'Haftalık Ders',

                      bold: true
                    }
                  ],

                  [
                    teacher.specialtyNames ||
                      '-',

                    teacher.teacherIsActive
                      ? 'Aktif'
                      : 'Pasif',

                    String(
                      teacher.individualStudentCount
                    ),

                    String(
                      teacher.groupStudentCount
                    ),

                    String(
                      teacher.groupCount
                    ),

                    String(
                      teacher.weeklyLessonCount
                    )
                  ]
                ]
              },

              layout:
                summaryBlockLayout,

              margin:
                [0, 0, 0, 0]
            })

            const details =
              teacher.details || []

            const detailBody = [
              [
                {
                  text:
                    'Kayıt Türü',

                  bold: true
                },
                {
                  text:
                    'Öğrenci / Grup',

                  bold: true
                },
                {
                  text:
                    'Paket',

                  bold: true
                },
                {
                  text:
                    'Öğrenci Kayıt Tarihi',

                  bold: true
                }
              ]
            ]

            if (
              details.length === 0
            ) {
              detailBody.push([
                '-',

                'Bu öğretmene bağlı aktif öğrenci veya grup bulunmamaktadır.',

                '-',

                '-'
              ])
            } else {
              details.forEach(
                (detail) => {
                  detailBody.push([
                    detail.recordTypeLabel ||
                      '-',

                    detail.recordType ===
                    'group'
                      ? `${
                          detail.groupName ||
                          '-'
                        } — ${
                          detail.studentName ||
                          '-'
                        }`
                      : detail.studentName ||
                        '-',

                    detail.packageName ||
                      '-',

                    detail.studentRegisterDate
                      ? formatDate(
                          detail.studentRegisterDate
                        )
                      : '-'
                  ])
                }
              )
            }

            content.push({
              table: {
                headerRows: 1,

                widths: [
                  78,
                  '*',
                  155,
                  105
                ],

                body:
                  detailBody,

                dontBreakRows:
                  true
              },

              layout:
                detailBlockLayout,

              margin:
                [0, -0.65, 0, 14]
            })
          }
        )

        pdfMake
          .createPdf({
            pageSize:
              'A4',

            pageOrientation:
              'landscape',

            pageMargins:
              [24, 52, 24, 34],

            header: {
              margin:
                [24, 16, 24, 0],

              columns: [
                {
                  text:
                    'ARTI AKADEMİ',

                  bold: true,

                  color:
                    '#0B84A5'
                },

                {
                  text:
                    'ÖĞRETMEN TAKİP RAPORU',

                  alignment:
                    'right',

                  bold: true
                }
              ]
            },

            content,

            defaultStyle: {
              font:
                'Roboto',

              fontSize:
                8,

              alignment:
                'center'
            }
          })
          .download(
            `ogretmen-takip-raporu-${getTodayKey()}.pdf`
          )
      } catch (exportError) {
        console.error(
          'Öğretmen takip PDF hatası:',
          exportError
        )

        alert(
          exportError instanceof Error
            ? exportError.message
            : 'PDF dosyası oluşturulamadı.'
        )
      } finally {
        setExporting('')
      }
    }

  return (
    <>
      <ReportExportButtons
        exporting={exporting}
        loading={loading}
        onExcel={exportExcel}
        onPdf={exportPdf}
      />

      <div className="report-toolbar">
        <div className="report-filter-grid">
          <div className="form-group">
            <label>
              Öğretmen Ara
            </label>

            <input
              value={searchText}
              onChange={(event) => {
                setSearchText(
                  event.target.value
                )

                setPage(1)
              }}
              placeholder="Öğretmen, branş, paket, telefon veya e-posta"
            />
          </div>

          <div className="form-group">
            <label>
              Öğretmen Durumu
            </label>

            <select
              value={teacherStatus}
              onChange={(event) => {
                setTeacherStatus(
                  event.target.value
                )

                setPage(1)
              }}
            >
              <option value="active">
                Aktif öğretmenler
              </option>

              <option value="passive">
                Pasif öğretmenler
              </option>

              <option value="all">
                Tüm öğretmenler
              </option>
            </select>
          </div>

          <div className="form-group">
            <label>
              Branş Ara
            </label>

            <input
              value={specialtyText}
              onChange={(event) => {
                setSpecialtyText(
                  event.target.value
                )

                setPage(1)
              }}
              placeholder="Örneğin gitar"
            />
          </div>

          <div className="form-group">
            <label>
              Paket Ara
            </label>

            <input
              value={packageText}
              onChange={(event) => {
                setPackageText(
                  event.target.value
                )

                setPage(1)
              }}
              placeholder="Örneğin aylık gitar"
            />
          </div>
        </div>

        <div className="report-toolbar-footer">
          <button
            type="button"
            className="cancel-button"
            onClick={clearFilters}
          >
            Filtreleri Temizle
          </button>

          <div className="report-toolbar-actions">
            <select
              value={sortOption}
              onChange={(event) => {
                setSortOption(
                  event.target.value
                )

                setPage(1)
              }}
            >
              <option value="nameAsc">
                Öğretmen A-Z
              </option>

              <option value="nameDesc">
                Öğretmen Z-A
              </option>

              <option value="totalStudentDesc">
                Toplam öğrenci çok-az
              </option>

              <option value="totalStudentAsc">
                Toplam öğrenci az-çok
              </option>

              <option value="individualStudentDesc">
                Bireysel öğrenci çok-az
              </option>

              <option value="groupCountDesc">
                Grup sayısı çok-az
              </option>

              <option value="groupCountAsc">
                Grup sayısı az-çok
              </option>

              <option value="weeklyLessonDesc">
                Haftalık ders çok-az
              </option>

              <option value="weeklyLessonAsc">
                Haftalık ders az-çok
              </option>

              <option value="newestTeacher">
                En yeni öğretmen
              </option>

              <option value="oldestTeacher">
                En eski öğretmen
              </option>
            </select>

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
              <option value="10">
                10 kayıt
              </option>

              <option value="25">
                25 kayıt
              </option>

              <option value="50">
                50 kayıt
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className="report-table-wrapper">
        <table
          className="report-table teacher-tracking-summary-table"
          style={{
            width: '100%',
            minWidth: 0,
            tableLayout: 'fixed'
          }}
        >
          <colgroup>
            <col style={{ width: '14%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '21%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '9%' }} />
          </colgroup>

          <thead>
            <tr>
              <th>Öğretmen</th>
              <th>Branşlar</th>
              <th>Tanımlı Paketler</th>
              <th>Bireysel Öğrenci</th>
              <th>Grup Öğrencisi</th>
              <th>Grup Sayısı</th>
              <th>Haftalık Ders</th>
              <th>Durum</th>
              <th>Detay</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="9"
                  className="empty-table"
                >
                  Öğretmen raporu yükleniyor...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan="9"
                  className="empty-table"
                >
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan="9"
                  className="empty-table"
                >
                  Filtrelere uygun öğretmen kaydı bulunamadı.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isExpanded =
                  expandedTeacherId ===
                  row.teacherId

                const details =
                  teacherDetails[
                    row.teacherId
                  ] || []

                const detailError =
                  detailErrors[
                    row.teacherId
                  ] || ''

                const isDetailLoading =
                  detailLoadingId ===
                  row.teacherId

                return (
                  <Fragment
                    key={row.teacherId}
                  >
                    <tr className="teacher-summary-row">
                      <td>
                        <strong>
                          {row.teacherName}
                        </strong>
                      </td>

                      <td
                        style={{
                          whiteSpace: 'normal',
                          overflowWrap: 'anywhere'
                        }}
                      >
                        {row.specialtyNames ||
                          '-'}
                      </td>

                      <td
                        className="report-long-text-cell"
                        style={{
                          whiteSpace: 'normal',
                          overflowWrap: 'anywhere'
                        }}
                      >
                        {row.packageNames ||
                          '-'}
                      </td>

                      <td>
                        <strong>
                          {row.individualStudentCount}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {row.groupStudentCount}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {row.groupCount}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {row.weeklyLessonCount}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`report-status-badge ${
                            row.teacherIsActive
                              ? 'active'
                              : 'passive'
                          }`}
                        >
                          {row.teacherIsActive
                            ? 'Aktif'
                            : 'Pasif'}
                        </span>
                      </td>

                      <td className="teacher-report-detail-cell">
                        <button
                          type="button"
                          className="report-detail-button"
                          onClick={() =>
                            toggleTeacherDetails(
                              row.teacherId
                            )
                          }
                        >
                          {isExpanded
                            ? 'Kapat'
                            : 'Göster'}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="teacher-detail-row">
                        <td colSpan="9">
                          <div className="teacher-detail-panel">
                            <div className="teacher-detail-heading">
                              <div>
                                <strong>
                                  {row.teacherName}
                                </strong>

                                <span>
                                  Bireysel ve grup öğrencileri
                                </span>
                              </div>

                              <div className="teacher-detail-summary">
                                <span>
                                  {row.individualStudentCount}{' '}
                                  bireysel
                                </span>

                                <span>
                                  {row.groupStudentCount}{' '}
                                  grup öğrencisi
                                </span>

                                <span>
                                  {row.groupCount}{' '}
                                  grup
                                </span>

                                <span>
                                  {row.weeklyLessonCount}{' '}
                                  haftalık ders
                                </span>
                              </div>
                            </div>

                            {isDetailLoading ? (
                              <div className="teacher-detail-state">
                                Detaylar yükleniyor...
                              </div>
                            ) : detailError ? (
                              <div className="teacher-detail-state error">
                                {detailError}
                              </div>
                            ) : details.length ===
                              0 ? (
                              <div className="teacher-detail-state">
                                Bu öğretmene bağlı aktif öğrenci veya grup bulunmamaktadır.
                              </div>
                            ) : (
                              <div className="teacher-detail-table-wrapper">
                                <table className="teacher-detail-table">
                                  <thead>
                                    <tr>
                                      <th>
                                        Kayıt Türü
                                      </th>

                                      <th>
                                        Öğrenci / Grup
                                      </th>

                                      <th>
                                        Paket
                                      </th>

                                      <th>
                                        Öğrenci Kayıt Tarihi
                                      </th>
                                    </tr>
                                  </thead>

                                  <tbody>
                                    {details.map(
                                      (
                                        detail,
                                        detailIndex
                                      ) => (
                                        <tr
                                          key={
                                            detail.detailId ||
                                            `${row.teacherId}-${detailIndex}`
                                          }
                                        >
                                          <td>
                                            <span
                                              className={`teacher-record-type ${
                                                detail.recordType ===
                                                'group'
                                                  ? 'group'
                                                  : 'individual'
                                              }`}
                                            >
                                              {detail.recordTypeLabel ||
                                                '-'}
                                            </span>
                                          </td>

                                          <td>
                                            <strong>
                                              {detail.recordType ===
                                              'group'
                                                ? `${
                                                    detail.groupName ||
                                                    '-'
                                                  } — ${
                                                    detail.studentName ||
                                                    '-'
                                                  }`
                                                : detail.studentName ||
                                                  '-'}
                                            </strong>
                                          </td>

                                          <td>
                                            {detail.packageName ||
                                              '-'}
                                          </td>

                                          <td>
                                            {detail.studentRegisterDate
                                              ? formatDate(
                                                  detail.studentRegisterDate
                                                )
                                              : '-'}
                                          </td>
                                        </tr>
                                      )
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <ReportPagination
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
      />
    </>
  )
}


function TeacherEarningsReport() {
  const [rows, setRows] =
    useState([])

  const [total, setTotal] =
    useState(0)

  const [page, setPage] =
    useState(1)

  const [pageSize, setPageSize] =
    useState(10)

  const [
    searchText,
    setSearchText
  ] = useState('')

  const [
    teacherStatus,
    setTeacherStatus
  ] = useState('active')

  const [
    branchText,
    setBranchText
  ] = useState('')

  const [
    earningStatus,
    setEarningStatus
  ] = useState('all')

  const [
    sortOption,
    setSortOption
  ] = useState('nameAsc')

  const [
    expandedTeacherId,
    setExpandedTeacherId
  ] = useState('')

  const [
    teacherDetails,
    setTeacherDetails
  ] = useState({})

  const [
    detailLoadingId,
    setDetailLoadingId
  ] = useState('')

  const [
    detailErrors,
    setDetailErrors
  ] = useState({})

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [exporting, setExporting] =
    useState('')

  useEffect(() => {
    let isMounted = true

    const timeoutId =
      window.setTimeout(
        async () => {
          setLoading(true)
          setError('')

          try {
            const result =
              await getTeacherEarningsReportPage({
                page,
                pageSize,
                searchText,
                teacherStatus,
                branchText,
                earningStatus,
                sortOption
              })

            if (!isMounted) {
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
              'Öğretmen hakediş raporu yüklenemedi:',
              loadError
            )

            if (isMounted) {
              setError(
                loadError instanceof Error
                  ? loadError.message
                  : 'Öğretmen hakediş raporu yüklenemedi.'
              )
            }
          } finally {
            if (isMounted) {
              setLoading(false)
            }
          }
        },
        searchText.trim() ||
        branchText.trim()
          ? 350
          : 0
      )

    return () => {
      isMounted = false

      window.clearTimeout(
        timeoutId
      )
    }
  }, [
    page,
    pageSize,
    searchText,
    teacherStatus,
    branchText,
    earningStatus,
    sortOption
  ])

  useEffect(() => {
    setExpandedTeacherId('')
  }, [
    page,
    pageSize,
    searchText,
    teacherStatus,
    branchText,
    earningStatus,
    sortOption
  ])

  const exportFilters = {
    searchText,
    teacherStatus,
    branchText,
    earningStatus
  }

  const clearFilters = () => {
    setSearchText('')
    setTeacherStatus('active')
    setBranchText('')
    setEarningStatus('all')
    setSortOption('nameAsc')
    setPage(1)
    setExpandedTeacherId('')
  }

  const toggleTeacherDetails =
    async (teacherId) => {
      if (
        expandedTeacherId ===
        teacherId
      ) {
        setExpandedTeacherId('')
        return
      }

      setExpandedTeacherId(
        teacherId
      )

      if (
        teacherDetails[teacherId]
      ) {
        return
      }

      setDetailLoadingId(
        teacherId
      )

      setDetailErrors(
        (current) => ({
          ...current,
          [teacherId]: ''
        })
      )

      try {
        const details =
          await getTeacherEarningReportDetails(
            teacherId
          )

        setTeacherDetails(
          (current) => ({
            ...current,
            [teacherId]: details
          })
        )
      } catch (detailError) {
        console.error(
          'Öğretmen hakediş detayları yüklenemedi:',
          detailError
        )

        setDetailErrors(
          (current) => ({
            ...current,

            [teacherId]:
              detailError instanceof Error
                ? detailError.message
                : 'Öğretmen hakediş detayları yüklenemedi.'
          })
        )
      } finally {
        setDetailLoadingId('')
      }
    }

  const exportExcel =
    async () => {
      if (exporting) {
        return
      }

      setExporting('excel')

      try {
        const exportRows =
          await getAllTeacherEarningsReportRows(
            exportFilters
          )

        if (
          exportRows.length === 0
        ) {
          alert(
            'Excel’e aktarılacak hakediş kaydı bulunmamaktadır.'
          )

          return
        }

        const excelModule =
          await import('exceljs')

        const ExcelJS =
          excelModule.default ||
          excelModule

        const workbook =
          new ExcelJS.Workbook()

        const worksheet =
          workbook.addWorksheet(
            'Öğretmen Hakediş'
          )

        worksheet.columns = [
          {
            header: 'Öğretmen',
            key: 'teacherName',
            width: 26
          },
          {
            header: 'Branş',
            key: 'branch',
            width: 22
          },
          {
            header: 'Komisyon',
            key: 'summaryCommission',
            width: 14
          },
          {
            header: 'Yapılan Ders',
            key: 'completedLessonCount',
            width: 16
          },
          {
            header: 'Ders Bedeli Toplamı',
            key: 'totalLessonAmount',
            width: 21
          },
          {
            header: 'Toplam Hakediş',
            key: 'totalEarning',
            width: 19
          },
          {
            header: 'Ödenen',
            key: 'totalPaid',
            width: 17
          },
          {
            header: 'Kalan',
            key: 'remainingPayment',
            width: 17
          },
          {
            header: 'Hakediş Durumu',
            key: 'earningStatus',
            width: 19
          },
          {
            header: 'Ders Tarihi',
            key: 'lessonDate',
            width: 16
          },
          {
            header: 'Ders Durumu',
            key: 'lessonStatus',
            width: 18
          },
          {
            header: 'Öğrenci / Grup',
            key: 'studentOrGroupName',
            width: 36
          },
          {
            header: 'Paket',
            key: 'packageName',
            width: 28
          },
          {
            header: 'Ders Birim Bedeli',
            key: 'unitPrice',
            width: 19
          },
          {
            header: 'Ders Komisyonu',
            key: 'detailCommission',
            width: 17
          },
          {
            header: 'Ders Hakedişi',
            key: 'teacherEarning',
            width: 18
          }
        ]

        exportRows.forEach(
          (teacher) => {
            const details =
              teacher.details || []

            const firstRowNumber =
              worksheet.rowCount + 1

            if (
              details.length === 0
            ) {
              worksheet.addRow({
                teacherName:
                  teacher.teacherName,

                branch:
                  teacher.branch ||
                  '-',

                summaryCommission:
                  formatPercentage(
                    teacher.commissionRate
                  ),

                completedLessonCount:
                  teacher.completedLessonCount,

                totalLessonAmount:
                  teacher.totalLessonAmount,

                totalEarning:
                  teacher.totalEarning,

                totalPaid:
                  teacher.totalPaid,

                remainingPayment:
                  teacher.remainingPayment,

                earningStatus:
                  teacher.earningStatus,

                lessonDate: '-',
                lessonStatus: '-',
                studentOrGroupName:
                  '-',
                packageName: '-',
                unitPrice: 0,
                detailCommission: '-',
                teacherEarning: 0
              })

              return
            }

            details.forEach(
              (
                detail,
                detailIndex
              ) => {
                const isFirstDetail =
                  detailIndex === 0

                worksheet.addRow({
                  teacherName:
                    isFirstDetail
                      ? teacher.teacherName
                      : '',

                  branch:
                    isFirstDetail
                      ? teacher.branch ||
                        '-'
                      : '',

                  summaryCommission:
                    isFirstDetail
                      ? formatPercentage(
                          teacher.commissionRate
                        )
                      : '',

                  completedLessonCount:
                    isFirstDetail
                      ? teacher.completedLessonCount
                      : '',

                  totalLessonAmount:
                    isFirstDetail
                      ? teacher.totalLessonAmount
                      : '',

                  totalEarning:
                    isFirstDetail
                      ? teacher.totalEarning
                      : '',

                  totalPaid:
                    isFirstDetail
                      ? teacher.totalPaid
                      : '',

                  remainingPayment:
                    isFirstDetail
                      ? teacher.remainingPayment
                      : '',

                  earningStatus:
                    isFirstDetail
                      ? teacher.earningStatus
                      : '',

                  lessonDate:
                    detail.lessonDate
                      ? formatDate(
                          detail.lessonDate
                        )
                      : '-',

                  lessonStatus:
                    getReadableLessonStatus(
                      detail.lessonStatus
                    ),

                  studentOrGroupName:
                    detail.studentOrGroupName ||
                    '-',

                  packageName:
                    detail.packageName ||
                    '-',

                  unitPrice:
                    detail.unitPrice,

                  detailCommission:
                    formatPercentage(
                      detail.commissionRate
                    ),

                  teacherEarning:
                    detail.teacherEarning
                })
              }
            )

            const lastRowNumber =
              worksheet.rowCount

            if (
              lastRowNumber >
              firstRowNumber
            ) {
              for (
                let columnNumber = 1;
                columnNumber <= 9;
                columnNumber += 1
              ) {
                worksheet.mergeCells(
                  firstRowNumber,
                  columnNumber,
                  lastRowNumber,
                  columnNumber
                )
              }
            }

            for (
              let rowNumber =
                firstRowNumber;
              rowNumber <=
              lastRowNumber;
              rowNumber += 1
            ) {
              worksheet.getRow(
                rowNumber
              ).alignment = {
                vertical: 'middle',
                wrapText: true
              }
            }
          }
        )

        worksheet.getRow(
          1
        ).font = {
          bold: true
        }

        worksheet.getRow(
          1
        ).alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        }

        ;[
          'totalLessonAmount',
          'totalEarning',
          'totalPaid',
          'remainingPayment',
          'unitPrice',
          'teacherEarning'
        ].forEach((columnKey) => {
          worksheet.getColumn(
            columnKey
          ).numFmt =
            '#,##0.00 [$₺-tr-TR]'
        })

        ;[
          'summaryCommission',
          'completedLessonCount',
          'earningStatus',
          'lessonDate',
          'lessonStatus',
          'detailCommission'
        ].forEach((columnKey) => {
          worksheet.getColumn(
            columnKey
          ).alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true
          }
        })

        worksheet.views = [
          {
            state: 'frozen',
            ySplit: 1
          }
        ]

        worksheet.autoFilter = {
          from: 'A1',
          to: 'P1'
        }

        await downloadWorkbook(
          workbook,
          `ogretmen-hakedis-raporu-${getTodayKey()}.xlsx`
        )
      } catch (exportError) {
        console.error(
          'Öğretmen hakediş Excel hatası:',
          exportError
        )

        alert(
          exportError instanceof Error
            ? exportError.message
            : 'Excel dosyası oluşturulamadı.'
        )
      } finally {
        setExporting('')
      }
    }

  const exportPdf =
    async () => {
      if (exporting) {
        return
      }

      setExporting('pdf')

      try {
        const exportRows =
          await getAllTeacherEarningsReportRows(
            exportFilters
          )

        if (
          exportRows.length === 0
        ) {
          alert(
            'PDF’e aktarılacak hakediş kaydı bulunmamaktadır.'
          )

          return
        }

        const pdfMake =
          await getPdfMake()

        const summaryBlockLayout = {
          hLineWidth: (
            lineIndex,
            node
          ) => {
            if (
              lineIndex === 0 ||
              lineIndex ===
                node.table.body.length
            ) {
              return 0.65
            }

            if (
              lineIndex === 1
            ) {
              return 0.45
            }

            return 0
          },

          vLineWidth: (
            lineIndex,
            node
          ) =>
            lineIndex === 0 ||
            lineIndex ===
              node.table.widths.length
              ? 0.65
              : 0,

          hLineColor: (
            lineIndex,
            node
          ) =>
            lineIndex === 0 ||
            lineIndex ===
              node.table.body.length
              ? '#9CA3AF'
              : '#C9CED5',

          vLineColor: () =>
            '#9CA3AF',

          paddingLeft: () =>
            7,

          paddingRight: () =>
            7,

          paddingTop: () =>
            6,

          paddingBottom: () =>
            6
        }

        const detailBlockLayout = {
          hLineWidth: (
            lineIndex,
            node
          ) => {
            if (
              lineIndex === 0 ||
              lineIndex ===
                node.table.body.length
            ) {
              return 0.65
            }

            if (
              lineIndex === 1
            ) {
              return 0.45
            }

            return 0.18
          },

          vLineWidth: (
            lineIndex,
            node
          ) =>
            lineIndex === 0 ||
            lineIndex ===
              node.table.widths.length
              ? 0.65
              : 0,

          hLineColor: (
            lineIndex,
            node
          ) => {
            if (
              lineIndex === 0 ||
              lineIndex ===
                node.table.body.length
            ) {
              return '#9CA3AF'
            }

            if (
              lineIndex === 1
            ) {
              return '#C2C8CF'
            }

            return '#E4E7EB'
          },

          vLineColor: () =>
            '#9CA3AF',

          paddingLeft: () =>
            7,

          paddingRight: () =>
            7,

          paddingTop: () =>
            5,

          paddingBottom: () =>
            5
        }

        const content = []

        exportRows.forEach(
          (teacher) => {
            content.push({
              table: {
                widths: [
                  '*',
                  '*',
                  '*',
                  '*',
                  '*',
                  '*',
                  '*',
                  '*'
                ],

                body: [
                  [
                    {
                      text:
                        `ÖĞRETMEN — ${teacher.teacherName}`,

                      colSpan: 8,

                      bold: true,

                      fontSize: 9,

                      alignment:
                        'left',

                      margin:
                        [2, 1, 0, 1]
                    },
                    {},
                    {},
                    {},
                    {},
                    {},
                    {},
                    {}
                  ],

                  [
                    {
                      text:
                        'Branş',

                      bold: true
                    },
                    {
                      text:
                        'Komisyon',

                      bold: true
                    },
                    {
                      text:
                        'Yapılan Ders',

                      bold: true
                    },
                    {
                      text:
                        'Ders Bedeli',

                      bold: true
                    },
                    {
                      text:
                        'Toplam Hakediş',

                      bold: true
                    },
                    {
                      text:
                        'Ödenen',

                      bold: true
                    },
                    {
                      text:
                        'Kalan',

                      bold: true
                    },
                    {
                      text:
                        'Durum',

                      bold: true
                    }
                  ],

                  [
                    teacher.branch ||
                      '-',

                    formatPercentage(
                      teacher.commissionRate
                    ),

                    String(
                      teacher.completedLessonCount
                    ),

                    formatCurrency(
                      teacher.totalLessonAmount
                    ),

                    formatCurrency(
                      teacher.totalEarning
                    ),

                    formatCurrency(
                      teacher.totalPaid
                    ),

                    formatCurrency(
                      teacher.remainingPayment
                    ),

                    teacher.earningStatus ||
                      '-'
                  ]
                ]
              },

              layout:
                summaryBlockLayout,

              margin:
                [0, 0, 0, 0]
            })

            const details =
              teacher.details || []

            const detailBody = [
              [
                {
                  text:
                    'Ders Tarihi',

                  bold: true
                },
                {
                  text:
                    'Ders Durumu',

                  bold: true
                },
                {
                  text:
                    'Öğrenci / Grup',

                  bold: true
                },
                {
                  text:
                    'Paket',

                  bold: true
                },
                {
                  text:
                    'Birim Bedel',

                  bold: true
                },
                {
                  text:
                    'Komisyon',

                  bold: true
                },
                {
                  text:
                    'Ders Hakedişi',

                  bold: true
                }
              ]
            ]

            if (
              details.length === 0
            ) {
              detailBody.push([
                '-',
                '-',

                'Bu öğretmene ait hakediş oluşturan ders bulunmamaktadır.',

                '-',
                '-',
                '-',
                '-'
              ])
            } else {
              details.forEach(
                (detail) => {
                  detailBody.push([
                    detail.lessonDate
                      ? formatDate(
                          detail.lessonDate
                        )
                      : '-',

                    getReadableLessonStatus(
                      detail.lessonStatus
                    ),

                    detail.studentOrGroupName ||
                      '-',

                    detail.packageName ||
                      '-',

                    formatCurrency(
                      detail.unitPrice
                    ),

                    formatPercentage(
                      detail.commissionRate
                    ),

                    formatCurrency(
                      detail.teacherEarning
                    )
                  ])
                }
              )
            }

            content.push({
              table: {
                headerRows: 1,

                widths: [
                  68,
                  82,
                  '*',
                  115,
                  75,
                  62,
                  82
                ],

                body:
                  detailBody,

                dontBreakRows:
                  true
              },

              layout:
                detailBlockLayout,

              margin:
                [0, -0.65, 0, 14]
            })
          }
        )

        pdfMake
          .createPdf({
            pageSize:
              'A4',

            pageOrientation:
              'landscape',

            pageMargins:
              [24, 52, 24, 34],

            header: {
              margin:
                [24, 16, 24, 0],

              columns: [
                {
                  text:
                    'ARTI AKADEMİ',

                  bold: true,

                  color:
                    '#0B84A5'
                },

                {
                  text:
                    'ÖĞRETMEN HAKEDİŞ RAPORU',

                  alignment:
                    'right',

                  bold: true
                }
              ]
            },

            content,

            defaultStyle: {
              font:
                'Roboto',

              fontSize:
                8,

              alignment:
                'center'
            }
          })
          .download(
            `ogretmen-hakedis-raporu-${getTodayKey()}.pdf`
          )
      } catch (exportError) {
        console.error(
          'Öğretmen hakediş PDF hatası:',
          exportError
        )

        alert(
          exportError instanceof Error
            ? exportError.message
            : 'PDF dosyası oluşturulamadı.'
        )
      } finally {
        setExporting('')
      }
    }

  return (
    <>
      <ReportExportButtons
        exporting={exporting}
        loading={loading}
        onExcel={exportExcel}
        onPdf={exportPdf}
      />

      <div className="report-toolbar">
        <div className="report-filter-grid">
          <div className="form-group">
            <label>
              Öğretmen Ara
            </label>

            <input
              value={searchText}
              onChange={(event) => {
                setSearchText(
                  event.target.value
                )

                setPage(1)
              }}
              placeholder="Öğretmen veya branş"
            />
          </div>

          <div className="form-group">
            <label>
              Öğretmen Durumu
            </label>

            <select
              value={teacherStatus}
              onChange={(event) => {
                setTeacherStatus(
                  event.target.value
                )

                setPage(1)
              }}
            >
              <option value="active">
                Aktif öğretmenler
              </option>

              <option value="passive">
                Pasif öğretmenler
              </option>

              <option value="all">
                Tüm öğretmenler
              </option>
            </select>
          </div>

          <div className="form-group">
            <label>
              Branş Ara
            </label>

            <input
              value={branchText}
              onChange={(event) => {
                setBranchText(
                  event.target.value
                )

                setPage(1)
              }}
              placeholder="Örneğin gitar"
            />
          </div>

          <div className="form-group">
            <label>
              Hakediş Durumu
            </label>

            <select
              value={earningStatus}
              onChange={(event) => {
                setEarningStatus(
                  event.target.value
                )

                setPage(1)
              }}
            >
              <option value="all">
                Tüm hakediş durumları
              </option>

              <option value="waiting">
                Bekliyor
              </option>

              <option value="partial">
                Kısmi Ödendi
              </option>

              <option value="paid">
                Ödendi
              </option>

              <option value="none">
                Hakediş Yok
              </option>
            </select>
          </div>
        </div>

        <div className="report-toolbar-footer">
          <button
            type="button"
            className="cancel-button"
            onClick={clearFilters}
          >
            Filtreleri Temizle
          </button>

          <div className="report-toolbar-actions">
            <select
              value={sortOption}
              onChange={(event) => {
                setSortOption(
                  event.target.value
                )

                setPage(1)
              }}
            >
              <option value="nameAsc">
                Öğretmen A-Z
              </option>

              <option value="nameDesc">
                Öğretmen Z-A
              </option>

              <option value="lessonCountDesc">
                Yapılan ders çok-az
              </option>

              <option value="lessonCountAsc">
                Yapılan ders az-çok
              </option>

              <option value="lessonAmountDesc">
                Ders bedeli yüksek
              </option>

              <option value="lessonAmountAsc">
                Ders bedeli düşük
              </option>

              <option value="earningDesc">
                Hakediş yüksek
              </option>

              <option value="earningAsc">
                Hakediş düşük
              </option>

              <option value="paidDesc">
                Ödenen yüksek
              </option>

              <option value="remainingDesc">
                Kalan yüksek
              </option>

              <option value="remainingAsc">
                Kalan düşük
              </option>
            </select>

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
              <option value="10">
                10 kayıt
              </option>

              <option value="25">
                25 kayıt
              </option>

              <option value="50">
                50 kayıt
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className="report-table-wrapper">
        <table
          className="report-table teacher-earnings-summary-table"
          style={{
            width: '100%',
            minWidth: 0,
            tableLayout: 'fixed'
          }}
        >
          <colgroup>
            <col style={{ width: '13%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>

          <thead>
            <tr>
              <th>Öğretmen</th>
              <th>Branş</th>
              <th className="teacher-earning-center-column">Komisyon</th>
              <th className="teacher-earning-center-column">Yapılan Ders</th>
              <th className="teacher-earning-money-column">Ders Bedeli</th>
              <th className="teacher-earning-money-column">Toplam Hakediş</th>
              <th className="teacher-earning-money-column">Ödenen</th>
              <th className="teacher-earning-money-column">Kalan</th>
              <th className="teacher-earning-center-column">Durum</th>
              <th className="teacher-earning-center-column">Detay</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="10"
                  className="empty-table"
                >
                  Öğretmen hakediş raporu yükleniyor...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan="10"
                  className="empty-table"
                >
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan="10"
                  className="empty-table"
                >
                  Filtrelere uygun hakediş kaydı bulunamadı.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isExpanded =
                  expandedTeacherId ===
                  row.teacherId

                const details =
                  teacherDetails[
                    row.teacherId
                  ] || []

                const detailError =
                  detailErrors[
                    row.teacherId
                  ] || ''

                const isDetailLoading =
                  detailLoadingId ===
                  row.teacherId

                return (
                  <Fragment
                    key={row.teacherId}
                  >
                    <tr className="teacher-summary-row">
                      <td>
                        <strong>
                          {row.teacherName}
                        </strong>
                      </td>

                      <td>
                        {row.branch ||
                          '-'}
                      </td>

                      <td className="teacher-earning-center-cell">
                        {formatPercentage(
                          row.commissionRate
                        )}
                      </td>

                      <td className="teacher-earning-center-cell">
                        <strong>
                          {row.completedLessonCount}
                        </strong>
                      </td>

                      <td className="teacher-earning-money-cell">
                        {formatCurrency(
                          row.totalLessonAmount
                        )}
                      </td>

                      <td className="teacher-earning-money-cell">
                        <strong className="report-paid-amount">
                          {formatCurrency(
                            row.totalEarning
                          )}
                        </strong>
                      </td>

                      <td className="teacher-earning-money-cell">
                        {formatCurrency(
                          row.totalPaid
                        )}
                      </td>

                      <td className="teacher-earning-money-cell">
                        <strong className="report-remaining-amount">
                          {formatCurrency(
                            row.remainingPayment
                          )}
                        </strong>
                      </td>

                      <td className="teacher-earning-center-cell">
                        <span
                          className={`report-payment-status ${getTeacherEarningStatusClass(
                            row.earningStatusClass
                          )}`}
                        >
                          {row.earningStatus}
                        </span>
                      </td>

                      <td className="teacher-report-detail-cell">
                        <button
                          type="button"
                          className="report-detail-button"
                          onClick={() =>
                            toggleTeacherDetails(
                              row.teacherId
                            )
                          }
                        >
                          {isExpanded
                            ? 'Kapat'
                            : 'Göster'}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="teacher-detail-row">
                        <td colSpan="10">
                          <div className="teacher-detail-panel">
                            <div className="teacher-detail-heading">
                              <div>
                                <strong>
                                  {row.teacherName}
                                </strong>

                                <span>
                                  Hakedişi oluşturan dersler
                                </span>
                              </div>

                              <div className="teacher-detail-summary">
                                <span>
                                  {row.completedLessonCount}{' '}
                                  ders
                                </span>

                                <span>
                                  {formatCurrency(
                                    row.totalEarning
                                  )}{' '}
                                  hakediş
                                </span>

                                <span>
                                  {formatCurrency(
                                    row.totalPaid
                                  )}{' '}
                                  ödendi
                                </span>

                                <span>
                                  {formatCurrency(
                                    row.remainingPayment
                                  )}{' '}
                                  kalan
                                </span>
                              </div>
                            </div>

                            {isDetailLoading ? (
                              <div className="teacher-detail-state">
                                Ders detayları yükleniyor...
                              </div>
                            ) : detailError ? (
                              <div className="teacher-detail-state error">
                                {detailError}
                              </div>
                            ) : details.length ===
                              0 ? (
                              <div className="teacher-detail-state">
                                Bu öğretmene ait hakediş oluşturan ders bulunmamaktadır.
                              </div>
                            ) : (
                              <div className="teacher-detail-table-wrapper">
                                <table className="teacher-detail-table">
                                  <thead>
                                    <tr>
                                      <th>
                                        Ders Tarihi
                                      </th>

                                      <th>
                                        Ders Durumu
                                      </th>

                                      <th>
                                        Öğrenci / Grup
                                      </th>

                                      <th>
                                        Paket
                                      </th>

                                      <th>
                                        Birim Bedel
                                      </th>

                                      <th>
                                        Komisyon
                                      </th>

                                      <th>
                                        Ders Hakedişi
                                      </th>
                                    </tr>
                                  </thead>

                                  <tbody>
                                    {details.map(
                                      (
                                        detail,
                                        detailIndex
                                      ) => (
                                        <tr
                                          key={
                                            detail.lessonId ||
                                            `${row.teacherId}-${detailIndex}`
                                          }
                                        >
                                          <td>
                                            {detail.lessonDate
                                              ? formatDate(
                                                  detail.lessonDate
                                                )
                                              : '-'}
                                          </td>

                                          <td>
                                            {getReadableLessonStatus(
                                              detail.lessonStatus
                                            )}
                                          </td>

                                          <td>
                                            <strong>
                                              {detail.studentOrGroupName ||
                                                '-'}
                                            </strong>
                                          </td>

                                          <td>
                                            {detail.packageName ||
                                              '-'}
                                          </td>

                                          <td>
                                            {formatCurrency(
                                              detail.unitPrice
                                            )}
                                          </td>

                                          <td>
                                            {formatPercentage(
                                              detail.commissionRate
                                            )}
                                          </td>

                                          <td>
                                            <strong className="report-paid-amount">
                                              {formatCurrency(
                                                detail.teacherEarning
                                              )}
                                            </strong>
                                          </td>
                                        </tr>
                                      )
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <ReportPagination
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
      />
    </>
  )
}


function TeacherPaymentsReport() {
  const [rows, setRows] =
    useState([])

  const [total, setTotal] =
    useState(0)

  const [page, setPage] =
    useState(1)

  const [pageSize, setPageSize] =
    useState(10)

  const [
    searchText,
    setSearchText
  ] = useState('')

  const [
    paymentMethod,
    setPaymentMethod
  ] = useState('')

  const [
    startDate,
    setStartDate
  ] = useState('')

  const [
    endDate,
    setEndDate
  ] = useState('')

  const [
    sortOption,
    setSortOption
  ] = useState('newest')

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [exporting, setExporting] =
    useState('')

  useEffect(() => {
    let isMounted = true

    const timeoutId =
      window.setTimeout(
        async () => {
          setLoading(true)
          setError('')

          try {
            const result =
              await getTeacherPaymentsReportPage({
                page,
                pageSize,
                searchText,
                paymentMethod,
                startDate,
                endDate,
                sortOption
              })

            if (!isMounted) {
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
              'Öğretmen ödemeleri raporu yüklenemedi:',
              loadError
            )

            if (isMounted) {
              setError(
                loadError instanceof Error
                  ? loadError.message
                  : 'Öğretmen ödemeleri raporu yüklenemedi.'
              )
            }
          } finally {
            if (isMounted) {
              setLoading(false)
            }
          }
        },
        searchText.trim()
          ? 350
          : 0
      )

    return () => {
      isMounted = false

      window.clearTimeout(
        timeoutId
      )
    }
  }, [
    page,
    pageSize,
    searchText,
    paymentMethod,
    startDate,
    endDate,
    sortOption
  ])

  const exportFilters = {
    searchText,
    paymentMethod,
    startDate,
    endDate
  }

  const clearFilters = () => {
    setSearchText('')
    setPaymentMethod('')
    setStartDate('')
    setEndDate('')
    setSortOption('newest')
    setPage(1)
  }

  const exportExcel =
    async () => {
      if (exporting) {
        return
      }

      setExporting('excel')

      try {
        const exportRows =
          await getAllTeacherPaymentsReportRows(
            exportFilters
          )

        if (
          exportRows.length === 0
        ) {
          alert(
            'Excel’e aktarılacak öğretmen ödeme kaydı bulunmamaktadır.'
          )

          return
        }

        const excelModule =
          await import('exceljs')

        const ExcelJS =
          excelModule.default ||
          excelModule

        const workbook =
          new ExcelJS.Workbook()

        const worksheet =
          workbook.addWorksheet(
            'Öğretmen Ödemeleri'
          )

        worksheet.columns = [
          {
            header: 'Öğretmen',
            key: 'teacherName',
            width: 28
          },
          {
            header: 'Ödeme Tarihi',
            key: 'paymentDate',
            width: 18
          },
          {
            header: 'Tutar',
            key: 'amount',
            width: 18
          },
          {
            header: 'Ödeme Yöntemi',
            key: 'paymentMethod',
            width: 20
          },
          {
            header: 'Referans No',
            key: 'referenceNumber',
            width: 24
          },
          {
            header: 'Not',
            key: 'note',
            width: 38
          },
          {
            header: 'Durum',
            key: 'status',
            width: 14
          }
        ]

        exportRows.forEach(
          (row) => {
            worksheet.addRow({
              teacherName:
                row.teacherName ||
                '-',

              paymentDate:
                row.paymentDate
                  ? formatDate(
                      row.paymentDate
                    )
                  : '-',

              amount:
                row.amount,

              paymentMethod:
                row.paymentMethod ||
                '-',

              referenceNumber:
                row.referenceNumber ||
                '-',

              note:
                row.note ||
                '-',

              status:
                row.status ||
                '-'
            })
          }
        )

        worksheet.getRow(
          1
        ).font = {
          bold: true
        }

        worksheet.getRow(
          1
        ).alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        }

        worksheet.getColumn(
          'amount'
        ).numFmt =
          '#,##0.00 [$₺-tr-TR]'

        worksheet.getColumn(
          'amount'
        ).alignment = {
          vertical: 'middle',
          horizontal: 'right'
        }

        ;[
          'paymentDate',
          'paymentMethod',
          'status'
        ].forEach((columnKey) => {
          worksheet.getColumn(
            columnKey
          ).alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true
          }
        })

        worksheet.views = [
          {
            state: 'frozen',
            ySplit: 1
          }
        ]

        worksheet.autoFilter = {
          from: 'A1',
          to: 'G1'
        }

        await downloadWorkbook(
          workbook,
          `ogretmen-odemeleri-raporu-${getTodayKey()}.xlsx`
        )
      } catch (exportError) {
        console.error(
          'Öğretmen ödemeleri Excel hatası:',
          exportError
        )

        alert(
          exportError instanceof Error
            ? exportError.message
            : 'Excel dosyası oluşturulamadı.'
        )
      } finally {
        setExporting('')
      }
    }

  const exportPdf =
    async () => {
      if (exporting) {
        return
      }

      setExporting('pdf')

      try {
        const exportRows =
          await getAllTeacherPaymentsReportRows(
            exportFilters
          )

        if (
          exportRows.length === 0
        ) {
          alert(
            'PDF’e aktarılacak öğretmen ödeme kaydı bulunmamaktadır.'
          )

          return
        }

        const pdfMake =
          await getPdfMake()

        const paymentBlockLayout = {
          hLineWidth: (
            lineIndex,
            node
          ) => {
            if (
              lineIndex === 0 ||
              lineIndex ===
                node.table.body.length
            ) {
              return 0.65
            }

            if (
              lineIndex === 1 ||
              lineIndex === 2
            ) {
              return 0.45
            }

            return 0.18
          },

          vLineWidth: (
            lineIndex,
            node
          ) =>
            lineIndex === 0 ||
            lineIndex ===
              node.table.widths.length
              ? 0.65
              : 0,

          hLineColor: (
            lineIndex,
            node
          ) => {
            if (
              lineIndex === 0 ||
              lineIndex ===
                node.table.body.length
            ) {
              return '#9CA3AF'
            }

            if (
              lineIndex === 1 ||
              lineIndex === 2
            ) {
              return '#C2C8CF'
            }

            return '#E4E7EB'
          },

          vLineColor: () =>
            '#9CA3AF',

          paddingLeft: () =>
            7,

          paddingRight: () =>
            7,

          paddingTop: () =>
            6,

          paddingBottom: () =>
            6
        }

        const paymentsByTeacher =
          exportRows.reduce(
            (
              result,
              row
            ) => {
              const teacherName =
                row.teacherName ||
                'Tanımsız Öğretmen'

              if (
                !result[
                  teacherName
                ]
              ) {
                result[
                  teacherName
                ] = []
              }

              result[
                teacherName
              ].push(row)

              return result
            },
            {}
          )

        const content = []

        Object.entries(
          paymentsByTeacher
        ).forEach(
          ([
            teacherName,
            paymentRows
          ]) => {
            const paymentBody = [
              [
                {
                  text:
                    `ÖĞRETMEN — ${teacherName}`,

                  colSpan: 6,

                  bold: true,

                  fontSize: 9,

                  alignment:
                    'left',

                  margin:
                    [2, 1, 0, 1]
                },
                {},
                {},
                {},
                {},
                {}
              ],

              [
                {
                  text:
                    'Ödeme Tarihi',

                  bold: true
                },
                {
                  text:
                    'Tutar',

                  bold: true
                },
                {
                  text:
                    'Ödeme Yöntemi',

                  bold: true
                },
                {
                  text:
                    'Referans No',

                  bold: true
                },
                {
                  text:
                    'Not',

                  bold: true
                },
                {
                  text:
                    'Durum',

                  bold: true
                }
              ]
            ]

            paymentRows.forEach(
              (row) => {
                paymentBody.push([
                  row.paymentDate
                    ? formatDate(
                        row.paymentDate
                      )
                    : '-',

                  formatCurrency(
                    row.amount
                  ),

                  row.paymentMethod ||
                    '-',

                  row.referenceNumber ||
                    '-',

                  row.note ||
                    '-',

                  row.status ||
                    '-'
                ])
              }
            )

            content.push({
              table: {
                headerRows: 2,

                widths: [
                  88,
                  82,
                  105,
                  100,
                  '*',
                  65
                ],

                body:
                  paymentBody,

                dontBreakRows:
                  true
              },

              layout:
                paymentBlockLayout,

              margin:
                [0, 0, 0, 14]
            })
          }
        )

        pdfMake
          .createPdf({
            pageSize:
              'A4',

            pageOrientation:
              'landscape',

            pageMargins:
              [24, 52, 24, 34],

            header: {
              margin:
                [24, 16, 24, 0],

              columns: [
                {
                  text:
                    'ARTI AKADEMİ',

                  bold: true,

                  color:
                    '#0B84A5'
                },

                {
                  text:
                    'ÖĞRETMEN ÖDEMELERİ RAPORU',

                  alignment:
                    'right',

                  bold: true
                }
              ]
            },

            content,

            defaultStyle: {
              font:
                'Roboto',

              fontSize:
                8,

              alignment:
                'center'
            }
          })
          .download(
            `ogretmen-odemeleri-raporu-${getTodayKey()}.pdf`
          )
      } catch (exportError) {
        console.error(
          'Öğretmen ödemeleri PDF hatası:',
          exportError
        )

        alert(
          exportError instanceof Error
            ? exportError.message
            : 'PDF dosyası oluşturulamadı.'
        )
      } finally {
        setExporting('')
      }
    }

  return (
    <>
      <ReportExportButtons
        exporting={exporting}
        loading={loading}
        onExcel={exportExcel}
        onPdf={exportPdf}
      />

      <div className="report-toolbar">
        <div className="report-filter-grid">
          <div className="form-group">
            <label>
              Ödeme Ara
            </label>

            <input
              value={searchText}
              onChange={(event) => {
                setSearchText(
                  event.target.value
                )

                setPage(1)
              }}
              placeholder="Öğretmen, referans no veya not"
            />
          </div>

          <div className="form-group">
            <label>
              Ödeme Yöntemi
            </label>

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

              <option value="Nakit">
                Nakit
              </option>

              <option value="Havale/EFT">
                Havale/EFT
              </option>

              <option value="Kredi Kartı">
                Kredi Kartı
              </option>

              <option value="Banka Kartı">
                Banka Kartı
              </option>

              <option value="Diğer">
                Diğer
              </option>
            </select>
          </div>

          <div className="form-group">
            <label>
              Başlangıç Tarihi
            </label>

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
            <label>
              Bitiş Tarihi
            </label>

            <input
              type="date"
              value={endDate}
              min={
                startDate ||
                undefined
              }
              onChange={(event) => {
                setEndDate(
                  event.target.value
                )

                setPage(1)
              }}
            />
          </div>
        </div>

        <div className="report-toolbar-footer">
          <button
            type="button"
            className="cancel-button"
            onClick={clearFilters}
          >
            Filtreleri Temizle
          </button>

          <div className="report-toolbar-actions">
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
                En yeni ödeme
              </option>

              <option value="oldest">
                En eski ödeme
              </option>

              <option value="amountDesc">
                Tutar yüksek-düşük
              </option>

              <option value="amountAsc">
                Tutar düşük-yüksek
              </option>

              <option value="teacherAsc">
                Öğretmen A-Z
              </option>

              <option value="teacherDesc">
                Öğretmen Z-A
              </option>
            </select>

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
              <option value="10">
                10 kayıt
              </option>

              <option value="25">
                25 kayıt
              </option>

              <option value="50">
                50 kayıt
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className="report-table-wrapper">
        <table className="report-table teacher-payments-report-table">
          <thead>
            <tr>
              <th>Öğretmen</th>
              <th>Ödeme Tarihi</th>
              <th>Tutar</th>
              <th>Ödeme Yöntemi</th>
              <th>Referans No</th>
              <th>Not</th>
              <th>Durum</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="7"
                  className="empty-table"
                >
                  Öğretmen ödemeleri yükleniyor...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan="7"
                  className="empty-table"
                >
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan="7"
                  className="empty-table"
                >
                  Filtrelere uygun öğretmen ödeme kaydı bulunamadı.
                </td>
              </tr>
            ) : (
              rows.map(
                (row) => (
                  <tr
                    key={
                      row.paymentId
                    }
                  >
                    <td>
                      <strong>
                        {row.teacherName ||
                          '-'}
                      </strong>
                    </td>

                    <td>
                      {row.paymentDate
                        ? formatDate(
                            row.paymentDate
                          )
                        : '-'}
                    </td>

                    <td>
                      <strong className="report-paid-amount">
                        {formatCurrency(
                          row.amount
                        )}
                      </strong>
                    </td>

                    <td>
                      {row.paymentMethod ||
                        '-'}
                    </td>

                    <td>
                      {row.referenceNumber ||
                        '-'}
                    </td>

                    <td className="report-long-text-cell">
                      {row.note ||
                        '-'}
                    </td>

                    <td>
                      <span
                        className={`report-status-badge ${
                          String(
                            row.status ||
                              ''
                          )
                            .trim()
                            .toLocaleLowerCase(
                              'tr-TR'
                            ) ===
                          'aktif'
                            ? 'active'
                            : 'passive'
                        }`}
                      >
                        {row.status ||
                          '-'}
                      </span>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>

      <ReportPagination
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setPage}
      />
    </>
  )
}


function StaffPaymentsReport() {
  const [rows, setRows] =
    useState([])

  const [total, setTotal] =
    useState(0)

  const [page, setPage] =
    useState(1)

  const [pageSize, setPageSize] =
    useState(10)

  const [
    searchText,
    setSearchText
  ] = useState('')

  const [
    paymentType,
    setPaymentType
  ] = useState('')

  const [
    paymentMethod,
    setPaymentMethod
  ] = useState('')

  const [
    startDate,
    setStartDate
  ] = useState('')

  const [
    endDate,
    setEndDate
  ] = useState('')

  const [
    sortOption,
    setSortOption
  ] = useState('newest')

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [exporting, setExporting] =
    useState('')

  useEffect(() => {
    let isMounted = true

    const timeoutId =
      window.setTimeout(
        async () => {
          setLoading(true)
          setError('')

          try {
            const result =
              await getStaffPaymentsReportPage({
                page,
                pageSize,
                searchText,
                paymentType,
                paymentMethod,
                startDate,
                endDate,
                sortOption
              })

            if (!isMounted) {
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

            setRows(
              result.data
            )

            setTotal(
              result.total
            )
          } catch (loadError) {
            console.error(
              'Personel ödemeleri raporu yüklenemedi:',
              loadError
            )

            if (isMounted) {
              setError(
                loadError instanceof Error
                  ? loadError.message
                  : 'Personel ödemeleri raporu yüklenemedi.'
              )
            }
          } finally {
            if (isMounted) {
              setLoading(false)
            }
          }
        },
        searchText.trim()
          ? 350
          : 0
      )

    return () => {
      isMounted = false

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
    sortOption
  ])

  const exportFilters = {
    searchText,
    paymentType,
    paymentMethod,
    startDate,
    endDate
  }

  const clearFilters = () => {
    setSearchText('')
    setPaymentType('')
    setPaymentMethod('')
    setStartDate('')
    setEndDate('')
    setSortOption('newest')
    setPage(1)
  }

  const exportExcel =
    async () => {
      if (exporting) {
        return
      }

      setExporting('excel')

      try {
        const exportRows =
          await getAllStaffPaymentsReportRows(
            exportFilters
          )

        if (
          exportRows.length === 0
        ) {
          alert(
            'Excel’e aktarılacak personel ödeme kaydı bulunmamaktadır.'
          )

          return
        }

        const excelModule =
          await import('exceljs')

        const ExcelJS =
          excelModule.default ||
          excelModule

        const workbook =
          new ExcelJS.Workbook()

        const worksheet =
          workbook.addWorksheet(
            'Personel Ödemeleri'
          )

        worksheet.columns = [
          {
            header: 'Personel',
            key: 'staffName',
            width: 26
          },
          {
            header: 'Görev / Unvan',
            key: 'roleTitle',
            width: 23
          },
          {
            header: 'Ödeme Türü',
            key: 'paymentType',
            width: 18
          },
          {
            header: 'Ödeme Dönemi',
            key: 'paymentPeriod',
            width: 19
          },
          {
            header: 'Ödeme Tarihi',
            key: 'paymentDate',
            width: 18
          },
          {
            header: 'Tutar',
            key: 'amount',
            width: 18
          },
          {
            header: 'Ödeme Yöntemi',
            key: 'paymentMethod',
            width: 20
          },
          {
            header: 'Referans No',
            key: 'referenceNumber',
            width: 23
          },
          {
            header: 'Not',
            key: 'note',
            width: 36
          }
        ]

        exportRows.forEach(
          (row) => {
            worksheet.addRow({
              staffName:
                row.staffName ||
                '-',

              roleTitle:
                row.roleTitle ||
                '-',

              paymentType:
                row.paymentType ||
                '-',

              paymentPeriod:
                row.paymentPeriod ||
                '-',

              paymentDate:
                row.paymentDate
                  ? formatDate(
                      row.paymentDate
                    )
                  : '-',

              amount:
                row.amount,

              paymentMethod:
                row.paymentMethod ||
                '-',

              referenceNumber:
                row.referenceNumber ||
                '-',

              note:
                row.note ||
                '-'
            })
          }
        )

        worksheet.getRow(
          1
        ).font = {
          bold: true
        }

        worksheet.getRow(
          1
        ).alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        }

        worksheet.getColumn(
          'amount'
        ).numFmt =
          '#,##0.00 [$₺-tr-TR]'

        worksheet.columns.forEach(
          (column) => {
            column.alignment = {
              vertical:
                'middle',

              horizontal:
                'center',

              wrapText:
                true
            }
          }
        )

        worksheet.views = [
          {
            state:
              'frozen',

            ySplit:
              1
          }
        ]

        worksheet.autoFilter = {
          from:
            'A1',

          to:
            'I1'
        }

        await downloadWorkbook(
          workbook,
          `personel-odemeleri-raporu-${getTodayKey()}.xlsx`
        )
      } catch (exportError) {
        console.error(
          'Personel ödemeleri Excel hatası:',
          exportError
        )

        alert(
          exportError instanceof Error
            ? exportError.message
            : 'Excel dosyası oluşturulamadı.'
        )
      } finally {
        setExporting('')
      }
    }

  const exportPdf =
    async () => {
      if (exporting) {
        return
      }

      setExporting('pdf')

      try {
        const exportRows =
          await getAllStaffPaymentsReportRows(
            exportFilters
          )

        if (
          exportRows.length === 0
        ) {
          alert(
            'PDF’e aktarılacak personel ödeme kaydı bulunmamaktadır.'
          )

          return
        }

        const pdfMake =
          await getPdfMake()

        const tableBody = [
          [
            {
              text:
                'Personel',

              bold:
                true
            },
            {
              text:
                'Görev / Unvan',

              bold:
                true
            },
            {
              text:
                'Ödeme Türü',

              bold:
                true
            },
            {
              text:
                'Ödeme Dönemi',

              bold:
                true
            },
            {
              text:
                'Ödeme Tarihi',

              bold:
                true
            },
            {
              text:
                'Tutar',

              bold:
                true
            },
            {
              text:
                'Ödeme Yöntemi',

              bold:
                true
            },
            {
              text:
                'Referans No',

              bold:
                true
            },
            {
              text:
                'Not',

              bold:
                true
            }
          ],

          ...exportRows.map(
            (row) => [
              row.staffName ||
                '-',

              row.roleTitle ||
                '-',

              row.paymentType ||
                '-',

              row.paymentPeriod ||
                '-',

              row.paymentDate
                ? formatDate(
                    row.paymentDate
                  )
                : '-',

              formatCurrency(
                row.amount
              ),

              row.paymentMethod ||
                '-',

              row.referenceNumber ||
                '-',

              row.note ||
                '-'
            ]
          )
        ]

        pdfMake
          .createPdf({
            pageSize:
              'A4',

            pageOrientation:
              'landscape',

            pageMargins:
              [24, 52, 24, 34],

            header: {
              margin:
                [24, 16, 24, 0],

              columns: [
                {
                  text:
                    'ARTI AKADEMİ',

                  bold:
                    true,

                  color:
                    '#0B84A5'
                },

                {
                  text:
                    'PERSONEL ÖDEMELERİ RAPORU',

                  alignment:
                    'right',

                  bold:
                    true
                }
              ]
            },

            content: [
              {
                table: {
                  headerRows:
                    1,

                  widths: [
                    82,
                    78,
                    62,
                    68,
                    64,
                    58,
                    74,
                    68,
                    120
                  ],

                  body:
                    tableBody,

                  dontBreakRows:
                    true
                },

                layout: {
                  hLineWidth: (
                    lineIndex
                  ) =>
                    lineIndex === 1
                      ? 0.8
                      : 0.35,

                  hLineColor: () =>
                    '#C8D0D6',

                  vLineWidth: () =>
                    0,

                  paddingLeft: () =>
                    3,

                  paddingRight: () =>
                    3,

                  paddingTop: () =>
                    4,

                  paddingBottom: () =>
                    4
                }
              }
            ],

            defaultStyle: {
              font:
                'Roboto',

              fontSize:
                8,

              alignment:
                'center'
            }
          })
          .download(
            `personel-odemeleri-raporu-${getTodayKey()}.pdf`
          )
      } catch (exportError) {
        console.error(
          'Personel ödemeleri PDF hatası:',
          exportError
        )

        alert(
          exportError instanceof Error
            ? exportError.message
            : 'PDF dosyası oluşturulamadı.'
        )
      } finally {
        setExporting('')
      }
    }

  return (
    <>
      <ReportExportButtons
        exporting={
          exporting
        }
        loading={
          loading
        }
        onExcel={
          exportExcel
        }
        onPdf={
          exportPdf
        }
      />

      <div className="report-toolbar">
        <div className="report-filter-grid">
          <div className="form-group">
            <label>
              Personel Ara
            </label>

            <input
              value={
                searchText
              }
              onChange={(event) => {
                setSearchText(
                  event.target.value
                )

                setPage(1)
              }}
              placeholder="Personel, görev, dönem, referans veya not"
            />
          </div>

          <div className="form-group">
            <label>
              Ödeme Türü
            </label>

            <select
              value={
                paymentType
              }
              onChange={(event) => {
                setPaymentType(
                  event.target.value
                )

                setPage(1)
              }}
            >
              <option value="">
                Tüm ödeme türleri
              </option>

              <option value="Maaş">
                Maaş
              </option>

              <option value="Avans">
                Avans
              </option>

              <option value="Prim">
                Prim
              </option>

              <option value="Fazla Mesai">
                Fazla Mesai
              </option>

              <option value="Yol / Yemek">
                Yol / Yemek
              </option>

              <option value="Diğer">
                Diğer
              </option>
            </select>
          </div>

          <div className="form-group">
            <label>
              Ödeme Yöntemi
            </label>

            <select
              value={
                paymentMethod
              }
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

              <option value="Nakit">
                Nakit
              </option>

              <option value="Havale / EFT">
                Havale / EFT
              </option>

              <option value="Kredi Kartı">
                Kredi Kartı
              </option>

              <option value="Banka Kartı">
                Banka Kartı
              </option>
            </select>
          </div>

          <div
            style={{
              gridColumn:
                '1 / 3',

              display:
                'grid',

              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',

              gap:
                '14px'
            }}
          >
            <div className="form-group">
              <label>
                Başlangıç Tarihi
              </label>

              <input
                type="date"
                value={
                  startDate
                }
                onChange={(event) => {
                  setStartDate(
                    event.target.value
                  )

                  setPage(1)
                }}
              />
            </div>

            <div className="form-group">
              <label>
                Bitiş Tarihi
              </label>

              <input
                type="date"
                value={
                  endDate
                }
                min={
                  startDate ||
                  undefined
                }
                onChange={(event) => {
                  setEndDate(
                    event.target.value
                  )

                  setPage(1)
                }}
              />
            </div>
          </div>
        </div>

        <div className="report-toolbar-footer">
          <button
            type="button"
            className="cancel-button"
            onClick={
              clearFilters
            }
          >
            Filtreleri Temizle
          </button>

          <div className="report-toolbar-actions">
            <select
              value={
                sortOption
              }
              onChange={(event) => {
                setSortOption(
                  event.target.value
                )

                setPage(1)
              }}
            >
              <option value="newest">
                En yeni ödeme
              </option>

              <option value="oldest">
                En eski ödeme
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

            <select
              value={
                pageSize
              }
              onChange={(event) => {
                setPageSize(
                  Number(
                    event.target.value
                  )
                )

                setPage(1)
              }}
            >
              <option value="10">
                10 kayıt
              </option>

              <option value="25">
                25 kayıt
              </option>

              <option value="50">
                50 kayıt
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className="report-table-wrapper">
        <table
          className="report-table"
          style={{
            width:
              '100%',

            tableLayout:
              'fixed'
          }}
        >
          <colgroup>
            <col
              style={{
                width:
                  '13%'
              }}
            />
            <col
              style={{
                width:
                  '12%'
              }}
            />
            <col
              style={{
                width:
                  '10%'
              }}
            />
            <col
              style={{
                width:
                  '10%'
              }}
            />
            <col
              style={{
                width:
                  '10%'
              }}
            />
            <col
              style={{
                width:
                  '10%'
              }}
            />
            <col
              style={{
                width:
                  '11%'
              }}
            />
            <col
              style={{
                width:
                  '10%'
              }}
            />
            <col
              style={{
                width:
                  '14%'
              }}
            />
          </colgroup>

          <thead>
            <tr>
              {[
                'Personel',
                'Görev / Unvan',
                'Ödeme Türü',
                'Ödeme Dönemi',
                'Ödeme Tarihi',
                'Tutar',
                'Ödeme Yöntemi',
                'Referans No',
                'Not'
              ].map(
                (header) => (
                  <th
                    key={
                      header
                    }
                    style={{
                      textAlign:
                        'center'
                    }}
                  >
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="9"
                  className="empty-table"
                >
                  Personel ödemeleri yükleniyor...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan="9"
                  className="empty-table"
                >
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan="9"
                  className="empty-table"
                >
                  Filtrelere uygun personel ödeme kaydı bulunamadı.
                </td>
              </tr>
            ) : (
              rows.map(
                (row) => (
                  <tr
                    key={
                      row.paymentId
                    }
                  >
                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      <strong>
                        {row.staffName ||
                          '-'}
                      </strong>
                    </td>

                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      {row.roleTitle ||
                        '-'}
                    </td>

                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      {row.paymentType ||
                        '-'}
                    </td>

                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      {row.paymentPeriod ||
                        '-'}
                    </td>

                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      {row.paymentDate
                        ? formatDate(
                            row.paymentDate
                          )
                        : '-'}
                    </td>

                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      <strong className="report-paid-amount">
                        {formatCurrency(
                          row.amount
                        )}
                      </strong>
                    </td>

                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      {row.paymentMethod ||
                        '-'}
                    </td>

                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      {row.referenceNumber ||
                        '-'}
                    </td>

                    <td
                      className="report-long-text-cell"
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      {row.note ||
                        '-'}
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>

      <ReportPagination
        total={
          total
        }
        page={
          page
        }
        pageSize={
          pageSize
        }
        loading={
          loading
        }
        onPageChange={
          setPage
        }
      />
    </>
  )
}


function IncomeExpenseReport() {
  const [rows, setRows] =
    useState([])

  const [total, setTotal] =
    useState(0)

  const [summary, setSummary] =
    useState({
      totalIncome: 0,
      totalExpense: 0,
      netBalance: 0,
      recordCount: 0
    })

  const [page, setPage] =
    useState(1)

  const [pageSize, setPageSize] =
    useState(10)

  const [
    searchText,
    setSearchText
  ] = useState('')

  const [
    direction,
    setDirection
  ] = useState('all')

  const [
    sourceType,
    setSourceType
  ] = useState('')

  const [
    paymentMethod,
    setPaymentMethod
  ] = useState('')

  const [
    startDate,
    setStartDate
  ] = useState('')

  const [
    endDate,
    setEndDate
  ] = useState('')

  const [
    sortOption,
    setSortOption
  ] = useState('newest')

  const [loading, setLoading] =
    useState(true)

  const [
    summaryLoading,
    setSummaryLoading
  ] = useState(true)

  const [error, setError] =
    useState('')

  const [exporting, setExporting] =
    useState('')

  const reportFilters = {
    searchText,
    direction,
    sourceType,
    paymentMethod,
    startDate,
    endDate
  }

  useEffect(() => {
    let isMounted = true

    const timeoutId =
      window.setTimeout(
        async () => {
          setLoading(true)
          setError('')

          try {
            const result =
              await getFinanceIncomeExpenseReportPage({
                page,
                pageSize,
                ...reportFilters,
                sortOption
              })

            if (!isMounted) {
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

            if (
              page >
              totalPages
            ) {
              setPage(
                totalPages
              )

              return
            }

            setRows(
              result.data
            )

            setTotal(
              result.total
            )
          } catch (loadError) {
            console.error(
              'Gelir-gider raporu yüklenemedi:',
              loadError
            )

            if (isMounted) {
              setError(
                loadError instanceof Error
                  ? loadError.message
                  : 'Gelir-gider raporu yüklenemedi.'
              )
            }
          } finally {
            if (isMounted) {
              setLoading(false)
            }
          }
        },
        searchText.trim()
          ? 350
          : 0
      )

    return () => {
      isMounted = false

      window.clearTimeout(
        timeoutId
      )
    }
  }, [
    page,
    pageSize,
    searchText,
    direction,
    sourceType,
    paymentMethod,
    startDate,
    endDate,
    sortOption
  ])

  useEffect(() => {
    let isMounted = true

    const loadSummary =
      async () => {
        setSummaryLoading(
          true
        )

        try {
          const result =
            await getFinanceIncomeExpenseReportSummary(
              reportFilters
            )

          if (isMounted) {
            setSummary(
              result
            )
          }
        } catch (summaryError) {
          console.error(
            'Gelir-gider özeti yüklenemedi:',
            summaryError
          )
        } finally {
          if (isMounted) {
            setSummaryLoading(
              false
            )
          }
        }
      }

    loadSummary()

    return () => {
      isMounted = false
    }
  }, [
    searchText,
    direction,
    sourceType,
    paymentMethod,
    startDate,
    endDate
  ])

  const clearFilters = () => {
    setSearchText('')
    setDirection('all')
    setSourceType('')
    setPaymentMethod('')
    setStartDate('')
    setEndDate('')
    setSortOption('newest')
    setPage(1)
  }

  const getSummaryValue =
    (value) =>
      summaryLoading
        ? '...'
        : formatCurrency(
            value
          )

  const exportExcel =
    async () => {
      if (exporting) {
        return
      }

      setExporting('excel')

      try {
        const exportRows =
          await getAllFinanceIncomeExpenseReportRows({
            ...reportFilters,
            sortOption: 'newest'
          })

        if (
          exportRows.length === 0
        ) {
          alert(
            'Excel’e aktarılacak gelir-gider kaydı bulunmamaktadır.'
          )

          return
        }

        /*
         * Excel çıktısı PDF gibi tek kronolojik liste:
         * gelir ve gider kayıtları ayrılmaz.
         */
        const sortedRows = [
          ...exportRows
        ].sort(
          (
            firstRow,
            secondRow
          ) => {
            const firstDate =
              new Date(
                firstRow.transactionDate ||
                0
              ).getTime()

            const secondDate =
              new Date(
                secondRow.transactionDate ||
                0
              ).getTime()

            if (
              secondDate !==
              firstDate
            ) {
              return (
                secondDate -
                firstDate
              )
            }

            const firstCreated =
              new Date(
                firstRow.createdAt ||
                0
              ).getTime()

            const secondCreated =
              new Date(
                secondRow.createdAt ||
                0
              ).getTime()

            return (
              secondCreated -
              firstCreated
            )
          }
        )

        const exportSummary =
          sortedRows.reduce(
            (
              result,
              row
            ) => {
              if (
                row.direction ===
                'income'
              ) {
                result.totalIncome +=
                  Number(
                    row.amount || 0
                  )
              } else {
                result.totalExpense +=
                  Number(
                    row.amount || 0
                  )
              }

              return result
            },
            {
              totalIncome:
                0,

              totalExpense:
                0
            }
          )

        exportSummary.netBalance =
          exportSummary.totalIncome -
          exportSummary.totalExpense

        const excelModule =
          await import('exceljs')

        const ExcelJS =
          excelModule.default ||
          excelModule

        const workbook =
          new ExcelJS.Workbook()

        const worksheet =
          workbook.addWorksheet(
            'Gelir-Gider'
          )

        /*
         * Tek sayfa:
         * üstte özet,
         * altta tüm ayrıntılı hareketler.
         */
        worksheet.columns = [
          {
            key:
              'direction',
            width:
              13
          },
          {
            key:
              'date',
            width:
              16
          },
          {
            key:
              'source',
            width:
              22
          },
          {
            key:
              'title',
            width:
              30
          },
          {
            key:
              'category',
            width:
              22
          },
          {
            key:
              'description',
            width:
              34
          },
          {
            key:
              'relatedParty',
            width:
              28
          },
          {
            key:
              'amount',
            width:
              18
          },
          {
            key:
              'paymentMethod',
            width:
              20
          },
          {
            key:
              'documentNumber',
            width:
              23
          },
          {
            key:
              'note',
            width:
              36
          }
        ]

        worksheet.getCell(
          'A1'
        ).value =
          'Gösterge'

        worksheet.getCell(
          'B1'
        ).value =
          'Tutar'

        worksheet.getCell(
          'A2'
        ).value =
          'Toplam Gelir'

        worksheet.getCell(
          'B2'
        ).value =
          exportSummary.totalIncome

        worksheet.getCell(
          'A3'
        ).value =
          'Toplam Gider'

        worksheet.getCell(
          'B3'
        ).value =
          exportSummary.totalExpense

        worksheet.getCell(
          'A4'
        ).value =
          'Net Bakiye'

        worksheet.getCell(
          'B4'
        ).value =
          exportSummary.netBalance

        worksheet.getRow(
          1
        ).font = {
          bold:
            true
        }

        worksheet.getRow(
          1
        ).alignment = {
          vertical:
            'middle',

          horizontal:
            'center'
        }

        ;[
          'B2',
          'B3',
          'B4'
        ].forEach(
          (cellAddress) => {
            worksheet.getCell(
              cellAddress
            ).numFmt =
              '#,##0.00 [$₺-tr-TR]'

            worksheet.getCell(
              cellAddress
            ).alignment = {
              horizontal:
                'center'
            }
          }
        )

        /*
         * Ayrıntılı liste başlığı.
         */
        const detailHeaderRowNumber =
          7

        const detailHeaders = [
          'Tür',
          'Tarih',
          'Kaynak',
          'Başlık',
          'Kategori',
          'Açıklama',
          'İlgili Kişi / Kurum',
          'Tutar',
          'Ödeme Yöntemi',
          'Belge / Referans No',
          'Not'
        ]

        const detailHeaderRow =
          worksheet.getRow(
            detailHeaderRowNumber
          )

        detailHeaders.forEach(
          (
            header,
            index
          ) => {
            detailHeaderRow.getCell(
              index + 1
            ).value =
              header
          }
        )

        detailHeaderRow.font = {
          bold:
            true
        }

        detailHeaderRow.alignment = {
          vertical:
            'middle',

          horizontal:
            'center',

          wrapText:
            true
        }

        sortedRows.forEach(
          (row) => {
            const excelRow =
              worksheet.addRow({
                direction:
                  row.directionLabel,

                date:
                  row.transactionDate
                    ? formatDate(
                        row.transactionDate
                      )
                    : '-',

                source:
                  row.sourceLabel ||
                  '-',

                title:
                  row.title ||
                  '-',

                category:
                  row.category ||
                  '-',

                description:
                  row.description ||
                  '-',

                relatedParty:
                  row.relatedParty ||
                  '-',

                amount:
                  Number(
                    row.amount || 0
                  ),

                paymentMethod:
                  row.paymentMethod ||
                  '-',

                documentNumber:
                  row.documentNumber ||
                  '-',

                note:
                  row.note ||
                  '-'
              })

            excelRow.alignment = {
              vertical:
                'middle',

              horizontal:
                'center',

              wrapText:
                true
            }
          }
        )

        worksheet.getColumn(
          'amount'
        ).numFmt =
          '#,##0.00 [$₺-tr-TR]'

        worksheet.getColumn(
          'amount'
        ).alignment = {
          vertical:
            'middle',

          horizontal:
            'center',

          wrapText:
            true
        }

        /*
         * Ayrıntı başlığı ekranda sabit kalsın.
         */
        worksheet.views = [
          {
            state:
              'frozen',

            ySplit:
              detailHeaderRowNumber
          }
        ]

        worksheet.autoFilter = {
          from: {
            row:
              detailHeaderRowNumber,

            column:
              1
          },

          to: {
            row:
              detailHeaderRowNumber,

            column:
              detailHeaders.length
          }
        }

        await downloadWorkbook(
          workbook,
          `gelir-gider-raporu-${getTodayKey()}.xlsx`
        )
      } catch (exportError) {
        console.error(
          'Gelir-gider Excel hatası:',
          exportError
        )

        alert(
          exportError instanceof Error
            ? exportError.message
            : 'Excel dosyası oluşturulamadı.'
        )
      } finally {
        setExporting('')
      }
    }

  // PDF AYRI LİSTE SÜRÜMÜ:
  // Üstte özet, sonra GELİRLER ve GİDERLER ayrı tablolar.
  const exportPdf =
    async () => {
      if (exporting) {
        return
      }

      setExporting('pdf')

      try {
        const exportRows =
          await getAllFinanceIncomeExpenseReportRows({
            ...reportFilters,
            sortOption: 'newest'
          })

        if (
          exportRows.length === 0
        ) {
          alert(
            'PDF’e aktarılacak gelir-gider kaydı bulunmamaktadır.'
          )

          return
        }

        const sortedRows = [
          ...exportRows
        ].sort(
          (
            firstRow,
            secondRow
          ) => {
            const firstDate =
              new Date(
                firstRow.transactionDate ||
                0
              ).getTime()

            const secondDate =
              new Date(
                secondRow.transactionDate ||
                0
              ).getTime()

            if (
              secondDate !==
              firstDate
            ) {
              return (
                secondDate -
                firstDate
              )
            }

            const firstCreated =
              new Date(
                firstRow.createdAt ||
                0
              ).getTime()

            const secondCreated =
              new Date(
                secondRow.createdAt ||
                0
              ).getTime()

            return (
              secondCreated -
              firstCreated
            )
          }
        )

        const incomeRows =
          sortedRows.filter(
            (row) =>
              row.direction ===
              'income'
          )

        const expenseRows =
          sortedRows.filter(
            (row) =>
              row.direction ===
              'expense'
          )

        const exportSummary =
          sortedRows.reduce(
            (
              result,
              row
            ) => {
              if (
                row.direction ===
                'income'
              ) {
                result.totalIncome +=
                  Number(
                    row.amount || 0
                  )
              } else {
                result.totalExpense +=
                  Number(
                    row.amount || 0
                  )
              }

              return result
            },
            {
              totalIncome:
                0,

              totalExpense:
                0
            }
          )

        exportSummary.netBalance =
          exportSummary.totalIncome -
          exportSummary.totalExpense

        const pdfMake =
          await getPdfMake()

        const createDetailBody =
          (rows) => [
            [
              'Tarih',
              'Kaynak',
              'Başlık',
              'Kategori',
              'İlgili',
              'Tutar',
              'Yöntem',
              'Belge No',
              'Not'
            ].map(
              (header) => ({
                text:
                  header,

                bold:
                  true
              })
            ),

            ...rows.map(
              (row) => [
                row.transactionDate
                  ? formatDate(
                      row.transactionDate
                    )
                  : '-',

                row.sourceLabel ||
                  '-',

                row.description
                  ? `${
                      row.title ||
                      '-'
                    } — ${
                      row.description
                    }`
                  : row.title ||
                    '-',

                row.category ||
                  '-',

                row.relatedParty ||
                  '-',

                formatCurrency(
                  row.amount
                ),

                row.paymentMethod ||
                  '-',

                row.documentNumber ||
                  '-',

                row.note ||
                  '-'
              ]
            )
          ]

        const content = [
          {
            table: {
              widths: [
                '*',
                '*',
                '*'
              ],

              body: [
                [
                  {
                    text:
                      'Toplam Gelir',

                    bold:
                      true
                  },
                  {
                    text:
                      'Toplam Gider',

                    bold:
                      true
                  },
                  {
                    text:
                      'Net Bakiye',

                    bold:
                      true
                  }
                ],

                [
                  formatCurrency(
                    exportSummary.totalIncome
                  ),

                  formatCurrency(
                    exportSummary.totalExpense
                  ),

                  formatCurrency(
                    exportSummary.netBalance
                  )
                ]
              ]
            },

            layout:
              'lightHorizontalLines',

            margin:
              [0, 0, 0, 14]
          }
        ]

        content.push({
          text:
            'GELİRLER',

          bold:
            true,

          fontSize:
            9,

          alignment:
            'left',

          margin:
            [0, 0, 0, 5]
        })

        if (
          incomeRows.length === 0
        ) {
          content.push({
            text:
              'Filtrelere uygun gelir kaydı bulunmamaktadır.',

            alignment:
              'left',

            margin:
              [0, 0, 0, 14]
          })
        } else {
          content.push({
            table: {
              headerRows:
                1,

              widths: [
                50,
                65,
                105,
                66,
                78,
                58,
                66,
                58,
                92
              ],

              body:
                createDetailBody(
                  incomeRows
                ),

              dontBreakRows:
                true
            },

            layout:
              'lightHorizontalLines',

            margin:
              [0, 0, 0, 16]
          })
        }

        content.push({
          text:
            'GİDERLER',

          bold:
            true,

          fontSize:
            9,

          alignment:
            'left',

          margin:
            [0, 0, 0, 5]
        })

        if (
          expenseRows.length === 0
        ) {
          content.push({
            text:
              'Filtrelere uygun gider kaydı bulunmamaktadır.',

            alignment:
              'left'
          })
        } else {
          content.push({
            table: {
              headerRows:
                1,

              widths: [
                50,
                65,
                105,
                66,
                78,
                58,
                66,
                58,
                92
              ],

              body:
                createDetailBody(
                  expenseRows
                ),

              dontBreakRows:
                true
            },

            layout:
              'lightHorizontalLines'
          })
        }

        pdfMake
          .createPdf({
            pageSize:
              'A4',

            pageOrientation:
              'landscape',

            pageMargins:
              [24, 52, 24, 34],

            header: {
              margin:
                [24, 16, 24, 0],

              columns: [
                {
                  text:
                    'ARTI AKADEMİ',

                  bold:
                    true,

                  color:
                    '#0B84A5'
                },

                {
                  text:
                    'GELİR-GİDER RAPORU',

                  alignment:
                    'right',

                  bold:
                    true
                }
              ]
            },

            content,

            defaultStyle: {
              font:
                'Roboto',

              fontSize:
                7,

              alignment:
                'center'
            }
          })
          .download(
            `gelir-gider-AYRI-LISTE-${getTodayKey()}.pdf`
          )
      } catch (exportError) {
        console.error(
          'Gelir-gider PDF hatası:',
          exportError
        )

        alert(
          exportError instanceof Error
            ? exportError.message
            : 'PDF dosyası oluşturulamadı.'
        )
      } finally {
        setExporting('')
      }
    }

  return (
    <>
      <ReportExportButtons
        exporting={
          exporting
        }
        loading={
          loading
        }
        onExcel={
          exportExcel
        }
        onPdf={
          exportPdf
        }
      />

      <div
        style={{
          display:
            'grid',

          gridTemplateColumns:
            'repeat(3, minmax(0, 1fr))',

          gap:
            '14px',

          marginBottom:
            '18px'
        }}
      >
        {[
          {
            label:
              'Toplam Gelir',

            value:
              summary.totalIncome
          },
          {
            label:
              'Toplam Gider',

            value:
              summary.totalExpense
          },
          {
            label:
              'Net Bakiye',

            value:
              summary.netBalance
          }
        ].map(
          (item) => (
            <div
              key={
                item.label
              }
              style={{
                padding:
                  '16px 18px',

                border:
                  '1px solid #dce6ec',

                borderRadius:
                  '12px',

                background:
                  '#f8fafc',

                textAlign:
                  'center'
              }}
            >
              <div
                style={{
                  marginBottom:
                    '7px',

                  color:
                    '#64748b',

                  fontSize:
                    '12px',

                  fontWeight:
                    800
                }}
              >
                {item.label}
              </div>

              <strong
                style={{
                  color:
                    '#17313d',

                  fontSize:
                    '18px'
                }}
              >
                {getSummaryValue(
                  item.value
                )}
              </strong>
            </div>
          )
        )}
      </div>

      <div className="report-toolbar">
        <div className="report-filter-grid">
          <div className="form-group">
            <label>
              Hareket Ara
            </label>

            <input
              value={
                searchText
              }
              onChange={(event) => {
                setSearchText(
                  event.target.value
                )

                setPage(1)
              }}
              placeholder="Başlık, kişi, kategori, belge veya not"
            />
          </div>

          <div className="form-group">
            <label>
              Hareket Türü
            </label>

            <select
              value={
                direction
              }
              onChange={(event) => {
                setDirection(
                  event.target.value
                )

                setPage(1)
              }}
            >
              <option value="all">
                Tüm hareketler
              </option>

              <option value="income">
                Gelir
              </option>

              <option value="expense">
                Gider
              </option>
            </select>
          </div>

          <div className="form-group">
            <label>
              Kaynak
            </label>

            <select
              value={
                sourceType
              }
              onChange={(event) => {
                setSourceType(
                  event.target.value
                )

                setPage(1)
              }}
            >
              <option value="">
                Tüm kaynaklar
              </option>

              <option value="student-payment">
                Öğrenci Tahsilatı
              </option>

              <option value="other-income">
                Ek Gelir
              </option>

              <option value="institution-expense">
                Kurum Gideri
              </option>

              <option value="teacher-payment">
                Öğretmen Ödemesi
              </option>

              <option value="staff-payment">
                Personel Ödemesi
              </option>
            </select>
          </div>

          <div className="form-group">
            <label>
              Ödeme Yöntemi
            </label>

            <select
              value={
                paymentMethod
              }
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

              <option value="Nakit">
                Nakit
              </option>

              <option value="Havale">
                Havale / EFT
              </option>

              <option value="Kredi Kartı">
                Kredi Kartı
              </option>

              <option value="Banka Kartı">
                Banka Kartı
              </option>
            </select>
          </div>

          <div
            style={{
              gridColumn:
                '1 / 3',

              display:
                'grid',

              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',

              gap:
                '14px'
            }}
          >
            <div className="form-group">
              <label>
                Başlangıç Tarihi
              </label>

              <input
                type="date"
                value={
                  startDate
                }
                onChange={(event) => {
                  setStartDate(
                    event.target.value
                  )

                  setPage(1)
                }}
              />
            </div>

            <div className="form-group">
              <label>
                Bitiş Tarihi
              </label>

              <input
                type="date"
                value={
                  endDate
                }
                min={
                  startDate ||
                  undefined
                }
                onChange={(event) => {
                  setEndDate(
                    event.target.value
                  )

                  setPage(1)
                }}
              />
            </div>
          </div>
        </div>

        <div className="report-toolbar-footer">
          <button
            type="button"
            className="cancel-button"
            onClick={
              clearFilters
            }
          >
            Filtreleri Temizle
          </button>

          <div className="report-toolbar-actions">
            <select
              value={
                sortOption
              }
              onChange={(event) => {
                setSortOption(
                  event.target.value
                )

                setPage(1)
              }}
            >
              <option value="newest">
                En yeni hareket
              </option>

              <option value="oldest">
                En eski hareket
              </option>

              <option value="amountDesc">
                Tutar yüksek-düşük
              </option>

              <option value="amountAsc">
                Tutar düşük-yüksek
              </option>

              <option value="titleAsc">
                Başlık A-Z
              </option>

              <option value="titleDesc">
                Başlık Z-A
              </option>
            </select>

            <select
              value={
                pageSize
              }
              onChange={(event) => {
                setPageSize(
                  Number(
                    event.target.value
                  )
                )

                setPage(1)
              }}
            >
              <option value="10">
                10 kayıt
              </option>

              <option value="25">
                25 kayıt
              </option>

              <option value="50">
                50 kayıt
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className="report-table-wrapper">
        <table
          className="report-table"
          style={{
            width:
              '100%',

            tableLayout:
              'fixed'
          }}
        >
          <colgroup>
            <col style={{ width: '7%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
          </colgroup>

          <thead>
            <tr>
              {[
                'Tür',
                'Tarih',
                'Kaynak',
                'Başlık',
                'Kategori',
                'İlgili Kişi / Kurum',
                'Tutar',
                'Ödeme Yöntemi',
                'Belge No'
              ].map(
                (header) => (
                  <th
                    key={
                      header
                    }
                    style={{
                      textAlign:
                        'center'
                    }}
                  >
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="9"
                  className="empty-table"
                >
                  Gelir-gider raporu yükleniyor...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan="9"
                  className="empty-table"
                >
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan="9"
                  className="empty-table"
                >
                  Filtrelere uygun gelir-gider hareketi bulunamadı.
                </td>
              </tr>
            ) : (
              rows.map(
                (row) => (
                  <tr
                    key={
                      row.recordId
                    }
                  >
                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      <strong>
                        {row.directionLabel}
                      </strong>
                    </td>

                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      {row.transactionDate
                        ? formatDate(
                            row.transactionDate
                          )
                        : '-'}
                    </td>

                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      {row.sourceLabel ||
                        '-'}
                    </td>

                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      <strong>
                        {row.title ||
                          '-'}
                      </strong>
                    </td>

                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      {row.category ||
                        '-'}
                    </td>

                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      {row.relatedParty ||
                        '-'}
                    </td>

                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      <strong
                        className={
                          row.direction ===
                          'income'
                            ? 'report-paid-amount'
                            : 'report-remaining-amount'
                        }
                      >
                        {formatCurrency(
                          row.amount
                        )}
                      </strong>
                    </td>

                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      {row.paymentMethod ||
                        '-'}
                    </td>

                    <td
                      style={{
                        textAlign:
                          'center'
                      }}
                    >
                      {row.documentNumber ||
                        '-'}
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>

      <ReportPagination
        total={
          total
        }
        page={
          page
        }
        pageSize={
          pageSize
        }
        loading={
          loading
        }
        onPageChange={
          setPage
        }
      />
    </>
  )
}

function Reports() {
  const [
    activeReport,
    setActiveReport
  ] = useState(() => {
    const savedReport =
      localStorage.getItem(
        'arti-akademi-active-report'
      )

    return reportTabs.some(
      (item) =>
        item.id === savedReport
    )
      ? savedReport
      : 'student-tracking'
  })

  useEffect(() => {
    localStorage.setItem(
      'arti-akademi-active-report',
      activeReport
    )
  }, [activeReport])

  const selectedReport =
    reportTabs.find(
      (item) =>
        item.id === activeReport
    ) || reportTabs[0]

  let reportContent

  if (
    activeReport ===
    'student-tracking'
  ) {
    reportContent = (
      <StudentTrackingReport />
    )
  } else if (
    activeReport ===
    'student-payments'
  ) {
    reportContent = (
      <StudentPaymentReport />
    )
  } else if (
    activeReport ===
    'teacher-tracking'
  ) {
    reportContent = (
      <TeacherTrackingReport />
    )
  } else if (
    activeReport ===
    'teacher-earnings'
  ) {
    reportContent = (
      <TeacherEarningsReport />
    )
  } else if (
    activeReport ===
    'teacher-payments'
  ) {
    reportContent = (
      <TeacherPaymentsReport />
    )
  } else if (
    activeReport ===
    'staff-payments'
  ) {
    reportContent = (
      <StaffPaymentsReport />
    )
  } else if (
    activeReport ===
    'income-expense'
  ) {
    reportContent = (
      <IncomeExpenseReport />
    )
  } else {
    reportContent = (
      <div className="reports-placeholder">
        <div className="reports-placeholder-icon">
          R
        </div>

        <strong>
          {selectedReport.title}
        </strong>

        <p>
          Bu rapor sonraki adımda gerçek verilerle eklenecek.
        </p>
      </div>
    )
  }

  return (
    <div className="reports-page">
      <section className="page-card reports-page-heading">
        <div>
          <span className="page-badge">
            Raporlama Merkezi
          </span>

          <h1>
            Raporlar
          </h1>

          <p>
            Öğrenci, öğretmen ve finans bilgilerini
            ayrı raporlar üzerinden görüntüleyin.
          </p>
        </div>
      </section>

      <section className="reports-navigation-card">
        {reportGroups.map(
          (group) => (
            <div
              className="reports-navigation-group"
              key={group.id}
            >
              <span className="reports-navigation-label">
                {group.label}
              </span>

              <div className="reports-navigation-buttons">
                {group.items.map(
                  (tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={
                        activeReport ===
                        tab.id
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        setActiveReport(
                          tab.id
                        )
                      }
                    >
                      {tab.label}
                    </button>
                  )
                )}
              </div>
            </div>
          )
        )}
      </section>

      <section className="reports-content-card">
        <div className="reports-content-heading">
          <div>
            <span>
              Seçili Rapor
            </span>

            <h2>
              {selectedReport.title}
            </h2>

            <p>
              {selectedReport.description}
            </p>
          </div>
        </div>

        {reportContent}
      </section>
    </div>
  )
}

export default Reports