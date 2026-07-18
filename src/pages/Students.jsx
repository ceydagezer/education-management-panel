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

  const exportStudentsToExcel = async () => {
    if (!students.length) {
      alert('Excel’e aktarılacak öğrenci bulunmamaktadır.')
      return
    }

    try {
      /*
       * ExcelJS yalnızca Excel düğmesine basıldığında yüklenir.
       * Böylece öğrenci ekranının ilk açılışı gereksiz yere
       * ağırlaşmaz.
       */
      const excelModule = await import('exceljs')
      const ExcelJS = excelModule.default || excelModule

      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Artı Akademi - Bilim Sanat'
      workbook.company = 'Artı Akademi - Bilim Sanat'
      workbook.subject = 'Öğrenci Listesi'
      workbook.created = new Date()

      const worksheet = workbook.addWorksheet(
        'Öğrenci Listesi',
        {
          properties: {
            defaultRowHeight: 20
          },
          pageSetup: {
            paperSize: 9,
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: {
              left: 0.25,
              right: 0.25,
              top: 0.5,
              bottom: 0.5,
              header: 0.2,
              footer: 0.2
            }
          }
        }
      )

      worksheet.columns = [
        { key: 'fullName', width: 24 },
        { key: 'packages', width: 34 },
        { key: 'teachers', width: 24 },
        { key: 'totalFee', width: 20 },
        { key: 'nextPaymentDate', width: 21 },
        { key: 'status', width: 14 },
        { key: 'passiveDate', width: 19 },
        { key: 'passiveReason', width: 34 },
        { key: 'archiveDate', width: 17 },
        { key: 'retentionReviewDate', width: 23 },
        { key: 'retentionStatus', width: 25 },
        { key: 'anonymizedDate', width: 22 }
      ]

      worksheet.mergeCells('A1:L1')
      const titleCell = worksheet.getCell('A1')
      titleCell.value = 'ARTI AKADEMİ - ÖĞRENCİ LİSTESİ'
      titleCell.font = {
        name: 'Calibri',
        size: 18,
        bold: true,
        color: { argb: 'FFFFFFFF' }
      }
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F766E' }
      }
      titleCell.alignment = {
        horizontal: 'left',
        vertical: 'middle'
      }
      worksheet.getRow(1).height = 34

      worksheet.mergeCells('A2:L2')
      const infoCell = worksheet.getCell('A2')
      infoCell.value =
        `Oluşturulma tarihi: ${new Date().toLocaleString('tr-TR')}  •  ` +
        `Toplam öğrenci: ${students.length}`
      infoCell.font = {
        name: 'Calibri',
        size: 10,
        italic: true,
        color: { argb: 'FF475569' }
      }
      infoCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0FDFA' }
      }
      infoCell.alignment = {
        horizontal: 'left',
        vertical: 'middle'
      }
      worksheet.getRow(2).height = 24

      const headerRow = worksheet.getRow(4)
      headerRow.values = [
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
      headerRow.height = 32

      headerRow.eachCell((cell) => {
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FFFFFFFF' }
        }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0EA5A4' }
        }
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true
        }
        cell.border = {
          top: {
            style: 'thin',
            color: { argb: 'FF0F766E' }
          },
          left: {
            style: 'thin',
            color: { argb: 'FFD5E4E8' }
          },
          bottom: {
            style: 'thin',
            color: { argb: 'FF0F766E' }
          },
          right: {
            style: 'thin',
            color: { argb: 'FFD5E4E8' }
          }
        }
      })

      const toExcelDate = (value) => {
        if (!value) return null

        const date = new Date(
          `${String(value).slice(0, 10)}T00:00:00`
        )

        return Number.isNaN(date.getTime())
          ? null
          : date
      }

      students.forEach((student, index) => {
        const row = worksheet.addRow({
          fullName: student.fullName || '-',
          packages: getPackagesText(student),
          teachers: getTeachersText(student),
          totalFee: getTotalFee(student),
          nextPaymentDate: toExcelDate(
            getNearestPaymentDate(student)
          ),
          status: getStudentStatusLabel(student),
          passiveDate: toExcelDate(
            getPassiveDate(student)
          ),
          passiveReason:
            student.passiveReason ||
            student.archiveReason ||
            '-',
          archiveDate: isArchivedStudent(student)
            ? toExcelDate(student.archivedAt)
            : null,
          retentionReviewDate: toExcelDate(
            getRetentionReviewDate(student)
          ),
          retentionStatus:
            student.retentionStatus || '-',
          anonymizedDate: toExcelDate(
            student.anonymizedAt
          )
        })

        row.height = 29

        row.eachCell(
          { includeEmpty: true },
          (cell) => {
            cell.font = {
              name: 'Calibri',
              size: 10,
              color: { argb: 'FF334155' }
            }
            cell.alignment = {
              vertical: 'middle',
              wrapText: true
            }
            cell.border = {
              top: {
                style: 'thin',
                color: { argb: 'FFE2E8F0' }
              },
              left: {
                style: 'thin',
                color: { argb: 'FFE2E8F0' }
              },
              bottom: {
                style: 'thin',
                color: { argb: 'FFE2E8F0' }
              },
              right: {
                style: 'thin',
                color: { argb: 'FFE2E8F0' }
              }
            }

            if (index % 2 === 1) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF8FAFC' }
              }
            }
          }
        )

        const statusCell = row.getCell(6)
        statusCell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FF334155' }
        }
        statusCell.alignment = {
          horizontal: 'center',
          vertical: 'middle'
        }

        const status = getStudentStatusLabel(student)
        const statusStyle = {
          Aktif: {
            fill: 'FFDCFCE7',
            text: 'FF15803D'
          },
          Pasif: {
            fill: 'FFF1F5F9',
            text: 'FF64748B'
          },
          Arşiv: {
            fill: 'FFEDE9FE',
            text: 'FF6D28D9'
          },
          İnceleme: {
            fill: 'FFFEF3C7',
            text: 'FFB45309'
          },
          Anonim: {
            fill: 'FFE2E8F0',
            text: 'FF475569'
          }
        }[status]

        if (statusStyle) {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: statusStyle.fill }
          }
          statusCell.font = {
            name: 'Calibri',
            size: 10,
            bold: true,
            color: { argb: statusStyle.text }
          }
        }
      })

      worksheet.getColumn(4).numFmt = '₺#,##0.00'
      ;[5, 7, 9, 10, 12].forEach(
        (columnNumber) => {
          worksheet.getColumn(columnNumber).numFmt =
            'dd.mm.yyyy'
          worksheet.getColumn(columnNumber).alignment = {
            horizontal: 'center',
            vertical: 'middle'
          }
        }
      )

      worksheet.getColumn(4).alignment = {
        horizontal: 'right',
        vertical: 'middle'
      }
      worksheet.getColumn(6).alignment = {
        horizontal: 'center',
        vertical: 'middle'
      }

      worksheet.views = [
        {
          state: 'frozen',
          ySplit: 4,
          activeCell: 'A5'
        }
      ]

      worksheet.autoFilter = {
        from: 'A4',
        to: `L${worksheet.rowCount}`
      }

      worksheet.headerFooter.oddFooter =
        '&LArtı Akademi - Bilim Sanat' +
        '&CSayfa &P / &N' +
        '&RÖğrenci Listesi'

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download =
        `ogrenci-listesi-${getTodayKey()}.xlsx`

      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(
        () => URL.revokeObjectURL(url),
        100
      )
    } catch (error) {
      console.error(
        'Öğrenci Excel dosyası oluşturulamadı:',
        error
      )
      alert(
        'Excel dosyası oluşturulamadı. ExcelJS paketinin kurulu olduğundan emin olun.'
      )
    }
  }

  const handleCreateStudentPdf = async () => {
    if (!selectedStudent) {
      alert('PDF oluşturulacak öğrenci bulunamadı.')
      return
    }

    if (editingSection) {
      alert(
        'PDF oluşturmadan önce açık olan düzenlemeyi kaydedin veya iptal edin.'
      )
      return
    }

    setIsCreatingPdf(true)

    try {
      /*
       * PDF kütüphanesi yalnızca kullanıcı PDF düğmesine bastığında yüklenir.
       * Bu sayede öğrenci ekranının ilk açılışı gereksiz yere yavaşlamaz.
       */
      const [pdfMakeModule, pdfFontsModule] = await Promise.all([
        import('pdfmake/build/pdfmake.js'),
        import('pdfmake/build/vfs_fonts.js')
      ])

      const pdfMake = pdfMakeModule.default || pdfMakeModule
      const pdfFonts = pdfFontsModule.default || pdfFontsModule

      if (typeof pdfMake.addVirtualFileSystem === 'function') {
        pdfMake.addVirtualFileSystem(pdfFonts)
      } else if (pdfFonts?.pdfMake?.vfs) {
        pdfMake.vfs = pdfFonts.pdfMake.vfs
      } else if (pdfFonts?.vfs) {
        pdfMake.vfs = pdfFonts.vfs
      }

      const safeText = (value) => {
        const text = String(value ?? '').trim()
        return text || '-'
      }

      const getPaymentAmountForPdf = (payment) =>
        Number(
          payment?.amount ??
            payment?.transactionAmount ??
            payment?.paidAmount ??
            0
        )

      const getPaymentDateForPdf = (payment) =>
        payment?.paymentDate ||
        payment?.collectionDate ||
        payment?.date ||
        ''

      const getPaymentPeriodForPdf = (payment) => {
        const value =
          payment?.paymentPeriod ||
          payment?.period ||
          payment?.dueDate ||
          getPaymentDateForPdf(payment)

        const period = String(value || '').slice(0, 7)

        if (!/^\d{4}-\d{2}$/.test(period)) {
          return '-'
        }

        const [year, month] = period.split('-').map(Number)

        return new Date(year, month - 1, 1).toLocaleDateString(
          'tr-TR',
          {
            month: 'long',
            year: 'numeric'
          }
        )
      }

      const studentPackages = normalizeStudentPackages(
        selectedStudent
      )

      const studentPayments = getStudentPayments(
        selectedStudent
      ).sort((first, second) =>
        String(getPaymentDateForPdf(second)).localeCompare(
          String(getPaymentDateForPdf(first))
        )
      )

      const dayOrder = {
        Pazartesi: 1,
        Salı: 2,
        Çarşamba: 3,
        Perşembe: 4,
        Cuma: 5,
        Cumartesi: 6,
        Pazar: 7
      }

      const studentLessons = getStudentLessons(
        selectedStudent
      ).sort((first, second) => {
        const dayDifference =
          (dayOrder[first.day] || 99) -
          (dayOrder[second.day] || 99)

        if (dayDifference !== 0) {
          return dayDifference
        }

        return String(first.time || '').localeCompare(
          String(second.time || '')
        )
      })

      const totalCollected = studentPayments.reduce(
        (total, payment) =>
          total + getPaymentAmountForPdf(payment),
        0
      )

      const generatedAt = new Date().toLocaleString('tr-TR', {
        dateStyle: 'long',
        timeStyle: 'short'
      })

      const activePackageCount = studentPackages.filter(
        isPackageActive
      ).length

      const statusLabel = getStudentStatusLabel(selectedStudent)
      const statusIsActive = statusLabel === 'Aktif'

      const fieldCell = (label, value, options = {}) => ({
        stack: [
          {
            text: String(label || '').toLocaleUpperCase('tr-TR'),
            style: 'fieldLabel'
          },
          {
            text: safeText(value),
            style: 'fieldValue',
            margin: [0, 3, 0, 0]
          }
        ],
        fillColor: options.fillColor || '#F8FAFC',
        margin: [10, 5, 10, 5],
        ...(options.colSpan ? { colSpan: options.colSpan } : {})
      })

      const informationGrid = (rows) => ({
        table: {
          widths: ['*', '*'],
          body: rows
        },
        layout: {
          hLineColor: () => '#DDE7EF',
          vLineColor: () => '#DDE7EF',
          hLineWidth: () => 0.6,
          vLineWidth: () => 0.6,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 0,
          paddingBottom: () => 0
        }
      })

      const sectionHeading = (title) => ({
        table: {
          widths: [4, '*'],
          body: [
            [
              {
                text: '',
                fillColor: '#14B8A6'
              },
              {
                text: title,
                style: 'sectionTitle',
                margin: [8, 1, 0, 1]
              }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 7]
      })

      const compactSection = (
        title,
        content,
        unbreakable = true
      ) => ({
        stack: [sectionHeading(title), content],
        margin: [0, 9, 0, 0],
        unbreakable
      })

      const metricCell = (label, value, accent = false) => ({
        stack: [
          {
            text: label,
            style: 'metricLabel',
            alignment: 'center'
          },
          {
            text: value,
            style: accent ? 'metricValueAccent' : 'metricValue',
            alignment: 'center',
            margin: [0, 4, 0, 0]
          }
        ],
        fillColor: accent ? '#ECFDF5' : '#F8FAFC',
        margin: [8, 7, 8, 7]
      })

      const tableHeaderCell = (value) => ({
        text: value,
        style: 'tableHeader',
        fillColor: '#E8F3F5',
        margin: [0, 1, 0, 1]
      })

      const tableBodyCell = (value, options = {}) => ({
        text: safeText(value),
        style: options.style || 'tableCell',
        alignment: options.alignment || 'left',
        color: options.color,
        bold: options.bold,
        fillColor: options.fillColor,
        margin: options.margin
      })

      const titledTable = ({
        title,
        headers,
        rows,
        widths
      }) => ({
        margin: [0, 9, 0, 0],
        table: {
          headerRows: 2,
          dontBreakRows: true,
          keepWithHeaderRows: 1,
          widths,
          body: [
            [
              {
                text: title,
                colSpan: headers.length,
                style: 'tableSectionTitle',
                fillColor: '#F0FDFA',
                margin: [8, 5, 8, 5]
              },
              ...Array.from(
                { length: headers.length - 1 },
                () => ({})
              )
            ],
            headers.map(tableHeaderCell),
            ...rows
          ]
        },
        layout: {
          hLineColor: () => '#DDE7EF',
          vLineColor: () => '#DDE7EF',
          hLineWidth: () => 0.55,
          vLineWidth: () => 0.55,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 5,
          paddingBottom: () => 5
        }
      })

      const packageRows = studentPackages.map((packageItem) => [
        {
          stack: [
            {
              text: safeText(packageItem.packageName),
              style: 'tablePrimaryText'
            },
            {
              text: [
                safeText(packageItem.instrument),
                packageItem.lessonCount
                  ? ` · ${packageItem.lessonCount} ders`
                  : '',
                packageItem.lessonDuration
                  ? ` · ${packageItem.lessonDuration} dk`
                  : ''
              ],
              style: 'tableSecondaryText',
              margin: [0, 2, 0, 0]
            }
          ]
        },
        tableBodyCell(
          packageItem.defaultTeacherName ||
            packageItem.teacherName ||
            packageItem.teacher
        ),
        tableBodyCell(
          `₺${formatPrice(
            packageItem.agreedPrice ?? packageItem.monthlyFee
          )}`,
          {
            alignment: 'right',
            bold: true
          }
        ),
        tableBodyCell(formatDate(packageItem.firstPaymentDate), {
          alignment: 'center'
        }),
        tableBodyCell(formatDate(packageItem.nextPaymentDate), {
          alignment: 'center'
        }),
        tableBodyCell(
          isPackageActive(packageItem)
            ? 'Aktif'
            : 'Sonlandırıldı',
          {
            alignment: 'center',
            bold: true,
            color: isPackageActive(packageItem)
              ? '#15803D'
              : '#B45309',
            fillColor: isPackageActive(packageItem)
              ? '#ECFDF5'
              : '#FFFBEB'
          }
        )
      ])

      const paymentRows = studentPayments.map((payment) => [
        tableBodyCell(formatDate(getPaymentDateForPdf(payment)), {
          alignment: 'center'
        }),
        tableBodyCell(payment.packageName),
        tableBodyCell(getPaymentPeriodForPdf(payment)),
        tableBodyCell(payment.paymentMethod),
        tableBodyCell(payment.referenceNumber),
        tableBodyCell(
          `₺${formatPrice(getPaymentAmountForPdf(payment))}`,
          {
            alignment: 'right',
            bold: true,
            color: '#0F766E'
          }
        )
      ])

      const lessonRows = studentLessons.map((lesson) => [
        tableBodyCell(lesson.day),
        tableBodyCell(lesson.time, { alignment: 'center' }),
        {
          stack: [
            {
              text: safeText(lesson.packageName),
              style: 'tablePrimaryText'
            },
            {
              text: safeText(lesson.instrument),
              style: 'tableSecondaryText',
              margin: [0, 2, 0, 0]
            }
          ]
        },
        tableBodyCell(lesson.teacherName || lesson.teacher),
        tableBodyCell(
          lesson.duration || lesson.lessonDuration,
          { alignment: 'center' }
        )
      ])

      const documentDefinition = {
        pageSize: 'A4',
        pageMargins: [36, 66, 36, 42],

        header: (currentPage) => ({
          margin: [36, 18, 36, 0],
          stack: [
            {
              columns: [
                {
                  width: '*',
                  stack: [
                    {
                      text: 'ARTI AKADEMİ',
                      color: '#0F766E',
                      bold: true,
                      fontSize: 12
                    },
                    {
                      text: 'BİLİM SANAT ÖĞRENCİ YÖNETİM SİSTEMİ',
                      color: '#64748B',
                      fontSize: 7,
                      characterSpacing: 0.4,
                      margin: [0, 2, 0, 0]
                    }
                  ]
                },
                {
                  width: 190,
                  alignment: 'right',
                  stack: [
                    {
                      text: 'ÖĞRENCİ BİLGİ FORMU',
                      color: '#334155',
                      bold: true,
                      fontSize: 8.5
                    },
                    {
                      text: `Belge no: OG-${safeText(
                        selectedStudent.id
                      )} · Sayfa ${currentPage}`,
                      color: '#94A3B8',
                      fontSize: 7,
                      margin: [0, 2, 0, 0]
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
                  y1: 7,
                  x2: 523,
                  y2: 7,
                  lineWidth: 1.4,
                  lineColor: '#14B8A6'
                }
              ]
            }
          ]
        }),

        footer: (currentPage, pageCount) => ({
          margin: [36, 0, 36, 15],
          columns: [
            {
              text: 'Kurum içi kullanım içindir. Bu belge kişisel veri içerebilir.',
              color: '#94A3B8',
              fontSize: 7
            },
            {
              text: `${currentPage} / ${pageCount}`,
              color: '#64748B',
              alignment: 'right',
              fontSize: 7.5
            }
          ]
        }),

        content: [
          {
            table: {
              widths: [5, '*', 112],
              body: [
                [
                  {
                    text: '',
                    fillColor: '#14B8A6'
                  },
                  {
                    stack: [
                      {
                        text: safeText(selectedStudent.fullName),
                        style: 'studentName'
                      },
                      {
                        text: `Kayıt tarihi: ${formatDate(
                          selectedStudent.registerDate
                        )} · Belge oluşturma: ${generatedAt}`,
                        style: 'studentMeta',
                        margin: [0, 4, 0, 0]
                      }
                    ],
                    fillColor: '#F8FAFC',
                    margin: [14, 8, 10, 8]
                  },
                  {
                    stack: [
                      {
                        text: 'KAYIT DURUMU',
                        style: 'statusLabel',
                        alignment: 'center'
                      },
                      {
                        text: statusLabel,
                        style: statusIsActive
                          ? 'statusValueActive'
                          : 'statusValuePassive',
                        alignment: 'center',
                        margin: [0, 5, 0, 0]
                      }
                    ],
                    fillColor: statusIsActive
                      ? '#ECFDF5'
                      : '#FFF7ED',
                    margin: [8, 8, 8, 8]
                  }
                ]
              ]
            },
            layout: 'noBorders'
          },

          compactSection(
            'Öğrenci Bilgileri',
            informationGrid([
              [
                fieldCell('TC Kimlik No', selectedStudent.tcNo),
                fieldCell('Ad Soyad', selectedStudent.fullName)
              ],
              [
                fieldCell('Cinsiyet', selectedStudent.gender),
                fieldCell(
                  'Doğum Tarihi',
                  formatDate(selectedStudent.birthDate)
                )
              ],
              [
                fieldCell(
                  'Kayıt Tarihi',
                  formatDate(selectedStudent.registerDate)
                ),
                fieldCell('Cep Telefonu', selectedStudent.phone)
              ],
              [
                fieldCell('E-posta', selectedStudent.email),
                fieldCell('Durum', statusLabel)
              ],
              [
                fieldCell('Adres', selectedStudent.address, {
                  colSpan: 2,
                  fillColor: '#FFFFFF'
                }),
                {}
              ]
            ])
          ),

          compactSection(
            'Veli Bilgileri',
            informationGrid([
              [
                fieldCell('Anne Adı', selectedStudent.motherName),
                fieldCell(
                  'Anne Telefonu',
                  selectedStudent.motherPhone
                )
              ],
              [
                fieldCell('Baba Adı', selectedStudent.fatherName),
                fieldCell(
                  'Baba Telefonu',
                  selectedStudent.fatherPhone
                )
              ]
            ])
          ),

          compactSection(
            'Paket ve Ödeme Özeti',
            {
              table: {
                widths: ['*', '*', '*'],
                body: [
                  [
                    metricCell(
                      'Aktif Paket',
                      String(activePackageCount)
                    ),
                    metricCell(
                      'Aylık Toplam Ücret',
                      `₺${formatPrice(
                        getTotalFee(selectedStudent)
                      )}`,
                      true
                    ),
                    metricCell(
                      'Toplam Tahsilat',
                      `₺${formatPrice(totalCollected)}`
                    )
                  ]
                ]
              },
              layout: {
                hLineColor: () => '#DDE7EF',
                vLineColor: () => '#DDE7EF',
                hLineWidth: () => 0.6,
                vLineWidth: () => 0.6,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0
              }
            }
          ),

          packageRows.length
            ? titledTable({
                title: 'Paket Ayrıntıları',
                headers: [
                  'Paket / Ders',
                  'Öğretmen',
                  'Ücret',
                  'İlk Ödeme',
                  'Sonraki',
                  'Durum'
                ],
                widths: ['*', 78, 55, 61, 61, 52],
                rows: packageRows
              })
            : compactSection(
                'Paket Ayrıntıları',
                {
                  text: 'Bu öğrenci için paket kaydı bulunmamaktadır.',
                  style: 'emptyText'
                }
              ),

          ...(
            paymentRows.length
              ? [
                  titledTable({
                    title: 'Tahsilat Geçmişi',
                    headers: [
                      'Tarih',
                      'Paket',
                      'Dönem',
                      'Yöntem',
                      'Dekont No',
                      'Tutar'
                    ],
                    widths: [58, '*', 72, 66, 64, 58],
                    rows: paymentRows
                  })
                ]
              : []
          ),

          lessonRows.length
            ? titledTable({
                title: 'Ders Planları',
                headers: [
                  'Gün',
                  'Saat',
                  'Paket / Ders',
                  'Öğretmen',
                  'Süre'
                ],
                widths: [58, 42, '*', 82, 44],
                rows: lessonRows
              })
            : compactSection(
                'Ders Planları',
                {
                  text: 'Bu öğrenci için ders planı bulunmamaktadır.',
                  style: 'emptyText'
                }
              ),

          compactSection(
            'Notlar',
            {
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      text: safeText(selectedStudent.notes),
                      style: 'noteText',
                      fillColor: '#F8FAFC',
                      margin: [10, 8, 10, 8]
                    }
                  ]
                ]
              },
              layout: {
                hLineColor: () => '#DDE7EF',
                vLineColor: () => '#DDE7EF',
                hLineWidth: () => 0.6,
                vLineWidth: () => 0.6,
                paddingLeft: () => 0,
                paddingRight: () => 0,
                paddingTop: () => 0,
                paddingBottom: () => 0
              }
            }
          )
        ],

        styles: {
          studentName: {
            color: '#0F172A',
            bold: true,
            fontSize: 18
          },
          studentMeta: {
            color: '#64748B',
            fontSize: 7.8
          },
          statusLabel: {
            color: '#64748B',
            bold: true,
            fontSize: 7
          },
          statusValueActive: {
            color: '#15803D',
            bold: true,
            fontSize: 10.5
          },
          statusValuePassive: {
            color: '#B45309',
            bold: true,
            fontSize: 10.5
          },
          sectionTitle: {
            color: '#0F172A',
            bold: true,
            fontSize: 11.5
          },
          fieldLabel: {
            color: '#64748B',
            bold: true,
            fontSize: 7,
            characterSpacing: 0.25
          },
          fieldValue: {
            color: '#1E293B',
            fontSize: 9
          },
          metricLabel: {
            color: '#64748B',
            bold: true,
            fontSize: 7.5
          },
          metricValue: {
            color: '#0F172A',
            bold: true,
            fontSize: 12.5
          },
          metricValueAccent: {
            color: '#0F766E',
            bold: true,
            fontSize: 12.5
          },
          tableSectionTitle: {
            color: '#0F766E',
            bold: true,
            fontSize: 10.5
          },
          tableHeader: {
            color: '#334155',
            bold: true,
            fontSize: 7.2
          },
          tableCell: {
            color: '#334155',
            fontSize: 7.4,
            lineHeight: 1.15
          },
          tablePrimaryText: {
            color: '#1E293B',
            bold: true,
            fontSize: 7.5
          },
          tableSecondaryText: {
            color: '#64748B',
            fontSize: 6.7
          },
          noteText: {
            color: '#334155',
            fontSize: 8.5,
            lineHeight: 1.3
          },
          emptyText: {
            color: '#64748B',
            italics: true,
            fontSize: 8.5,
            fillColor: '#F8FAFC',
            margin: [10, 8, 10, 8]
          }
        },

        defaultStyle: {
          font: 'Roboto',
          fontSize: 8.5,
          color: '#334155'
        }
      }

      const fileName = String(
        selectedStudent.fullName || 'ogrenci'
      )
        .toLocaleLowerCase('tr-TR')
        .replaceAll('ç', 'c')
        .replaceAll('ğ', 'g')
        .replaceAll('ı', 'i')
        .replaceAll('ö', 'o')
        .replaceAll('ş', 's')
        .replaceAll('ü', 'u')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

      pdfMake
        .createPdf(documentDefinition)
        .download(`${fileName || 'ogrenci'}-bilgi-formu.pdf`)
    } catch (error) {
      console.error('Öğrenci PDF oluşturma hatası:', error)
      alert(
        'PDF oluşturulamadı. Proje klasöründe "npm install pdfmake" komutunu çalıştırdığınızdan emin olun.'
      )
    } finally {
      setIsCreatingPdf(false)
    }
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