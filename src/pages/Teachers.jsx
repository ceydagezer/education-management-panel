import { useEffect, useRef, useState } from 'react'

import {
  LoadingButton
} from '../components/AsyncState'

import {
  createSpecialty
} from '../services/catalogService'

import {
  createTeacher,
  reactivateTeacher,
  setTeacherPassive,
  updateTeacher
} from '../services/teacherService'
import ExcelJS from 'exceljs'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import '../styles/teachers.css'

import {
  formatDate,
  getTodayKey
} from '../utils/dateHelpers'

import {
  areIdsEqual,
  normalizeSearchText,
  normalizeStatusText
} from '../utils/textHelpers'

const TEACHER_DRAFT_DISCARD_EVENT =
  'arti-akademi-discard-drafts'

let teacherFormDraftCache = null

const MAX_PHOTO_SIZE = 5 * 1024 * 1024
const MAX_CV_SIZE = 10 * 1024 * 1024
const ALLOWED_CV_EXTENSIONS = ['pdf', 'doc', 'docx']

const formatDateTime = (date = new Date()) =>
  date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

const sanitizeFileName = (value) =>
  String(value || 'ogretmen')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ogretmen'

const configurePdfMakeFonts = () => {
  const virtualFonts =
    pdfFonts?.pdfMake?.vfs ||
    pdfFonts?.vfs ||
    pdfFonts

  if (typeof pdfMake.addVirtualFileSystem === 'function') {
    pdfMake.addVirtualFileSystem(virtualFonts)
    return
  }

  pdfMake.vfs = virtualFonts
}

const getPdfImage = (value) =>
  typeof value === 'string' && value.startsWith('data:image/')
    ? value
    : null

const getSpecialtyId = (specialty) =>
  typeof specialty === 'string'
    ? specialty
    : specialty?.id ?? specialty?.name ?? ''

const getSpecialtyName = (specialty) =>
  typeof specialty === 'string'
    ? specialty
    : specialty?.name ?? ''

const getSpecialtyNames = (specialties = []) =>
  (Array.isArray(specialties) ? specialties : [])
    .map(getSpecialtyName)
    .filter(Boolean)

const getSpecialtyText = (teacher) => {
  const names = getSpecialtyNames(
    teacher?.specialties
  )

  if (names.length > 0) {
    return names.join(', ')
  }

  return teacher?.branch || '-'
}

function Teachers({
  teachers = [],
  setTeachers,
  specialties = [],
  setSpecialties,
  teachersLoading = false,
  unsavedChanges
}) {
  const createEmptyForm = () => ({
    fullName: '',
    phone: '',
    email: '',
    birthDate: '',
    gender: '',
    specialties: [],
    isActive: true,
    photo: '',
    photoFile: null,
    photoPath: '',
    removePhoto: false,
    cvFile: null,
    cvFileName: '',
    cvFilePath: '',
    cvUrl: '',
    removeCv: false,
    commissionRate: 50,
    paymentDay: '',
    notes: ''
  })

  const [showForm, setShowForm] = useState(
    () =>
      Boolean(
        teacherFormDraftCache?.showForm
      )
  )

  const [
    editingTeacherId,
    setEditingTeacherId
  ] = useState(
    () =>
      teacherFormDraftCache
        ?.editingTeacherId ??
      null
  )

  const [
    teacherForm,
    setTeacherForm
  ] = useState(
    () =>
      teacherFormDraftCache
        ?.teacherForm ??
      createEmptyForm()
  )

  const [
    newSpecialty,
    setNewSpecialty
  ] = useState(
    () =>
      teacherFormDraftCache
        ?.newSpecialty ??
      ''
  )
  const [isCvDragActive, setIsCvDragActive] = useState(false)
  const [teacherStatusFilter, setTeacherStatusFilter] = useState('active')
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [creatingTeacherPdfId, setCreatingTeacherPdfId] = useState(null)

  const [isSavingTeacher, setIsSavingTeacher] = useState(false)
  const [isSavingSpecialty, setIsSavingSpecialty] = useState(false)
  const [changingTeacherStatusId, setChangingTeacherStatusId] = useState(null)
  const [actionError, setActionError] = useState('')

  const photoInputRef = useRef(null)
  const cvInputRef = useRef(null)

  /*
   * Form açıkken girilen veriler geçici bellekte tutulur.
   * Böylece ortak uyarı penceresi açılıp kapandığında veya
   * bileşen yeniden oluşturulduğunda form kaybolmaz.
   */
  useEffect(() => {
    if (!showForm) {
      return
    }

    teacherFormDraftCache = {
      showForm,
      editingTeacherId,
      teacherForm,
      newSpecialty
    }
  }, [
    showForm,
    editingTeacherId,
    teacherForm,
    newSpecialty
  ])

  /*
   * Kullanıcı "Kaydetmeden Çık" seçtiğinde App.jsx
   * bu olayı yayınlar ve öğretmen taslağı temizlenir.
   */
  useEffect(() => {
    const clearTeacherDraft = () => {
      teacherFormDraftCache = null
    }

    window.addEventListener(
      TEACHER_DRAFT_DISCARD_EVENT,
      clearTeacherDraft
    )

    return () => {
      window.removeEventListener(
        TEACHER_DRAFT_DISCARD_EVENT,
        clearTeacherDraft
      )
    }
  }, [])

  /*
   * Kaydedilmemiş değişiklik yoksa işlem doğrudan
   * çalışır. Değişiklik varsa App.jsx içindeki ortak
   * uyarı penceresi açılır.
   */
  const runProtectedAction = (action) => {
    if (unsavedChanges?.requestAction) {
      unsavedChanges.requestAction(action)
      return
    }

    action()
  }

  const paymentDayOptions = Array.from(
    { length: 31 },
    (_, index) => index + 1
  )

  const handleTeacherChange = (event) => {
    const { name, value } = event.target

    setActionError('')
    unsavedChanges?.markDirty?.()

    setTeacherForm((current) => ({
      ...current,
      [name]: value
    }))
  }

  const handleSpecialtyToggle = (specialty) => {
    setActionError('')
    unsavedChanges?.markDirty?.()

    const specialtyId = String(
      getSpecialtyId(specialty)
    )

    setTeacherForm((current) => {
      const alreadySelected =
        current.specialties.some(
          (item) =>
            String(item) === specialtyId
        )

      return {
        ...current,
        specialties: alreadySelected
          ? current.specialties.filter(
              (item) =>
                String(item) !== specialtyId
            )
          : [
              ...current.specialties,
              specialtyId
            ]
      }
    })
  }

  const handleNewSpecialtyChange = (event) => {
    setActionError('')
    unsavedChanges?.markDirty?.()
    setNewSpecialty(event.target.value)
  }

  const handleAddSpecialty = async () => {
    const value = newSpecialty.trim()

    if (!value) {
      alert('Uzmanlık adı giriniz.')
      return
    }

    const normalizedValue =
      normalizeSearchText(value)

    const existingSpecialty = specialties.find(
      (item) =>
        normalizeSearchText(
          getSpecialtyName(item)
        ) === normalizedValue
    )

    if (existingSpecialty) {
      const existingId = String(
        getSpecialtyId(existingSpecialty)
      )

      setTeacherForm((current) => ({
        ...current,
        specialties: current.specialties.includes(existingId)
          ? current.specialties
          : [
              ...current.specialties,
              existingId
            ]
      }))

      setNewSpecialty('')
      return
    }

    setIsSavingSpecialty(true)
    setActionError('')

    try {
      const savedSpecialty =
        await createSpecialty(value)

      setSpecialties((current) => [
        ...current,
        savedSpecialty
      ])

      setTeacherForm((current) => ({
        ...current,
        specialties: [
          ...current.specialties,
          String(savedSpecialty.id)
        ]
      }))

      setNewSpecialty('')
      unsavedChanges?.markDirty?.()
    } catch (error) {
      console.error(
        'Uzmanlık ekleme hatası:',
        error
      )

      setActionError(
        error instanceof Error
          ? error.message
          : 'Uzmanlık eklenemedi.'
      )
    } finally {
      setIsSavingSpecialty(false)
    }
  }

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('Lütfen geçerli bir görsel dosyası seçiniz.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_PHOTO_SIZE) {
      alert('Profil fotoğrafı en fazla 5 MB olabilir.')
      event.target.value = ''
      return
    }

    unsavedChanges?.markDirty?.()

    const reader = new FileReader()

    reader.onloadend = () => {
      setTeacherForm((current) => ({
        ...current,
        photo: String(reader.result || ''),
        photoFile: file,
        removePhoto: false
      }))
    }

    reader.readAsDataURL(file)
  }

  const removePhoto = () => {
    unsavedChanges?.markDirty?.()

    setTeacherForm((current) => ({
      ...current,
      photo: '',
      photoFile: null,
      removePhoto: true
    }))

    if (photoInputRef.current) {
      photoInputRef.current.value = ''
    }
  }

  const validateCvFile = (file) => {
    const extension = file.name
      .split('.')
      .pop()
      ?.toLocaleLowerCase('tr-TR')

    if (
      !extension ||
      !ALLOWED_CV_EXTENSIONS.includes(extension)
    ) {
      alert('CV dosyası PDF, DOC veya DOCX formatında olmalıdır.')
      return false
    }

    if (file.size > MAX_CV_SIZE) {
      alert('CV dosyası en fazla 10 MB olabilir.')
      return false
    }

    return true
  }

  const saveCvFileToForm = (file) => {
    if (!validateCvFile(file)) {
      return
    }

    unsavedChanges?.markDirty?.()

    setTeacherForm((current) => ({
      ...current,
      cvFile: file,
      cvFileName: file.name,
      removeCv: false
    }))
  }

  const handleCvChange = (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    saveCvFileToForm(file)
  }

  const handleCvDragOver = (event) => {
    event.preventDefault()
    setIsCvDragActive(true)
  }

  const handleCvDragLeave = (event) => {
    event.preventDefault()
    setIsCvDragActive(false)
  }

  const handleCvDrop = (event) => {
    event.preventDefault()
    setIsCvDragActive(false)

    const file = event.dataTransfer.files?.[0]

    if (!file) {
      return
    }

    saveCvFileToForm(file)
  }

  const removeCvFile = (event) => {
    event?.preventDefault()
    event?.stopPropagation()

    unsavedChanges?.markDirty?.()

    setTeacherForm((current) => ({
      ...current,
      cvFile: null,
      cvFileName: '',
      cvFilePath: '',
      cvUrl: '',
      removeCv: true
    }))

    if (cvInputRef.current) {
      cvInputRef.current.value = ''
    }
  }

  const performOpenAddForm = () => {
    teacherFormDraftCache = null
    unsavedChanges?.markClean?.()

    setActionError('')
    setTeacherForm(createEmptyForm())
    setNewSpecialty('')
    setEditingTeacherId(null)
    setIsCvDragActive(false)
    setShowForm(true)
  }

  const openAddForm = () => {
    runProtectedAction(performOpenAddForm)
  }

  const performOpenEditForm = (teacher) => {
    teacherFormDraftCache = null
    unsavedChanges?.markClean?.()

    setActionError('')
    setTeacherForm({
      fullName: teacher.fullName || '',
      phone: teacher.phone || '',
      email: teacher.email || '',
      birthDate: teacher.birthDate || '',
      gender: teacher.gender || '',
      specialties:
        Array.isArray(teacher.specialties) &&
        teacher.specialties.length > 0
          ? teacher.specialties
              .map(getSpecialtyId)
              .filter(Boolean)
              .map(String)
          : teacher.branch
            ? [String(teacher.branch)]
            : [],
      isActive:
        teacher.isActive !== undefined
          ? teacher.isActive
          : teacher.status !== 'Pasif',
      photo:
        teacher.photo ||
        teacher.profilePhotoUrl ||
        '',
      photoFile: null,
      photoPath:
        teacher.photoPath ||
        teacher.profilePhotoPath ||
        '',
      removePhoto: false,
      cvFile: null,
      cvFileName:
        teacher.cvFileName || '',
      cvFilePath:
        teacher.cvFilePath || '',
      cvUrl:
        teacher.cvUrl || '',
      removeCv: false,
      commissionRate:
        teacher.commissionRate !== undefined
          ? teacher.commissionRate
          : 50,
      paymentDay:
        teacher.paymentDay ??
        teacher.teacherPaymentDay ??
        '',
      notes: teacher.notes || ''
    })

    setEditingTeacherId(teacher.id)
    setNewSpecialty('')
    setIsCvDragActive(false)
    setShowForm(true)
  }

  const openEditForm = (teacher) => {
    runProtectedAction(() =>
      performOpenEditForm(teacher)
    )
  }

  const performCloseForm = () => {
    teacherFormDraftCache = null
    unsavedChanges?.markClean?.()

    setActionError('')
    setTeacherForm(createEmptyForm())
    setNewSpecialty('')
    setEditingTeacherId(null)
    setIsCvDragActive(false)
    setShowForm(false)
  }

  const closeForm = () => {
    if (
      isSavingTeacher ||
      isSavingSpecialty
    ) {
      return
    }

    runProtectedAction(performCloseForm)
  }

  const saveTeacher = async (event) => {
    event.preventDefault()

    if (!teacherForm.fullName.trim()) {
      alert('Ad soyad zorunludur.')
      return
    }

    if (!teacherForm.phone.trim()) {
      alert('Telefon zorunludur.')
      return
    }

    if (!teacherForm.email.trim()) {
      alert('E-posta zorunludur.')
      return
    }

    if (!teacherForm.birthDate) {
      alert('Doğum tarihi zorunludur.')
      return
    }

    if (!teacherForm.gender) {
      alert('Cinsiyet zorunludur.')
      return
    }

    if (teacherForm.specialties.length === 0) {
      alert('En az bir uzmanlık seçiniz.')
      return
    }

    const commissionRate = Number(
      teacherForm.commissionRate
    )

    if (
      !Number.isFinite(commissionRate) ||
      commissionRate < 0 ||
      commissionRate > 100
    ) {
      alert(
        'Hakediş yüzdesi 0 ile 100 arasında olmalıdır.'
      )
      return
    }

    const paymentDay = Number(
      teacherForm.paymentDay
    )

    if (
      !Number.isInteger(paymentDay) ||
      paymentDay < 1 ||
      paymentDay > 31
    ) {
      alert('Aylık ödeme gününü seçiniz.')
      return
    }

    setIsSavingTeacher(true)
    setActionError('')

    try {
      const savedTeacher =
        editingTeacherId
          ? await updateTeacher(
              editingTeacherId,
              teacherForm
            )
          : await createTeacher(
              teacherForm
            )

      setTeachers((current) => {
        if (editingTeacherId) {
          return current.map((teacher) =>
            areIdsEqual(
              teacher.id,
              editingTeacherId
            )
              ? savedTeacher
              : teacher
          )
        }

        return [
          savedTeacher,
          ...current
        ]
      })

      unsavedChanges?.markClean?.()
      performCloseForm()
    } catch (error) {
      console.error(
        'Öğretmen kaydetme hatası:',
        error
      )

      setActionError(
        error instanceof Error
          ? error.message
          : 'Öğretmen kaydedilemedi.'
      )
    } finally {
      setIsSavingTeacher(false)
    }
  }

  const changeTeacherStatus = async (teacher) => {
    const isCurrentlyActive =
      teacher.isActive !== false &&
      normalizeStatusText(
        teacher.status
      ) !== 'pasif'

    setActionError('')

    if (isCurrentlyActive) {
      const passiveReason = window.prompt(
        'Öğretmenin pasife alınma nedenini yazınız:',
        teacher.passiveReason || ''
      )

      if (passiveReason === null) {
        return
      }

      if (!passiveReason.trim()) {
        alert('Pasife alma nedeni zorunludur.')
        return
      }

      const isConfirmed = window.confirm(
        `${teacher.fullName} pasife alınacak. Geçmiş ders, paket ve ödeme kayıtları korunacaktır. Devam edilsin mi?`
      )

      if (!isConfirmed) {
        return
      }

      setChangingTeacherStatusId(
        teacher.id
      )

      try {
        const updatedTeacher =
          await setTeacherPassive(
            teacher.id,
            passiveReason,
            getTodayKey()
          )

        setTeachers((current) =>
          current.map((item) =>
            areIdsEqual(
              item.id,
              teacher.id
            )
              ? updatedTeacher
              : item
          )
        )
      } catch (error) {
        console.error(
          'Öğretmen pasife alma hatası:',
          error
        )

        setActionError(
          error instanceof Error
            ? error.message
            : 'Öğretmen pasife alınamadı.'
        )
      } finally {
        setChangingTeacherStatusId(
          null
        )
      }

      return
    }

    const isConfirmed = window.confirm(
      `${teacher.fullName} yeniden aktif öğretmen olarak işaretlensin mi?`
    )

    if (!isConfirmed) {
      return
    }

    setChangingTeacherStatusId(
      teacher.id
    )

    try {
      const updatedTeacher =
        await reactivateTeacher(
          teacher.id,
          getTodayKey()
        )

      setTeachers((current) =>
        current.map((item) =>
          areIdsEqual(
            item.id,
            teacher.id
          )
            ? updatedTeacher
            : item
        )
      )
    } catch (error) {
      console.error(
        'Öğretmen aktifleştirme hatası:',
        error
      )

      setActionError(
        error instanceof Error
          ? error.message
          : 'Öğretmen aktifleştirilemedi.'
      )
    } finally {
      setChangingTeacherStatusId(
        null
      )
    }
  }

  const openCvFile = (teacher) => {
    if (teacher.cvUrl) {
      window.open(
        teacher.cvUrl,
        '_blank',
        'noopener,noreferrer'
      )
      return
    }

    if (!teacher.cvFile) {
      return
    }

    const cvUrl = URL.createObjectURL(
      teacher.cvFile
    )

    window.open(
      cvUrl,
      '_blank',
      'noopener,noreferrer'
    )

    setTimeout(() => {
      URL.revokeObjectURL(cvUrl)
    }, 1000)
  }

  const getTeacherPaymentDay = (teacher) =>
    teacher.paymentDay ??
    teacher.teacherPaymentDay ??
    ''

  const isTeacherActive = (teacher) =>
    teacher.isActive !== false &&
    normalizeStatusText(
      teacher.status
    ) !== 'pasif'

  const activeTeacherCount = teachers.filter(
    isTeacherActive
  ).length

  const passiveTeacherCount =
    teachers.length - activeTeacherCount

  const filteredTeachers = teachers.filter(
    (teacher) => {
      if (teacherStatusFilter === 'active') {
        return isTeacherActive(teacher)
      }

      if (teacherStatusFilter === 'passive') {
        return !isTeacherActive(teacher)
      }

      return true
    }
  )

  const exportTeachersToExcel = async () => {
    if (filteredTeachers.length === 0) {
      alert('Aktarılacak öğretmen kaydı bulunmamaktadır.')
      return
    }

    setIsExportingExcel(true)

    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Artı Akademi - Bilim Sanat Paneli'
      workbook.created = new Date()
      workbook.modified = new Date()

      const worksheet = workbook.addWorksheet('Öğretmenler', {
        views: [
          {
            state: 'frozen',
            ySplit: 4
          }
        ],
        pageSetup: {
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          paperSize: 9,
          margins: {
            left: 0.25,
            right: 0.25,
            top: 0.45,
            bottom: 0.45,
            header: 0.2,
            footer: 0.2
          }
        }
      })

      const columns = [
        { header: 'Ad Soyad', key: 'fullName', width: 25 },
        { header: 'Telefon', key: 'phone', width: 18 },
        { header: 'E-posta', key: 'email', width: 28 },
        { header: 'Doğum Tarihi', key: 'birthDate', width: 16 },
        { header: 'Cinsiyet', key: 'gender', width: 13 },
        { header: 'Uzmanlıklar', key: 'specialties', width: 30 },
        { header: 'Hakediş (%)', key: 'commissionRate', width: 15 },
        { header: 'Ödeme Günü', key: 'paymentDay', width: 20 },
        { header: 'Durum', key: 'status', width: 13 },
        { header: 'Pasife Alma Tarihi', key: 'passiveDate', width: 19 },
        { header: 'Pasife Alma Nedeni', key: 'passiveReason', width: 30 },
        { header: 'Fotoğraf', key: 'photo', width: 13 },
        { header: 'CV', key: 'cv', width: 11 },
        { header: 'CV Dosya Adı', key: 'cvFileName', width: 30 },
        { header: 'Notlar', key: 'notes', width: 38 }
      ]

      worksheet.columns = columns
      worksheet.spliceRows(1, 0, [], [], [])

      worksheet.mergeCells('A1:O1')
      worksheet.getCell('A1').value = 'ARTI AKADEMİ - ÖĞRETMEN LİSTESİ'
      worksheet.getCell('A1').font = {
        name: 'Calibri',
        size: 18,
        bold: true,
        color: { argb: 'FFFFFFFF' }
      }
      worksheet.getCell('A1').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F766E' }
      }
      worksheet.getCell('A1').alignment = {
        vertical: 'middle',
        horizontal: 'left'
      }
      worksheet.getRow(1).height = 34

      worksheet.mergeCells('A2:O2')
      const filterText =
        teacherStatusFilter === 'active'
          ? 'Aktif öğretmenler'
          : teacherStatusFilter === 'passive'
            ? 'Pasif öğretmenler'
            : 'Tüm öğretmenler'

      worksheet.getCell('A2').value =
        `${filterText} • Oluşturulma: ${formatDateTime()}`
      worksheet.getCell('A2').font = {
        name: 'Calibri',
        size: 10,
        italic: true,
        color: { argb: 'FF475569' }
      }
      worksheet.getCell('A2').alignment = {
        vertical: 'middle',
        horizontal: 'left'
      }
      worksheet.getRow(2).height = 22
      worksheet.getRow(3).height = 8

      const headerRow = worksheet.getRow(4)
      columns.forEach((column, index) => {
        headerRow.getCell(index + 1).value = column.header
      })
      headerRow.height = 28
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
          fgColor: { argb: 'FF0EA5A8' }
        }
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF0F766E' } },
          left: { style: 'thin', color: { argb: 'FFBFE4E3' } },
          bottom: { style: 'thin', color: { argb: 'FF0F766E' } },
          right: { style: 'thin', color: { argb: 'FFBFE4E3' } }
        }
      })

      filteredTeachers.forEach((teacher) => {
        const paymentDay = getTeacherPaymentDay(teacher)
        const row = worksheet.addRow({
          fullName: teacher.fullName || '',
          phone: teacher.phone || '',
          email: teacher.email || '',
          birthDate: formatDate(teacher.birthDate),
          gender: teacher.gender || '',
          specialties:
            getSpecialtyText(teacher),
          commissionRate: Number(teacher.commissionRate || 0),
          paymentDay: paymentDay
            ? `Her ayın ${paymentDay}. günü`
            : 'Tanımlı değil',
          status: isTeacherActive(teacher) ? 'Aktif' : 'Pasif',
          passiveDate: teacher.passiveDate
            ? formatDate(teacher.passiveDate)
            : '-',
          passiveReason: teacher.passiveReason || '',
          photo:
            teacher.photo || teacher.profilePhotoUrl ? 'Evet' : 'Hayır',
          cv:
            teacher.cvFile || teacher.cvFileName ? 'Evet' : 'Hayır',
          cvFileName: teacher.cvFileName || '',
          notes: teacher.notes || ''
        })

        row.height = 34
        row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
          cell.font = {
            name: 'Calibri',
            size: 10,
            color: { argb: 'FF334155' }
          }
          cell.alignment = {
            vertical: 'middle',
            horizontal:
              [7, 9, 12, 13].includes(columnNumber)
                ? 'center'
                : 'left',
            wrapText: true
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          }
        })

        const statusCell = row.getCell(9)
        const isActive = isTeacherActive(teacher)
        statusCell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: {
            argb: isActive ? 'FF15803D' : 'FFB45309'
          }
        }
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: isActive ? 'FFDCFCE7' : 'FFFEF3C7'
          }
        }
      })

      const lastRow = Math.max(4, worksheet.rowCount)
      worksheet.autoFilter = {
        from: 'A4',
        to: `O${lastRow}`
      }

      worksheet.getColumn(7).numFmt = '0"%"'
      worksheet.properties.defaultRowHeight = 22
      worksheet.headerFooter.oddFooter =
        '&LArtı Akademi&CÖğretmen Listesi&R&B&P / &N'

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const fileUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const filterLabel =
        teacherStatusFilter === 'active'
          ? 'aktif'
          : teacherStatusFilter === 'passive'
            ? 'pasif'
            : 'tum'

      link.href = fileUrl
      link.download =
        `ogretmen-listesi-${filterLabel}-${getTodayKey()}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(fileUrl)
    } catch (error) {
      console.error('Öğretmen Excel aktarımı başarısız:', error)
      alert(
        'Excel dosyası oluşturulamadı. Sayfayı yenileyip tekrar deneyiniz.'
      )
    } finally {
      setIsExportingExcel(false)
    }
  }

  const createTeacherPdf = (teacher) => {
    if (!teacher) {
      return
    }

    setCreatingTeacherPdfId(teacher.id)

    try {
      configurePdfMakeFonts()

      const paymentDay = getTeacherPaymentDay(teacher)
      const isActive = isTeacherActive(teacher)
      const statusText = isActive ? 'Aktif' : 'Pasif'
      const specialtyText =
        getSpecialtyText(teacher)
      const cvText =
        teacher.cvFileName ||
        (teacher.cvFile ? 'CV dosyası mevcut' : 'CV bulunmuyor')
      const teacherPhoto = getPdfImage(
        teacher.photo || teacher.profilePhotoUrl || ''
      )
      const initials = String(teacher.fullName || '?')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || '?'

      const labelCell = (label) => ({
        text: label,
        bold: true,
        color: '#475569',
        fillColor: '#F8FAFC',
        margin: [8, 7, 8, 7]
      })

      const valueCell = (value) => ({
        text: String(value || '-'),
        color: '#0F172A',
        margin: [8, 7, 8, 7]
      })

      const infoTableLayout = {
        hLineColor: () => '#DCE6EE',
        vLineColor: () => '#DCE6EE',
        hLineWidth: () => 0.8,
        vLineWidth: () => 0.8,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0
      }

      const profileVisual = teacherPhoto
        ? {
            image: teacherPhoto,
            width: 72,
            height: 72,
            fit: [72, 72],
            alignment: 'center',
            margin: [0, 0, 0, 0]
          }
        : {
            table: {
              widths: [72],
              heights: [72],
              body: [
                [
                  {
                    text: initials,
                    alignment: 'center',
                    color: '#0F766E',
                    fillColor: '#CCFBF1',
                    bold: true,
                    fontSize: 22,
                    margin: [0, 24, 0, 0]
                  }
                ]
              ]
            },
            layout: {
              hLineColor: () => '#99F6E4',
              vLineColor: () => '#99F6E4',
              hLineWidth: () => 1,
              vLineWidth: () => 1,
              paddingLeft: () => 0,
              paddingRight: () => 0,
              paddingTop: () => 0,
              paddingBottom: () => 0
            }
          }

      const documentDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 40, 40, 48],
        defaultStyle: {
          font: 'Roboto',
          fontSize: 9.3,
          color: '#334155',
          lineHeight: 1.2
        },
        footer: (currentPage, pageCount) => ({
          margin: [40, 10, 40, 0],
          columns: [
            {
              text: 'Artı Akademi - Kurum içi öğretmen bilgi formu',
              color: '#94A3B8',
              fontSize: 7.5
            },
            {
              text: `${currentPage} / ${pageCount}`,
              alignment: 'right',
              color: '#94A3B8',
              fontSize: 7.5
            }
          ]
        }),
        content: [
          {
            columns: [
              {
                stack: [
                  {
                    text: 'ARTI AKADEMİ - BİLİM SANAT',
                    color: '#0F766E',
                    bold: true,
                    fontSize: 10
                  },
                  {
                    text: 'ÖĞRETMEN BİLGİ FORMU',
                    bold: true,
                    fontSize: 18,
                    color: '#0F172A',
                    margin: [0, 4, 0, 2]
                  },
                  {
                    text: 'Kurum içi öğretmen kayıt özeti',
                    color: '#64748B',
                    fontSize: 8.5
                  }
                ]
              },
              {
                width: 150,
                stack: [
                  {
                    text: 'Belge Oluşturma Tarihi',
                    alignment: 'right',
                    color: '#64748B',
                    fontSize: 8
                  },
                  {
                    text: formatDateTime(),
                    alignment: 'right',
                    bold: true,
                    color: '#0F172A',
                    fontSize: 9,
                    margin: [0, 3, 0, 0]
                  }
                ]
              }
            ],
            margin: [0, 0, 0, 9]
          },
          {
            canvas: [
              {
                type: 'line',
                x1: 0,
                y1: 0,
                x2: 515,
                y2: 0,
                lineWidth: 2,
                lineColor: '#14B8A6'
              }
            ],
            margin: [0, 0, 0, 13]
          },
          {
            table: {
              widths: [86, '*', 84],
              body: [
                [
                  {
                    ...profileVisual,
                    margin: [7, 7, 7, 7]
                  },
                  {
                    stack: [
                      {
                        text: teacher.fullName || '-',
                        bold: true,
                        color: '#0F172A',
                        fontSize: 17,
                        margin: [0, 8, 0, 5]
                      },
                      {
                        text: specialtyText,
                        color: '#475569',
                        fontSize: 9.5,
                        margin: [0, 0, 0, 4]
                      },
                      {
                        text: teacher.email || '-',
                        color: '#64748B',
                        fontSize: 8.5
                      }
                    ],
                    margin: [4, 0, 4, 0]
                  },
                  {
                    text: statusText,
                    alignment: 'center',
                    bold: true,
                    color: isActive ? '#15803D' : '#B45309',
                    fillColor: isActive ? '#DCFCE7' : '#FEF3C7',
                    margin: [8, 8, 8, 8]
                  }
                ]
              ]
            },
            layout: {
              fillColor: (rowIndex, node, columnIndex) =>
                columnIndex === 1 ? '#F8FAFC' : null,
              hLineColor: () => '#DCE6EE',
              vLineColor: () => '#DCE6EE',
              hLineWidth: () => 0.8,
              vLineWidth: () => 0.8,
              paddingLeft: () => 0,
              paddingRight: () => 0,
              paddingTop: () => 0,
              paddingBottom: () => 0
            },
            margin: [0, 0, 0, 14]
          },
          {
            text: 'Kişisel ve İletişim Bilgileri',
            style: 'sectionTitle'
          },
          {
            table: {
              widths: [94, '*', 94, '*'],
              body: [
                [
                  labelCell('Telefon'),
                  valueCell(teacher.phone),
                  labelCell('E-posta'),
                  valueCell(teacher.email)
                ],
                [
                  labelCell('Doğum Tarihi'),
                  valueCell(formatDate(teacher.birthDate)),
                  labelCell('Cinsiyet'),
                  valueCell(teacher.gender)
                ]
              ]
            },
            layout: infoTableLayout,
            margin: [0, 0, 0, 13]
          },
          {
            text: 'Mesleki ve Finansal Bilgiler',
            style: 'sectionTitle'
          },
          {
            table: {
              widths: [104, '*', 104, '*'],
              body: [
                [
                  labelCell('Uzmanlıklar'),
                  {
                    ...valueCell(specialtyText),
                    colSpan: 3
                  },
                  {},
                  {}
                ],
                [
                  labelCell('Hakediş Oranı'),
                  valueCell(`%${Number(teacher.commissionRate || 0)}`),
                  labelCell('Aylık Ödeme Günü'),
                  valueCell(
                    paymentDay
                      ? `Her ayın ${paymentDay}. günü`
                      : 'Tanımlı değil'
                  )
                ],
                [
                  labelCell('CV / Belge'),
                  {
                    ...valueCell(cvText),
                    colSpan: 3
                  },
                  {},
                  {}
                ]
              ]
            },
            layout: infoTableLayout,
            margin: [0, 0, 0, 13]
          },
          ...(!isActive
            ? [
                {
                  text: 'Pasif Kayıt Bilgileri',
                  style: 'sectionTitle'
                },
                {
                  table: {
                    widths: [104, '*', 104, '*'],
                    body: [
                      [
                        labelCell('Pasife Alma Tarihi'),
                        valueCell(formatDate(teacher.passiveDate)),
                        labelCell('Pasife Alma Nedeni'),
                        valueCell(teacher.passiveReason)
                      ]
                    ]
                  },
                  layout: infoTableLayout,
                  margin: [0, 0, 0, 13]
                }
              ]
            : []),
          {
            text: 'Açıklama / Not',
            style: 'sectionTitle'
          },
          {
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    text: teacher.notes || 'Not bulunmamaktadır.',
                    color: teacher.notes ? '#334155' : '#94A3B8',
                    italics: !teacher.notes,
                    margin: [9, 9, 9, 9]
                  }
                ]
              ]
            },
            layout: infoTableLayout
          },
          {
            text:
              'Bu belge kurum içi kullanım amacıyla oluşturulmuştur. Kişisel verileri yalnızca yetkili kişilerle paylaşınız.',
            color: '#94A3B8',
            fontSize: 7.5,
            alignment: 'center',
            margin: [0, 16, 0, 0]
          }
        ],
        styles: {
          sectionTitle: {
            bold: true,
            fontSize: 11,
            color: '#0F172A',
            margin: [0, 0, 0, 6]
          }
        }
      }

      const fileName =
        `${sanitizeFileName(teacher.fullName)}-ogretmen-bilgi-formu.pdf`

      pdfMake.createPdf(documentDefinition).download(
        fileName,
        () => setCreatingTeacherPdfId(null)
      )
    } catch (error) {
      console.error('Öğretmen PDF oluşturma hatası:', error)
      alert(
        'PDF oluşturulamadı. Sayfayı yenileyip tekrar deneyiniz.'
      )
      setCreatingTeacherPdfId(null)
    }
  }

  return (
    <div className="dashboard-shell">
      <section className="page-card">
        <div>
          <span className="page-badge">
            Öğretmen Yönetimi
          </span>

          <h1>Öğretmenler</h1>

          <p>
            Öğretmen bilgilerini, uzmanlıklarını,
            hakediş yüzdelerini ve ödeme
            günlerini yönetin.
          </p>
        </div>

        <div className="teacher-page-actions">
          <button
            className="excel-button"
            type="button"
            onClick={exportTeachersToExcel}
            disabled={
              isExportingExcel ||
              teachersLoading
            }
          >
            {isExportingExcel
              ? 'Excel Hazırlanıyor...'
              : 'Excel’e Aktar'}
          </button>

          <button
            className="manage-button"
            type="button"
            onClick={openAddForm}
            disabled={
              isSavingTeacher ||
              teachersLoading
            }
          >
            + Öğretmen Ekle
          </button>
        </div>
      </section>

      {actionError && (
        <div
          className="finance-empty-warning"
          role="alert"
        >
          {actionError}
        </div>
      )}

      {showForm && (
        <section className="student-form-card teacher-form-card">
          <div className="section-title-row">
            <h2>
              {editingTeacherId
                ? 'Öğretmen Düzenle'
                : 'Yeni Öğretmen Ekle'}
            </h2>

            <button
              className="edit-section-button"
              type="button"
              onClick={closeForm}
              disabled={
                isSavingTeacher ||
                isSavingSpecialty
              }
            >
              Kapat
            </button>
          </div>

          <form onSubmit={saveTeacher}>
            <div className="teacher-form-top">
              <aside className="teacher-photo-section">
                <span className="teacher-photo-label">
                  Profil Fotoğrafı
                </span>

                <label className="teacher-photo-upload">
                  {teacherForm.photo ? (
                    <img
                      className="teacher-photo-large-preview"
                      src={teacherForm.photo}
                      alt="Öğretmen profil önizlemesi"
                    />
                  ) : (
                    <span className="teacher-default-photo-icon">
                      <svg
                        viewBox="0 0 160 160"
                        aria-hidden="true"
                      >
                        <circle cx="80" cy="80" r="58" />
                        <circle
                          cx="80"
                          cy="63"
                          r="23"
                          fill="#f8fafc"
                        />
                        <path
                          d="M38 126c5-25 23-39 42-39s37 14 42 39"
                          fill="#f8fafc"
                        />
                      </svg>
                    </span>
                  )}

                  <span className="teacher-photo-plus">
                    +
                  </span>

                  <input
                    ref={photoInputRef}
                    className="hidden-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    disabled={isSavingTeacher}
                  />
                </label>

                <p className="teacher-photo-help">
                  Fotoğraf eklemek veya değiştirmek
                  için alana tıklayın.
                </p>

                {teacherForm.photo && (
                  <button
                    className="teacher-photo-remove"
                    type="button"
                    onClick={removePhoto}
                  >
                    Fotoğrafı Kaldır
                  </button>
                )}

                <div
                  className={`teacher-current-status ${
                    teacherForm.isActive !== false
                      ? 'active'
                      : 'passive'
                  }`}
                >
                  <span />
                  <div>
                    <strong>
                      {teacherForm.isActive !== false
                        ? 'Aktif öğretmen'
                        : 'Pasif öğretmen'}
                    </strong>
                    <small>
                      Durum değişikliği öğretmen
                      listesinden yapılır.
                    </small>
                  </div>
                </div>
              </aside>

              <div className="teacher-form-content">
                <div className="form-grid">
                  <div className="form-group">
                    <label>
                      Ad Soyad
                      <span className="required-star">
                        *
                      </span>
                    </label>

                    <input
                      name="fullName"
                      value={teacherForm.fullName}
                      onChange={handleTeacherChange}
                      placeholder="Örn: Meral Hoca"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Telefon
                      <span className="required-star">
                        *
                      </span>
                    </label>

                    <input
                      name="phone"
                      value={teacherForm.phone}
                      onChange={handleTeacherChange}
                      placeholder="05xx xxx xx xx"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      E-posta
                      <span className="required-star">
                        *
                      </span>
                    </label>

                    <input
                      type="email"
                      name="email"
                      value={teacherForm.email}
                      onChange={handleTeacherChange}
                      placeholder="ornek@mail.com"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Doğum Tarihi
                      <span className="required-star">
                        *
                      </span>
                    </label>

                    <input
                      type="date"
                      name="birthDate"
                      value={teacherForm.birthDate}
                      onChange={handleTeacherChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Cinsiyet
                      <span className="required-star">
                        *
                      </span>
                    </label>

                    <select
                      name="gender"
                      value={teacherForm.gender}
                      onChange={handleTeacherChange}
                    >
                      <option value="">
                        Seçiniz
                      </option>
                      <option value="Kadın">
                        Kadın
                      </option>
                      <option value="Erkek">
                        Erkek
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>
                      Hakediş Yüzdesi (%)
                      <span className="required-star">
                        *
                      </span>
                    </label>

                    <input
                      type="number"
                      name="commissionRate"
                      value={
                        teacherForm.commissionRate
                      }
                      onChange={handleTeacherChange}
                      min="0"
                      max="100"
                      step="1"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Aylık Ödeme Günü
                      <span className="required-star">
                        *
                      </span>
                    </label>

                    <select
                      name="paymentDay"
                      value={teacherForm.paymentDay}
                      onChange={handleTeacherChange}
                    >
                      <option value="">
                        Ödeme günü seçiniz
                      </option>

                      {paymentDayOptions.map((day) => (
                        <option
                          key={day}
                          value={day}
                        >
                          Her ayın {day}. günü
                        </option>
                      ))}
                    </select>

                    <small className="field-help-text">
                      29, 30 veya 31 seçilirse kısa
                      aylarda ayın son günü kullanılır.
                    </small>
                  </div>

                  <div className="form-group full-width">
                    <label>
                      Uzmanlıklar
                      <span className="required-star">
                        *
                      </span>
                    </label>

                    <div className="specialty-grid">
                      {specialties.map((specialty) => {
                        const specialtyId = String(
                          getSpecialtyId(specialty)
                        )
                        const specialtyName =
                          getSpecialtyName(specialty)
                        const isSelected =
                          teacherForm.specialties.some(
                            (item) =>
                              String(item) ===
                              specialtyId
                          )

                        return (
                          <label
                            className={`specialty-item ${
                              isSelected
                                ? 'selected'
                                : ''
                            }`}
                            key={specialtyId}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                handleSpecialtyToggle(
                                  specialty
                                )
                              }
                            />
                            {specialtyName}
                          </label>
                        )
                      })}
                    </div>

                    <div className="specialty-add-row specialty-add-row-bottom">
                      <input
                        value={newSpecialty}
                        onChange={
                          handleNewSpecialtyChange
                        }
                        placeholder="Yeni uzmanlık ekle, örn: Solfej"
                      />

                      <LoadingButton
                        type="button"
                        loading={isSavingSpecialty}
                        loadingText="Ekleniyor..."
                        disabled={isSavingTeacher}
                        onClick={handleAddSpecialty}
                      >
                        + Ekle
                      </LoadingButton>
                    </div>
                  </div>

                  <div className="form-group full-width">
                    <label>Açıklama / Not</label>

                    <textarea
                      name="notes"
                      value={teacherForm.notes}
                      onChange={handleTeacherChange}
                      placeholder="Öğretmenin deneyimleri, çalışma düzeni veya diğer notlar"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="teacher-commission-box package-calculation-box">
              <div>
                <span>
                  Hakediş ve Ödeme Bilgisi
                </span>

                <p>
                  Hakediş, öğretmene bağlı öğrenci
                  paketlerinin toplam ücreti üzerinden
                  belirlenen yüzdeye göre hesaplanır.
                </p>
              </div>

              <div className="package-calculation-grid teacher-payment-summary-grid">
                <div className="package-calculation-item">
                  <small>Öğretmen Payı</small>
                  <strong>
                    %{teacherForm.commissionRate || 0}
                  </strong>
                </div>

                <div className="package-calculation-item">
                  <small>Kuruma Kalan</small>
                  <strong>
                    %
                    {100 -
                      Number(
                        teacherForm.commissionRate ||
                          0
                      )}
                  </strong>
                </div>

                <div className="package-calculation-item">
                  <small>Ödeme Günü</small>
                  <strong>
                    {teacherForm.paymentDay
                      ? `Ayın ${teacherForm.paymentDay}. günü`
                      : 'Seçilmedi'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="teacher-cv-section">
              <label>CV / Belge</label>

              <label
                className={`teacher-cv-dropzone ${
                  isCvDragActive
                    ? 'teacher-cv-dropzone-active'
                    : ''
                }`}
                onDragOver={handleCvDragOver}
                onDragLeave={handleCvDragLeave}
                onDrop={handleCvDrop}
              >
                {teacherForm.cvFileName ? (
                  <div className="teacher-cv-selected">
                    <span className="teacher-cv-file-icon">
                      CV
                    </span>

                    <div className="teacher-cv-file-info">
                      <strong>
                        {teacherForm.cvFileName}
                      </strong>
                      <span>
                        Dosya seçildi. Değiştirmek
                        için alana tekrar tıklayın.
                      </span>
                    </div>

                    <button
                      className="teacher-cv-remove"
                      type="button"
                      onClick={removeCvFile}
                    >
                      Kaldır
                    </button>
                  </div>
                ) : (
                  <div className="teacher-cv-empty">
                    <span className="teacher-upload-icon">
                      <svg
                        viewBox="0 0 32 32"
                        aria-hidden="true"
                      >
                        <path d="M16 22V7" />
                        <path d="m10 13 6-6 6 6" />
                        <path d="M7 23v3h18v-3" />
                      </svg>
                    </span>

                    <div>
                      <strong>
                        CV dosyasını buraya sürükleyin
                      </strong>
                      <p>
                        veya dosya seçmek için tıklayın
                      </p>
                      <small>
                        PDF, DOC veya DOCX · En fazla
                        10 MB
                      </small>
                    </div>
                  </div>
                )}

                <input
                  ref={cvInputRef}
                  className="hidden-file-input"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleCvChange}
                  disabled={isSavingTeacher}
                />
              </label>
            </div>

            <div className="form-actions">
              <button
                className="cancel-button"
                type="button"
                onClick={closeForm}
                disabled={
                  isSavingTeacher ||
                  isSavingSpecialty
                }
              >
                İptal
              </button>

              <LoadingButton
                className="save-button"
                type="submit"
                loading={isSavingTeacher}
                loadingText={
                  editingTeacherId
                    ? 'Güncelleniyor...'
                    : 'Kaydediliyor...'
                }
                disabled={isSavingSpecialty}
              >
                {editingTeacherId
                  ? 'Güncelle'
                  : 'Kaydet'}
              </LoadingButton>
            </div>
          </form>
        </section>
      )}

      <section className="lesson-table-card">
        <div className="table-head">
          <div>
            <h2>Öğretmen Listesi</h2>

            <p>
              Kayıtlı öğretmenler, uzmanlıklar,
              hakediş oranları ve ödeme günleri
            </p>
          </div>

          <button
            className="lesson-count"
            type="button"
          >
            {teachersLoading
              ? '— öğretmen'
              : `${filteredTeachers.length} öğretmen`}
          </button>
        </div>

        <div className="teacher-status-filter-bar">
          <button
            type="button"
            className={`teacher-status-filter-button ${
              teacherStatusFilter === 'active'
                ? 'selected'
                : ''
            }`}
            onClick={() =>
              setTeacherStatusFilter('active')
            }
          >
            Aktif (
            {teachersLoading
              ? '—'
              : activeTeacherCount}
            )
          </button>

          <button
            type="button"
            className={`teacher-status-filter-button ${
              teacherStatusFilter === 'passive'
                ? 'selected'
                : ''
            }`}
            onClick={() =>
              setTeacherStatusFilter('passive')
            }
          >
            Pasif (
            {teachersLoading
              ? '—'
              : passiveTeacherCount}
            )
          </button>

          <button
            type="button"
            className={`teacher-status-filter-button ${
              teacherStatusFilter === 'all'
                ? 'selected'
                : ''
            }`}
            onClick={() =>
              setTeacherStatusFilter('all')
            }
          >
            Tümü (
            {teachersLoading
              ? '—'
              : teachers.length}
            )
          </button>
        </div>

        <div className="payment-table-wrapper">
          <table className="lesson-table teacher-list-table">
            <thead>
              <tr>
                <th>Öğretmen</th>
                <th>Telefon</th>
                <th>E-posta</th>
                <th>Uzmanlıklar</th>
                <th>CV / Belge</th>
                <th>Hakediş</th>
                <th>Ödeme Günü</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>

            <tbody>
              {teachersLoading ? (
                <tr>
                  <td
                    className="empty-table"
                    colSpan="9"
                  >
                    Öğretmenler yükleniyor...
                  </td>
                </tr>
              ) : filteredTeachers.length > 0 ? (
                filteredTeachers.map((teacher) => {
                  const paymentDay =
                    getTeacherPaymentDay(teacher)

                  return (
                    <tr key={teacher.id}>
                      <td>
                        <div className="teacher-table-user">
                          <div className="teacher-table-photo">
                            {teacher.photo ||
                            teacher.profilePhotoUrl ? (
                              <img
                                src={
                                  teacher.photo ||
                                  teacher.profilePhotoUrl
                                }
                                alt={teacher.fullName}
                              />
                            ) : (
                              <span>
                                {teacher.fullName
                                  ?.charAt(0)
                                  ?.toUpperCase() ||
                                  '?'}
                              </span>
                            )}
                          </div>

                          <strong>
                            {teacher.fullName}
                          </strong>
                        </div>
                      </td>

                      <td className="teacher-phone-cell">
                        {teacher.phone || '-'}
                      </td>

                      <td className="teacher-email-cell">
                        {teacher.email || '-'}
                      </td>

                      <td>
                        {getSpecialtyText(teacher)}
                      </td>

                      <td>
                        {teacher.cvUrl ||
                        teacher.cvFile ? (
                          <button
                            className="detail-button"
                            type="button"
                            onClick={() =>
                              openCvFile(teacher)
                            }
                          >
                            CV Görüntüle
                          </button>
                        ) : (
                          teacher.cvFileName || '-'
                        )}
                      </td>

                      <td>
                        %{teacher.commissionRate || 0}
                      </td>

                      <td>
                        {paymentDay
                          ? `Her ayın ${paymentDay}. günü`
                          : 'Tanımlı değil'}
                      </td>

                      <td>
                        <div className="teacher-status-cell">
                          <span
                            className={`status-badge ${
                              isTeacherActive(teacher)
                                ? 'paid'
                                : 'pending'
                            }`}
                          >
                            {isTeacherActive(teacher)
                              ? 'Aktif'
                              : 'Pasif'}
                          </span>

                          {!isTeacherActive(teacher) && (
                            <small>
                              {teacher.passiveDate || 'Tarih yok'}
                              {teacher.passiveReason
                                ? ` · ${teacher.passiveReason}`
                                : ''}
                            </small>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="table-actions teacher-table-actions">
                          <button
                            className="teacher-pdf-button"
                            type="button"
                            onClick={() =>
                              createTeacherPdf(teacher)
                            }
                            disabled={
                              areIdsEqual(
                                creatingTeacherPdfId,
                                teacher.id
                              )
                            }
                          >
                            {areIdsEqual(
                              creatingTeacherPdfId,
                              teacher.id
                            )
                              ? 'Hazırlanıyor...'
                              : 'PDF'}
                          </button>

                          <button
                            className="detail-button"
                            type="button"
                            disabled={areIdsEqual(
                              changingTeacherStatusId,
                              teacher.id
                            )}
                            onClick={() =>
                              openEditForm(teacher)
                            }
                          >
                            Düzenle
                          </button>

                          <LoadingButton
                            className={
                              isTeacherActive(teacher)
                                ? 'teacher-passive-button'
                                : 'teacher-reactivate-button'
                            }
                            type="button"
                            loading={areIdsEqual(
                              changingTeacherStatusId,
                              teacher.id
                            )}
                            loadingText="İşleniyor..."
                            disabled={isSavingTeacher}
                            onClick={() =>
                              changeTeacherStatus(
                                teacher
                              )
                            }
                          >
                            {isTeacherActive(teacher)
                              ? 'Pasife Al'
                              : 'Aktifleştir'}
                          </LoadingButton>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    className="empty-table"
                    colSpan="9"
                  >
                    Seçili duruma uygun öğretmen
                    kaydı bulunmamaktadır.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default Teachers