import { supabase } from '../lib/supabase'

function mapSpecialtyFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapPackageFromDb(row) {
  return {
    id: row.id,
    name: row.name,

    specialtyId: row.specialty_id,
    specialty_id: row.specialty_id,

    instrument:
      row.specialty?.name ?? '',

    duration:
      `${row.duration_minutes} dk`,

    durationMinutes:
      row.duration_minutes,

    lessonCount:
      row.lesson_count,

    totalPrice: Number(
      row.total_price ?? 0
    ),

    unitPrice: Number(
      row.unit_price ?? 0
    ),

    teacherShareRate:
      row.teacher_share_rate === null
        ? null
        : Number(
            row.teacher_share_rate
          ),

    status: row.status,
    isActive: row.is_active,

    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const specialtySelect = `
  id,
  name,
  is_active,
  created_at,
  updated_at
`

const packageSelect = `
  id,
  name,
  specialty_id,
  duration_minutes,
  lesson_count,
  total_price,
  unit_price,
  teacher_share_rate,
  status,
  is_active,
  created_at,
  updated_at,
  specialty:specialties (
    id,
    name
  )
`

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

function getCatalogErrorMessage(
  error,
  fallbackMessage,
  duplicateMessage = ''
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

  if (
    duplicateMessage &&
    (
      error?.code === '23505' ||
      String(
        error?.message ?? ''
      )
        .toLocaleLowerCase('tr-TR')
        .includes('duplicate')
    )
  ) {
    return duplicateMessage
  }

  return fallbackMessage
}

export async function getSpecialties() {
  const { data, error } = await supabase
    .from('specialties')
    .select(specialtySelect)
    .order('name', {
      ascending: true
    })

  if (error) {
    throw new Error(
      getCatalogErrorMessage(
        error,
        'Branşlar şu anda alınamadı.'
      )
    )
  }

  return (data ?? []).map(
    mapSpecialtyFromDb
  )
}

export async function getPackages() {
  const { data, error } = await supabase
    .from('packages')
    .select(packageSelect)
    .order('created_at', {
      ascending: false
    })

  if (error) {
    throw new Error(
      getCatalogErrorMessage(
        error,
        'Paketler şu anda alınamadı.'
      )
    )
  }

  return (data ?? []).map(
    mapPackageFromDb
  )
}

export async function createSpecialty(
  name
) {
  const cleanName = String(
    name ?? ''
  ).trim()

  if (!cleanName) {
    throw new Error(
      'Branş adı boş bırakılamaz.'
    )
  }

  const { data, error } = await supabase
    .from('specialties')
    .insert({
      name: cleanName
    })
    .select(specialtySelect)
    .single()

  if (error) {
    throw new Error(
      getCatalogErrorMessage(
        error,
        'Branş eklenemedi.',
        'Bu branş daha önce eklenmiş.'
      )
    )
  }

  return mapSpecialtyFromDb(data)
}

function normalizeDurationMinutes(
  packageForm
) {
  const rawValue =
    packageForm.durationMinutes ??
    packageForm.duration

  if (typeof rawValue === 'string') {
    return Number(
      rawValue.replace(
        /[^0-9.]/g,
        ''
      )
    )
  }

  return Number(rawValue)
}

function validatePackageForm(
  packageForm
) {
  const cleanName = String(
    packageForm.name ?? ''
  ).trim()

  const specialtyId = String(
    packageForm.specialtyId ?? ''
  ).trim()

  const lessonCount = Number(
    packageForm.lessonCount
  )

  const totalPrice = Number(
    packageForm.totalPrice
  )

  const durationMinutes =
    normalizeDurationMinutes(
      packageForm
    )

  if (!cleanName) {
    throw new Error(
      'Paket adı zorunludur.'
    )
  }

  if (!specialtyId) {
    throw new Error(
      'Branş seçimi zorunludur.'
    )
  }

  if (
    !Number.isInteger(lessonCount) ||
    lessonCount <= 0
  ) {
    throw new Error(
      'Ders sayısı pozitif bir tam sayı olmalıdır.'
    )
  }

  if (
    !Number.isFinite(totalPrice) ||
    totalPrice <= 0
  ) {
    throw new Error(
      'Toplam ücret 0’dan büyük olmalıdır.'
    )
  }

  if (
    !Number.isInteger(
      durationMinutes
    ) ||
    durationMinutes <= 0
  ) {
    throw new Error(
      'Ders süresi pozitif bir tam sayı olmalıdır.'
    )
  }

  return {
    cleanName,
    specialtyId,
    lessonCount,
    totalPrice,
    durationMinutes,
    unitPrice:
      totalPrice / lessonCount
  }
}

export async function createPackage(
  packageForm
) {
  const values =
    validatePackageForm(
      packageForm
    )

  const { data, error } = await supabase
    .from('packages')
    .insert({
      name:
        values.cleanName,

      specialty_id:
        values.specialtyId,

      duration_minutes:
        values.durationMinutes,

      lesson_count:
        values.lessonCount,

      total_price:
        values.totalPrice,

      unit_price:
        values.unitPrice,

      status: 'Aktif',
      is_active: true
    })
    .select(packageSelect)
    .single()

  if (error) {
    throw new Error(
      getCatalogErrorMessage(
        error,
        'Paket eklenemedi.',
        'Bu paket adıyla daha önce bir kayıt oluşturulmuş.'
      )
    )
  }

  return mapPackageFromDb(data)
}

export async function updatePackage(
  packageId,
  packageForm
) {
  const cleanPackageId = String(
    packageId ?? ''
  ).trim()

  if (!cleanPackageId) {
    throw new Error(
      'Paket kimliği bulunamadı.'
    )
  }

  const values =
    validatePackageForm(
      packageForm
    )

  const { data, error } = await supabase
    .from('packages')
    .update({
      name:
        values.cleanName,

      specialty_id:
        values.specialtyId,

      duration_minutes:
        values.durationMinutes,

      lesson_count:
        values.lessonCount,

      total_price:
        values.totalPrice,

      unit_price:
        values.unitPrice
    })
    .eq('id', cleanPackageId)
    .select(packageSelect)
    .single()

  if (error) {
    throw new Error(
      getCatalogErrorMessage(
        error,
        'Paket güncellenemedi.',
        'Bu paket adıyla başka bir kayıt bulunmaktadır.'
      )
    )
  }

  return mapPackageFromDb(data)
}

export async function setPackageActiveStatus(
  packageId,
  isActive
) {
  const cleanPackageId = String(
    packageId ?? ''
  ).trim()

  if (!cleanPackageId) {
    throw new Error(
      'Paket kimliği bulunamadı.'
    )
  }

  const nextIsActive =
    isActive === true

  const { data, error } = await supabase
    .from('packages')
    .update({
      is_active:
        nextIsActive,

      status:
        nextIsActive
          ? 'Aktif'
          : 'Pasif'
    })
    .eq('id', cleanPackageId)
    .select(packageSelect)
    .single()

  if (error) {
    throw new Error(
      getCatalogErrorMessage(
        error,
        'Paket durumu değiştirilemedi.'
      )
    )
  }

  return mapPackageFromDb(data)
}