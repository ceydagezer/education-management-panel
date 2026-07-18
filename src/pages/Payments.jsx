import { useRef, useState } from 'react'
import RequiredStar from '../components/RequiredStar'
import '../styles/students.css'

const formatPrice = (value) =>
  Number(value || 0).toLocaleString('tr-TR', {
    maximumFractionDigits: 2
  })

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('tr-TR')
}

const createStudentPackageId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `student-package-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`
}

const ARCHIVE_AFTER_MONTHS = 6
const RETENTION_REVIEW_YEARS = 2

const getDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

const addMonthsToDate = (dateValue, monthCount) => {
  if (!dateValue) return ''

  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`)

  if (Number.isNaN(date.getTime())) return ''

  const originalDay = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + monthCount)

  const lastDayOfTargetMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  ).getDate()

  date.setDate(Math.min(originalDay, lastDayOfTargetMonth))

  return getDateKey(date)
}

const addYearsToDate = (dateValue, yearCount) =>
  addMonthsToDate(dateValue, yearCount * 12)

function Students({
  students = [],
  setStudents,
  lessonPlans = [],
  packages = [],
  teachers = [],
  payments = [],
  setLessonPlans,
  setPayments,
  unsavedChanges,
  onUnsavedChangesChange,
  requestUnsavedAction
}) {
  const [studentView, setStudentView] = useState('list')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [editingSection, setEditingSection] = useState(null)
  const [editForm, setEditForm] = useState(null)

  const emptyStudentForm = {
    tcNo: '',
    fullName: '',
    gender: '',
    birthDate: '',
    registerDate: '',
    phone: '',
    email: '',
    address: '',
    motherName: '',
    motherPhone: '',
    fatherName: '',
    fatherPhone: '',
    packageIds: [],
    enrolledPackages: [],
    lessonPlans: [],
    notes: '',
    isActive: true,
    status: 'Aktif',
    passiveDate: '',
    passiveReason: '',
    isArchived: false,
    archivedAt: '',
    archiveReason: '',
    retentionReviewDate: '',
    retentionStatus: 'Aktif Kayıt',
    isAnonymized: false,
    anonymizedAt: '',
    reactivatedAt: ''
  }

  const emptyPackageDraft = {
    packageId: '',
    teacherId: '',
    agreedPrice: '',
    firstPaymentDate: '',
    nextPaymentDate: ''
  }

  const [studentForm, setStudentForm] = useState(emptyStudentForm)
  const [packageDraft, setPackageDraft] = useState(emptyPackageDraft)
  const [editPackageDraft, setEditPackageDraft] =
    useState(emptyPackageDraft)

  /*
   * Yeni öğrenci formundaki paket düzenleme kimliği ile
   * kayıtlı öğrencinin paket düzenleme kimliği birbirinden ayrıldı.
   * Böylece bir öğrenciye birden fazla paket eklenebilir ve
   * yalnızca seçilen paket satırı güncellenebilir.
   */
  const [packageEditingId, setPackageEditingId] = useState(null)
  const [editPackageEditingId, setEditPackageEditingId] =
    useState(null)

  /*
   * Paket formu başlangıçta kapalıdır.
   * Kullanıcı yalnızca "Düzenle" veya "+ Yeni Paket Ekle"
   * butonuna bastığında ilgili form açılır.
   */
  const [packageEditorOpen, setPackageEditorOpen] =
    useState(false)
  const [editPackageEditorOpen, setEditPackageEditorOpen] =
    useState(false)

  const [statusFilter, setStatusFilter] = useState('active')
  const [isCreatingPdf, setIsCreatingPdf] = useState(false)

  /*
   * ÖĞRENCİ EKRANI KAYDEDİLMEMİŞ DEĞİŞİKLİK TAKİBİ
   *
   * Aynı ekranda birbirinden bağımsız dört taslak bulunabilir:
   * - Yeni öğrenci formu
   * - Yeni öğrenci formundaki paket düzenleyici
   * - Kayıtlı öğrenci detay düzenlemesi
   * - Detay ekranındaki paket düzenleyici
   *
   * Ref kullanıldığı için ardışık işlemlerde eski state değeriyle
   * yanlış uyarı üretme riski oluşmaz.
   */
  const dirtyFlagsRef = useRef({
    studentForm: false,
    packageDraft: false,
    editForm: false,
    editPackageDraft: false
  })

  const publishUnsavedState = (dirtyFlags) => {
    const hasUnsavedChanges =
      Object.values(dirtyFlags).some(Boolean)

    if (hasUnsavedChanges) {
      if (unsavedChanges?.markDirty) {
        unsavedChanges.markDirty()
      } else if (
        typeof onUnsavedChangesChange === 'function'
      ) {
        onUnsavedChangesChange(true)
      }

      return
    }

    if (unsavedChanges?.markClean) {
      unsavedChanges.markClean()
    } else if (
      typeof onUnsavedChangesChange === 'function'
    ) {
      onUnsavedChangesChange(false)
    }
  }

  const updateDirtyFlags = (updates) => {
    const nextFlags = {
      ...dirtyFlagsRef.current,
      ...updates
    }

    dirtyFlagsRef.current = nextFlags
    publishUnsavedState(nextFlags)
  }

  const clearAllDirtyFlags = () => {
    const cleanFlags = {
      studentForm: false,
      packageDraft: false,
      editForm: false,
      editPackageDraft: false
    }

    dirtyFlagsRef.current = cleanFlags
    publishUnsavedState(cleanFlags)
  }

  const getUnsavedActionRequester = () =>
    unsavedChanges?.requestAction ||
    requestUnsavedAction

  /*
   * Sayfa veya ana görünüm değişikliği bütün öğrenci taslaklarını
   * etkileyebileceği için tüm dirty bilgileri temizlenir.
   */
  const runProtectedPageAction = (action) => {
    const hasUnsavedChanges =
      Object.values(dirtyFlagsRef.current).some(Boolean)

    if (!hasUnsavedChanges) {
      action()
      return
    }

    const requestAction =
      getUnsavedActionRequester()

    if (typeof requestAction === 'function') {
      requestAction(() => {
        clearAllDirtyFlags()
        action()
      })
      return
    }

    action()
  }

  /*
   * Yalnızca belirtilen alt taslakları kapatır.
   * Örneğin paket formu kapatıldığında ana öğrenci formunda
   * yapılmış değişiklikler kaybolmadığı için dirty kalmaya devam eder.
   */
  const runProtectedDraftAction = (
    draftKeys,
    action
  ) => {
    const keys = Array.isArray(draftKeys)
      ? draftKeys
      : [draftKeys]

    const hasTargetDraftChanges = keys.some(
      (key) => dirtyFlagsRef.current[key]
    )

    if (!hasTargetDraftChanges) {
      action()
      return
    }

    const requestAction =
      getUnsavedActionRequester()

    const discardTargetDrafts = () => {
      const updates = {}

      keys.forEach((key) => {
        updates[key] = false
      })

      updateDirtyFlags(updates)
      action()
    }

    if (typeof requestAction === 'function') {
      requestAction(discardTargetDrafts)
      return
    }

    discardTargetDrafts()
  }

  const normalizeStatusText = (value) =>
    String(value || '')
      .trim()
      .toLocaleLowerCase('tr-TR')

  const activeTeachers = teachers.filter(
    (teacher) =>
      teacher.isActive !== false &&
      normalizeStatusText(teacher.status) !== 'pasif'
  )

  const getTeacherName = (teacher) =>
    teacher?.fullName || teacher?.name || ''

  const getTodayKey = () => getDateKey(new Date())

  const isStudentAnonymized = (student) =>
    student?.isAnonymized === true ||
    normalizeStatusText(student?.retentionStatus) ===
      'anonimleştirildi'

  const isArchivedStudent = (student) =>
    student?.isArchived === true ||
    normalizeStatusText(student?.status) === 'arşiv'

  const isStudentActive = (student) =>
    student?.isActive !== false &&
    normalizeStatusText(student?.status) !== 'pasif' &&
    !isArchivedStudent(student)

  const isStudentPassive = (student) =>
    !isStudentActive(student) && !isArchivedStudent(student)

  const getPassiveDate = (student) => {
    if (student?.passiveDate) {
      return student.passiveDate
    }

    /*
     * Eski sürümde archivedAt alanı pasife alma tarihi olarak
     * kullanılıyordu. Bu kontrol eski kayıtları bozmadan taşır.
     */
    if (
      normalizeStatusText(student?.status) === 'pasif' &&
      !student?.isArchived
    ) {
      return student?.archivedAt || ''
    }

    return ''
  }

  const getRetentionReviewDate = (student) => {
    if (student?.retentionReviewDate) {
      return student.retentionReviewDate
    }

    if (student?.archivedAt && isArchivedStudent(student)) {
      return addYearsToDate(
        student.archivedAt,
        RETENTION_REVIEW_YEARS
      )
    }

    return ''
  }

  const isArchiveEligible = (student) => {
    if (!isStudentPassive(student)) return false

    const passiveDate = getPassiveDate(student)

    if (!passiveDate) return false

    const eligibilityDate = addMonthsToDate(
      passiveDate,
      ARCHIVE_AFTER_MONTHS
    )

    return (
      eligibilityDate !== '' &&
      eligibilityDate <= getTodayKey()
    )
  }

  const isRetentionReviewDue = (student) => {
    if (
      !isArchivedStudent(student) ||
      isStudentAnonymized(student)
    ) {
      return false
    }

    const reviewDate = getRetentionReviewDate(student)

    return (
      reviewDate !== '' &&
      reviewDate <= getTodayKey()
    )
  }

  const getStudentStatusLabel = (student) => {
    if (isStudentAnonymized(student)) {
      return 'Anonim'
    }

    if (isRetentionReviewDue(student)) {
      return 'İnceleme'
    }

    if (isArchivedStudent(student)) {
      return 'Arşiv'
    }

    if (isStudentPassive(student)) {
      return 'Pasif'
    }

    return 'Aktif'
  }

  const getStudentStatusClass = (student) => {
    if (isStudentAnonymized(student)) {
      return 'anonymized'
    }

    if (isRetentionReviewDue(student)) {
      return 'review'
    }

    if (isArchivedStudent(student)) {
      return 'archived'
    }

    if (isStudentPassive(student)) {
      return 'passive'
    }

    return 'active'
  }

  const getStudentLessons = (student) =>
    lessonPlans.filter(
      (lesson) =>
        String(lesson.studentId) === String(student.id) ||
        normalizeStatusText(lesson.studentName) ===
          normalizeStatusText(student.fullName)
    )

  const getStudentPayments = (student) =>
    payments.filter(
      (payment) =>
        String(payment.studentId) === String(student.id) ||
        normalizeStatusText(payment.studentName) ===
          normalizeStatusText(student.fullName)
    )

  const getDeletionBlockers = (student) => {
    const blockers = []
    const packageCount =
      normalizeStudentPackages(student).length
    const lessonCount =
      getStudentLessons(student).length
    const paymentCount =
      getStudentPayments(student).length

    if (packageCount > 0) {
      blockers.push(`${packageCount} paket kaydı`)
    }

    if (lessonCount > 0) {
      blockers.push(`${lessonCount} ders kaydı`)
    }

    if (paymentCount > 0) {
      blockers.push(`${paymentCount} tahsilat kaydı`)
    }

    return blockers
  }

  const canPermanentlyDeleteStudent = (student) =>
    getDeletionBlockers(student).length === 0

  const activeStudentCount =
    students.filter(isStudentActive).length

  const passiveStudentCount =
    students.filter(isStudentPassive).length

  const archivedStudentCount =
    students.filter(isArchivedStudent).length

  const reviewStudentCount =
    students.filter(isRetentionReviewDue).length

  const filteredStudents = students.filter((student) => {
    if (statusFilter === 'active') {
      return isStudentActive(student)
    }

    if (statusFilter === 'passive') {
      return isStudentPassive(student)
    }

    if (statusFilter === 'archived') {
      return (
        isArchivedStudent(student) &&
        !isRetentionReviewDue(student)
      )
    }

    if (statusFilter === 'review') {
      return isRetentionReviewDue(student)
    }

    return true
  })

  const isPackageActive = (item) =>
    item?.isActive !== false &&
    normalizeStatusText(item?.status) !== 'sonlandırıldı' &&
    normalizeStatusText(item?.status) !== 'pasif'

  const normalizeStudentPackages = (student) => {
    if (
      Array.isArray(student?.enrolledPackages) &&
      student.enrolledPackages.length > 0
    ) {
      return student.enrolledPackages.map((item, index) => {
        const teacherName =
          item.defaultTeacherName ||
          item.teacherName ||
          (typeof item.teacher === 'string'
            ? item.teacher
            : getTeacherName(item.teacher))

        const firstPaymentDate =
          item.firstPaymentDate ||
          item.nextPaymentDate ||
          item.dueDate ||
          ''

        const nextPaymentDate =
          item.nextPaymentDate ||
          firstPaymentDate

        const status =
          item.status ||
          (item.isActive === false ? 'Sonlandırıldı' : 'Aktif')

        const active =
          item.isActive !== false &&
          normalizeStatusText(status) !== 'sonlandırıldı' &&
          normalizeStatusText(status) !== 'pasif'

        return {
          ...item,
          studentPackageId: String(
            item.studentPackageId ||
              item.enrollmentId ||
              item.assignmentId ||
              `${student.id || 'student'}-${item.packageId || item.id}-${index}`
          ),
          packageId: item.packageId ?? item.id ?? '',
          packageName: item.packageName || item.name || 'Tanımsız Paket',
          instrument: item.instrument || item.branch || '',
          lessonDuration: item.lessonDuration || item.duration || '',
          lessonCount: Number(item.lessonCount || 0),
          monthlyFee: Number(
            item.agreedPrice ??
              item.monthlyFee ??
              item.totalPrice ??
              item.packagePrice ??
              0
          ),
          agreedPrice: Number(
            item.agreedPrice ??
              item.monthlyFee ??
              item.totalPrice ??
              item.packagePrice ??
              0
          ),
          teacherId:
            item.defaultTeacherId ||
            item.teacherId ||
            item.teacher?.id ||
            '',
          defaultTeacherId:
            item.defaultTeacherId ||
            item.teacherId ||
            item.teacher?.id ||
            '',
          teacherName,
          defaultTeacherName: teacherName,
          teacher: teacherName,
          paymentPeriod: item.paymentPeriod || 'Aylık',
          paymentDay:
            item.paymentDay ||
            (firstPaymentDate
              ? Number(String(firstPaymentDate).slice(8, 10))
              : ''),
          firstPaymentDate,
          nextPaymentDate,
          status: active ? 'Aktif' : 'Sonlandırıldı',
          isActive: active,
          endedAt: item.endedAt || '',
          endReason: item.endReason || ''
        }
      })
    }

    if (student?.packageId) {
      const teacherName =
        student.defaultTeacherName ||
        student.teacherName ||
        (typeof student.teacher === 'string'
          ? student.teacher
          : getTeacherName(student.teacher))

      const firstPaymentDate =
        student.firstPaymentDate ||
        student.nextPaymentDate ||
        ''

      const nextPaymentDate =
        student.nextPaymentDate ||
        firstPaymentDate

      return [
        {
          studentPackageId: String(
            student.studentPackageId ||
              `${student.id}-${student.packageId}`
          ),
          packageId: student.packageId,
          packageName: student.packageName || 'Tanımsız Paket',
          instrument: student.instrument || '',
          lessonDuration: student.lessonDuration || '',
          lessonCount: Number(student.lessonCount || 0),
          monthlyFee: Number(
            student.agreedPrice ?? student.monthlyFee ?? 0
          ),
          agreedPrice: Number(
            student.agreedPrice ?? student.monthlyFee ?? 0
          ),
          teacherId:
            student.defaultTeacherId ||
            student.teacherId ||
            '',
          defaultTeacherId:
            student.defaultTeacherId ||
            student.teacherId ||
            '',
          teacherName,
          defaultTeacherName: teacherName,
          teacher: teacherName,
          paymentPeriod: student.paymentPeriod || 'Aylık',
          paymentDay:
            student.paymentDay ||
            (firstPaymentDate
              ? Number(String(firstPaymentDate).slice(8, 10))
              : ''),
          firstPaymentDate,
          nextPaymentDate,
          status: 'Aktif',
          isActive: true,
          endedAt: '',
          endReason: ''
        }
      ]
    }

    return []
  }

  const getActiveStudentPackages = (student) =>
    normalizeStudentPackages(student).filter(isPackageActive)

  const getPackageIds = (items) =>
    items
      .filter(isPackageActive)
      .map((item) => item.packageId)

  const syncLegacyFields = (studentData, enrolledPackages) => {
    const firstPackage =
      enrolledPackages.find(isPackageActive) ||
      enrolledPackages[0]

    return {
      ...studentData,
      enrolledPackages,
      packageIds: getPackageIds(enrolledPackages),
      packageId: firstPackage?.packageId || '',
      packageName: firstPackage?.packageName || '',
      instrument: firstPackage?.instrument || '',
      lessonDuration: firstPackage?.lessonDuration || '',
      lessonCount: firstPackage?.lessonCount || '',
      monthlyFee: firstPackage?.monthlyFee || '',
      agreedPrice: firstPackage?.agreedPrice || '',
      teacherId: firstPackage?.teacherId || '',
      defaultTeacherId: firstPackage?.defaultTeacherId || '',
      teacherName: firstPackage?.teacherName || '',
      defaultTeacherName: firstPackage?.defaultTeacherName || '',
      teacher: firstPackage?.teacher || '',
      paymentDay: firstPackage?.paymentDay || '',
      firstPaymentDate: firstPackage?.firstPaymentDate || '',
      nextPaymentDate: firstPackage?.nextPaymentDate || ''
    }
  }

  const getPackageSummary = (
    packageItem,
    teacher,
    draft,
    existingItem = null
  ) => {
    const teacherName = getTeacherName(teacher)
    const firstPaymentDate = draft.firstPaymentDate
    const nextPaymentDate =
      draft.nextPaymentDate || firstPaymentDate
    const agreedPrice = Number(
      draft.agreedPrice || packageItem.totalPrice || 0
    )

    return {
      ...(existingItem || {}),
      studentPackageId:
        existingItem?.studentPackageId ||
        createStudentPackageId(),
      packageId: packageItem.id,
      packageName: packageItem.name,
      instrument: packageItem.instrument,
      lessonDuration:
        packageItem.duration ||
        packageItem.lessonDuration ||
        '',
      lessonCount: Number(packageItem.lessonCount || 0),
      monthlyFee: agreedPrice,
      agreedPrice,
      teacherId: teacher.id,
      defaultTeacherId: teacher.id,
      teacherName,
      defaultTeacherName: teacherName,
      teacher: teacherName,
      paymentPeriod: existingItem?.paymentPeriod || 'Aylık',
      paymentDay: Number(String(firstPaymentDate).slice(8, 10)),
      firstPaymentDate,
      nextPaymentDate,
      status: existingItem?.status || 'Aktif',
      isActive: existingItem
        ? isPackageActive(existingItem)
        : true,
      endedAt: existingItem?.endedAt || '',
      endReason: existingItem?.endReason || ''
    }
  }

  const getPackagesText = (student) => {
    const activeItems = getActiveStudentPackages(student)
    const items = activeItems.length
      ? activeItems
      : normalizeStudentPackages(student)

    return items.length
      ? items.map((item) => item.packageName).join(', ')
      : '-'
  }

  /*
   * Ana öğrenci listesinde uzun paket adları yerine
   * yalnızca öğrencinin eğitim aldığı enstrümanlar gösterilir.
   * Paket ayrıntıları öğrenci detay ekranında korunur.
   */
  const getInstrumentsText = (student) => {
    const activeItems = getActiveStudentPackages(student)
    const items = activeItems.length
      ? activeItems
      : normalizeStudentPackages(student)

    const instruments = [
      ...new Set(
        items
          .map((item) => item.instrument)
          .filter(Boolean)
      )
    ]

    return instruments.length
      ? instruments.join(', ')
      : '-'
  }

  const getTeachersText = (student) => {
    const activeItems = getActiveStudentPackages(student)
    const items = activeItems.length
      ? activeItems
      : normalizeStudentPackages(student)

    const names = [
      ...new Set(
        items
          .map(
            (item) =>
              item.defaultTeacherName ||
              item.teacherName ||
              item.teacher
          )
          .filter(Boolean)
      )
    ]

    return names.length ? names.join(', ') : '-'
  }

  const getTotalFee = (student) =>
    getActiveStudentPackages(student).reduce(
      (total, item) =>
        total + Number(item.agreedPrice || item.monthlyFee || 0),
      0
    )

  const getNearestPaymentDate = (student) => {
    const dates = getActiveStudentPackages(student)
      .map((item) => item.nextPaymentDate)
      .filter(Boolean)
      .sort()

    return dates[0] || ''
  }

  const handleStudentChange = (event) => {
    const { name, value } = event.target

    updateDirtyFlags({
      studentForm: true
    })

    setStudentForm((current) => ({
      ...current,
      [name]: value
    }))
  }

  const handleEditChange = (event) => {
    const { name, value } = event.target

    updateDirtyFlags({
      editForm: true
    })

    setEditForm((current) => ({
      ...current,
      [name]: value
    }))
  }

  const getPackageById = (packageId) =>
    packages.find(
      (item) => String(item.id) === String(packageId)
    )

  const getTeacherById = (teacherId) =>
    teachers.find(
      (item) => String(item.id) === String(teacherId)
    )

  const updatePackageDraftField = (
    setDraft,
    fieldName,
    value
  ) => {
    updateDirtyFlags({
      [setDraft === setEditPackageDraft
        ? 'editPackageDraft'
        : 'packageDraft']: true
    })

    setDraft((current) => {
      if (fieldName === 'packageId') {
        const selectedPackage = getPackageById(value)

        return {
          ...current,
          packageId: value,
          agreedPrice: selectedPackage
            ? String(
                selectedPackage.totalPrice ??
                  selectedPackage.monthlyFee ??
                  ''
              )
            : ''
        }
      }

      if (fieldName === 'firstPaymentDate') {
        const shouldMoveNextPayment =
          !current.nextPaymentDate ||
          current.nextPaymentDate === current.firstPaymentDate

        return {
          ...current,
          firstPaymentDate: value,
          nextPaymentDate: shouldMoveNextPayment
            ? value
            : current.nextPaymentDate
        }
      }

      return {
        ...current,
        [fieldName]: value
      }
    })
  }

  const validatePackageDraft = (draft) => {
    if (!draft.packageId) {
      alert('Paket seçiniz.')
      return false
    }

    if (!draft.teacherId) {
      alert('Bu paket için varsayılan öğretmen seçiniz.')
      return false
    }

    if (
      draft.agreedPrice === '' ||
      Number(draft.agreedPrice) <= 0
    ) {
      alert('Geçerli bir paket ücreti giriniz.')
      return false
    }

    if (!draft.firstPaymentDate) {
      alert('İlk ödeme tarihini seçiniz.')
      return false
    }

    if (!draft.nextPaymentDate) {
      alert('Sonraki ödeme tarihini seçiniz.')
      return false
    }

    return true
  }

  const savePackageToForm = ({
    draft,
    target,
    setTarget,
    resetDraft,
    editingId,
    setEditingId,
    setEditorOpen
  }) => {
    if (!validatePackageDraft(draft)) return

    const selectedPackage = getPackageById(draft.packageId)
    const selectedTeacher = getTeacherById(draft.teacherId)

    if (!selectedPackage || !selectedTeacher) {
      alert('Paket veya öğretmen kaydı bulunamadı.')
      return
    }

    const currentPackages = normalizeStudentPackages(target)
    const currentEditingItem = editingId
      ? currentPackages.find(
          (item) =>
            String(item.studentPackageId) ===
            String(editingId)
        )
      : null

    const duplicateActivePackage = currentPackages.some(
      (item) =>
        String(item.studentPackageId) !== String(editingId) &&
        String(item.packageId) === String(selectedPackage.id) &&
        isPackageActive(item)
    )

    if (duplicateActivePackage) {
      alert(
        'Bu paket öğrenciye aktif olarak zaten tanımlanmış. Mevcut satırı düzenleyebilir veya sonlandırdıktan sonra yeni kayıt oluşturabilirsiniz.'
      )
      return
    }

    const packageRecord = getPackageSummary(
      selectedPackage,
      selectedTeacher,
      draft,
      currentEditingItem
    )

    const updatedPackages = currentEditingItem
      ? currentPackages.map((item) =>
          String(item.studentPackageId) === String(editingId)
            ? packageRecord
            : item
        )
      : [...currentPackages, packageRecord]

    setTarget((current) =>
      syncLegacyFields(current, updatedPackages)
    )

    if (setTarget === setEditForm) {
      updateDirtyFlags({
        editForm: true,
        editPackageDraft: false
      })
    } else {
      updateDirtyFlags({
        studentForm: true,
        packageDraft: false
      })
    }

    resetDraft(emptyPackageDraft)
    setEditingId(null)
    setEditorOpen(false)
  }

  const getPackageDraftKey = (setDraft) =>
    setDraft === setEditPackageDraft
      ? 'editPackageDraft'
      : 'packageDraft'

  const performStartPackageEdit = (
    item,
    setDraft,
    setEditingId,
    setEditorOpen
  ) => {
    setDraft({
      packageId: String(item.packageId || ''),
      teacherId: String(
        item.defaultTeacherId ||
          item.teacherId ||
          ''
      ),
      agreedPrice: String(
        item.agreedPrice ??
          item.monthlyFee ??
          ''
      ),
      firstPaymentDate: item.firstPaymentDate || '',
      nextPaymentDate:
        item.nextPaymentDate ||
        item.firstPaymentDate ||
        ''
    })

    setEditingId(item.studentPackageId)
    setEditorOpen(true)

    updateDirtyFlags({
      [getPackageDraftKey(setDraft)]: false
    })
  }

  const startPackageEdit = (
    item,
    setDraft,
    setEditingId,
    setEditorOpen
  ) => {
    runProtectedDraftAction(
      getPackageDraftKey(setDraft),
      () =>
        performStartPackageEdit(
          item,
          setDraft,
          setEditingId,
          setEditorOpen
        )
    )
  }

  const performOpenNewPackageEditor = (
    resetDraft,
    setEditingId,
    setEditorOpen
  ) => {
    resetDraft(emptyPackageDraft)
    setEditingId(null)
    setEditorOpen(true)

    updateDirtyFlags({
      [getPackageDraftKey(resetDraft)]: false
    })
  }

  const openNewPackageEditor = (
    resetDraft,
    setEditingId,
    setEditorOpen
  ) => {
    runProtectedDraftAction(
      getPackageDraftKey(resetDraft),
      () =>
        performOpenNewPackageEditor(
          resetDraft,
          setEditingId,
          setEditorOpen
        )
    )
  }

  const performCancelPackageEdit = (
    resetDraft,
    setEditingId,
    setEditorOpen
  ) => {
    resetDraft(emptyPackageDraft)
    setEditingId(null)
    setEditorOpen(false)

    updateDirtyFlags({
      [getPackageDraftKey(resetDraft)]: false
    })
  }

  const cancelPackageEdit = (
    resetDraft,
    setEditingId,
    setEditorOpen
  ) => {
    runProtectedDraftAction(
      getPackageDraftKey(resetDraft),
      () =>
        performCancelPackageEdit(
          resetDraft,
          setEditingId,
          setEditorOpen
        )
    )
  }

  /*
   * Bu işlem yalnızca henüz kaydedilmemiş yeni öğrenci formunda kullanılır.
   * Kayıtlı öğrencilerde geçmiş bağlantıları korumak için paket silinmez,
   * sonlandırılır.
   */
  const removeUnsavedPackageFromForm = (
    target,
    setTarget,
    studentPackageId
  ) => {
    const isConfirmed = window.confirm(
      'Bu paket henüz öğrenci kaydı oluşturulmadan kaldırılacak. Devam etmek istiyor musunuz?'
    )

    if (!isConfirmed) return

    const updatedPackages = normalizeStudentPackages(target).filter(
      (item) =>
        String(item.studentPackageId) !==
        String(studentPackageId)
    )

    setTarget((current) =>
      syncLegacyFields(current, updatedPackages)
    )

    updateDirtyFlags({
      studentForm: true
    })

    if (
      String(packageEditingId) ===
      String(studentPackageId)
    ) {
      performCancelPackageEdit(
        setPackageDraft,
        setPackageEditingId,
        setPackageEditorOpen
      )
    }
  }

  const togglePackageStatusInForm = (
    target,
    setTarget,
    studentPackageId
  ) => {
    const currentPackages = normalizeStudentPackages(target)
    const selectedPackage = currentPackages.find(
      (item) =>
        String(item.studentPackageId) ===
        String(studentPackageId)
    )

    if (!selectedPackage) return

    if (isPackageActive(selectedPackage)) {
      const reason = window.prompt(
        `${selectedPackage.packageName} paketini sonlandırma nedenini yazınız:`,
        'Paket tamamlandı'
      )

      if (reason === null) return

      const updatedPackages = currentPackages.map((item) =>
        String(item.studentPackageId) ===
        String(studentPackageId)
          ? {
              ...item,
              isActive: false,
              status: 'Sonlandırıldı',
              endedAt: getTodayKey(),
              endReason:
                reason.trim() || 'Belirtilmedi'
            }
          : item
      )

      setTarget((current) =>
        syncLegacyFields(current, updatedPackages)
      )

      updateDirtyFlags({
        editForm: true
      })

      if (
        String(editPackageEditingId) ===
        String(studentPackageId)
      ) {
        performCancelPackageEdit(
          setEditPackageDraft,
          setEditPackageEditingId,
          setEditPackageEditorOpen
        )
      }

      return
    }

    const duplicateActivePackage = currentPackages.some(
      (item) =>
        String(item.studentPackageId) !==
          String(studentPackageId) &&
        String(item.packageId) ===
          String(selectedPackage.packageId) &&
        isPackageActive(item)
    )

    if (duplicateActivePackage) {
      alert(
        'Aynı paket için başka bir aktif kayıt bulunduğundan bu kayıt yeniden aktifleştirilemez.'
      )
      return
    }

    const confirmActivation = window.confirm(
      `${selectedPackage.packageName} paketini yeniden aktifleştirmek istiyor musunuz?`
    )

    if (!confirmActivation) return

    const updatedPackages = currentPackages.map((item) =>
      String(item.studentPackageId) ===
      String(studentPackageId)
        ? {
            ...item,
            isActive: true,
            status: 'Aktif',
            endedAt: '',
            endReason: ''
          }
        : item
    )

    setTarget((current) =>
      syncLegacyFields(current, updatedPackages)
    )

    updateDirtyFlags({
      editForm: true
    })
  }

  const validateStudentData = (data, requirePaymentDates = true) => {
    const enrolledPackages = normalizeStudentPackages(data)
    const activePackages =
      enrolledPackages.filter(isPackageActive)

    if (!String(data.tcNo || '').trim()) {
      alert('TC Kimlik No zorunludur.')
      return false
    }

    if (!/^[0-9]{11}$/.test(String(data.tcNo).trim())) {
      alert('TC Kimlik No 11 haneli olmalıdır.')
      return false
    }

    if (!String(data.fullName || '').trim()) {
      alert('Ad soyad zorunludur.')
      return false
    }

    if (!String(data.registerDate || '').trim()) {
      alert('Kayıt tarihi zorunludur.')
      return false
    }

    if (!String(data.phone || '').trim()) {
      alert('Cep telefonu zorunludur.')
      return false
    }

    if (!enrolledPackages.length) {
      alert('En az bir paket eklemelisiniz.')
      return false
    }

    if (
      isStudentActive(data) &&
      !activePackages.length
    ) {
      alert('Aktif öğrencinin en az bir aktif paketi bulunmalıdır.')
      return false
    }

    if (
      activePackages.some(
        (item) =>
          !item.teacherId &&
          !String(item.teacherName || item.teacher || '').trim()
      )
    ) {
      alert('Her paket için öğretmen seçilmelidir.')
      return false
    }

    if (
      requirePaymentDates &&
      activePackages.some((item) => !item.nextPaymentDate)
    ) {
      alert('Her paket için ödeme tarihi seçilmelidir.')
      return false
    }

    return true
  }

  const handleStudentSubmit = (event) => {
    event.preventDefault()

    if (!validateStudentData(studentForm, true)) return

    const newStudent = syncLegacyFields(
      {
        id: Date.now(),
        ...studentForm,
        tcNo: studentForm.tcNo.trim(),
        fullName: studentForm.fullName.trim(),
        registerDate: studentForm.registerDate.trim(),
        phone: studentForm.phone.trim(),
        lessonPlans: [],
        isActive: true,
        status: 'Aktif',
        passiveDate: '',
        passiveReason: '',
        isArchived: false,
        archivedAt: '',
        archiveReason: '',
        retentionReviewDate: '',
        retentionStatus: 'Aktif Kayıt',
        isAnonymized: false,
        anonymizedAt: '',
        reactivatedAt: ''
      },
      normalizeStudentPackages(studentForm)
    )

    setStudents((current) => [...current, newStudent])
    setStudentForm(emptyStudentForm)
    setPackageDraft(emptyPackageDraft)
    setPackageEditingId(null)
    setPackageEditorOpen(false)
    clearAllDirtyFlags()
    setStudentView('list')
  }

  const performShowStudentDetail = (student) => {
    const normalizedStudent = syncLegacyFields(
      student,
      normalizeStudentPackages(student)
    )

    clearAllDirtyFlags()
    setSelectedStudent(normalizedStudent)
    setEditForm({ ...normalizedStudent })
    setEditingSection(null)
    setEditPackageDraft(emptyPackageDraft)
    setEditPackageEditingId(null)
    setEditPackageEditorOpen(false)
    setStudentView('detail')
  }

  const showStudentDetail = (student) => {
    runProtectedPageAction(() =>
      performShowStudentDetail(student)
    )
  }

  const performStartEditSection = (sectionName) => {
    setEditingSection(sectionName)
    setEditForm({
      ...selectedStudent,
      enrolledPackages:
        normalizeStudentPackages(selectedStudent)
    })

    setEditPackageDraft(emptyPackageDraft)
    setEditPackageEditingId(null)
    setEditPackageEditorOpen(false)

    updateDirtyFlags({
      editForm: false,
      editPackageDraft: false
    })
  }

  const startEditSection = (sectionName) => {
    if (editingSection === sectionName) {
      return
    }

    runProtectedDraftAction(
      ['editForm', 'editPackageDraft'],
      () => performStartEditSection(sectionName)
    )
  }

  const performCancelEdit = () => {
    setEditingSection(null)
    setEditForm({ ...selectedStudent })
    setEditPackageDraft(emptyPackageDraft)
    setEditPackageEditingId(null)
    setEditPackageEditorOpen(false)

    updateDirtyFlags({
      editForm: false,
      editPackageDraft: false
    })
  }

  const cancelEdit = () => {
    runProtectedDraftAction(
      ['editForm', 'editPackageDraft'],
      performCancelEdit
    )
  }

  const saveEdit = () => {
    if (
      !validateStudentData(
        editForm,
        editingSection === 'education'
      )
    ) {
      return
    }

    const updatedStudent = syncLegacyFields(
      {
        ...editForm,
        tcNo: String(editForm.tcNo || '').trim(),
        fullName: String(editForm.fullName || '').trim(),
        registerDate: String(editForm.registerDate || '').trim(),
        phone: String(editForm.phone || '').trim()
      },
      normalizeStudentPackages(editForm)
    )

    setStudents((current) =>
      current.map((student) =>
        student.id === selectedStudent.id ? updatedStudent : student
      )
    )

    setSelectedStudent(updatedStudent)
    setEditForm(updatedStudent)
    setEditingSection(null)
    setEditPackageDraft(emptyPackageDraft)
    setEditPackageEditingId(null)
    setEditPackageEditorOpen(false)

    updateDirtyFlags({
      editForm: false,
      editPackageDraft: false
    })
  }


  const returnToStudentList = () => {
    runProtectedPageAction(() => {
      setStudentForm(emptyStudentForm)
      setPackageDraft(emptyPackageDraft)
      setPackageEditingId(null)
      setPackageEditorOpen(false)
      setSelectedStudent(null)
      setEditForm(null)
      setEditingSection(null)
      setEditPackageDraft(emptyPackageDraft)
      setEditPackageEditingId(null)
      setEditPackageEditorOpen(false)
      clearAllDirtyFlags()
      setStudentView('list')
    })
  }

  const openNewStudentForm = () => {
    runProtectedPageAction(() => {
      setStudentForm(emptyStudentForm)
      setPackageDraft(emptyPackageDraft)
      setPackageEditingId(null)
      setPackageEditorOpen(false)
      clearAllDirtyFlags()
      setStudentView('form')
    })
  }

  const runAfterDiscardingDetailDraft = (action) => {
    runProtectedDraftAction(
      ['editForm', 'editPackageDraft'],
      () => {
        performCancelEdit()
        action()
      }
    )
  }

  const updateSelectedStudentState = (updatedStudent) => {
    setSelectedStudent(updatedStudent)
    setEditForm({ ...updatedStudent })
  }

  const saveStudentLifecycleUpdate = (updatedStudent) => {
    setStudents((current) =>
      current.map((student) =>
        student.id === updatedStudent.id
          ? updatedStudent
          : student
      )
    )

    updateSelectedStudentState(updatedStudent)
    setEditingSection(null)
  }

  const handleToggleStudentStatus = () => {
    if (!selectedStudent) return

    if (isStudentActive(selectedStudent)) {
      const reason = window.prompt(
        'Öğrenciyi pasife alma nedenini yazınız:',
        'Geçici olarak ara verdi'
      )

      if (reason === null) return

      const updatedStudent = {
        ...selectedStudent,
        isActive: false,
        status: 'Pasif',
        passiveDate: getTodayKey(),
        passiveReason:
          reason.trim() || 'Belirtilmedi',
        isArchived: false,
        archivedAt: '',
        archiveReason: '',
        retentionReviewDate: '',
        retentionStatus:
          'Saklama Süresi Devam Ediyor'
      }

      saveStudentLifecycleUpdate(updatedStudent)
      return
    }

    const confirmActivation = window.confirm(
      `${selectedStudent.fullName} adlı öğrenciyi yeniden aktifleştirmek istediğinize emin misiniz?`
    )

    if (!confirmActivation) return

    const updatedStudent = {
      ...selectedStudent,
      isActive: true,
      status: 'Aktif',
      isArchived: false,
      retentionStatus: 'Aktif Kayıt',
      reactivatedAt: getTodayKey()
    }

    saveStudentLifecycleUpdate(updatedStudent)
  }

  const handleArchiveStudent = () => {
    if (!selectedStudent) return

    if (!isStudentPassive(selectedStudent)) {
      alert(
        'Yalnızca pasif öğrenciler arşive taşınabilir.'
      )
      return
    }

    if (!isArchiveEligible(selectedStudent)) {
      const passiveDate = getPassiveDate(
        selectedStudent
      )
      const eligibilityDate = passiveDate
        ? addMonthsToDate(
            passiveDate,
            ARCHIVE_AFTER_MONTHS
          )
        : ''

      alert(
        eligibilityDate
          ? `Bu kayıt ${formatDate(
              eligibilityDate
            )} tarihinde arşivlenmeye uygun olacaktır.`
          : 'Pasife alma tarihi bulunmadığı için arşiv uygunluğu hesaplanamadı.'
      )
      return
    }

    const confirmArchive = window.confirm(
      `${selectedStudent.fullName} adlı öğrenciyi arşive taşımak istediğinize emin misiniz? Geçmiş ders ve tahsilat kayıtları korunacaktır.`
    )

    if (!confirmArchive) return

    const archivedAt = getTodayKey()

    const updatedStudent = {
      ...selectedStudent,
      isActive: false,
      status: 'Arşiv',
      isArchived: true,
      archivedAt,
      archiveReason:
        selectedStudent.passiveReason ||
        selectedStudent.archiveReason ||
        'Pasif öğrenci arşive taşındı',
      retentionReviewDate: addYearsToDate(
        archivedAt,
        RETENTION_REVIEW_YEARS
      ),
      retentionStatus:
        'Saklama Süresi Devam Ediyor'
    }

    saveStudentLifecycleUpdate(updatedStudent)
  }

  const handleExtendRetention = () => {
    if (!selectedStudent) return

    const currentReviewDate =
      getRetentionReviewDate(selectedStudent)

    const baseDate =
      currentReviewDate &&
      currentReviewDate > getTodayKey()
        ? currentReviewDate
        : getTodayKey()

    const newReviewDate =
      addYearsToDate(baseDate, 1)

    const confirmExtend = window.confirm(
      `Bu kaydın saklama inceleme tarihini ${formatDate(
        newReviewDate
      )} tarihine ertelemek istiyor musunuz?`
    )

    if (!confirmExtend) return

    saveStudentLifecycleUpdate({
      ...selectedStudent,
      retentionReviewDate: newReviewDate,
      retentionStatus: 'Saklamaya Devam'
    })
  }

  const handleAnonymizeStudent = () => {
    if (!selectedStudent) return

    if (!isArchivedStudent(selectedStudent)) {
      alert(
        'Anonimleştirme yalnızca arşiv kayıtlarında yapılabilir.'
      )
      return
    }

    if (!isRetentionReviewDue(selectedStudent)) {
      alert(
        'Bu kaydın saklama inceleme tarihi henüz gelmedi.'
      )
      return
    }

    const anonymousName = `Anonim Öğrenci #${selectedStudent.id}`

    const confirmAnonymize = window.confirm(
      `${selectedStudent.fullName} adlı öğrencinin kişisel bilgileri anonimleştirilecek. Ders ve finans geçmişi isimsiz olarak korunacaktır. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?`
    )

    if (!confirmAnonymize) return

    const updatedStudent = {
      ...selectedStudent,
      tcNo: '',
      fullName: anonymousName,
      gender: '',
      birthDate: '',
      phone: '',
      email: '',
      address: '',
      motherName: '',
      motherPhone: '',
      fatherName: '',
      fatherPhone: '',
      notes: '',
      isActive: false,
      status: 'Arşiv',
      isArchived: true,
      isAnonymized: true,
      anonymizedAt: getTodayKey(),
      retentionStatus: 'Anonimleştirildi'
    }

    setStudents((current) =>
      current.map((student) =>
        student.id === selectedStudent.id
          ? updatedStudent
          : student
      )
    )

    if (typeof setLessonPlans === 'function') {
      setLessonPlans((current) =>
        current.map((lesson) =>
          String(lesson.studentId) ===
          String(selectedStudent.id)
            ? {
                ...lesson,
                studentName: anonymousName
              }
            : lesson
        )
      )
    }

    if (typeof setPayments === 'function') {
      setPayments((current) =>
        current.map((payment) =>
          String(payment.studentId) ===
          String(selectedStudent.id)
            ? {
                ...payment,
                studentName: anonymousName
              }
            : payment
        )
      )
    }

    updateSelectedStudentState(updatedStudent)
    setEditingSection(null)
  }

  const handlePermanentDelete = () => {
    if (!selectedStudent) return

    const blockers =
      getDeletionBlockers(selectedStudent)

    if (blockers.length > 0) {
      alert(
        `Bu öğrenci kalıcı olarak silinemez. Bağlı kayıtlar: ${blockers.join(
          ', '
        )}. Öğrenciyi pasife alabilir, arşivleyebilir veya inceleme tarihi geldiğinde anonimleştirebilirsiniz.`
      )
      return
    }

    const confirmDelete = window.confirm(
      `${selectedStudent.fullName} adlı öğrenci kalıcı olarak silinecek. Bu işlem yalnızca bağlantısız hatalı/test kayıtları için kullanılmalıdır ve geri alınamaz. Devam etmek istiyor musunuz?`
    )

    if (!confirmDelete) return

    setStudents((current) =>
      current.filter(
        (student) =>
          student.id !== selectedStudent.id
      )
    )

    setSelectedStudent(null)
    setEditForm(null)
    setEditingSection(null)
    clearAllDirtyFlags()
    setStudentView('list')
  }

  const getPdfPaymentAmount = (payment) =>
    Number(
      payment?.amount ??
        payment?.transactionAmount ??
        payment?.paidAmount ??
        0
    )

  const getPdfPaymentDate = (payment) =>
    payment?.paymentDate ||
    payment?.collectionDate ||
    payment?.date ||
    ''

  const getPdfPaymentPeriod = (payment) => {
    const period =
      payment?.paymentPeriod ||
      payment?.period ||
      payment?.dueDate ||
      getPdfPaymentDate(payment)

    const periodKey = String(period || '').slice(0, 7)

    if (!/^\d{4}-\d{2}$/.test(periodKey)) {
      return '-'
    }

    const [year, month] = periodKey.split('-').map(Number)

    return new Date(year, month - 1, 1).toLocaleDateString(
      'tr-TR',
      {
        month: 'long',
        year: 'numeric'
      }
    )
  }

  const getPdfFileName = (student) => {
    const safeName = String(student?.fullName || 'ogrenci')
      .toLocaleLowerCase('tr-TR')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ş/g, 's')
      .replace(/ü/g, 'u')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    return `${safeName || 'ogrenci'}-bilgi-formu-${getTodayKey()}.pdf`
  }

  const handleCreateStudentPdf = async () => {
    if (!selectedStudent || isCreatingPdf) return

    if (editingSection) {
      alert(
        'PDF oluşturmadan önce açık düzenleme bölümündeki değişiklikleri kaydedin veya iptal edin.'
      )
      return
    }

    setIsCreatingPdf(true)

    try {
      const [pdfMakeModule, pdfFontsModule] = await Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts')
      ])

      const pdfMake =
        pdfMakeModule.default || pdfMakeModule

      const pdfFontFiles =
        pdfFontsModule?.pdfMake?.vfs ||
        pdfFontsModule?.default?.pdfMake?.vfs ||
        pdfFontsModule?.default?.vfs ||
        pdfFontsModule?.vfs ||
        pdfFontsModule?.default

      if (!pdfFontFiles) {
        throw new Error('PDF yazı tipleri yüklenemedi.')
      }

      pdfMake.vfs = pdfFontFiles
      pdfMake.fonts = {
        Roboto: {
          normal: 'Roboto-Regular.ttf',
          bold: 'Roboto-Medium.ttf',
          italics: 'Roboto-Italic.ttf',
          bolditalics: 'Roboto-MediumItalic.ttf'
        }
      }

      const student = selectedStudent
      const studentPackages =
        normalizeStudentPackages(student)
      const studentPayments = getStudentPayments(student)
        .slice()
        .sort((first, second) =>
          String(getPdfPaymentDate(second)).localeCompare(
            String(getPdfPaymentDate(first))
          )
        )
      const studentLessons = getStudentLessons(student)
        .slice()
        .sort((first, second) => {
          const firstText = `${first.day || ''} ${first.time || ''}`
          const secondText = `${second.day || ''} ${second.time || ''}`
          return firstText.localeCompare(secondText, 'tr')
        })

      const totalCollected = studentPayments.reduce(
        (total, payment) =>
          total + getPdfPaymentAmount(payment),
        0
      )

      const activePackageCount = studentPackages.filter(
        isPackageActive
      ).length

      const generatedAt = new Date().toLocaleString(
        'tr-TR',
        {
          dateStyle: 'long',
          timeStyle: 'short'
        }
      )

      const valueOrDash = (value) =>
        String(value || '').trim() || '-'

      const infoCell = (label, value) => ({
        stack: [
          {
            text: label,
            style: 'fieldLabel'
          },
          {
            text: valueOrDash(value),
            style: 'fieldValue'
          }
        ],
        fillColor: '#F8FAFC',
        margin: [9, 8, 9, 8]
      })

      const sectionTitle = (title) => ({
        table: {
          widths: [5, '*'],
          body: [
            [
              {
                text: '',
                fillColor: '#14B8A6',
                border: [false, false, false, false]
              },
              {
                text: title,
                style: 'sectionTitle',
                fillColor: '#ECFEFF',
                margin: [9, 7, 9, 7],
                border: [false, false, false, false]
              }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 14, 0, 7]
      })

      const packageRows = studentPackages.map((item) => [
        {
          stack: [
            {
              text: valueOrDash(item.packageName),
              bold: true,
              color: '#0F172A'
            },
            {
              text: [
                item.instrument || 'Ders bilgisi yok',
                item.lessonCount
                  ? ` - ${item.lessonCount} ders`
                  : '',
                item.lessonDuration
                  ? ` - ${item.lessonDuration} dk`
                  : ''
              ].join(''),
              color: '#64748B',
              fontSize: 8,
              margin: [0, 3, 0, 0]
            }
          ]
        },
        valueOrDash(
          item.defaultTeacherName ||
            item.teacherName ||
            item.teacher
        ),
        `₺${formatPrice(
          item.agreedPrice || item.monthlyFee
        )}`,
        formatDate(item.firstPaymentDate),
        formatDate(item.nextPaymentDate),
        {
          text: isPackageActive(item)
            ? 'Aktif'
            : 'Sonlandırıldı',
          bold: true,
          color: isPackageActive(item)
            ? '#15803D'
            : '#B45309',
          fillColor: isPackageActive(item)
            ? '#DCFCE7'
            : '#FEF3C7',
          alignment: 'center',
          margin: [3, 3, 3, 3]
        }
      ])

      const paymentRows = studentPayments.map((payment) => [
        formatDate(getPdfPaymentDate(payment)),
        valueOrDash(payment.packageName),
        getPdfPaymentPeriod(payment),
        valueOrDash(payment.paymentMethod),
        valueOrDash(payment.referenceNumber),
        {
          text: `₺${formatPrice(
            getPdfPaymentAmount(payment)
          )}`,
          alignment: 'right',
          bold: true
        }
      ])

      const lessonRows = studentLessons.map((lesson) => [
        valueOrDash(lesson.day),
        valueOrDash(lesson.time),
        valueOrDash(
          lesson.packageName || lesson.instrument
        ),
        valueOrDash(
          lesson.teacherName || lesson.teacher
        ),
        valueOrDash(
          lesson.duration
            ? `${lesson.duration} dk`
            : ''
        )
      ])

      const documentDefinition = {
        pageSize: 'A4',
        pageMargins: [36, 82, 36, 52],
        info: {
          title: `${student.fullName} - Öğrenci Bilgi Formu`,
          author: 'Artı Akademi - Bilim Sanat',
          subject: 'Öğrenci bilgi, paket ve tahsilat özeti',
          keywords: 'öğrenci, paket, ödeme, ders'
        },
        header: () => ({
          margin: [36, 22, 36, 0],
          stack: [
            {
              columns: [
                {
                  width: '*',
                  stack: [
                    {
                      text: 'ARTI AKADEMİ',
                      color: '#0F172A',
                      bold: true,
                      fontSize: 15,
                      characterSpacing: 0.7
                    },
                    {
                      text: 'BİLİM SANAT ÖĞRENCİ YÖNETİM SİSTEMİ',
                      color: '#64748B',
                      fontSize: 7.5,
                      characterSpacing: 0.6,
                      margin: [0, 2, 0, 0]
                    }
                  ]
                },
                {
                  width: 'auto',
                  stack: [
                    {
                      text: 'ÖĞRENCİ BİLGİ FORMU',
                      color: '#0F766E',
                      bold: true,
                      alignment: 'right',
                      fontSize: 10
                    },
                    {
                      text: `Belge tarihi: ${formatDate(
                        getTodayKey()
                      )}`,
                      color: '#64748B',
                      alignment: 'right',
                      fontSize: 8,
                      margin: [0, 3, 0, 0]
                    }
                  ]
                }
              ]
            },
            {
              canvas: [
                {
                  type: 'line',
                  x1: 0,
                  y1: 9,
                  x2: 523,
                  y2: 9,
                  lineWidth: 2,
                  lineColor: '#14B8A6'
                }
              ]
            }
          ]
        }),
        footer: (currentPage, pageCount) => ({
          margin: [36, 0, 36, 18],
          columns: [
            {
              text: 'Bu belge kişisel veri içerir. Yetkisiz kişilerle paylaşılmamalıdır.',
              color: '#94A3B8',
              fontSize: 7.5
            },
            {
              text: `Sayfa ${currentPage} / ${pageCount}`,
              color: '#64748B',
              fontSize: 8,
              alignment: 'right'
            }
          ]
        }),
        content: [
          {
            table: {
              widths: ['*', 112],
              body: [
                [
                  {
                    stack: [
                      {
                        text: valueOrDash(student.fullName),
                        fontSize: 20,
                        bold: true,
                        color: '#0F172A'
                      },
                      {
                        text: `Kayıt No: ${valueOrDash(
                          student.id
                        )}`,
                        color: '#64748B',
                        fontSize: 8.5,
                        margin: [0, 5, 0, 0]
                      }
                    ],
                    margin: [14, 13, 14, 13]
                  },
                  {
                    stack: [
                      {
                        text: 'KAYIT DURUMU',
                        color: '#64748B',
                        fontSize: 7.5,
                        bold: true,
                        alignment: 'center'
                      },
                      {
                        text: getStudentStatusLabel(student),
                        color: isStudentActive(student)
                          ? '#15803D'
                          : '#B45309',
                        bold: true,
                        fontSize: 11,
                        alignment: 'center',
                        margin: [0, 6, 0, 0]
                      }
                    ],
                    fillColor: isStudentActive(student)
                      ? '#F0FDF4'
                      : '#FFFBEB',
                    margin: [10, 12, 10, 12]
                  }
                ]
              ]
            },
            layout: {
              hLineColor: () => '#DDE7EF',
              vLineColor: () => '#DDE7EF',
              hLineWidth: () => 0.7,
              vLineWidth: () => 0.7
            },
            margin: [0, 0, 0, 4]
          },

          sectionTitle('Öğrenci Bilgileri'),
          {
            table: {
              widths: ['*', '*'],
              body: [
                [
                  infoCell('TC Kimlik No', student.tcNo),
                  infoCell('Ad Soyad', student.fullName)
                ],
                [
                  infoCell(
                    'Doğum Tarihi',
                    formatDate(student.birthDate)
                  ),
                  infoCell('Cinsiyet', student.gender)
                ],
                [
                  infoCell(
                    'Kayıt Tarihi',
                    formatDate(student.registerDate)
                  ),
                  infoCell('Cep Telefonu', student.phone)
                ],
                [
                  infoCell('E-posta', student.email),
                  infoCell(
                    'En Yakın Ödeme Tarihi',
                    formatDate(
                      getNearestPaymentDate(student)
                    )
                  )
                ],
                [
                  {
                    ...infoCell('Adres', student.address),
                    colSpan: 2
                  },
                  {}
                ]
              ]
            },
            layout: {
              hLineColor: () => '#E2E8F0',
              vLineColor: () => '#E2E8F0',
              hLineWidth: () => 0.6,
              vLineWidth: () => 0.6
            }
          },

          sectionTitle('Veli Bilgileri'),
          {
            table: {
              widths: ['*', '*'],
              body: [
                [
                  infoCell('Anne Adı', student.motherName),
                  infoCell(
                    'Anne Telefonu',
                    student.motherPhone
                  )
                ],
                [
                  infoCell('Baba Adı', student.fatherName),
                  infoCell(
                    'Baba Telefonu',
                    student.fatherPhone
                  )
                ]
              ]
            },
            layout: {
              hLineColor: () => '#E2E8F0',
              vLineColor: () => '#E2E8F0',
              hLineWidth: () => 0.6,
              vLineWidth: () => 0.6
            }
          },

          sectionTitle('Paket ve Ödeme Özeti'),
          {
            columns: [
              {
                width: '*',
                stack: [
                  {
                    text: 'Aktif Paket',
                    style: 'summaryLabel'
                  },
                  {
                    text: `${activePackageCount}`,
                    style: 'summaryValue'
                  }
                ],
                fillColor: '#F0FDFA',
                margin: [11, 9, 11, 9]
              },
              { width: 8, text: '' },
              {
                width: '*',
                stack: [
                  {
                    text: 'Aylık Toplam Ücret',
                    style: 'summaryLabel'
                  },
                  {
                    text: `₺${formatPrice(
                      getTotalFee(student)
                    )}`,
                    style: 'summaryValue'
                  }
                ],
                fillColor: '#F0F9FF',
                margin: [11, 9, 11, 9]
              },
              { width: 8, text: '' },
              {
                width: '*',
                stack: [
                  {
                    text: 'Toplam Tahsilat',
                    style: 'summaryLabel'
                  },
                  {
                    text: `₺${formatPrice(totalCollected)}`,
                    style: 'summaryValue'
                  }
                ],
                fillColor: '#F0FDF4',
                margin: [11, 9, 11, 9]
              }
            ],
            margin: [0, 0, 0, 9]
          },

          studentPackages.length
            ? {
                table: {
                  headerRows: 1,
                  dontBreakRows: true,
                  widths: [130, 86, 58, 60, 60, 56],
                  body: [
                    [
                      'Paket',
                      'Öğretmen',
                      'Ücret',
                      'İlk Ödeme',
                      'Sonraki',
                      'Durum'
                    ].map((text) => ({
                      text,
                      style: 'tableHeader'
                    })),
                    ...packageRows
                  ]
                },
                layout: {
                  fillColor: (rowIndex) =>
                    rowIndex > 0 && rowIndex % 2 === 0
                      ? '#F8FAFC'
                      : null,
                  hLineColor: () => '#DDE7EF',
                  vLineColor: () => '#DDE7EF',
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                  paddingLeft: () => 6,
                  paddingRight: () => 6,
                  paddingTop: () => 6,
                  paddingBottom: () => 6
                }
              }
            : {
                text: 'Öğrenciye tanımlanmış paket bulunmamaktadır.',
                style: 'emptyText'
              },

          sectionTitle('Tahsilat Geçmişi'),
          studentPayments.length
            ? {
                table: {
                  headerRows: 1,
                  dontBreakRows: true,
                  widths: [60, 112, 74, 68, 72, 66],
                  body: [
                    [
                      'Tarih',
                      'Paket',
                      'Dönem',
                      'Yöntem',
                      'Dekont No',
                      'Tutar'
                    ].map((text) => ({
                      text,
                      style: 'tableHeader'
                    })),
                    ...paymentRows
                  ]
                },
                layout: {
                  fillColor: (rowIndex) =>
                    rowIndex > 0 && rowIndex % 2 === 0
                      ? '#F8FAFC'
                      : null,
                  hLineColor: () => '#DDE7EF',
                  vLineColor: () => '#DDE7EF',
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                  paddingLeft: () => 5,
                  paddingRight: () => 5,
                  paddingTop: () => 6,
                  paddingBottom: () => 6
                }
              }
            : {
                text: 'Bu öğrenci için tahsilat kaydı bulunmamaktadır.',
                style: 'emptyText'
              },

          sectionTitle('Haftalık Ders Planı'),
          studentLessons.length
            ? {
                table: {
                  headerRows: 1,
                  dontBreakRows: true,
                  widths: [62, 48, 136, 132, 60],
                  body: [
                    [
                      'Gün',
                      'Saat',
                      'Paket / Ders',
                      'Öğretmen',
                      'Süre'
                    ].map((text) => ({
                      text,
                      style: 'tableHeader'
                    })),
                    ...lessonRows
                  ]
                },
                layout: {
                  fillColor: (rowIndex) =>
                    rowIndex > 0 && rowIndex % 2 === 0
                      ? '#F8FAFC'
                      : null,
                  hLineColor: () => '#DDE7EF',
                  vLineColor: () => '#DDE7EF',
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                  paddingLeft: () => 6,
                  paddingRight: () => 6,
                  paddingTop: () => 6,
                  paddingBottom: () => 6
                }
              }
            : {
                text: 'Bu öğrenci için haftalık ders planı bulunmamaktadır.',
                style: 'emptyText'
              },

          sectionTitle('Notlar ve Belge Bilgisi'),
          {
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    stack: [
                      {
                        text: 'Öğrenci Notları',
                        style: 'fieldLabel'
                      },
                      {
                        text: valueOrDash(student.notes),
                        style: 'fieldValue',
                        margin: [0, 4, 0, 0]
                      }
                    ],
                    fillColor: '#F8FAFC',
                    margin: [10, 9, 10, 9]
                  }
                ],
                [
                  {
                    text: `Bu belge, sistemde kayıtlı bilgiler esas alınarak ${generatedAt} tarihinde otomatik olarak oluşturulmuştur.`,
                    color: '#64748B',
                    fontSize: 8,
                    italics: true,
                    margin: [10, 8, 10, 8]
                  }
                ]
              ]
            },
            layout: {
              hLineColor: () => '#E2E8F0',
              vLineColor: () => '#E2E8F0',
              hLineWidth: () => 0.6,
              vLineWidth: () => 0.6
            }
          }
        ],
        defaultStyle: {
          font: 'Roboto',
          fontSize: 8.5,
          color: '#334155',
          lineHeight: 1.18
        },
        styles: {
          sectionTitle: {
            bold: true,
            fontSize: 11,
            color: '#0F766E'
          },
          fieldLabel: {
            bold: true,
            fontSize: 7.5,
            color: '#64748B'
          },
          fieldValue: {
            fontSize: 9,
            color: '#0F172A',
            margin: [0, 3, 0, 0]
          },
          tableHeader: {
            bold: true,
            fontSize: 7.5,
            color: '#334155',
            fillColor: '#EAF0F6',
            alignment: 'left'
          },
          summaryLabel: {
            bold: true,
            fontSize: 7.5,
            color: '#64748B'
          },
          summaryValue: {
            bold: true,
            fontSize: 13,
            color: '#0F172A',
            margin: [0, 5, 0, 0]
          },
          emptyText: {
            color: '#64748B',
            fontSize: 8.5,
            italics: true,
            fillColor: '#F8FAFC',
            margin: [9, 8, 9, 8]
          }
        }
      }

      pdfMake
        .createPdf(documentDefinition)
        .download(getPdfFileName(student))
    } catch (error) {
      console.error('Öğrenci PDF oluşturma hatası:', error)
      alert(
        'PDF oluşturulamadı. pdfmake paketinin kurulu olduğundan emin olun ve tekrar deneyin.'
      )
    } finally {
      setIsCreatingPdf(false)
    }
  }

  const exportStudentsToExcel = () => {
    const headers = [
      'Ad Soyad',
      'Paketler',
      'Öğretmenler',
      'Aylık Toplam Ücret',
      'Sonraki Ödeme Tarihi',
      'Durum',
      'Pasife Alma Tarihi',
      'Pasife Alma Nedeni',
      'Arşiv Tarihi',
      'Saklama İnceleme Tarihi',
      'Saklama Durumu',
      'Anonimleştirme Tarihi'
    ]

    const rows = students.map((student) => [
      student.fullName,
      getPackagesText(student),
      getTeachersText(student),
      getTotalFee(student),
      getNearestPaymentDate(student),
      getStudentStatusLabel(student),
      getPassiveDate(student),
      student.passiveReason ||
        student.archiveReason ||
        '',
      isArchivedStudent(student)
        ? student.archivedAt || ''
        : '',
      getRetentionReviewDate(student),
      student.retentionStatus || '',
      student.anonymizedAt || ''
    ])

    const csvContent = [
      headers.join(';'),
      ...rows.map((row) => row.join(';'))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;'
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'ogrenci-listesi.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const renderSectionButtons = (sectionName) => {
    if (
      selectedStudent &&
      isStudentAnonymized(selectedStudent)
    ) {
      return null
    }

    if (editingSection === sectionName) {
      return (
        <div className="edit-actions">
          <button
            className="cancel-button"
            type="button"
            onClick={cancelEdit}
          >
            İptal
          </button>
          <button
            className="save-button"
            type="button"
            onClick={saveEdit}
          >
            Kaydet
          </button>
        </div>
      )
    }

    return (
      <button
        className="edit-section-button"
        type="button"
        onClick={() => startEditSection(sectionName)}
      >
        ✏️ Düzenle
      </button>
    )
  }

  const renderTeacherOptions = (selectedTeacherId = '') => {
    const selectedTeacher = teachers.find(
      (teacher) =>
        String(teacher.id) === String(selectedTeacherId)
    )

    const selectedTeacherIsInactive =
      selectedTeacher &&
      !activeTeachers.some(
        (teacher) =>
          String(teacher.id) ===
          String(selectedTeacher.id)
      )

    return (
      <>
        {selectedTeacherIsInactive && (
          <option
            value={selectedTeacher.id}
            disabled
          >
            {getTeacherName(selectedTeacher)}
            {' (Pasif öğretmen)'}
          </option>
        )}

        {activeTeachers.map((teacher) => (
          <option key={teacher.id} value={teacher.id}>
            {getTeacherName(teacher)}
          </option>
        ))}
      </>
    )
  }

  const renderPackageOptions = (selectedPackageId = '') => {
    const activePackages = packages.filter(
      (item) =>
        item.isActive !== false &&
        normalizeStatusText(item.status) !== 'pasif'
    )

    const selectedPackage = packages.find(
      (item) =>
        String(item.id) === String(selectedPackageId)
    )

    const selectedPackageIsInactive =
      selectedPackage &&
      !activePackages.some(
        (item) =>
          String(item.id) ===
          String(selectedPackage.id)
      )

    return (
      <>
        {selectedPackageIsInactive && (
          <option
            value={selectedPackage.id}
            disabled
          >
            {selectedPackage.name}
            {' (Pasif paket)'}
          </option>
        )}

        {activePackages.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </>
    )
  }

  const renderPackageDraftFields = ({
    draft,
    setDraft,
    submitHandler,
    isEditing,
    cancelHandler
  }) => (
    <div className="package-editor-panel full-width">
      <div className="package-editor-header">
        <div>
          <span className="package-editor-eyebrow">
            {isEditing ? 'Paket Düzenleme' : 'Yeni Paket'}
          </span>
          <h3>
            {isEditing
              ? 'Mevcut Paketi Düzenle'
              : 'Yeni Paket Ekle'}
          </h3>
          <p>
            {isEditing
              ? 'Seçilen paketin öğretmen, ücret ve ödeme tarihi bilgilerini güncelleyin.'
              : 'Öğrenciye tanımlanacak yeni paket ve ödeme bilgilerini girin.'}
          </p>
        </div>

        <button
          type="button"
          className="package-editor-close-button"
          onClick={cancelHandler}
          aria-label="Paket formunu kapat"
        >
          ×
        </button>
      </div>

      <div className="form-grid package-editor-grid">
        <div className="form-group">
          <label>
            Paket Seçimi <RequiredStar />
          </label>
          <select
            value={draft.packageId}
            onChange={(event) =>
              updatePackageDraftField(
                setDraft,
                'packageId',
                event.target.value
              )
            }
          >
            <option value="">Paket seçiniz</option>
            {renderPackageOptions(draft.packageId)}
          </select>
        </div>

        <div className="form-group">
          <label>
            Varsayılan Paket Öğretmeni <RequiredStar />
          </label>
          <select
            value={draft.teacherId}
            onChange={(event) =>
              updatePackageDraftField(
                setDraft,
                'teacherId',
                event.target.value
              )
            }
          >
            <option value="">Öğretmen seçiniz</option>
            {renderTeacherOptions(draft.teacherId)}
          </select>
        </div>

        <div className="form-group">
          <label>
            Anlaşılan Paket Ücreti <RequiredStar />
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.agreedPrice}
            onChange={(event) =>
              updatePackageDraftField(
                setDraft,
                'agreedPrice',
                event.target.value
              )
            }
            placeholder="Paket seçilince otomatik gelir"
          />
        </div>

        <div className="form-group">
          <label>
            İlk Ödeme Tarihi <RequiredStar />
          </label>
          <input
            type="date"
            value={draft.firstPaymentDate}
            onChange={(event) =>
              updatePackageDraftField(
                setDraft,
                'firstPaymentDate',
                event.target.value
              )
            }
          />
        </div>

        <div className="form-group">
          <label>
            Sonraki Ödeme Tarihi <RequiredStar />
          </label>
          <input
            type="date"
            value={draft.nextPaymentDate}
            onChange={(event) =>
              updatePackageDraftField(
                setDraft,
                'nextPaymentDate',
                event.target.value
              )
            }
          />
        </div>

        <div className="package-teacher-info full-width">
          Buradaki öğretmen paketin varsayılan öğretmenidir.
          Yalnızca belirli bir ders için yapılacak geçici öğretmen
          değişikliği Ders Programı ekranından gerçekleştirilir.
        </div>

        <div className="package-editor-footer full-width">
          <button
            type="button"
            className="cancel-button package-edit-cancel-button"
            onClick={cancelHandler}
          >
            İptal
          </button>

          <button
            type="button"
            className="primary-button package-add-button"
            onClick={submitHandler}
          >
            {isEditing
              ? 'Değişiklikleri Kaydet'
              : 'Paketi Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )

  const renderPackageTable = (
    items,
    {
      onEdit = null,
      onRemove = null,
      onToggleStatus = null
    } = {}
  ) => {
    if (!items.length) {
      return (
        <div className="empty-detail-box">
          Henüz paket eklenmedi.
        </div>
      )
    }

    const hasActions =
      Boolean(onEdit) ||
      Boolean(onRemove) ||
      Boolean(onToggleStatus)

    return (
      <div className="payment-table-wrapper">
        <table className="lesson-table package-selection-table package-management-table">
          <thead>
            <tr>
              <th>Paket</th>
              <th>Varsayılan Öğretmen</th>
              <th>Anlaşılan Ücret</th>
              <th>İlk Ödeme</th>
              <th>Ödeme Günü</th>
              <th>Sonraki Ödeme</th>
              <th>Durum</th>
              {hasActions && <th>İşlem</th>}
            </tr>
          </thead>

          <tbody>
            {items.map((item) => {
              const active = isPackageActive(item)

              return (
                <tr
                  key={item.studentPackageId}
                  className={
                    active
                      ? 'package-row-active'
                      : 'package-row-ended'
                  }
                >
                  <td>
                    <div className="package-table-main">
                      <strong>{item.packageName}</strong>
                      <small>
                        {item.instrument || 'Ders bilgisi yok'}
                        {item.lessonCount
                          ? ` • ${item.lessonCount} ders`
                          : ''}
                      </small>
                    </div>
                  </td>

                  <td>
                    {item.defaultTeacherName ||
                      item.teacherName ||
                      item.teacher ||
                      '-'}
                  </td>

                  <td>
                    ₺{formatPrice(
                      item.agreedPrice ||
                        item.monthlyFee
                    )}
                  </td>

                  <td>
                    {formatDate(item.firstPaymentDate)}
                  </td>

                  <td>
                    {item.paymentDay
                      ? `Her ayın ${item.paymentDay}. günü`
                      : '-'}
                  </td>

                  <td>
                    {formatDate(item.nextPaymentDate)}
                  </td>

                  <td>
                    <span
                      className={`package-status-badge ${
                        active ? 'active' : 'ended'
                      }`}
                    >
                      {active
                        ? 'Aktif'
                        : 'Sonlandırıldı'}
                    </span>

                    {!active && item.endedAt && (
                      <small className="package-ended-date">
                        {formatDate(item.endedAt)}
                      </small>
                    )}
                  </td>

                  {hasActions && (
                    <td>
                      <div className="package-row-actions">
                        {onEdit && active && (
                          <button
                            className="package-edit-button"
                            type="button"
                            onClick={() => onEdit(item)}
                          >
                            Düzenle
                          </button>
                        )}

                        {onRemove && (
                          <button
                            className="delete-button"
                            type="button"
                            onClick={() =>
                              onRemove(
                                item.studentPackageId
                              )
                            }
                          >
                            Kaldır
                          </button>
                        )}

                        {onToggleStatus && (
                          <button
                            className={
                              active
                                ? 'package-end-button'
                                : 'package-reactivate-button'
                            }
                            type="button"
                            onClick={() =>
                              onToggleStatus(
                                item.studentPackageId
                              )
                            }
                          >
                            {active
                              ? 'Sonlandır'
                              : 'Aktifleştir'}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const renderStudentForm = () => (
    <div className="dashboard-shell">
      <section className="page-card">
        <div>
          <span className="page-badge">Öğrenci Kayıt</span>
          <h1>Yeni Öğrenci Ekle</h1>
          <p>Öğrenci, paket, öğretmen ve ödeme tarihi bilgilerini kaydedin.</p>
        </div>
        <button
          className="manage-button"
          type="button"
          onClick={returnToStudentList}
        >
          Listeye Dön
        </button>
      </section>

      <form onSubmit={handleStudentSubmit} className="student-form-card">
        <div className="form-section">
          <h2>Öğrenci Bilgileri</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>TC Kimlik No <RequiredStar /></label>
              <input
                name="tcNo"
                value={studentForm.tcNo}
                onChange={handleStudentChange}
                maxLength="11"
              />
            </div>
            <div className="form-group">
              <label>Ad Soyad <RequiredStar /></label>
              <input
                name="fullName"
                value={studentForm.fullName}
                onChange={handleStudentChange}
              />
            </div>
            <div className="form-group">
              <label>Cinsiyet</label>
              <select
                name="gender"
                value={studentForm.gender}
                onChange={handleStudentChange}
              >
                <option value="">Seçiniz</option>
                <option value="Kadın">Kadın</option>
                <option value="Erkek">Erkek</option>
              </select>
            </div>
            <div className="form-group">
              <label>Doğum Tarihi</label>
              <input
                type="date"
                name="birthDate"
                value={studentForm.birthDate}
                onChange={handleStudentChange}
              />
            </div>
            <div className="form-group">
              <label>Kayıt Tarihi <RequiredStar /></label>
              <input
                type="date"
                name="registerDate"
                value={studentForm.registerDate}
                onChange={handleStudentChange}
              />
            </div>
            <div className="form-group">
              <label>Cep Telefonu <RequiredStar /></label>
              <input
                name="phone"
                value={studentForm.phone}
                onChange={handleStudentChange}
              />
            </div>
            <div className="form-group">
              <label>E-posta</label>
              <input
                type="email"
                name="email"
                value={studentForm.email}
                onChange={handleStudentChange}
              />
            </div>
            <div className="form-group full-width">
              <label>Adres</label>
              <textarea
                name="address"
                value={studentForm.address}
                onChange={handleStudentChange}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Veli Bilgileri</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Anne Adı</label>
              <input
                name="motherName"
                value={studentForm.motherName}
                onChange={handleStudentChange}
              />
            </div>
            <div className="form-group">
              <label>Anne Telefonu</label>
              <input
                name="motherPhone"
                value={studentForm.motherPhone}
                onChange={handleStudentChange}
              />
            </div>
            <div className="form-group">
              <label>Baba Adı</label>
              <input
                name="fatherName"
                value={studentForm.fatherName}
                onChange={handleStudentChange}
              />
            </div>
            <div className="form-group">
              <label>Baba Telefonu</label>
              <input
                name="fatherPhone"
                value={studentForm.fatherPhone}
                onChange={handleStudentChange}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="package-section-header">
            <div>
              <h2>Paket ve Ödeme Bilgileri</h2>
              <p className="package-section-description">
                Öğrenciye paket eklemek için aşağıdaki düğmeyi kullanın.
              </p>
            </div>

            {!packageEditorOpen && (
              <div className="package-add-button-row">
                <button
                  type="button"
                  className="primary-button package-new-button"
                  onClick={() =>
                    openNewPackageEditor(
                      setPackageDraft,
                      setPackageEditingId,
                      setPackageEditorOpen
                    )
                  }
                >
                  + Paket Ekle
                </button>
              </div>
            )}
          </div>

          <div className="package-management-area">
            {packageEditorOpen &&
              renderPackageDraftFields({
                draft: packageDraft,
                setDraft: setPackageDraft,
                submitHandler: () =>
                  savePackageToForm({
                    draft: packageDraft,
                    target: studentForm,
                    setTarget: setStudentForm,
                    resetDraft: setPackageDraft,
                    editingId: packageEditingId,
                    setEditingId: setPackageEditingId,
                    setEditorOpen: setPackageEditorOpen
                  }),
                isEditing: Boolean(packageEditingId),
                cancelHandler: () =>
                  cancelPackageEdit(
                    setPackageDraft,
                    setPackageEditingId,
                    setPackageEditorOpen
                  )
              })}

            {normalizeStudentPackages(studentForm).length > 0 && (
              <div className="package-list-block">
                <div className="package-list-heading">
                  <div>
                    <h3>Kayıtlı Paketler ve Ödeme Tarihleri</h3>
                    <p>
                      Eklenen paketleri buradan düzenleyebilir veya
                      öğrenci kaydedilmeden önce kaldırabilirsiniz.
                    </p>
                  </div>

                  <span className="package-count-badge">
                    {normalizeStudentPackages(studentForm).length} paket
                  </span>
                </div>

                {renderPackageTable(
                  normalizeStudentPackages(studentForm),
                  {
                    onEdit: (item) =>
                      startPackageEdit(
                        item,
                        setPackageDraft,
                        setPackageEditingId,
                        setPackageEditorOpen
                      ),
                    onRemove: (id) =>
                      removeUnsavedPackageFromForm(
                        studentForm,
                        setStudentForm,
                        id
                      )
                  }
                )}
              </div>
            )}

            <div className="form-grid package-bottom-grid">
              {normalizeStudentPackages(studentForm).length > 0 && (
                <div className="form-group">
                  <label>Aylık Toplam Ücret</label>
                  <input
                    value={`₺${formatPrice(getTotalFee(studentForm))}`}
                    readOnly
                  />
                </div>
              )}

              <div className="form-group full-width">
                <label>Notlar</label>
                <textarea
                  name="notes"
                  value={studentForm.notes}
                  onChange={handleStudentChange}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={returnToStudentList}
          >
            İptal
          </button>
          <button type="submit" className="save-button">
            Öğrenciyi Kaydet
          </button>
        </div>
      </form>
    </div>
  )

  const renderStudentDetail = () => {
    if (!selectedStudent || !editForm) return null

    const studentLessons = lessonPlans
      .filter(
        (lesson) =>
          String(lesson.studentId) === String(selectedStudent.id) ||
          String(lesson.studentName || '')
            .trim()
            .toLocaleLowerCase('tr-TR') ===
            String(selectedStudent.fullName || '')
              .trim()
              .toLocaleLowerCase('tr-TR')
      )
      .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))

    return (
      <div className="dashboard-shell">
        <section className="page-card">
          <div>
            <div className="student-detail-title-row">
              <span className="page-badge">Öğrenci Detay</span>
              <span
                className={`student-status-badge ${getStudentStatusClass(
                  selectedStudent
                )}`}
              >
                {getStudentStatusLabel(selectedStudent)}
              </span>
            </div>
            <h1>{selectedStudent.fullName}</h1>
            <p>Öğrenci, paket, ödeme tarihi ve ders planı bilgileri.</p>
          </div>
          <div className="detail-actions student-detail-actions">
            <button
              className="manage-button"
              type="button"
              onClick={returnToStudentList}
            >
              Geri Dön
            </button>

            {!isStudentAnonymized(selectedStudent) && (
              <button
                className={`student-status-action-button ${
                  isStudentActive(selectedStudent)
                    ? 'deactivate'
                    : 'activate'
                }`}
                type="button"
                onClick={() =>
                  runAfterDiscardingDetailDraft(
                    handleToggleStudentStatus
                  )
                }
              >
                {isStudentActive(selectedStudent)
                  ? 'Pasife Al'
                  : 'Yeniden Aktifleştir'}
              </button>
            )}

            {isStudentPassive(selectedStudent) &&
              isArchiveEligible(selectedStudent) && (
                <button
                  className="student-status-action-button archive"
                  type="button"
                  onClick={() =>
                    runAfterDiscardingDetailDraft(
                      handleArchiveStudent
                    )
                  }
                >
                  Arşive Taşı
                </button>
              )}

            {isRetentionReviewDue(selectedStudent) &&
              !isStudentAnonymized(selectedStudent) && (
                <>
                  <button
                    className="student-status-action-button extend"
                    type="button"
                    onClick={() =>
                      runAfterDiscardingDetailDraft(
                        handleExtendRetention
                      )
                    }
                  >
                    Saklamayı 1 Yıl Uzat
                  </button>

                  <button
                    className="student-status-action-button anonymize"
                    type="button"
                    onClick={() =>
                      runAfterDiscardingDetailDraft(
                        handleAnonymizeStudent
                      )
                    }
                  >
                    Anonimleştir
                  </button>
                </>
              )}

            {canPermanentlyDeleteStudent(selectedStudent) && (
              <button
                className="student-permanent-delete-button"
                type="button"
                onClick={() =>
                  runAfterDiscardingDetailDraft(
                    handlePermanentDelete
                  )
                }
              >
                Kalıcı Sil
              </button>
            )}

            <button
              className="pdf-button"
              type="button"
              onClick={handleCreateStudentPdf}
              disabled={isCreatingPdf}
            >
              {isCreatingPdf
                ? 'PDF Hazırlanıyor...'
                : 'PDF Oluştur'}
            </button>
          </div>
        </section>

        {!isStudentActive(selectedStudent) && (
          <section
            className={`student-lifecycle-summary ${getStudentStatusClass(
              selectedStudent
            )}`}
          >
            <div>
              <span>
                {isStudentAnonymized(selectedStudent)
                  ? 'Anonimleştirilmiş Kayıt'
                  : isRetentionReviewDue(selectedStudent)
                  ? 'Saklama İncelemesi Bekliyor'
                  : isArchivedStudent(selectedStudent)
                  ? 'Arşiv Öğrenci Kaydı'
                  : 'Pasif Öğrenci Kaydı'}
              </span>

              <strong>
                {isStudentAnonymized(selectedStudent)
                  ? 'Kişisel bilgiler kaldırıldı; geçmiş ders ve finans bağlantıları anonim olarak korunuyor.'
                  : selectedStudent.passiveReason ||
                    selectedStudent.archiveReason ||
                    'Durum nedeni belirtilmedi.'}
              </strong>

              {isStudentPassive(selectedStudent) && (
                <small>
                  {isArchiveEligible(selectedStudent)
                    ? 'Bu kayıt arşivlenmeye uygundur.'
                    : `Arşivlenmeye uygun tarih: ${formatDate(
                        addMonthsToDate(
                          getPassiveDate(selectedStudent),
                          ARCHIVE_AFTER_MONTHS
                        )
                      )}`}
                </small>
              )}
            </div>

            <div className="student-lifecycle-dates">
              {getPassiveDate(selectedStudent) && (
                <small>
                  Pasife alma: <b>{formatDate(
                    getPassiveDate(selectedStudent)
                  )}</b>
                </small>
              )}

              {isArchivedStudent(selectedStudent) &&
                selectedStudent.archivedAt && (
                  <small>
                    Arşiv tarihi: <b>{formatDate(
                      selectedStudent.archivedAt
                    )}</b>
                  </small>
                )}

              {getRetentionReviewDate(selectedStudent) &&
                !isStudentAnonymized(selectedStudent) && (
                  <small>
                    İnceleme tarihi: <b>{formatDate(
                      getRetentionReviewDate(
                        selectedStudent
                      )
                    )}</b>
                  </small>
                )}

              {selectedStudent.anonymizedAt && (
                <small>
                  Anonimleştirme: <b>{formatDate(
                    selectedStudent.anonymizedAt
                  )}</b>
                </small>
              )}
            </div>
          </section>
        )}

        <section className="detail-card">
          <div className="detail-section">
            <div className="section-title-row">
              <h2>Öğrenci Bilgileri</h2>
              {renderSectionButtons('student')}
            </div>

            {editingSection === 'student' ? (
              <div className="form-grid">
                <div className="form-group">
                  <label>TC Kimlik No <RequiredStar /></label>
                  <input
                    name="tcNo"
                    value={editForm.tcNo}
                    onChange={handleEditChange}
                    maxLength="11"
                  />
                </div>
                <div className="form-group">
                  <label>Ad Soyad <RequiredStar /></label>
                  <input
                    name="fullName"
                    value={editForm.fullName}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="form-group">
                  <label>Kayıt Tarihi <RequiredStar /></label>
                  <input
                    type="date"
                    name="registerDate"
                    value={editForm.registerDate}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="form-group">
                  <label>Cep Telefonu <RequiredStar /></label>
                  <input
                    name="phone"
                    value={editForm.phone}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="form-group">
                  <label>E-posta</label>
                  <input
                    type="email"
                    name="email"
                    value={editForm.email}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Adres</label>
                  <textarea
                    name="address"
                    value={editForm.address}
                    onChange={handleEditChange}
                  />
                </div>
              </div>
            ) : (
              <div className="detail-grid">
                <p><strong>TC Kimlik No:</strong> {selectedStudent.tcNo || '-'}</p>
                <p><strong>Ad Soyad:</strong> {selectedStudent.fullName || '-'}</p>
                <p><strong>Kayıt Tarihi:</strong> {formatDate(selectedStudent.registerDate)}</p>
                <p><strong>Cep Telefonu:</strong> {selectedStudent.phone || '-'}</p>
                <p><strong>E-posta:</strong> {selectedStudent.email || '-'}</p>
                <p className="full-width"><strong>Adres:</strong> {selectedStudent.address || '-'}</p>
              </div>
            )}
          </div>

          <div className="detail-section">
            <div className="section-title-row">
              <h2>Veli Bilgileri</h2>
              {renderSectionButtons('parent')}
            </div>

            {editingSection === 'parent' ? (
              <div className="form-grid">
                <div className="form-group">
                  <label>Anne Adı</label>
                  <input name="motherName" value={editForm.motherName} onChange={handleEditChange} />
                </div>
                <div className="form-group">
                  <label>Anne Telefonu</label>
                  <input name="motherPhone" value={editForm.motherPhone} onChange={handleEditChange} />
                </div>
                <div className="form-group">
                  <label>Baba Adı</label>
                  <input name="fatherName" value={editForm.fatherName} onChange={handleEditChange} />
                </div>
                <div className="form-group">
                  <label>Baba Telefonu</label>
                  <input name="fatherPhone" value={editForm.fatherPhone} onChange={handleEditChange} />
                </div>
              </div>
            ) : (
              <div className="detail-grid">
                <p><strong>Anne Adı:</strong> {selectedStudent.motherName || '-'}</p>
                <p><strong>Anne Telefonu:</strong> {selectedStudent.motherPhone || '-'}</p>
                <p><strong>Baba Adı:</strong> {selectedStudent.fatherName || '-'}</p>
                <p><strong>Baba Telefonu:</strong> {selectedStudent.fatherPhone || '-'}</p>
              </div>
            )}
          </div>

          <div className="detail-section">
            <div className="section-title-row">
              <h2>Paket ve Ödeme Bilgileri</h2>
              {renderSectionButtons('education')}
            </div>

            {editingSection === 'education' ? (
              <div className="package-management-area">
                {!editPackageEditorOpen && (
                  <div className="package-inline-add-row">
                    <button
                      type="button"
                      className="primary-button package-new-button"
                      onClick={() =>
                        openNewPackageEditor(
                          setEditPackageDraft,
                          setEditPackageEditingId,
                          setEditPackageEditorOpen
                        )
                      }
                    >
                      + Paket Ekle
                    </button>
                  </div>
                )}

                {editPackageEditorOpen &&
                  renderPackageDraftFields({
                    draft: editPackageDraft,
                    setDraft: setEditPackageDraft,
                    submitHandler: () =>
                      savePackageToForm({
                        draft: editPackageDraft,
                        target: editForm,
                        setTarget: setEditForm,
                        resetDraft: setEditPackageDraft,
                        editingId: editPackageEditingId,
                        setEditingId: setEditPackageEditingId,
                        setEditorOpen: setEditPackageEditorOpen
                      }),
                    isEditing: Boolean(editPackageEditingId),
                    cancelHandler: () =>
                      cancelPackageEdit(
                        setEditPackageDraft,
                        setEditPackageEditingId,
                        setEditPackageEditorOpen
                      )
                  })}

                {normalizeStudentPackages(editForm).length > 0 && (
                  <div className="package-list-block">
                    <div className="package-list-heading">
                      <div>
                        <h3>Kayıtlı Paketler ve Ödeme Tarihleri</h3>
                        <p>
                          Düzenlemek istediğiniz paketi seçebilir,
                          sonlandırabilir veya yeniden aktifleştirebilirsiniz.
                        </p>
                      </div>

                      <span className="package-count-badge">
                        {normalizeStudentPackages(editForm).length} paket
                      </span>
                    </div>

                    {renderPackageTable(
                      normalizeStudentPackages(editForm),
                      {
                        onEdit: (item) =>
                          startPackageEdit(
                            item,
                            setEditPackageDraft,
                            setEditPackageEditingId,
                            setEditPackageEditorOpen
                          ),
                        onToggleStatus: (id) =>
                          togglePackageStatusInForm(
                            editForm,
                            setEditForm,
                            id
                          )
                      }
                    )}
                  </div>
                )}

                <div className="form-grid package-bottom-grid">
                  <div className="form-group full-width">
                    <label>Notlar</label>
                    <textarea
                      name="notes"
                      value={editForm.notes}
                      onChange={handleEditChange}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {renderPackageTable(
                  normalizeStudentPackages(selectedStudent)
                )}
                <div className="detail-grid" style={{ marginTop: '18px' }}>
                  <p><strong>Aylık Toplam Ücret:</strong> ₺{formatPrice(getTotalFee(selectedStudent))}</p>
                  <p><strong>Notlar:</strong> {selectedStudent.notes || '-'}</p>
                </div>
              </>
            )}
          </div>

          <div className="detail-section">
            <div className="lesson-plan-header">
              <h2>Ders Planları</h2>
            </div>

            {studentLessons.length ? (
              <div className="payment-table-wrapper">
                <table className="lesson-table">
                  <thead>
                    <tr>
                      <th>Gün</th>
                      <th>Saat</th>
                      <th>Paket</th>
                      <th>Ders</th>
                      <th>Öğretmen</th>
                      <th>Süre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentLessons.map((plan) => (
                      <tr key={plan.id}>
                        <td>{plan.day}</td>
                        <td>{plan.time}</td>
                        <td>{plan.packageName || '-'}</td>
                        <td>{plan.instrument || '-'}</td>
                        <td>{plan.teacherName || plan.teacher || '-'}</td>
                        <td>{plan.duration || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-detail-box">
                Bu öğrenci için henüz ders planı eklenmedi.
              </div>
            )}
          </div>
        </section>
      </div>
    )
  }

  const renderStudentList = () => (
    <div className="dashboard-shell">
      <section className="page-card">
        <div>
          <span className="page-badge">Öğrenci Yönetimi</span>
          <h1>Öğrenciler</h1>
          <p>Öğrenci kayıtlarını, paketlerini ve ödeme tarihlerini yönetin.</p>
        </div>
        <div className="student-actions">
          <button className="excel-button" type="button" onClick={exportStudentsToExcel}>
            Excel’e Aktar
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={openNewStudentForm}
          >
            + Yeni Öğrenci Ekle
          </button>
        </div>
      </section>

      <section className="student-table-card">
        <div className="table-head student-list-header">
          <div>
            <h2>Öğrenci Listesi</h2>
            <p>Kayıtlı öğrenciler ve temel bilgileri</p>
          </div>
          <button className="lesson-count" type="button">
            {filteredStudents.length} öğrenci
          </button>
        </div>

        <div className="student-status-toolbar">
          <div className="student-status-filters" role="group" aria-label="Öğrenci durum filtresi">
            <button
              type="button"
              className={`student-filter-button ${
                statusFilter === 'active' ? 'selected' : ''
              }`}
              onClick={() => setStatusFilter('active')}
            >
              Aktif
              <span>{activeStudentCount}</span>
            </button>

            <button
              type="button"
              className={`student-filter-button ${
                statusFilter === 'passive' ? 'selected' : ''
              }`}
              onClick={() => setStatusFilter('passive')}
            >
              Pasif
              <span>{passiveStudentCount}</span>
            </button>

            <button
              type="button"
              className={`student-filter-button ${
                statusFilter === 'archived' ? 'selected' : ''
              }`}
              onClick={() => setStatusFilter('archived')}
            >
              Arşiv
              <span>{archivedStudentCount - reviewStudentCount}</span>
            </button>

            <button
              type="button"
              className={`student-filter-button ${
                statusFilter === 'review' ? 'selected' : ''
              }`}
              onClick={() => setStatusFilter('review')}
            >
              İnceleme
              <span>{reviewStudentCount}</span>
            </button>

            <button
              type="button"
              className={`student-filter-button ${
                statusFilter === 'all' ? 'selected' : ''
              }`}
              onClick={() => setStatusFilter('all')}
            >
              Tümü
              <span>{students.length}</span>
            </button>
          </div>

          <p>
            Pasif kayıtlar 6 ay sonra arşivlenmeye uygun olur. Arşiv kayıtları 2 yıl sonra incelemeye düşer; sistem otomatik silme yapmaz.
          </p>
        </div>

        <div className="payment-table-wrapper">
          <table className="lesson-table">
            <thead>
              <tr>
                <th>TC Kimlik No</th>
                <th>Ad Soyad</th>
                <th>Enstrümanlar</th>
                <th>Öğretmenler</th>
                <th>Aylık Ücret</th>
                <th>Sonraki Ödeme</th>
                <th>Telefon</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length ? (
                filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td>{student.tcNo || '-'}</td>
                    <td>{student.fullName}</td>
                    <td>{getInstrumentsText(student)}</td>
                    <td>{getTeachersText(student)}</td>
                    <td>₺{formatPrice(getTotalFee(student))}</td>
                    <td>{formatDate(getNearestPaymentDate(student))}</td>
                    <td>{student.phone || '-'}</td>
                    <td>
                      <span
                        className={`student-status-badge ${getStudentStatusClass(
                          student
                        )}`}
                      >
                        {getStudentStatusLabel(student)}
                      </span>
                    </td>
                    <td>
                      <button
                        className="detail-button"
                        type="button"
                        onClick={() => showStudentDetail(student)}
                      >
                        Detay
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="empty-table">
                    Kayıtlı öğrenci bulunmamaktadır.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )

  if (studentView === 'form') return renderStudentForm()
  if (studentView === 'detail') return renderStudentDetail()
  return renderStudentList()
}

export default Students