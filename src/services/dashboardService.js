import { supabase } from '../lib/supabase'

function mapDashboardSummary(row) {
  return {
    activeStudentCount: Number(
      row?.active_student_count || 0
    ),

    activeTeacherCount: Number(
      row?.active_teacher_count || 0
    ),

    monthlyStudentIncome: Number(
      row?.monthly_student_income || 0
    ),

    monthlyOtherIncome: Number(
      row?.monthly_other_income || 0
    ),

    monthlyIncome: Number(
      row?.monthly_income || 0
    ),

    totalIncome: Number(
      row?.total_income || 0
    ),

    totalInstitutionExpense: Number(
      row?.total_institution_expense || 0
    ),

    totalTeacherPaid: Number(
      row?.total_teacher_paid || 0
    ),

    totalExpense: Number(
      row?.total_expense || 0
    ),

    netCash: Number(
      row?.net_cash || 0
    ),

    totalOutstanding: Number(
      row?.total_outstanding || 0
    ),

    overdueCount: Number(
      row?.overdue_count || 0
    ),

    upcomingCount: Number(
      row?.upcoming_count || 0
    ),

    teacherRemaining: Number(
      row?.teacher_remaining || 0
    ),

    completedLessonCount: Number(
      row?.completed_lesson_count || 0
    ),

    todayLessonCount: Number(
      row?.today_lesson_count || 0
    )
  }
}

function mapReceivable(row) {
  return {
    studentPackageId:
      row.student_package_id || '',

    studentId:
      row.student_id || '',

    studentName:
      row.student_name || 'Öğrenci',

    packageId:
      row.package_id || '',

    packageName:
      row.package_name ||
      'Tanımsız Paket',

    instrument:
      row.instrument || '',

    teacherId:
      row.teacher_id || '',

    teacherName:
      row.teacher_name || '',

    agreedPrice: Number(
      row.agreed_price || 0
    ),

    monthlyFee: Number(
      row.agreed_price || 0
    ),

    lessonCount: Number(
      row.lesson_count || 1
    ),

    unitPrice: Number(
      row.unit_price || 0
    ),

    dueDate:
      row.due_date || '',

    period:
      row.payment_period || '',

    collectedAmount: Number(
      row.collected_amount || 0
    ),

    remainingDebt: Number(
      row.remaining_debt || 0
    ),

    daysUntilDue:
      row.days_until_due === null
        ? null
        : Number(
            row.days_until_due
          ),

    daysLate: Number(
      row.days_late || 0
    ),

    receivableStatus:
      row.receivable_status ||
      'Normal'
  }
}

function isNetworkError(error) {
  const message = String(
    error?.message ?? ''
  ).toLocaleLowerCase('tr-TR')

  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch')
  )
}

function getDashboardErrorMessage(
  error,
  fallbackMessage
) {
  if (
    typeof navigator !==
      'undefined' &&
    !navigator.onLine
  ) {
    return (
      'İnternet bağlantısı bulunamadı. ' +
      'Bağlantınızı kontrol edip tekrar deneyiniz.'
    )
  }

  if (isNetworkError(error)) {
    return (
      'Sunucuya ulaşılamadı. ' +
      'İnternet bağlantınızı kontrol edip tekrar deneyiniz.'
    )
  }

  return fallbackMessage
}

function normalizePositiveNumber(
  value,
  fallbackValue
) {
  const numericValue = Number(value)

  if (
    !Number.isFinite(numericValue) ||
    numericValue <= 0
  ) {
    return fallbackValue
  }

  return numericValue
}

function normalizeDateKey(value) {
  const dateKey = String(
    value ?? ''
  ).trim()

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateKey
    )
  ) {
    throw new Error(
      'Dashboard tarihi geçerli değildir.'
    )
  }

  return dateKey
}

export async function getDashboardSummary({
  todayKey,
  currentDayName,
  upcomingDays = 7,
  graceDays = 3
}) {
  const cleanTodayKey =
    normalizeDateKey(todayKey)

  const cleanCurrentDayName =
    String(
      currentDayName ?? ''
    ).trim()

  if (!cleanCurrentDayName) {
    throw new Error(
      'Gün bilgisi bulunamadı.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .rpc(
      'get_dashboard_summary',
      {
        p_today:
          cleanTodayKey,

        p_current_day:
          cleanCurrentDayName,

        p_upcoming_days:
          normalizePositiveNumber(
            upcomingDays,
            7
          ),

        p_grace_days:
          Math.max(
            0,
            Number(graceDays) || 0
          )
      }
    )
    .single()

  if (error) {
    throw new Error(
      getDashboardErrorMessage(
        error,
        'Dashboard özeti şu anda alınamadı.'
      )
    )
  }

  return mapDashboardSummary(data)
}

export async function getDashboardReceivables({
  todayKey,
  upcomingDays = 7,
  graceDays = 3,
  limit = 30
}) {
  const cleanTodayKey =
    normalizeDateKey(todayKey)

  const {
    data,
    error
  } = await supabase
    .rpc(
      'get_dashboard_receivables',
      {
        p_today:
          cleanTodayKey,

        p_upcoming_days:
          normalizePositiveNumber(
            upcomingDays,
            7
          ),

        p_grace_days:
          Math.max(
            0,
            Number(graceDays) || 0
          ),

        p_limit:
          Math.max(
            1,
            Math.trunc(
              Number(limit) || 30
            )
          )
      }
    )

  if (error) {
    throw new Error(
      getDashboardErrorMessage(
        error,
        'Dashboard alacak kayıtları şu anda alınamadı.'
      )
    )
  }

  return (data || []).map(
    mapReceivable
  )
}