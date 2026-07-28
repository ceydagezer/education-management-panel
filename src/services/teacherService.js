import { supabase } from '../lib/supabase'

const PHOTO_BUCKET = 'teacher-photos'
const CV_BUCKET = 'teacher-cvs'
const SIGNED_URL_SECONDS = 60 * 60 * 24

const teacherSelect = `
  id,
  full_name,
  phone,
  email,
  birth_date,
  gender,
  commission_rate,
  payment_day,
  photo_path,
  cv_file_path,
  cv_file_name,
  notes,
  status,
  is_active,
  passive_date,
  passive_reason,
  reactivated_at,
  created_at,
  updated_at,
  teacher_specialties (
    specialty_id,
    specialty:specialties (
      id,
      name,
      is_active
    )
  )
`

function mapTeacherFromDb(row) {
  const specialties = (
    row.teacher_specialties ?? []
  )
    .map((relation) => relation.specialty)
    .filter(Boolean)
    .map((specialty) => ({
      id: specialty.id,
      name: specialty.name,
      isActive:
        specialty.is_active !== false
    }))

  return {
    id: row.id,
    fullName: row.full_name ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    birthDate: row.birth_date ?? '',
    gender: row.gender ?? '',

    commissionRate: Number(
      row.commission_rate ?? 50
    ),

    paymentDay:
      row.payment_day ?? '',

    teacherPaymentDay:
      row.payment_day ?? '',

    photoPath:
      row.photo_path ?? '',

    profilePhotoPath:
      row.photo_path ?? '',

    photo: '',
    profilePhotoUrl: '',

    cvFilePath:
      row.cv_file_path ?? '',

    cvFileName:
      row.cv_file_name ?? '',

    cvUrl: '',
    cvFile: null,

    notes:
      row.notes ?? '',

    status:
      row.status ?? 'Aktif',

    isActive:
      row.is_active !== false,

    passiveDate:
      row.passive_date ?? '',

    passiveReason:
      row.passive_reason ?? '',

    reactivatedAt:
      row.reactivated_at ?? '',

    specialties,

    branch:
      specialties[0]?.name ?? '',

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  }
}

async function createSignedUrl(
  bucket,
  path
) {
  if (!path) {
    return ''
  }

  const { data, error } = await supabase
    .storage
    .from(bucket)
    .createSignedUrl(
      path,
      SIGNED_URL_SECONDS
    )

  if (error) {
    console.error(
      `${bucket} signed URL oluşturulamadı:`,
      error
    )

    return ''
  }

  return data?.signedUrl ?? ''
}

async function attachFileUrls(teacher) {
  const [
    photoUrl,
    cvUrl
  ] = await Promise.all([
    createSignedUrl(
      PHOTO_BUCKET,
      teacher.photoPath
    ),

    createSignedUrl(
      CV_BUCKET,
      teacher.cvFilePath
    )
  ])

  return {
    ...teacher,

    photo:
      photoUrl,

    profilePhotoUrl:
      photoUrl,

    cvUrl
  }
}

function normalizeTeacherForm(form) {
  const fullName = String(
    form.fullName ?? ''
  ).trim()

  const phone = String(
    form.phone ?? ''
  ).trim()

  const email = String(
    form.email ?? ''
  ).trim()

  const commissionRate = Number(
    form.commissionRate
  )

  const paymentDay = Number(
    form.paymentDay
  )

  const specialtyIds = [
    ...new Set(
      (form.specialties ?? [])
        .map((specialty) =>
          typeof specialty === 'string'
            ? specialty
            : specialty?.id
        )
        .filter(Boolean)
        .map(String)
    )
  ]

  if (!fullName) {
    throw new Error(
      'Ad soyad zorunludur.'
    )
  }

  if (!phone) {
    throw new Error(
      'Telefon zorunludur.'
    )
  }

  if (!email) {
    throw new Error(
      'E-posta zorunludur.'
    )
  }

  if (!form.birthDate) {
    throw new Error(
      'Doğum tarihi zorunludur.'
    )
  }

  if (!form.gender) {
    throw new Error(
      'Cinsiyet zorunludur.'
    )
  }

  if (
    specialtyIds.length === 0
  ) {
    throw new Error(
      'En az bir uzmanlık seçiniz.'
    )
  }

  if (
    !Number.isFinite(
      commissionRate
    ) ||
    commissionRate < 0 ||
    commissionRate > 100
  ) {
    throw new Error(
      'Hakediş yüzdesi 0 ile 100 arasında olmalıdır.'
    )
  }

  if (
    !Number.isInteger(
      paymentDay
    ) ||
    paymentDay < 1 ||
    paymentDay > 31
  ) {
    throw new Error(
      'Aylık ödeme gününü seçiniz.'
    )
  }

  return {
    teacherRow: {
      full_name:
        fullName,

      phone,

      email,

      birth_date:
        form.birthDate,

      gender:
        form.gender,

      commission_rate:
        commissionRate,

      payment_day:
        paymentDay,

      notes: String(
        form.notes ?? ''
      ).trim()
    },

    specialtyIds
  }
}

function getFileExtension(file) {
  const nameExtension =
    file?.name
      ?.split('.')
      .pop()
      ?.toLocaleLowerCase(
        'tr-TR'
      )

  if (nameExtension) {
    return nameExtension.replace(
      /[^a-z0-9]/g,
      ''
    )
  }

  const mimeExtension =
    file?.type
      ?.split('/')
      .pop()
      ?.toLocaleLowerCase(
        'tr-TR'
      )

  return mimeExtension || 'bin'
}

async function uploadTeacherFile({
  bucket,
  teacherId,
  prefix,
  file
}) {
  const extension =
    getFileExtension(file)

  const filePath =
    `${teacherId}/${prefix}-${Date.now()}.${extension}`

  const { error } = await supabase
    .storage
    .from(bucket)
    .upload(
      filePath,
      file,
      {
        cacheControl: '3600',
        upsert: false,

        contentType:
          file.type || undefined
      }
    )

  if (error) {
    throw new Error(
      `Dosya yüklenemedi: ${error.message}`
    )
  }

  return filePath
}

async function removeStorageFile(
  bucket,
  path
) {
  if (!path) {
    return
  }

  const { error } = await supabase
    .storage
    .from(bucket)
    .remove([path])

  if (error) {
    console.error(
      `${bucket} dosyası silinemedi:`,
      error
    )
  }
}

async function getTeacherById(
  teacherId
) {
  const { data, error } = await supabase
    .from('teachers')
    .select(teacherSelect)
    .eq('id', teacherId)
    .single()

  if (error) {
    throw new Error(
      `Öğretmen kaydı alınamadı: ${error.message}`
    )
  }

  return attachFileUrls(
    mapTeacherFromDb(data)
  )
}

export async function getTeachers() {
  const { data, error } = await supabase
    .from('teachers')
    .select(teacherSelect)
    .order('created_at', {
      ascending: false
    })

  if (error) {
    throw new Error(
      `Öğretmenler alınamadı: ${error.message}`
    )
  }

  return Promise.all(
    (data ?? []).map(
      (row) =>
        attachFileUrls(
          mapTeacherFromDb(row)
        )
    )
  )
}

async function replaceTeacherSpecialties(
  teacherId,
  specialtyIds
) {
  const {
    error: deleteError
  } = await supabase
    .from('teacher_specialties')
    .delete()
    .eq(
      'teacher_id',
      teacherId
    )

  if (deleteError) {
    throw new Error(
      `Öğretmen uzmanlıkları temizlenemedi: ${deleteError.message}`
    )
  }

  if (
    specialtyIds.length === 0
  ) {
    return
  }

  const relationRows =
    specialtyIds.map(
      (specialtyId) => ({
        teacher_id:
          teacherId,

        specialty_id:
          specialtyId
      })
    )

  const {
    error: insertError
  } = await supabase
    .from('teacher_specialties')
    .insert(relationRows)

  if (insertError) {
    throw new Error(
      `Öğretmen uzmanlıkları kaydedilemedi: ${insertError.message}`
    )
  }
}

export async function createTeacher(
  form
) {
  const {
    teacherRow,
    specialtyIds
  } = normalizeTeacherForm(form)

  const { data, error } = await supabase
    .from('teachers')
    .insert({
      ...teacherRow,

      status:
        'Aktif',

      is_active:
        true
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(
      `Öğretmen eklenemedi: ${error.message}`
    )
  }

  const teacherId =
    data.id

  let uploadedPhotoPath = ''
  let uploadedCvPath = ''

  try {
    if (form.photoFile) {
      uploadedPhotoPath =
        await uploadTeacherFile({
          bucket:
            PHOTO_BUCKET,

          teacherId,

          prefix:
            'profile',

          file:
            form.photoFile
        })
    }

    if (form.cvFile) {
      uploadedCvPath =
        await uploadTeacherFile({
          bucket:
            CV_BUCKET,

          teacherId,

          prefix:
            'cv',

          file:
            form.cvFile
        })
    }

    const {
      error: filePathError
    } = await supabase
      .from('teachers')
      .update({
        photo_path:
          uploadedPhotoPath ||
          null,

        cv_file_path:
          uploadedCvPath ||
          null,

        cv_file_name:
          form.cvFile?.name ||
          null
      })
      .eq(
        'id',
        teacherId
      )

    if (filePathError) {
      throw new Error(
        `Dosya bilgileri kaydedilemedi: ${filePathError.message}`
      )
    }

    await replaceTeacherSpecialties(
      teacherId,
      specialtyIds
    )
  } catch (saveError) {
    await Promise.all([
      removeStorageFile(
        PHOTO_BUCKET,
        uploadedPhotoPath
      ),

      removeStorageFile(
        CV_BUCKET,
        uploadedCvPath
      )
    ])

    await supabase
      .from('teachers')
      .delete()
      .eq(
        'id',
        teacherId
      )

    throw saveError
  }

  return getTeacherById(
    teacherId
  )
}

export async function updateTeacher(
  teacherId,
  form
) {
  if (!teacherId) {
    throw new Error(
      'Öğretmen kimliği bulunamadı.'
    )
  }

  const {
    teacherRow,
    specialtyIds
  } = normalizeTeacherForm(form)

  const oldPhotoPath =
    form.photoPath || ''

  const oldCvPath =
    form.cvFilePath || ''

  let uploadedPhotoPath = ''
  let uploadedCvPath = ''

  try {
    if (form.photoFile) {
      uploadedPhotoPath =
        await uploadTeacherFile({
          bucket:
            PHOTO_BUCKET,

          teacherId,

          prefix:
            'profile',

          file:
            form.photoFile
        })
    }

    if (form.cvFile) {
      uploadedCvPath =
        await uploadTeacherFile({
          bucket:
            CV_BUCKET,

          teacherId,

          prefix:
            'cv',

          file:
            form.cvFile
        })
    }

    const nextPhotoPath =
      form.removePhoto
        ? null
        : uploadedPhotoPath ||
          oldPhotoPath ||
          null

    const nextCvPath =
      form.removeCv
        ? null
        : uploadedCvPath ||
          oldCvPath ||
          null

    const nextCvFileName =
      form.removeCv
        ? null
        : form.cvFile?.name ||
          form.cvFileName ||
          null

    const { error } = await supabase
      .from('teachers')
      .update({
        ...teacherRow,

        photo_path:
          nextPhotoPath,

        cv_file_path:
          nextCvPath,

        cv_file_name:
          nextCvFileName
      })
      .eq(
        'id',
        teacherId
      )

    if (error) {
      throw new Error(
        `Öğretmen güncellenemedi: ${error.message}`
      )
    }

    await replaceTeacherSpecialties(
      teacherId,
      specialtyIds
    )

    if (
      oldPhotoPath &&
      (
        form.removePhoto ||
        uploadedPhotoPath
      )
    ) {
      await removeStorageFile(
        PHOTO_BUCKET,
        oldPhotoPath
      )
    }

    if (
      oldCvPath &&
      (
        form.removeCv ||
        uploadedCvPath
      )
    ) {
      await removeStorageFile(
        CV_BUCKET,
        oldCvPath
      )
    }
  } catch (saveError) {
    await Promise.all([
      removeStorageFile(
        PHOTO_BUCKET,
        uploadedPhotoPath
      ),

      removeStorageFile(
        CV_BUCKET,
        uploadedCvPath
      )
    ])

    throw saveError
  }

  return getTeacherById(
    teacherId
  )
}

export async function setTeacherPassive(
  teacherId,
  passiveReason,
  passiveDate
) {
  const cleanReason = String(
    passiveReason ?? ''
  ).trim()

  if (!cleanReason) {
    throw new Error(
      'Pasife alma nedeni zorunludur.'
    )
  }

  const { error } = await supabase
    .from('teachers')
    .update({
      is_active:
        false,

      status:
        'Pasif',

      passive_date:
        passiveDate,

      passive_reason:
        cleanReason
    })
    .eq(
      'id',
      teacherId
    )

  if (error) {
    throw new Error(
      `Öğretmen pasife alınamadı: ${error.message}`
    )
  }

  return getTeacherById(
    teacherId
  )
}

export async function reactivateTeacher(
  teacherId,
  reactivatedAt
) {
  const { error } = await supabase
    .from('teachers')
    .update({
      is_active:
        true,

      status:
        'Aktif',

      reactivated_at:
        reactivatedAt,

      passive_date:
        null,

      passive_reason:
        null
    })
    .eq(
      'id',
      teacherId
    )

  if (error) {
    throw new Error(
      `Öğretmen aktifleştirilemedi: ${error.message}`
    )
  }

  return getTeacherById(
    teacherId
  )
}