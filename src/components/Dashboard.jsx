import { useEffect, useState } from 'react'
import '../styles/dashboard.css'

import {
  getDashboardSummary,
  getDashboardReceivables
} from '../services/dashboardService'

import {
  getStudentPackageLessonUsage
} from '../services/studentService'

import {
  addYearsToDate,
  formatDate,
  formatPrice,
  getDateKey,
  getTodayKey
} from '../utils/dateHelpers'

import {
  getLessonStatusClass,
  isActiveLesson,
  normalizeLessonStatus
} from '../utils/lessonHelpers'

import {
  normalizeStatusText as normalizeText
} from '../utils/textHelpers'

const UPCOMING_DAYS = 7
const GRACE_DAYS = 3

function Dashboard({
  students = [],
  teachers = [],
  lessonPlans = [],
  onNavigate = () => {}
}) {
  const [dashboardSummary, setDashboardSummary] =
    useState({
      activeStudentCount: 0,
      activeTeacherCount: 0,
      monthlyStudentIncome: 0,
      monthlyOtherIncome: 0,
      monthlyIncome: 0,
      totalIncome: 0,
      totalInstitutionExpense: 0,
      totalTeacherPaid: 0,
      totalExpense: 0,
      netCash: 0,
      totalOutstanding: 0,
      overdueCount: 0,
      upcomingCount: 0,
      teacherRemaining: 0,
      todayLessonCount: 0,
      completedLessonCount: 0
    })

  const [
    receivableRecords,
    setReceivableRecords
  ] = useState([])

  const [
    packageLessonUsage,
    setPackageLessonUsage
  ] = useState([])

  const [
    dashboardLoading,
    setDashboardLoading
  ] = useState(true)

  const [
    dashboardError,
    setDashboardError
  ] = useState('')

  const now = new Date()
  const todayKey = getTodayKey()

  const currentDayName =
    now.toLocaleDateString('tr-TR', {
      weekday: 'long'
    })

  const formattedToday =
    now.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })

  useEffect(() => {
    let isMounted = true

    const loadDashboardData =
      async () => {
        setDashboardLoading(true)
        setDashboardError('')

        try {
          const [
            summaryResult,
            receivableResult,
            packageLessonUsageResult
          ] = await Promise.all([
            getDashboardSummary({
              todayKey,
              currentDayName,
              upcomingDays:
                UPCOMING_DAYS,
              graceDays:
                GRACE_DAYS
            }),
            getDashboardReceivables({
              todayKey,
              upcomingDays:
                UPCOMING_DAYS,
              graceDays:
                GRACE_DAYS,
              limit: 30
            }),
            getStudentPackageLessonUsage()
          ])

          if (!isMounted) {
            return
          }

          setDashboardSummary(
            summaryResult
          )

          setReceivableRecords(
            receivableResult
          )

          setPackageLessonUsage(
            packageLessonUsageResult
          )
        } catch (error) {
          console.error(
            'Dashboard özetleri alınamadı:',
            error
          )

          if (isMounted) {
            const isOffline =
              typeof navigator !==
                'undefined' &&
              !navigator.onLine

            setDashboardError(
              isOffline
                ? 'İnternet bağlantısı bulunamadı. Dashboard verileri yüklenemedi.'
                : 'Dashboard verileri şu anda yüklenemedi.'
            )
          }
        } finally {
          if (isMounted) {
            setDashboardLoading(false)
          }
        }
      }

    loadDashboardData()

    return () => {
      isMounted = false
    }
  }, [
    todayKey,
    currentDayName
  ])

  const getTeacherName = (teacher) =>
    teacher?.fullName ??
    teacher?.name ??
    ''

  const getStudentName = (student) =>
    student?.fullName ??
    student?.name ??
    ''

  const packageFinancialRecords =
    receivableRecords

  const activeStudentCount =
    dashboardSummary.activeStudentCount

  const activeTeacherCount =
    dashboardSummary.activeTeacherCount

  const monthlyIncome =
    dashboardSummary.monthlyIncome

  const totalOutstanding =
    dashboardSummary.totalOutstanding

  const todayLessons = lessonPlans
    .filter(
      (lesson) =>
        normalizeText(lesson.day) ===
        normalizeText(currentDayName)
    )
    .sort(
      (
        firstLesson,
        secondLesson
      ) =>
        String(
          firstLesson.time || ''
        ).localeCompare(
          String(
            secondLesson.time || ''
          )
        )
    )

  const upcomingReceivables =
    packageFinancialRecords
      .filter(
        (record) =>
          record.receivableStatus ===
          'Yaklaşıyor'
      )
      .slice(0, 4)

  const criticalOverdueRecords =
    packageFinancialRecords.filter(
      (record) =>
        record.receivableStatus ===
        'Gecikmiş'
    )

  const missingPaymentDates =
    packageFinancialRecords.filter(
      (record) =>
        record.receivableStatus ===
        'Tarih Eksik'
    )

  const waitingMakeupLessons =
    lessonPlans.filter(
      (lesson) =>
        normalizeLessonStatus(
          lesson.status
        ) ===
        'Telafi yapılacak'
    )

  const conflictKeys = new Set()

  const activeLessonsForConflict =
    lessonPlans.filter(
      isActiveLesson
    )

  activeLessonsForConflict.forEach(
    (
      lesson,
      lessonIndex
    ) => {
      activeLessonsForConflict
        .slice(lessonIndex + 1)
        .forEach(
          (otherLesson) => {
            const sameSlot =
              normalizeText(
                lesson.day
              ) ===
                normalizeText(
                  otherLesson.day
                ) &&
              String(
                lesson.time || ''
              ) ===
                String(
                  otherLesson.time || ''
                )

            if (!sameSlot) {
              return
            }

            const sameTeacher =
              lesson.teacherId &&
              otherLesson.teacherId &&
              String(
                lesson.teacherId
              ) ===
                String(
                  otherLesson.teacherId
                )

            const sameStudent =
              lesson.studentId &&
              otherLesson.studentId &&
              String(
                lesson.studentId
              ) ===
                String(
                  otherLesson.studentId
                )

            if (sameTeacher) {
              conflictKeys.add(
                `teacher-${lesson.teacherId}-${lesson.day}-${lesson.time}`
              )
            }

            if (sameStudent) {
              conflictKeys.add(
                `student-${lesson.studentId}-${lesson.day}-${lesson.time}`
              )
            }
          }
        )
    }
  )

  const missingTeacherAssignments =
    packageFinancialRecords.filter(
      (record) =>
        !record.teacherId &&
        !record.teacherName
    )

  const invalidPriceAssignments =
    packageFinancialRecords.filter(
      (record) =>
        Number(
          record.monthlyFee || 0
        ) <= 0
    )

  const missingContactStudents =
    students.filter(
      (student) => {
        const isActive =
          student.isActive !== false &&
          normalizeText(
            student.status
          ) !== 'pasif'

        const isArchived =
          student.isArchived === true ||
          normalizeText(
            student.status
          ) === 'arşiv'

        const isAnonymized =
          student.isAnonymized === true ||
          normalizeText(
            student.retentionStatus
          ) === 'anonimleştirildi'

        const hasPhone =
          String(
            student.phone || ''
          ).trim() !== ''

        return (
          isActive &&
          !isArchived &&
          !isAnonymized &&
          !hasPhone
        )
      }
    )

  const totalTeacherRemaining =
    dashboardSummary.teacherRemaining

  const totalCompletedEarningLessonCount =
    dashboardSummary.completedLessonCount ||
    0

  const retentionReviewStudents =
    students.filter(
      (student) => {
        const isArchived =
          student.isArchived ===
            true ||
          normalizeText(
            student.status
          ) ===
            'arşiv'

        const isAnonymized =
          student.isAnonymized ===
            true ||
          normalizeText(
            student.retentionStatus
          ) ===
            'anonimleştirildi'

        if (
          !isArchived ||
          isAnonymized
        ) {
          return false
        }

        let reviewDate =
          getDateKey(
            student.retentionReviewDate
          )

        if (
          !reviewDate &&
          student.archivedAt
        ) {
          reviewDate =
            addYearsToDate(
              student.archivedAt,
              2
            )
        }

        return (
          reviewDate &&
          reviewDate <= todayKey
        )
      }
    )

  const packagesWithOneLessonLeft =
    packageLessonUsage.filter(
      (item) =>
        item.remainingLessonCount === 1
    )

  const packagesWithNoLessonLeft =
    packageLessonUsage.filter(
      (item) =>
        item.remainingLessonCount === 0
    )

  const alerts = []

  packagesWithNoLessonLeft.forEach(
    (item) => {
      alerts.push({
        id:
          `package-finished-${item.studentPackageId}`,
        type: 'danger',
        title:
          `${item.studentName} · Ders hakkı bitti`,
        description:
          `${item.packageName} paketinde ${item.usedLessonCount}/${item.totalLessonCount} ders tamamlandı. Paketi uzatın, güncelleyin veya sonlandırın.`,
        page: 'students',
        studentId:
          item.studentId,
        studentPackageId:
          item.studentPackageId
      })
    }
  )

  packagesWithOneLessonLeft.forEach(
    (item) => {
      alerts.push({
        id:
          `package-nearly-finished-${item.studentPackageId}`,
        type: 'warning',
        title:
          `${item.studentName} · 1 ders kaldı`,
        description:
          `${item.packageName} paketinde ${item.usedLessonCount}/${item.totalLessonCount} ders tamamlandı.`,
        page: 'students',
        studentId:
          item.studentId,
        studentPackageId:
          item.studentPackageId
      })
    }
  )

  if (
    criticalOverdueRecords.length >
    0
  ) {
    const overdueTotal =
      criticalOverdueRecords.reduce(
        (
          total,
          record
        ) =>
          total +
          Number(
            record.remainingDebt ||
              0
          ),
        0
      )

    alerts.push({
      id: 'overdue-payments',
      type: 'danger',
      title: `${criticalOverdueRecords.length} kritik gecikmiş tahsilat`,
      description: `3 günlük toleransı geçen toplam ₺${formatPrice(
        overdueTotal
      )} tutarında alacak bulunuyor.`,
      page: 'payments'
    })
  }

  if (
    missingPaymentDates.length >
    0
  ) {
    alerts.push({
      id: 'missing-payment-date',
      type: 'warning',
      title: `${missingPaymentDates.length} pakette ödeme tarihi eksik`,
      description:
        'Yaklaşan ve geciken tahsilatların hesaplanabilmesi için tarih eklenmeli.',
      page: 'students'
    })
  }

  if (
    retentionReviewStudents.length >
    0
  ) {
    alerts.push({
      id: 'student-retention-review',
      type: 'warning',
      title: `${retentionReviewStudents.length} arşiv kaydı inceleme bekliyor`,
      description:
        'Saklama süresi dolan kayıtları inceleyip saklamayı uzatın veya anonimleştirin.',
      page: 'students'
    })
  }

  if (
    waitingMakeupLessons.length >
    0
  ) {
    alerts.push({
      id: 'makeup-lessons',
      type: 'warning',
      title: `${waitingMakeupLessons.length} bekleyen telafi dersi`,
      description:
        'Planlanmış ancak henüz tamamlanmamış telafi dersleri var.',
      page: 'lesson-status'
    })
  }

  if (conflictKeys.size > 0) {
    alerts.push({
      id: 'lesson-conflicts',
      type: 'danger',
      title: `${conflictKeys.size} ders çakışması`,
      description:
        'Aynı öğrenci veya öğretmen aynı gün ve saate atanmış.',
      page: 'schedule'
    })
  }

  if (
    missingTeacherAssignments.length >
    0
  ) {
    alerts.push({
      id: 'missing-teacher',
      type: 'warning',
      title: `${missingTeacherAssignments.length} pakette öğretmen eksik`,
      description:
        'Öğrenci paketlerine öğretmen ataması yapılması gerekiyor.',
      page: 'students'
    })
  }

  if (
    invalidPriceAssignments.length >
    0
  ) {
    alerts.push({
      id: 'invalid-price',
      type: 'warning',
      title: `${invalidPriceAssignments.length} pakette ücret eksik`,
      description:
        'Ücreti sıfır veya boş olan öğrenci paketleri bulunuyor.',
      page: 'students'
    })
  }

  if (
    totalTeacherRemaining >
    0
  ) {
    alerts.push({
      id: 'teacher-payment',
      type: 'info',
      title:
        'Bekleyen öğretmen hakedişi',
      description: `${totalCompletedEarningLessonCount} tamamlanan dersten oluşan, ödenmesi beklenen toplam tutar ₺${formatPrice(
        totalTeacherRemaining
      )}.`,
      page: 'finance'
    })
  }

  if (
    missingContactStudents.length >
    0
  ) {
    alerts.push({
      id: 'missing-contact',
      type: 'info',
      title: `${missingContactStudents.length} öğrencide iletişim bilgisi eksik`,
      description:
        'Öğrencinin telefon bilgisi tamamlanmalı.',
      page: 'students'
    })
  }

  const visibleAlerts =
    alerts.slice(0, 5)

  const findTeacherNameForLesson =
    (lesson) => {
      if (lesson.teacherName) {
        return lesson.teacherName
      }

      if (
        typeof lesson.teacher ===
        'string'
      ) {
        return lesson.teacher
      }

      const teacher =
        teachers.find(
          (item) =>
            String(item.id) ===
            String(
              lesson.teacherId
            )
        )

      return (
        getTeacherName(
          teacher
        ) || '-'
      )
    }

  const findStudentNameForLesson =
    (lesson) => {
      if (lesson.studentName) {
        return lesson.studentName
      }

      const student =
        students.find(
          (item) =>
            String(item.id) ===
            String(
              lesson.studentId
            )
        )

      return (
        getStudentName(
          student
        ) || '-'
      )
    }

  const getReceivableStatusText =
    (record) => {
      if (
        record.daysUntilDue ===
        null
      ) {
        return 'Tarih tanımlı değil'
      }

      if (
        record.daysUntilDue >
        0
      ) {
        return `${record.daysUntilDue} gün kaldı · ${formatDate(
          record.dueDate
        )}`
      }

      if (
        record.daysUntilDue ===
        0
      ) {
        return `Bugün ödenecek · ${formatDate(
          record.dueDate
        )}`
      }

      return `Tolerans süresinde · ${record.daysLate} gün gecikti`
    }

  const getReceivableStatusClass =
    (record) => {
      if (
        record.daysUntilDue ===
        0
      ) {
        return 'due-today'
      }

      if (
        record.daysLate > 0
      ) {
        return 'grace'
      }

      return 'upcoming'
    }

  const renderMetricValue = (
    value,
    {
      currency = false
    } = {}
  ) => {
    if (dashboardLoading) {
      return currency
        ? '₺—'
        : '—'
    }

    if (currency) {
      return `₺${formatPrice(
        value
      )}`
    }

    return value
  }

  return (
    <div className="dashboard-home">
      <section className="dashboard-home-header">
        <div>
          <span className="dashboard-home-badge">
            Kontrol Paneli
          </span>

          <h1>Yönetici Paneli</h1>

          <p>
            Öğrenci, öğretmen, ders programı ve
            finans süreçlerinin güncel özeti.
          </p>
        </div>

        <div className="dashboard-home-date">
          <strong>
            {currentDayName}
          </strong>

          <span>
            {formattedToday}
          </span>
        </div>
      </section>

      {dashboardError && (
        <div
          className="dashboard-home-error"
          role="alert"
        >
          {dashboardError}
        </div>
      )}

      <section className="dashboard-home-metrics">
        <button
          type="button"
          className="dashboard-home-metric green"
          onClick={() =>
            onNavigate(
              'students'
            )
          }
        >
          <div>
            <span>
              Aktif Öğrenci
            </span>

            <strong>
              {renderMetricValue(
                activeStudentCount
              )}
            </strong>

            <small>
              Öğrenciler sayfasından
            </small>
          </div>

          <div className="dashboard-home-metric-icon">
            ✓
          </div>
        </button>

        <button
          type="button"
          className="dashboard-home-metric blue"
          onClick={() =>
            onNavigate(
              'teachers'
            )
          }
        >
          <div>
            <span>
              Aktif Öğretmen
            </span>

            <strong>
              {renderMetricValue(
                activeTeacherCount
              )}
            </strong>

            <small>
              Öğretmenler sayfasından
            </small>
          </div>

          <div className="dashboard-home-metric-icon">
            ♪
          </div>
        </button>

        <button
          type="button"
          className="dashboard-home-metric cyan"
          onClick={() =>
            onNavigate(
              'finance'
            )
          }
        >
          <div>
            <span>
              Bu Ay Gelir
            </span>

            <strong>
              {renderMetricValue(
                monthlyIncome,
                {
                  currency: true
                }
              )}
            </strong>

            <small>
              Tahsilatlar ve ek gelirler
            </small>
          </div>

          <div className="dashboard-home-metric-icon">
            ₺
          </div>
        </button>

        <button
          type="button"
          className="dashboard-home-metric red"
          onClick={() =>
            onNavigate(
              'payments'
            )
          }
        >
          <div>
            <span>
              Bekleyen Tahsilat
            </span>

            <strong>
              {renderMetricValue(
                totalOutstanding,
                {
                  currency: true
                }
              )}
            </strong>

            <small>
              Açık aylık ödeme dönemleri
            </small>
          </div>

          <div className="dashboard-home-metric-icon">
            !
          </div>
        </button>
      </section>

      <section className="dashboard-home-card dashboard-home-lessons">
        <div className="dashboard-home-section-heading">
          <div>
            <h2>
              Bugünkü Ders Programı
            </h2>

            <p>
              Gün içinde planlanan derslerin kısa özeti
            </p>
          </div>

          <button
            type="button"
            className="dashboard-home-count-button"
            onClick={() =>
              onNavigate(
                'schedule'
              )
            }
          >
            {dashboardLoading
              ? '—'
              : `${todayLessons.length} ders`}
          </button>
        </div>

        <div className="dashboard-home-table-wrapper">
          <table className="dashboard-home-table">
            <thead>
              <tr>
                <th>Saat</th>
                <th>Ders</th>
                <th>Öğretmen</th>
                <th>Öğrenci</th>
                <th>
                  Sınıf / Lokasyon
                </th>
                <th>Süre</th>
                <th>Durum</th>
              </tr>
            </thead>

            <tbody>
              {dashboardLoading ? (
                <tr>
                  <td
                    colSpan="7"
                    className="dashboard-home-empty-table"
                  >
                    Dashboard verileri yükleniyor...
                  </td>
                </tr>
              ) : todayLessons.length >
                0 ? (
                todayLessons.map(
                  (lesson) => (
                    <tr
                      key={
                        lesson.id
                      }
                    >
                      <td className="dashboard-home-time-cell">
                        {lesson.time ||
                          '-'}
                      </td>

                      <td>
                        <strong className="dashboard-home-table-title">
                          {lesson.packageName ||
                            lesson.instrument ||
                            lesson.lessonName ||
                            'Ders'}
                        </strong>
                      </td>

                      <td>
                        {findTeacherNameForLesson(
                          lesson
                        )}
                      </td>

                      <td>
                        {findStudentNameForLesson(
                          lesson
                        )}
                      </td>

                      <td>
                        {lesson.location ||
                          lesson.classroom ||
                          '-'}
                      </td>

                      <td>
                        {lesson.duration ||
                          '-'}
                      </td>

                      <td>
                        <span
                          className={getLessonStatusClass(
                            lesson.status,
                            'dashboard-home-status'
                          )}
                        >
                          {normalizeLessonStatus(
                            lesson.status
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                )
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="dashboard-home-empty-table"
                  >
                    Bugün için kayıtlı ders bulunmamaktadır.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-home-bottom-grid">
        <div className="dashboard-home-card dashboard-home-small-panel">
          <div className="dashboard-home-section-heading compact">
            <div>
              <h2>
                Yaklaşan Tahsilatlar
              </h2>

              <p>
                7 gün içindeki ve tolerans süresindeki ödemeler
              </p>
            </div>

            <button
              type="button"
              className="dashboard-home-panel-count"
              onClick={() =>
                onNavigate(
                  'payments'
                )
              }
            >
              {dashboardLoading
                ? '—'
                : upcomingReceivables.length}
            </button>
          </div>

          <div className="dashboard-home-panel-content">
            {dashboardLoading ? (
              <div className="dashboard-home-empty-panel">
                Tahsilat verileri yükleniyor...
              </div>
            ) : upcomingReceivables.length >
              0 ? (
              upcomingReceivables.map(
                (record) => (
                  <button
                    type="button"
                    className="dashboard-home-receivable-item"
                    key={
                      record.studentPackageId
                    }
                    onClick={() =>
                      onNavigate(
                        'payments'
                      )
                    }
                  >
                    <div>
                      <strong>
                        {record.studentName}
                      </strong>

                      <span>
                        {record.packageName}
                      </span>

                      <small
                        className={getReceivableStatusClass(
                          record
                        )}
                      >
                        {getReceivableStatusText(
                          record
                        )}
                      </small>
                    </div>

                    <b>
                      ₺
                      {formatPrice(
                        record.remainingDebt
                      )}
                    </b>
                  </button>
                )
              )
            ) : (
              <div className="dashboard-home-empty-panel">
                Önümüzdeki 7 gün içinde yaklaşan tahsilat bulunmamaktadır.
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-home-card dashboard-home-small-panel">
          <div className="dashboard-home-section-heading compact">
            <div>
              <h2>
                Önemli Uyarılar
              </h2>

              <p>
                Takip edilmesi gereken kritik kayıtlar
              </p>
            </div>

            <span className="dashboard-home-panel-count static">
              {dashboardLoading
                ? '—'
                : alerts.length}
            </span>
          </div>

          <div className="dashboard-home-panel-content">
            {dashboardLoading ? (
              <div className="dashboard-home-empty-panel">
                Uyarılar kontrol ediliyor...
              </div>
            ) : visibleAlerts.length >
              0 ? (
              visibleAlerts.map(
                (alertItem) => (
                  <button
                    type="button"
                    className="dashboard-home-alert-item"
                    key={
                      alertItem.id
                    }
                    onClick={() =>
                      onNavigate(
                        alertItem.page
                      )
                    }
                  >
                    <span
                      className={`dashboard-home-alert-dot ${alertItem.type}`}
                    />

                    <div>
                      <strong>
                        {alertItem.title}
                      </strong>

                      <span>
                        {alertItem.description}
                      </span>
                    </div>

                    <b>›</b>
                  </button>
                )
              )
            ) : (
              <div className="dashboard-home-success-panel">
                <span>✓</span>

                <div>
                  <strong>
                    Kritik uyarı bulunmuyor
                  </strong>

                  <p>
                    Tüm temel kayıtlar şu anda düzenli görünüyor.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default Dashboard