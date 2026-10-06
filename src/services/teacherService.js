import { supabase } from '../lib/supabase'

const PHOTO_BUCKET = 'teacher-photos'
const CV_BUCKET = 'teacher-cvs'

const SIGNED_URL_SECONDS =
  60 * 60 * 24

const SIGNED_URL_CACHE_MAX_AGE_MS =
  23 * 60 * 60 * 1000

const signedUrlCache = new Map()

const MAX_PHOTO_SIZE =
  5 * 1024 * 1024

const MAX_CV_SIZE =
  10 * 1024 * 1024

const ALLOWED_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
]

const ALLOWED_CV_TYPES = [
  'application/pdf'
]

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

function getTeacherErrorMessage(
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

function normalizeDateKey(
  value,
  label,
  {
    required = false
  } = {}
) {
  const dateKey = String(
    value ?? ''
  ).trim()

  if (!dateKey) {
    if (required) {
      throw new Error(
        `${label} zorunludur.`
      )
    }

    return ''
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateKey
    )
  ) {
    throw new Error(
      `${label} geçerli değildir.`
    )
  }

  const date = new Date(
    `${dateKey}T12:00:00`
  )

  if (
    Number.isNaN(date.getTime()) ||
    date
      .toISOString()
      .slice(0, 10) !== dateKey
  ) {
    throw new Error(
      `${label} geçerli değildir.`
    )
  }

  return dateKey
}

function mapTeacherFromDb(row) {
  const specialties = (
    row.teacher_specialties ?? []
  )
    .map(
      (relation) =>
        relation.specialty
    )
    .filter(Boolean)
    .map((specialty) => ({
      id: specialty.id,
      name: specialty.name,
      isActive:
        specialty.is_active !== false
    }))

  return {
    id: row.id,

    fullName:
      row.full_name ?? '',

    phone:
      row.phone ?? '',

    email:
      row.email ?? '',

    birthDate:
      row.birth_date ?? '',

    gender:
      row.gender ?? '',

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

  const cleanBucket = String(
    bucket || ''
  ).trim()

  const cleanPath = String(
    path || ''
  ).trim()

  if (!cleanBucket || !cleanPath) {
    return ''
  }

  const cacheKey =
    `${cleanBucket}:${cleanPath}`

  const cachedEntry =
    signedUrlCache.get(cacheKey)

  if (
    cachedEntry?.url &&
    Date.now() -
      Number(cachedEntry.createdAt || 0) <=
      SIGNED_URL_CACHE_MAX_AGE_MS
  ) {
    return cachedEntry.url
  }

  const { data, error } = await supabase
    .storage
    .from(cleanBucket)
    .createSignedUrl(
      cleanPath,
      SIGNED_URL_SECONDS
    )

  if (error) {
    console.error(
      `${cleanBucket} signed URL oluşturulamadı:`,
      error
    )

    signedUrlCache.delete(cacheKey)
    return ''
  }

  const signedUrl =
    data?.signedUrl ?? ''

  if (signedUrl) {
    signedUrlCache.set(
      cacheKey,
      {
        url: signedUrl,
        createdAt: Date.now()
      }
    )
  }

  return signedUrl
}

/*
 * Liste yüklenirken her öğretmen için ayrı istek atmak yerine
 * önbellekte olmayan fotoğrafların imzalı bağlantıları tek
 * istekte alınır. Fotoğraf alınamazsa liste yine yüklenir.
 */
async function attachPhotoUrls(
  teachers
) {
  const getCacheKey = (path) =>
    `${PHOTO_BUCKET}:${path}`

  const isCacheFresh = (path) => {
    const cachedEntry =
      signedUrlCache.get(getCacheKey(path))

    return Boolean(
      cachedEntry?.url &&
      Date.now() -
        Number(cachedEntry.createdAt || 0) <=
        SIGNED_URL_CACHE_MAX_AGE_MS
    )
  }

  const missingPaths = [
    ...new Set(
      teachers
        .map((teacher) =>
          String(teacher.photoPath || '').trim()
        )
        .filter(
          (path) =>
            path && !isCacheFresh(path)
        )
    )
  ]

  if (missingPaths.length > 0) {
    const { data, error } = await supabase
      .storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(
        missingPaths,
        SIGNED_URL_SECONDS
      )

    if (error) {
      console.error(
        `${PHOTO_BUCKET} signed URL listesi oluşturulamadı:`,
        error
      )
    }

    ;(data || []).forEach((item) => {
      if (item?.path && item?.signedUrl && !item.error) {
        signedUrlCache.set(
          getCacheKey(item.path),
          {
            url: item.signedUrl,
            createdAt: Date.now()
          }
        )
      }
    })
  }

  return teachers.map((teacher) => {
    const path = String(
      teacher.photoPath || ''
    ).trim()

    const photoUrl = path
      ? signedUrlCache.get(getCacheKey(path))?.url || ''
      : ''

    return {
      ...teacher,
      photo: photoUrl,
      profilePhotoUrl: photoUrl,
      cvUrl: ''
    }
  })
}

async function attachPhotoUrl(
  teacher
) {
  const photoUrl =
    await createSignedUrl(
      PHOTO_BUCKET,
      teacher.photoPath
    )

  return {
    ...teacher,

    photo:
      photoUrl,

    profilePhotoUrl:
      photoUrl,

    /*
     * CV bağlantısı liste yüklenirken oluşturulmaz.
     * CV yalnız kullanıcı görüntülediğinde veya PDF'e
     * eklemek istediğinde getTeacherCvUrl ile alınır.
     */
    cvUrl: ''
  }
}

export async function getTeacherCvUrl(
  teacherOrPath
) {
  const cvFilePath =
    typeof teacherOrPath === 'string'
      ? teacherOrPath
      : (
          teacherOrPath?.cvFilePath ||
          teacherOrPath?.cv_file_path ||
          ''
        )

  const cleanPath = String(
    cvFilePath || ''
  ).trim()

  if (!cleanPath) {
    return ''
  }

  return createSignedUrl(
    CV_BUCKET,
    cleanPath
  )
}

function validateTeacherFile(
  file,
  {
    label,
    allowedTypes,
    maxSize
  }
) {
  if (!file) {
    return
  }

  if (
    !allowedTypes.includes(
      file.type
    )
  ) {
    throw new Error(
      `${label} dosya türü desteklenmiyor.`
    )
  }

  if (
    !Number.isFinite(
      Number(file.size)
    ) ||
    file.size <= 0
  ) {
    throw new Error(
      `${label} dosyası geçerli değildir.`
    )
  }

  if (file.size > maxSize) {
    const maxSizeMb =
      Math.round(
        maxSize /
        (1024 * 1024)
      )

    throw new Error(
      `${label} en fazla ${maxSizeMb} MB olabilir.`
    )
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

  const birthDate =
    normalizeDateKey(
      form.birthDate,
      'Doğum tarihi',
      {
        required: true
      }
    )

  const gender = String(
    form.gender ?? ''
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
        .map((specialtyId) =>
          String(
            specialtyId
          ).trim()
        )
        .filter(Boolean)
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

  if (!gender) {
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

  validateTeacherFile(
    form.photoFile,
    {
      label: 'Fotoğraf',
      allowedTypes:
        ALLOWED_PHOTO_TYPES,
      maxSize:
        MAX_PHOTO_SIZE
    }
  )

  validateTeacherFile(
    form.cvFile,
    {
      label: 'CV',
      allowedTypes:
        ALLOWED_CV_TYPES,
      maxSize:
        MAX_CV_SIZE
    }
  )

  return {
    teacherRow: {
      full_name:
        fullName,

      phone,

      email,

      birth_date:
        birthDate,

      gender,

      commission_rate:
        commissionRate,

      payment_day:
        paymentDay,

      notes:
        String(
          form.notes ?? ''
        ).trim() || null
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
  const cleanTeacherId = String(
    teacherId || ''
  ).trim()

  if (!cleanTeacherId) {
    throw new Error(
      'Öğretmen kimliği bulunamadı.'
    )
  }

  const extension =
    getFileExtension(file)

  const filePath =
    `${cleanTeacherId}/${prefix}-${Date.now()}.${extension}`

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
      getTeacherErrorMessage(
        error,
        'Dosya yüklenemedi.'
      )
    )
  }

  return filePath
}

async function removeStorageFile(
  bucket,
  path
) {
  const cleanPath = String(
    path || ''
  ).trim()

  if (!cleanPath) {
    return
  }

  const { error } = await supabase
    .storage
    .from(bucket)
    .remove([cleanPath])

  if (!error) {
    signedUrlCache.delete(
      `${String(bucket || '').trim()}:${cleanPath}`
    )
  }

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
  const cleanTeacherId = String(
    teacherId || ''
  ).trim()

  if (!cleanTeacherId) {
    throw new Error(
      'Öğretmen kimliği bulunamadı.'
    )
  }

  const { data, error } = await supabase
    .from('teachers')
    .select(teacherSelect)
    .eq(
      'id',
      cleanTeacherId
    )
    .single()

  if (error) {
    throw new Error(
      getTeacherErrorMessage(
        error,
        'Öğretmen kaydı şu anda alınamadı.'
      )
    )
  }

  return attachPhotoUrl(
    mapTeacherFromDb(data)
  )
}

/*
 * Liste '*' ile okunur: is_deleted kolonu 20261009 migration'ıyla
 * gelir; kolon henüz yoksa da liste yüklenmeye devam eder.
 */
const teacherListSelect = `
  *,
  teacher_specialties (
    specialty_id,
    specialty:specialties (
      id,
      name,
      is_active
    )
  )
`

export async function getTeachers() {
  const { data, error } = await supabase
    .from('teachers')
    .select(teacherListSelect)
    .order(
      'created_at',
      {
        ascending: false
      }
    )

  if (error) {
    throw new Error(
      getTeacherErrorMessage(
        error,
        'Öğretmenler şu anda alınamadı.'
      )
    )
  }

  return attachPhotoUrls(
    (data ?? [])
      .filter((row) => row.is_deleted !== true)
      .map(mapTeacherFromDb)
  )
}

/*
 * Pasif ve hakedişi tamamen ödenmiş öğretmeni siler.
 * Kurallara takılan durumlarda (aktif ders, ödenmemiş hakediş...)
 * fırlatılan hata isBlocked = true taşır; ekran bunu uyarı
 * penceresiyle gösterir.
 */
export async function deleteTeacher(
  teacherId
) {
  const cleanTeacherId = String(
    teacherId || ''
  ).trim()

  if (!cleanTeacherId) {
    throw new Error(
      'Öğretmen kimliği bulunamadı.'
    )
  }

  const { data, error } = await supabase.rpc(
    'delete_teacher_safely',
    {
      p_teacher_id: cleanTeacherId
    }
  )

  if (error) {
    if (error.code === '22023' || error.code === 'P0002') {
      const blockedError = new Error(error.message)
      blockedError.isBlocked = true
      throw blockedError
    }

    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error(
        'Öğretmen silme özelliği için veritabanı güncellemesi (20261009_teacher_safe_delete.sql) henüz çalıştırılmamış.'
      )
    }

    throw new Error(
      getTeacherErrorMessage(
        error,
        `Öğretmen silinemedi: ${error.message}`
      )
    )
  }

  const deleteResult =
    Array.isArray(data) ? data[0] : data

  /*
   * Fotoğraf ve CV dosyaları kişisel veridir; kayıt silindikten
   * sonra depodan da kaldırılır. Dosya silinemezse kayıt
   * silinmiş sayılır, yalnız konsola yazılır.
   */
  const removals = [
    [PHOTO_BUCKET, deleteResult?.photo_path],
    [CV_BUCKET, deleteResult?.cv_file_path]
  ].filter(([, path]) => path)

  await Promise.all(
    removals.map(async ([bucket, path]) => {
      const { error: removeError } = await supabase
        .storage
        .from(bucket)
        .remove([path])

      if (removeError) {
        console.error(
          `${bucket} dosyası silinemedi:`,
          removeError
        )
      }

      signedUrlCache.delete(`${bucket}:${path}`)
    })
  )

  return deleteResult?.result || 'deleted'
}

async function insertTeacherSpecialties(
  teacherId,
  specialtyIds
) {
  const cleanTeacherId = String(
    teacherId || ''
  ).trim()

  const cleanSpecialtyIds = [
    ...new Set(
      (specialtyIds || [])
        .map((specialtyId) =>
          String(
            specialtyId || ''
          ).trim()
        )
        .filter(Boolean)
    )
  ]

  if (
    !cleanTeacherId ||
    cleanSpecialtyIds.length === 0
  ) {
    return
  }

  const relationRows =
    cleanSpecialtyIds.map(
      (specialtyId) => ({
        teacher_id:
          cleanTeacherId,
        specialty_id:
          specialtyId
      })
    )

  const { error } = await supabase
    .from('teacher_specialties')
    .insert(relationRows)

  if (error) {
    throw new Error(
      getTeacherErrorMessage(
        error,
        'Öğretmen uzmanlıkları kaydedilemedi.'
      )
    )
  }
}

async function replaceTeacherSpecialties(
  teacherId,
  specialtyIds
) {
  const cleanTeacherId = String(
    teacherId || ''
  ).trim()

  if (!cleanTeacherId) {
    throw new Error(
      'Öğretmen kimliği bulunamadı.'
    )
  }

  const cleanSpecialtyIds = [
    ...new Set(
      (specialtyIds || [])
        .map((specialtyId) =>
          String(
            specialtyId || ''
          ).trim()
        )
        .filter(Boolean)
    )
  ]

  const {
    error: deleteError
  } = await supabase
    .from('teacher_specialties')
    .delete()
    .eq(
      'teacher_id',
      cleanTeacherId
    )

  if (deleteError) {
    throw new Error(
      getTeacherErrorMessage(
        deleteError,
        'Öğretmen uzmanlıkları güncellenemedi.'
      )
    )
  }

  if (
    cleanSpecialtyIds.length === 0
  ) {
    return
  }

  const relationRows =
    cleanSpecialtyIds.map(
      (specialtyId) => ({
        teacher_id:
          cleanTeacherId,

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
      getTeacherErrorMessage(
        insertError,
        'Öğretmen uzmanlıkları kaydedilemedi.'
      )
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
      getTeacherErrorMessage(
        error,
        'Öğretmen eklenemedi.'
      )
    )
  }

  const teacherId =
    data.id

  let uploadedPhotoPath = ''
  let uploadedCvPath = ''

  try {
    /*
     * Fotoğraf ve CV birbirinden bağımsız Storage yüklemeleridir.
     * İkisi de varsa aynı anda başlatılır; biri diğerini beklemez.
     */
    const [
      photoPath,
      cvPath
    ] = await Promise.all([
      form.photoFile
        ? uploadTeacherFile({
            bucket:
              PHOTO_BUCKET,
            teacherId,
            prefix:
              'profile',
            file:
              form.photoFile
          })
        : Promise.resolve(''),

      form.cvFile
        ? uploadTeacherFile({
            bucket:
              CV_BUCKET,
            teacherId,
            prefix:
              'cv',
            file:
              form.cvFile
          })
        : Promise.resolve('')
    ])

    uploadedPhotoPath =
      photoPath || ''

    uploadedCvPath =
      cvPath || ''

    /*
     * Dosya yoksa gereksiz teachers UPDATE sorgusu gönderme.
     */
    if (
      uploadedPhotoPath ||
      uploadedCvPath
    ) {
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
          getTeacherErrorMessage(
            filePathError,
            'Dosya bilgileri kaydedilemedi.'
          )
        )
      }
    }

    /*
     * Yeni öğretmende henüz specialty ilişkisi olmadığı için
     * önce DELETE atmaya gerek yok; doğrudan INSERT yeterli.
     */
    await insertTeacherSpecialties(
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

    const {
      error: rollbackError
    } = await supabase
      .from('teachers')
      .delete()
      .eq(
        'id',
        teacherId
      )

    if (rollbackError) {
      console.error(
        'Başarısız öğretmen kaydı geri alınamadı:',
        rollbackError
      )
    }

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
  const cleanTeacherId = String(
    teacherId || ''
  ).trim()

  if (!cleanTeacherId) {
    throw new Error(
      'Öğretmen kimliği bulunamadı.'
    )
  }

  const {
    teacherRow,
    specialtyIds
  } = normalizeTeacherForm(form)

  const oldPhotoPath = String(
    form.photoPath || ''
  ).trim()

  const oldCvPath = String(
    form.cvFilePath || ''
  ).trim()

  let uploadedPhotoPath = ''
  let uploadedCvPath = ''

  try {
    if (form.photoFile) {
      uploadedPhotoPath =
        await uploadTeacherFile({
          bucket:
            PHOTO_BUCKET,

          teacherId:
            cleanTeacherId,

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

          teacherId:
            cleanTeacherId,

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
        cleanTeacherId
      )

    if (error) {
      throw new Error(
        getTeacherErrorMessage(
          error,
          'Öğretmen güncellenemedi.'
        )
      )
    }

    await replaceTeacherSpecialties(
      cleanTeacherId,
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
    cleanTeacherId
  )
}

export async function setTeacherPassive(
  teacherId,
  passiveReason,
  passiveDate
) {
  const cleanTeacherId = String(
    teacherId || ''
  ).trim()

  const cleanReason = String(
    passiveReason ?? ''
  ).trim()

  const cleanPassiveDate =
    normalizeDateKey(
      passiveDate,
      'Pasife alma tarihi',
      {
        required: true
      }
    )

  if (!cleanTeacherId) {
    throw new Error(
      'Öğretmen kimliği bulunamadı.'
    )
  }

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
        cleanPassiveDate,

      passive_reason:
        cleanReason
    })
    .eq(
      'id',
      cleanTeacherId
    )

  if (error) {
    throw new Error(
      getTeacherErrorMessage(
        error,
        'Öğretmen pasife alınamadı.'
      )
    )
  }

  return getTeacherById(
    cleanTeacherId
  )
}

export async function reactivateTeacher(
  teacherId,
  reactivatedAt
) {
  const cleanTeacherId = String(
    teacherId || ''
  ).trim()

  const cleanReactivatedAt =
    normalizeDateKey(
      reactivatedAt,
      'Aktifleştirme tarihi',
      {
        required: true
      }
    )

  if (!cleanTeacherId) {
    throw new Error(
      'Öğretmen kimliği bulunamadı.'
    )
  }

  const { error } = await supabase
    .from('teachers')
    .update({
      is_active:
        true,

      status:
        'Aktif',

      reactivated_at:
        cleanReactivatedAt,

      passive_date:
        null,

      passive_reason:
        null
    })
    .eq(
      'id',
      cleanTeacherId
    )

  if (error) {
    throw new Error(
      getTeacherErrorMessage(
        error,
        'Öğretmen aktifleştirilemedi.'
      )
    )
  }

  return getTeacherById(
    cleanTeacherId
  )
}