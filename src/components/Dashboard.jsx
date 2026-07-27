import { useMemo } from 'react'
import '../styles/dashboard.css'

import {
  addYearsToDate,
  formatDate,
  formatPrice,
  getDateKey,
  getTodayKey
} from '../utils/dateHelpers'

import {
  findCurrentDueRecord,
  getDueStatus,
  getPaymentAmount,
  getPaymentDate,
  isActivePayment
} from '../utils/paymentSchedule'

import {
  getLessonStatusClass,
  isActiveLesson,
  isCompletedLesson,
  normalizeLessonStatus
} from '../utils/lessonHelpers'

import { normalizeStatusText as normalizeText } from '../utils/textHelpers'

const UPCOMING_DAYS = 7
const GRACE_DAYS = 3

function Dashboard({
  students = [],
  teachers = [],
  packages = [],
  lessonPlans = [],
  payments = [],
  otherIncomes = [],
  teacherPayments = [],
  onNavigate = () => {}
}) {
  const now = new Date()
  const todayKey = getTodayKey()

  const currentMonthKey = todayKey.slice(0, 7)
  const currentDayName = now.toLocaleDateString('tr-TR', {
    weekday: 'long'
  })
  const formattedToday = now.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })

  const getTeacherName = (teacher) =>
    teacher?.fullName ?? teacher?.name ?? ''

  const getTeacherCommissionRate = (teacher) =>
    Number(
      teacher?.commissionRate ??
        teacher?.commissionPercentage ??
        teacher?.commission ??
        teacher?.hakEdisYuzdesi ??
        teacher?.hakedisYuzdesi ??
        0
    )

  const findTeacherByIdOrName = (teacherId, teacherName) => {
    const normalizedTeacherName = normalizeText(teacherName)

    return teachers.find((teacher) => {
      const idMatches =
        teacherId !== '' &&
        teacherId !== null &&
        teacherId !== undefined &&
        String(teacher.id) === String(teacherId)

      const nameMatches =
        normalizedTeacherName !== '' &&
        normalizeText(getTeacherName(teacher)) ===
          normalizedTeacherName

      return idMatches || nameMatches
    })
  }

  const getStudentName = (student) =>
    student?.fullName ?? student?.name ?? ''

  const getPackageFromCatalog = (packageId, packageName) => {
    const normalizedPackageName = normalizeText(packageName)

    return packages.find((packageItem) => {
      const idMatches =
        packageId !== '' &&
        packageId !== null &&
        packageId !== undefined &&
        String(packageItem.id) === String(packageId)

      const nameMatches =
        normalizedPackageName !== '' &&
        normalizeText(packageItem.name) === normalizedPackageName

      return idMatches || nameMatches
    })
  }

  const packageFinancialRecords = useMemo(() => {
    return students.flatMap((student) => {
      let studentPackages = []

      const possiblePackageLists = [
        student.enrolledPackages,
        student.studentPackages,
        student.assignedPackages,
        student.selectedPackages
      ]

      const packageList = possiblePackageLists.find(
        (list) => Array.isArray(list) && list.length > 0
      )

      if (packageList) {
        studentPackages = packageList
      } else if (
        Array.isArray(student.packageIds) &&
        student.packageIds.length > 0
      ) {
        studentPackages = student.packageIds.map((packageId) => {
          const catalogPackage = packages.find(
            (item) => String(item.id) === String(packageId)
          )

          return (
            catalogPackage || {
              packageId,
              packageName: 'Tanımsız Paket'
            }
          )
        })
      } else if (student.packageId || student.packageName) {
        studentPackages = [student]
      }

      return studentPackages.map((packageItem, index) => {
        const packageId =
          packageItem?.packageId ??
          packageItem?.id ??
          student.packageId ??
          `package-${index}`

        const catalogPackage = getPackageFromCatalog(
          packageId,
          packageItem?.packageName ??
            packageItem?.name ??
            student.packageName
        )

        const studentPackageId = String(
          packageItem?.studentPackageId ??
            packageItem?.enrollmentId ??
            packageItem?.assignmentId ??
            `${student.id}-${packageId}-${index}`
        )

        const teacherValue =
          packageItem?.teacher ??
          packageItem?.teacherName ??
          student.teacher ??
          student.teacherName ??
          ''

        const teacherName =
          packageItem?.teacherName ??
          (typeof teacherValue === 'string'
            ? teacherValue
            : teacherValue?.fullName ?? teacherValue?.name) ??
          ''

        const teacherId =
          packageItem?.teacherId ??
          packageItem?.teacher?.id ??
          student.teacherId ??
          student.teacher?.id ??
          ''

        const monthlyFee = Number(
          packageItem?.monthlyFee ??
            packageItem?.agreedPrice ??
            packageItem?.totalPrice ??
            packageItem?.packagePrice ??
            student.monthlyFee ??
            student.agreedPrice ??
            student.totalPrice ??
            student.packagePrice ??
            catalogPackage?.totalPrice ??
            0
        )

        const lessonCount =
          Number(
            packageItem?.lessonCount ??
              student.lessonCount ??
              catalogPackage?.lessonCount ??
              1
          ) || 1

        const unitPrice =
          lessonCount > 0
            ? monthlyFee / lessonCount
            : Number(
                catalogPackage?.unitPrice ??
                  monthlyFee
              )

        const firstPaymentDate = getDateKey(
          packageItem?.firstPaymentDate ??
            packageItem?.nextPaymentDate ??
            packageItem?.dueDate ??
            student.firstPaymentDate ??
            student.nextPaymentDate ??
            ''
        )

        const paymentDay = Number(
          packageItem?.paymentDay ??
            student.paymentDay ??
            (firstPaymentDate
              ? firstPaymentDate.slice(8, 10)
              : 1)
        )

        const dueRecord = findCurrentDueRecord(
          {
            studentPackageId,
            agreedPrice: monthlyFee,
            monthlyFee,
            firstPaymentDate,
            nextPaymentDate:
              packageItem?.nextPaymentDate ??
              student.nextPaymentDate ??
              firstPaymentDate,
            paymentDay
          },
          payments
        )

        const {
          dueDate,
          period,
          collectedAmount,
          remainingAmount: remainingDebt
        } = dueRecord

        const dueStatus = getDueStatus({
          dueDate,
          expectedAmount: monthlyFee,
          collectedAmount,
          todayKey
        })

        const daysUntilDue = dueStatus.daysUntilDue
        const daysLate = dueStatus.daysLate

        return {
          studentPackageId,
          studentId: String(student.id),
          studentName:
            getStudentName(student) || 'Öğrenci',
          packageId: String(packageId),
          packageName:
            packageItem?.packageName ??
            packageItem?.name ??
            student.packageName ??
            catalogPackage?.name ??
            'Tanımsız Paket',
          instrument:
            packageItem?.instrument ??
            student.instrument ??
            catalogPackage?.instrument ??
            '',
          teacherId: String(teacherId || ''),
          teacherName,
          agreedPrice: monthlyFee,
          monthlyFee,
          lessonCount,
          unitPrice,
          firstPaymentDate,
          paymentDay,
          dueDate,
          period,
          collectedAmount,
          remainingDebt,
          daysUntilDue,
          daysLate
        }
      })
    })
  }, [students, packages, payments, teachers, todayKey])

  const activeStudentCount = students.filter(
    (student) =>
      student.isActive !== false &&
      normalizeText(student.status) !== 'pasif' &&
      normalizeText(student.status) !== 'arşiv' &&
      student.isArchived !== true
  ).length

  const activeTeacherCount = teachers.filter(
    (teacher) =>
      teacher.isActive !== false &&
      normalizeText(teacher.status) !== 'pasif'
  ).length

  const monthlyStudentIncome = payments
    .filter(
      (payment) =>
        isActivePayment(payment) &&
        getPaymentDate(payment).slice(0, 7) ===
          currentMonthKey
    )
    .reduce(
      (total, payment) =>
        total + getPaymentAmount(payment),
      0
    )

  const monthlyOtherIncome = otherIncomes
    .filter(
      (income) =>
        income.status !== 'İptal' &&
        getDateKey(income.date).slice(0, 7) ===
          currentMonthKey
    )
    .reduce(
      (total, income) =>
        total + Number(income.amount || 0),
      0
    )

  const monthlyIncome =
    monthlyStudentIncome + monthlyOtherIncome

  const totalOutstanding = packageFinancialRecords.reduce(
    (total, record) =>
      total + Number(record.remainingDebt || 0),
    0
  )

  const todayLessons = lessonPlans
    .filter(
      (lesson) =>
        normalizeText(lesson.day) ===
        normalizeText(currentDayName)
    )
    .sort((firstLesson, secondLesson) =>
      String(firstLesson.time || '').localeCompare(
        String(secondLesson.time || '')
      )
    )

  const upcomingReceivables = packageFinancialRecords
    .filter(
      (record) =>
        record.remainingDebt > 0 &&
        record.dueDate &&
        record.daysUntilDue !== null &&
        record.daysUntilDue <= UPCOMING_DAYS &&
        record.daysLate <= GRACE_DAYS
    )
    .sort((first, second) =>
      first.dueDate.localeCompare(second.dueDate)
    )
    .slice(0, 4)

  const criticalOverdueRecords =
    packageFinancialRecords.filter(
      (record) =>
        record.remainingDebt > 0 &&
        record.daysLate > GRACE_DAYS
    )

  const missingPaymentDates =
    packageFinancialRecords.filter(
      (record) => !record.dueDate
    )

  const waitingMakeupLessons = lessonPlans.filter(
    (lesson) =>
      normalizeLessonStatus(lesson.status) ===
      'Telafi yapılacak'
  )

  const conflictKeys = new Set()
  const activeLessonsForConflict =
    lessonPlans.filter(isActiveLesson)

  activeLessonsForConflict.forEach((lesson, lessonIndex) => {
    activeLessonsForConflict
      .slice(lessonIndex + 1)
      .forEach((otherLesson) => {
        const sameSlot =
          normalizeText(lesson.day) ===
            normalizeText(otherLesson.day) &&
          String(lesson.time || '') ===
            String(otherLesson.time || '')

        if (!sameSlot) return

        const sameTeacher =
          lesson.teacherId &&
          otherLesson.teacherId &&
          String(lesson.teacherId) ===
            String(otherLesson.teacherId)

        const sameStudent =
          lesson.studentId &&
          otherLesson.studentId &&
          String(lesson.studentId) ===
            String(otherLesson.studentId)

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
      })
  })

  const missingTeacherAssignments =
    packageFinancialRecords.filter(
      (record) =>
        !record.teacherId && !record.teacherName
    )

  const invalidPriceAssignments =
    packageFinancialRecords.filter(
      (record) => Number(record.monthlyFee || 0) <= 0
    )

  const missingContactStudents = students.filter((student) => {
    const hasAnyPhone = [
      student.phone,
      student.motherPhone,
      student.fatherPhone,
      student.parentPhone
    ].some(
      (phone) => String(phone || '').trim() !== ''
    )

    return !hasAnyPhone
  })

  /*
   * Dashboard öğretmen hakedişini Finans sayfasıyla aynı mantıkla
   * hesaplar. Paket öğrenciye tanımlandığında hakediş oluşmaz.
   * Yalnızca "Yapıldı" veya "Telafi yapıldı" durumundaki dersler
   * hakedişe dahil edilir.
   */
  const completedLessonEarningRecords = useMemo(() => {
    return lessonPlans
      .filter(isCompletedLesson)
      .map((lesson, index) => {
        const teacher = findTeacherByIdOrName(
          lesson.teacherId,
          lesson.teacherName ?? lesson.teacher
        )

        if (!teacher) {
          return null
        }

        const lessonStudentId = String(
          lesson.studentId ?? ''
        )
        const lessonPackageId = String(
          lesson.packageId ?? ''
        )
        const lessonStudentPackageId = String(
          lesson.studentPackageId ??
            lesson.enrollmentId ??
            lesson.assignmentId ??
            ''
        )

        const studentPackage =
          packageFinancialRecords.find(
            (record) =>
              lessonStudentPackageId !== '' &&
              String(record.studentId) ===
                lessonStudentId &&
              String(record.studentPackageId) ===
                lessonStudentPackageId
          ) ??
          packageFinancialRecords.find(
            (record) =>
              lessonPackageId !== '' &&
              String(record.studentId) ===
                lessonStudentId &&
              String(record.packageId) ===
                lessonPackageId
          ) ??
          packageFinancialRecords.find(
            (record) =>
              String(record.studentId) ===
                lessonStudentId &&
              normalizeText(record.packageName) ===
                normalizeText(lesson.packageName)
          )

        const catalogPackage =
          getPackageFromCatalog(
            lesson.packageId,
            lesson.packageName
          )

        const agreedPrice = Number(
          studentPackage?.agreedPrice ??
            catalogPackage?.totalPrice ??
            lesson.packagePrice ??
            lesson.totalPrice ??
            0
        )

        const lessonCount =
          Number(
            studentPackage?.lessonCount ??
              catalogPackage?.lessonCount ??
              lesson.lessonCount ??
              1
          ) || 1

        const unitPrice = Number(
          studentPackage?.unitPrice ??
            (lessonCount > 0
              ? agreedPrice / lessonCount
              : catalogPackage?.unitPrice ??
                agreedPrice)
        )

        const commissionRate =
          getTeacherCommissionRate(teacher)

        return {
          earningRecordId: String(
            lesson.id ??
              `completed-lesson-${index}`
          ),
          lessonId: lesson.id,
          teacherId: String(teacher.id),
          teacherName: getTeacherName(teacher),
          studentId: lessonStudentId,
          studentName:
            lesson.studentName ??
            students.find(
              (student) =>
                String(student.id) ===
                lessonStudentId
            )?.fullName ??
            'Öğrenci',
          packageName:
            studentPackage?.packageName ??
            lesson.packageName ??
            catalogPackage?.name ??
            'Tanımsız Paket',
          instrument:
            lesson.instrument ??
            studentPackage?.instrument ??
            catalogPackage?.instrument ??
            '',
          unitPrice,
          commissionRate,
          teacherEarning:
            unitPrice * (commissionRate / 100)
        }
      })
      .filter(Boolean)
  }, [
    lessonPlans,
    packageFinancialRecords,
    teachers,
    students,
    packages
  ])

  const teacherEarningSummaries = useMemo(() => {
    return teachers.map((teacher) => {
      const completedLessons =
        completedLessonEarningRecords.filter(
          (record) =>
            String(record.teacherId) ===
              String(teacher.id) ||
            normalizeText(record.teacherName) ===
              normalizeText(
                getTeacherName(teacher)
              )
        )

      const totalEarning = completedLessons.reduce(
        (total, record) =>
          total +
          Number(record.teacherEarning || 0),
        0
      )

      const totalPaid = teacherPayments
        .filter(
          (payment) =>
            normalizeText(payment.status) !== 'iptal' &&
            String(payment.teacherId) ===
              String(teacher.id)
        )
        .reduce(
          (total, payment) =>
            total + Number(payment.amount || 0),
          0
        )

      return {
        teacher,
        completedLessonCount:
          completedLessons.length,
        totalEarning,
        totalPaid,
        remainingPayment: Math.max(
          0,
          totalEarning - totalPaid
        )
      }
    })
  }, [
    teachers,
    completedLessonEarningRecords,
    teacherPayments
  ])

  const totalTeacherRemaining =
    teacherEarningSummaries.reduce(
      (total, summary) =>
        total + summary.remainingPayment,
      0
    )

  const totalCompletedEarningLessonCount =
    teacherEarningSummaries.reduce(
      (total, summary) =>
        total + summary.completedLessonCount,
      0
    )


  const retentionReviewStudents = students.filter(
    (student) => {
      const isArchived =
        student.isArchived === true ||
        normalizeText(student.status) === 'arşiv'

      const isAnonymized =
        student.isAnonymized === true ||
        normalizeText(student.retentionStatus) ===
          'anonimleştirildi'

      if (!isArchived || isAnonymized) {
        return false
      }

      let reviewDate = getDateKey(
        student.retentionReviewDate
      )

      if (!reviewDate && student.archivedAt) {
        reviewDate = addYearsToDate(
          student.archivedAt,
          2
        )
      }

      return reviewDate && reviewDate <= todayKey
    }
  )

  const alerts = []

  if (criticalOverdueRecords.length > 0) {
    const overdueTotal = criticalOverdueRecords.reduce(
      (total, record) =>
        total + record.remainingDebt,
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

  if (missingPaymentDates.length > 0) {
    alerts.push({
      id: 'missing-payment-date',
      type: 'warning',
      title: `${missingPaymentDates.length} pakette ödeme tarihi eksik`,
      description:
        'Yaklaşan ve geciken tahsilatların hesaplanabilmesi için tarih eklenmeli.',
      page: 'students'
    })
  }

  if (retentionReviewStudents.length > 0) {
    alerts.push({
      id: 'student-retention-review',
      type: 'warning',
      title: `${retentionReviewStudents.length} arşiv kaydı inceleme bekliyor`,
      description:
        'Saklama süresi dolan kayıtları inceleyip saklamayı uzatın veya anonimleştirin.',
      page: 'students'
    })
  }

  if (waitingMakeupLessons.length > 0) {
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

  if (missingTeacherAssignments.length > 0) {
    alerts.push({
      id: 'missing-teacher',
      type: 'warning',
      title: `${missingTeacherAssignments.length} pakette öğretmen eksik`,
      description:
        'Öğrenci paketlerine öğretmen ataması yapılması gerekiyor.',
      page: 'students'
    })
  }

  if (invalidPriceAssignments.length > 0) {
    alerts.push({
      id: 'invalid-price',
      type: 'warning',
      title: `${invalidPriceAssignments.length} pakette ücret eksik`,
      description:
        'Ücreti sıfır veya boş olan öğrenci paketleri bulunuyor.',
      page: 'students'
    })
  }

  if (totalTeacherRemaining > 0) {
    alerts.push({
      id: 'teacher-payment',
      type: 'info',
      title: 'Bekleyen öğretmen hakedişi',
      description: `${totalCompletedEarningLessonCount} tamamlanan dersten oluşan, ödenmesi beklenen toplam tutar ₺${formatPrice(
        totalTeacherRemaining
      )}.`,
      page: 'finance'
    })
  }

  if (missingContactStudents.length > 0) {
    alerts.push({
      id: 'missing-contact',
      type: 'info',
      title: `${missingContactStudents.length} öğrencide iletişim bilgisi eksik`,
      description:
        'Öğrenci veya veli telefon bilgileri tamamlanmalı.',
      page: 'students'
    })
  }

  const visibleAlerts = alerts.slice(0, 5)

  const findTeacherNameForLesson = (lesson) => {
    if (lesson.teacherName) return lesson.teacherName
    if (typeof lesson.teacher === 'string') return lesson.teacher

    const teacher = teachers.find(
      (item) =>
        String(item.id) === String(lesson.teacherId)
    )

    return getTeacherName(teacher) || '-'
  }

  const findStudentNameForLesson = (lesson) => {
    if (lesson.studentName) return lesson.studentName

    const student = students.find(
      (item) =>
        String(item.id) === String(lesson.studentId)
    )

    return getStudentName(student) || '-'
  }

  const getReceivableStatusText = (record) => {
    if (record.daysUntilDue === null) {
      return 'Tarih tanımlı değil'
    }

    if (record.daysUntilDue > 0) {
      return `${record.daysUntilDue} gün kaldı · ${formatDate(
        record.dueDate
      )}`
    }

    if (record.daysUntilDue === 0) {
      return `Bugün ödenecek · ${formatDate(
        record.dueDate
      )}`
    }

    return `Tolerans süresinde · ${record.daysLate} gün gecikti`
  }

  const getReceivableStatusClass = (record) => {
    if (record.daysUntilDue === 0) return 'due-today'
    if (record.daysLate > 0) return 'grace'
    return 'upcoming'
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
          <strong>{currentDayName}</strong>
          <span>{formattedToday}</span>
        </div>
      </section>

      <section className="dashboard-home-metrics">
        <button
          type="button"
          className="dashboard-home-metric green"
          onClick={() => onNavigate('students')}
        >
          <div>
            <span>Aktif Öğrenci</span>
            <strong>{activeStudentCount}</strong>
            <small>Öğrenciler sayfasından</small>
          </div>
          <div className="dashboard-home-metric-icon">✓</div>
        </button>

        <button
          type="button"
          className="dashboard-home-metric blue"
          onClick={() => onNavigate('teachers')}
        >
          <div>
            <span>Aktif Öğretmen</span>
            <strong>{activeTeacherCount}</strong>
            <small>Öğretmenler sayfasından</small>
          </div>
          <div className="dashboard-home-metric-icon">♪</div>
        </button>

        <button
          type="button"
          className="dashboard-home-metric cyan"
          onClick={() => onNavigate('finance')}
        >
          <div>
            <span>Bu Ay Gelir</span>
            <strong>₺{formatPrice(monthlyIncome)}</strong>
            <small>Tahsilatlar ve ek gelirler</small>
          </div>
          <div className="dashboard-home-metric-icon">₺</div>
        </button>

        <button
          type="button"
          className="dashboard-home-metric red"
          onClick={() => onNavigate('payments')}
        >
          <div>
            <span>Bekleyen Tahsilat</span>
            <strong>₺{formatPrice(totalOutstanding)}</strong>
            <small>Açık aylık ödeme dönemleri</small>
          </div>
          <div className="dashboard-home-metric-icon">!</div>
        </button>
      </section>

      <section className="dashboard-home-card dashboard-home-lessons">
        <div className="dashboard-home-section-heading">
          <div>
            <h2>Bugünkü Ders Programı</h2>
            <p>Gün içinde planlanan derslerin kısa özeti</p>
          </div>

          <button
            type="button"
            className="dashboard-home-count-button"
            onClick={() => onNavigate('schedule')}
          >
            {todayLessons.length} ders
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
                <th>Sınıf / Lokasyon</th>
                <th>Süre</th>
                <th>Durum</th>
              </tr>
            </thead>

            <tbody>
              {todayLessons.length > 0 ? (
                todayLessons.map((lesson) => (
                  <tr key={lesson.id}>
                    <td className="dashboard-home-time-cell">
                      {lesson.time || '-'}
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
                      {findTeacherNameForLesson(lesson)}
                    </td>
                    <td>
                      {findStudentNameForLesson(lesson)}
                    </td>
                    <td>
                      {lesson.location ||
                        lesson.classroom ||
                        '-'}
                    </td>
                    <td>{lesson.duration || '-'}</td>
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
                ))
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="dashboard-home-empty-table"
                  >
                    Bugün için kayıtlı ders
                    bulunmamaktadır.
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
              <h2>Yaklaşan Tahsilatlar</h2>
              <p>
                7 gün içindeki ve tolerans
                süresindeki ödemeler
              </p>
            </div>

            <button
              type="button"
              className="dashboard-home-panel-count"
              onClick={() => onNavigate('payments')}
            >
              {upcomingReceivables.length}
            </button>
          </div>

          <div className="dashboard-home-panel-content">
            {upcomingReceivables.length > 0 ? (
              upcomingReceivables.map((record) => (
                <button
                  type="button"
                  className="dashboard-home-receivable-item"
                  key={record.studentPackageId}
                  onClick={() => onNavigate('payments')}
                >
                  <div>
                    <strong>{record.studentName}</strong>
                    <span>{record.packageName}</span>
                    <small
                      className={getReceivableStatusClass(
                        record
                      )}
                    >
                      {getReceivableStatusText(record)}
                    </small>
                  </div>

                  <b>
                    ₺{formatPrice(record.remainingDebt)}
                  </b>
                </button>
              ))
            ) : (
              <div className="dashboard-home-empty-panel">
                Önümüzdeki 7 gün içinde yaklaşan
                tahsilat bulunmamaktadır.
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-home-card dashboard-home-small-panel">
          <div className="dashboard-home-section-heading compact">
            <div>
              <h2>Önemli Uyarılar</h2>
              <p>Takip edilmesi gereken kritik kayıtlar</p>
            </div>

            <span className="dashboard-home-panel-count static">
              {alerts.length}
            </span>
          </div>

          <div className="dashboard-home-panel-content">
            {visibleAlerts.length > 0 ? (
              visibleAlerts.map((alertItem) => (
                <button
                  type="button"
                  className="dashboard-home-alert-item"
                  key={alertItem.id}
                  onClick={() =>
                    onNavigate(alertItem.page)
                  }
                >
                  <span
                    className={`dashboard-home-alert-dot ${alertItem.type}`}
                  />

                  <div>
                    <strong>{alertItem.title}</strong>
                    <span>{alertItem.description}</span>
                  </div>

                  <b>›</b>
                </button>
              ))
            ) : (
              <div className="dashboard-home-success-panel">
                <span>✓</span>
                <div>
                  <strong>Kritik uyarı bulunmuyor</strong>
                  <p>
                    Tüm temel kayıtlar şu anda düzenli
                    görünüyor.
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