import { supabase } from '../lib/supabase'

const paymentSelect = `
  id,
  student_id,
  student_package_id,
  package_id,
  teacher_id,
  amount,
  payment_period,
  due_date,
  payment_date,
  payment_method,
  reference_number,
  note,
  is_active,
  created_at,
  updated_at,

  student:students (
    id,
    full_name
  ),

  student_package:student_packages (
    id,
    agreed_price,
    payment_day,
    first_payment_date,
    next_payment_date
  ),

  package:packages (
    id,
    name,

    specialty:specialties (
      id,
      name
    )
  ),

  teacher:teachers (
    id,
    full_name
  )
`

function cleanOptionalText(value) {
  const cleanValue = String(value || '').trim()

  return cleanValue || null
}

function mapPaymentFromDb(row) {
  return {
    id: row.id,

    studentId:
      row.student_id || '',

    studentName:
      row.student?.full_name || '',

    studentPackageId:
      row.student_package_id || '',

    packageId:
      row.package_id || '',

    packageName:
      row.package?.name || 'Tanımsız Paket',

    instrument:
      row.package?.specialty?.name || '',

    teacherId:
      row.teacher_id || '',

    teacher:
      row.teacher?.full_name || '',

    teacherName:
      row.teacher?.full_name || '',

    packagePrice: Number(
      row.student_package?.agreed_price || 0
    ),

    amount:
      Number(row.amount || 0),

    paymentPeriod:
      row.payment_period || '',

    dueDate:
      row.due_date || '',

    paymentDate:
      row.payment_date || '',

    paymentMethod:
      row.payment_method || '',

    referenceNumber:
      row.reference_number || '',

    note:
      row.note || '',

    isActive:
      row.is_active !== false,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  }
}

function validatePaymentInput(form) {
  const studentId = String(
    form.studentId || ''
  ).trim()

  const studentPackageId = String(
    form.studentPackageId || ''
  ).trim()

  const amount = Number(
    form.amount
  )

  const paymentPeriod = String(
    form.paymentPeriod || ''
  ).trim()

  const paymentDate = String(
    form.paymentDate || ''
  ).trim()

  const paymentMethod = String(
    form.paymentMethod || ''
  ).trim()

  if (!studentId) {
    throw new Error(
      'Öğrenci bilgisi bulunamadı.'
    )
  }

  if (!studentPackageId) {
    throw new Error(
      'Öğrenci paketi bulunamadı.'
    )
  }

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      'Tahsilat tutarı 0’dan büyük olmalıdır.'
    )
  }

  if (!paymentPeriod) {
    throw new Error(
      'Ödeme dönemi bulunamadı.'
    )
  }

  if (!paymentDate) {
    throw new Error(
      'Tahsilat tarihi bulunamadı.'
    )
  }

  if (!paymentMethod) {
    throw new Error(
      'Ödeme yöntemi bulunamadı.'
    )
  }

  return {
    student_id:
      studentId,

    student_package_id:
      studentPackageId,

    package_id:
      form.packageId || null,

    teacher_id:
      form.teacherId || null,

    amount,

    payment_period:
      paymentPeriod,

    due_date:
      form.dueDate || null,

    payment_date:
      paymentDate,

    payment_method:
      paymentMethod,

    reference_number:
      cleanOptionalText(
        form.referenceNumber
      ),

    note:
      cleanOptionalText(
        form.note
      ),

    is_active: true
  }
}

export async function getPayments() {
  const {
    data,
    error
  } = await supabase
    .from('payments')
    .select(paymentSelect)
    .eq('is_active', true)
    .order('payment_date', {
      ascending: false
    })
    .order('created_at', {
      ascending: false
    })

  if (error) {
    throw new Error(
      `Tahsilatlar alınamadı: ${error.message}`
    )
  }

  return (data || []).map(
    mapPaymentFromDb
  )
}

export async function createPayment(
  form
) {
  const row =
    validatePaymentInput(form)

  const {
    data,
    error
  } = await supabase
    .from('payments')
    .insert(row)
    .select(paymentSelect)
    .single()

  if (error) {
    throw new Error(
      `Tahsilat kaydedilemedi: ${error.message}`
    )
  }

  return mapPaymentFromDb(data)
}

export async function updatePayment(
  paymentId,
  changes
) {
  if (!paymentId) {
    throw new Error(
      'Tahsilat kimliği bulunamadı.'
    )
  }

  const amount = Number(
    changes.amount
  )

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      'Tahsilat tutarı 0’dan büyük olmalıdır.'
    )
  }

  const paymentDate = String(
    changes.paymentDate || ''
  ).trim()

  const paymentMethod = String(
    changes.paymentMethod || ''
  ).trim()

  if (!paymentDate) {
    throw new Error(
      'Tahsilat tarihi bulunamadı.'
    )
  }

  if (!paymentMethod) {
    throw new Error(
      'Ödeme yöntemi bulunamadı.'
    )
  }

  const {
    data,
    error
  } = await supabase
    .from('payments')
    .update({
      amount,

      payment_date:
        paymentDate,

      payment_method:
        paymentMethod,

      reference_number:
        cleanOptionalText(
          changes.referenceNumber
        ),

      note:
        cleanOptionalText(
          changes.note
        )
    })
    .eq('id', paymentId)
    .select(paymentSelect)
    .single()

  if (error) {
    throw new Error(
      `Tahsilat güncellenemedi: ${error.message}`
    )
  }

  return mapPaymentFromDb(data)
}

export async function deletePayment(
  paymentId
) {
  if (!paymentId) {
    throw new Error(
      'Tahsilat kimliği bulunamadı.'
    )
  }

  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', paymentId)

  if (error) {
    throw new Error(
      `Tahsilat silinemedi: ${error.message}`
    )
  }
}

export async function updateStudentPackageNextPaymentDate(
  studentPackageId,
  nextPaymentDate
) {
  if (!studentPackageId) {
    throw new Error(
      'Öğrenci paketi kimliği bulunamadı.'
    )
  }

  const { error } = await supabase
    .from('student_packages')
    .update({
      next_payment_date:
        nextPaymentDate || null
    })
    .eq('id', studentPackageId)

  if (error) {
    throw new Error(
      `Sonraki ödeme tarihi güncellenemedi: ${error.message}`
    )
  }
}