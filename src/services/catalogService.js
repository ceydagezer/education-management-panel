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

    instrument: row.specialty?.name ?? '',

    duration: `${row.duration_minutes} dk`,
    durationMinutes: row.duration_minutes,

    lessonCount: row.lesson_count,

    totalPrice: Number(
      row.total_price ?? 0
    ),

    unitPrice: Number(
      row.unit_price ?? 0
    ),

    teacherShareRate:
      row.teacher_share_rate === null
        ? null
        : Number(row.teacher_share_rate),

    status: row.status,
    isActive: row.is_active,

    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

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

export async function getSpecialties() {
  const { data, error } = await supabase
    .from('specialties')
    .select(`
      id,
      name,
      is_active,
      created_at,
      updated_at
    `)
    .order('name', {
      ascending: true
    })

  if (error) {
    throw new Error(
      `Branşlar alınamadı: ${error.message}`
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
      `Paketler alınamadı: ${error.message}`
    )
  }

  return (data ?? []).map(
    mapPackageFromDb
  )
}

export async function createSpecialty(name) {
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
    .select(`
      id,
      name,
      is_active,
      created_at,
      updated_at
    `)
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error(
        'Bu branş daha önce eklenmiş.'
      )
    }

    throw new Error(
      `Branş eklenemedi: ${error.message}`
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

  if (!packageForm.name?.trim()) {
    throw new Error(
      'Paket adı zorunludur.'
    )
  }

  if (!packageForm.specialtyId) {
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
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0
  ) {
    throw new Error(
      'Ders süresi geçerli olmalıdır.'
    )
  }

  return {
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
      name: packageForm.name.trim(),

      specialty_id:
        packageForm.specialtyId,

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
      `Paket eklenemedi: ${error.message}`
    )
  }

  return mapPackageFromDb(data)
}

export async function updatePackage(
  packageId,
  packageForm
) {
  if (!packageId) {
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
      name: packageForm.name.trim(),

      specialty_id:
        packageForm.specialtyId,

      duration_minutes:
        values.durationMinutes,

      lesson_count:
        values.lessonCount,

      total_price:
        values.totalPrice,

      unit_price:
        values.unitPrice
    })
    .eq('id', packageId)
    .select(packageSelect)
    .single()

  if (error) {
    throw new Error(
      `Paket güncellenemedi: ${error.message}`
    )
  }

  return mapPackageFromDb(data)
}

export async function setPackageActiveStatus(
  packageId,
  isActive
) {
  if (!packageId) {
    throw new Error(
      'Paket kimliği bulunamadı.'
    )
  }

  const { data, error } = await supabase
    .from('packages')
    .update({
      is_active: isActive,
      status: isActive
        ? 'Aktif'
        : 'Pasif'
    })
    .eq('id', packageId)
    .select(packageSelect)
    .single()

  if (error) {
    throw new Error(
      `Paket durumu değiştirilemedi: ${error.message}`
    )
  }

  return mapPackageFromDb(data)
}