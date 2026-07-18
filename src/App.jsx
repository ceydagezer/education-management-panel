import { useEffect, useMemo, useState } from 'react'
import './App.css'

import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'

import Students from './pages/Students'
import Schedule from './pages/Schedule'
import Packages from './pages/Packages'
import Teachers from './pages/Teachers'
import Payments from './pages/Payments'
import Finance from './pages/Finance'
import LessonStatusTracking from './pages/LessonStatusTracking'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [activePage, setActivePage] = useState('dashboard')

  /*
   * KAYDEDİLMEMİŞ DEĞİŞİKLİKLER - GLOBAL ALTYAPI
   *
   * Tek bir boolean yerine kaynak bazlı kayıt tutulur.
   * Böylece bir ekran temizlenirken başka bir ekranın
   * kaydedilmemiş değişiklik bilgisi yanlışlıkla silinmez.
   */
  const [unsavedSources, setUnsavedSources] = useState({})
  const [showUnsavedModal, setShowUnsavedModal] =
    useState(false)
  const [pendingAction, setPendingAction] =
    useState(null)

  const hasUnsavedChanges =
    Object.keys(unsavedSources).length > 0

  const unsavedSourceLabels = useMemo(
    () => Object.values(unsavedSources),
    [unsavedSources]
  )

  const setUnsavedSource = (
    sourceKey,
    isDirty,
    sourceLabel = 'Bu ekran'
  ) => {
    setUnsavedSources((current) => {
      if (isDirty) {
        return {
          ...current,
          [sourceKey]: sourceLabel
        }
      }

      if (!(sourceKey in current)) {
        return current
      }

      const nextSources = { ...current }
      delete nextSources[sourceKey]
      return nextSources
    })
  }

  const clearUnsavedSource = (sourceKey) => {
    setUnsavedSource(sourceKey, false)
  }

  const clearAllUnsavedSources = () => {
    setUnsavedSources({})
  }

  const createUnsavedPageApi = (
    sourceKey,
    sourceLabel
  ) => ({
    sourceKey,
    sourceLabel,
    markDirty: () =>
      setUnsavedSource(
        sourceKey,
        true,
        sourceLabel
      ),
    markClean: () =>
      clearUnsavedSource(sourceKey),
    requestAction: (action) =>
      requestUnsavedAction(action),
    hasUnsavedChanges:
      Boolean(unsavedSources[sourceKey])
  })

  /*
   * FİNANS VERİLERİ
   */

  const [payments, setPayments] = useState([])
  const [otherIncomes, setOtherIncomes] = useState([])
  const [expenses, setExpenses] = useState([])
  const [teacherPayments, setTeacherPayments] = useState([])

  /*
   * PAKETLER
   */

  const [packages, setPackages] = useState([
    {
      id: 1,
      name: 'Tek Bağlama Dersi',
      instrument: 'Bağlama',
      duration: '45 dk',
      lessonCount: 1,
      totalPrice: 1000,
      unitPrice: 1000,
      status: 'Aktif'
    },
    {
      id: 2,
      name: 'Aylık Bağlama Özel Ders',
      instrument: 'Bağlama',
      duration: '45 dk',
      lessonCount: 4,
      totalPrice: 4000,
      unitPrice: 1000,
      status: 'Aktif'
    },
    {
      id: 3,
      name: 'Tek Gitar Dersi',
      instrument: 'Gitar',
      duration: '45 dk',
      lessonCount: 1,
      totalPrice: 1000,
      unitPrice: 1000,
      status: 'Aktif'
    },
    {
      id: 4,
      name: 'Aylık Gitar Özel Ders',
      instrument: 'Gitar',
      duration: '45 dk',
      lessonCount: 4,
      totalPrice: 4000,
      unitPrice: 1000,
      status: 'Aktif'
    },
    {
      id: 5,
      name: 'Tek Piyano Dersi',
      instrument: 'Piyano',
      duration: '45 dk',
      lessonCount: 1,
      totalPrice: 1250,
      unitPrice: 1250,
      status: 'Aktif'
    },
    {
      id: 6,
      name: 'Aylık Piyano Özel Ders',
      instrument: 'Piyano',
      duration: '45 dk',
      lessonCount: 4,
      totalPrice: 5000,
      unitPrice: 1250,
      status: 'Aktif'
    },
    {
      id: 7,
      name: 'Tek Keman Dersi',
      instrument: 'Keman',
      duration: '45 dk',
      lessonCount: 1,
      totalPrice: 1000,
      unitPrice: 1000,
      status: 'Aktif'
    },
    {
      id: 8,
      name: 'Aylık Keman Özel Ders',
      instrument: 'Keman',
      duration: '45 dk',
      lessonCount: 4,
      totalPrice: 4000,
      unitPrice: 1000,
      status: 'Aktif'
    },
    {
      id: 9,
      name: 'Tek Yan Flüt Dersi',
      instrument: 'Yan Flüt',
      duration: '45 dk',
      lessonCount: 1,
      totalPrice: 1000,
      unitPrice: 1000,
      status: 'Aktif'
    },
    {
      id: 10,
      name: 'Aylık Yan Flüt Özel Ders',
      instrument: 'Yan Flüt',
      duration: '45 dk',
      lessonCount: 4,
      totalPrice: 4000,
      unitPrice: 1000,
      status: 'Aktif'
    }
  ])

  /*
   * BRANŞLAR
   */

  const [specialties, setSpecialties] = useState([
    'Bağlama',
    'Gitar',
    'Piyano',
    'Keman',
    'Yan Flüt'
  ])

  /*
   * ÖĞRETMENLER
   */

  const [teachers, setTeachers] = useState([
    {
      id: 1,
      fullName: 'Meral Hoca',
      phone: '',
      email: '',
      birthDate: '',
      gender: 'Kadın',
      branch: 'Piyano',
      specialties: ['Piyano'],
      commissionRate: 50,
      isActive: true,
      photo: '',
      cvFileName: '',
      notes: ''
    },
    {
      id: 2,
      fullName: 'Ali Hoca',
      phone: '',
      email: '',
      birthDate: '',
      gender: 'Erkek',
      branch: 'Gitar',
      specialties: ['Gitar'],
      commissionRate: 50,
      isActive: true,
      photo: '',
      cvFileName: '',
      notes: ''
    }
  ])

  /*
   * ÖĞRENCİLER
   */

  const [students, setStudents] = useState([
    {
      id: 1,
      tcNo: '12345678901',
      fullName: 'Aylin Toksöz',
      gender: 'Kadın',
      birthDate: '2012-04-15',
      registerDate: '2026-07-01',
      phone: '05xx xxx xx xx',
      email: 'aylin@example.com',
      address: 'Çanakkale Merkez',

      motherName: 'Ayşe Toksöz',
      motherPhone: '05xx xxx xx xx',

      fatherName: 'Mehmet Toksöz',
      fatherPhone: '05xx xxx xx xx',

      packageIds: [6],

      enrolledPackages: [
        {
          studentPackageId: 'student-1-package-6',
          packageId: 6,
          packageName: 'Aylık Piyano Özel Ders',
          instrument: 'Piyano',
          lessonDuration: '45 dk',
          lessonCount: 4,
          monthlyFee: 5000,
          agreedPrice: 5000,

          teacherId: 1,
          teacherName: 'Meral Hoca',
          teacher: 'Meral Hoca'
        }
      ],

      instrument: 'Piyano',
      packageId: 6,
      packageName: 'Aylık Piyano Özel Ders',
      lessonDuration: '45 dk',
      lessonCount: 4,
      monthlyFee: 5000,
      agreedPrice: 5000,

      teacherId: 1,
      teacherName: 'Meral Hoca',
      teacher: 'Meral Hoca',

      lessonPlans: [],
      notes: 'Örnek öğrenci kaydı'
    }
  ])

  /*
   * DERS PLANLARI
   */

  const [lessonPlans, setLessonPlans] = useState([
    {
      id: 1,
      day: 'Çarşamba',
      time: '11:00',
      duration: '45 dk',

      studentId: 1,
      studentName: 'Aylin Toksöz',

      teacherId: 1,
      teacherName: 'Meral Hoca',

      packageId: 6,
      packageName: 'Aylık Piyano Özel Ders',

      instrument: 'Piyano',
      location: 'Sınıf 1',

      status: 'Planlandı',
      note: '',

      isMakeup: false,
      relatedLessonId: null
    }
  ])

  /*
   * SAYFA YENİLEME / SEKME KAPATMA KORUMASI
   */

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener(
      'beforeunload',
      handleBeforeUnload
    )

    return () => {
      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload
      )
    }
  }, [hasUnsavedChanges])

  /*
   * Kaydedilmemiş veri yoksa işlem doğrudan çalışır.
   * Varsa işlem bekletilir ve ortak uyarı penceresi açılır.
   */
  function requestUnsavedAction(action) {
    if (!hasUnsavedChanges) {
      action()
      return
    }

    setPendingAction(() => action)
    setShowUnsavedModal(true)
  }

  const stayOnCurrentPage = () => {
    setPendingAction(null)
    setShowUnsavedModal(false)
  }

  const discardChangesAndContinue = () => {
    const actionToRun = pendingAction

    clearAllUnsavedSources()
    setPendingAction(null)
    setShowUnsavedModal(false)

    if (typeof actionToRun === 'function') {
      actionToRun()
    }
  }

  /*
   * ORTAK UYARI PENCERESİ DAVRANIŞI
   *
   * Escape tuşu uyarıyı kapatır ve kullanıcı mevcut
   * sayfada kalır. Modal açıkken arka sayfanın kayması
   * engellenir.
   */
  useEffect(() => {
    if (!showUnsavedModal) {
      return undefined
    }

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow = 'hidden'

    const handleModalKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPendingAction(null)
        setShowUnsavedModal(false)
      }
    }

    document.addEventListener(
      'keydown',
      handleModalKeyDown
    )

    return () => {
      document.body.style.overflow =
        previousOverflow

      document.removeEventListener(
        'keydown',
        handleModalKeyDown
      )
    }
  }, [showUnsavedModal])

  /*
   * GİRİŞ İŞLEMLERİ
   */

  const handleLogin = (event) => {
    event.preventDefault()

    if (email.trim() === '' || password.trim() === '') {
      alert('Lütfen e-posta ve şifre alanlarını doldurunuz.')
      return
    }

    setIsLoggedIn(true)
  }

  const handleMenuClick = (page) => {
    if (page === activePage) {
      return
    }

    requestUnsavedAction(() => {
      setActivePage(page)
    })
  }

  const performLogout = () => {
    clearAllUnsavedSources()
    setIsLoggedIn(false)
    setActivePage('dashboard')
    setEmail('')
    setPassword('')
  }

  const handleLogout = () => {
    requestUnsavedAction(performLogout)
  }

  /*
   * LOGIN SAYFASI
   */

  if (!isLoggedIn) {
    return (
      <Login
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        handleLogin={handleLogin}
      />
    )
  }

  /*
   * PANEL
   */

  return (
    <div className="app">
      <Sidebar
        activePage={activePage}
        handleMenuClick={handleMenuClick}
        handleLogout={handleLogout}
      />

      <main className="dashboard">
        {activePage === 'dashboard' && (
          <Dashboard
            students={students}
            teachers={teachers}
            packages={packages}
            lessonPlans={lessonPlans}
            payments={payments}
            otherIncomes={otherIncomes}
            teacherPayments={teacherPayments}
            onNavigate={handleMenuClick}
          />
        )}

        {activePage === 'students' && (
          <Students
            students={students}
            setStudents={setStudents}
            lessonPlans={lessonPlans}
            setLessonPlans={setLessonPlans}
            packages={packages}
            teachers={teachers}
            payments={payments}
            setPayments={setPayments}
            unsavedChanges={createUnsavedPageApi(
              'students',
              'Öğrenci işlemleri'
            )}
          />
        )}

        {activePage === 'packages' && (
          <Packages
            packages={packages}
            setPackages={setPackages}
            unsavedChanges={createUnsavedPageApi(
              'packages',
              'Paket işlemleri'
            )}
          />
        )}

        {activePage === 'teachers' && (
          <Teachers
            teachers={teachers}
            setTeachers={setTeachers}
            specialties={specialties}
            setSpecialties={setSpecialties}
            unsavedChanges={createUnsavedPageApi(
              'teachers',
              'Öğretmen işlemleri'
            )}
          />
        )}

        {activePage === 'schedule' && (
          <Schedule
            lessonPlans={lessonPlans}
            setLessonPlans={setLessonPlans}
            students={students}
            teachers={teachers}
            packages={packages}
            unsavedChanges={createUnsavedPageApi(
              'schedule',
              'Ders programı işlemleri'
            )}
          />
        )}

        {activePage === 'lesson-status' && (
          <LessonStatusTracking
            lessons={lessonPlans}
            setLessons={setLessonPlans}
            teachers={teachers}
            students={students}
            packages={packages}
            unsavedChanges={createUnsavedPageApi(
              'lesson-status',
              'Ders durumu işlemleri'
            )}
          />
        )}

        {activePage === 'payments' && (
          <Payments
            students={students}
            setStudents={setStudents}
            payments={payments}
            setPayments={setPayments}
            unsavedChanges={createUnsavedPageApi(
              'payments',
              'Tahsilat işlemleri'
            )}
          />
        )}

        {activePage === 'finance' && (
          <Finance
            students={students}
            payments={payments}
            teachers={teachers}
            packages={packages}
            lessonPlans={lessonPlans}
            otherIncomes={otherIncomes}
            setOtherIncomes={setOtherIncomes}
            expenses={expenses}
            setExpenses={setExpenses}
            teacherPayments={teacherPayments}
            setTeacherPayments={setTeacherPayments}
            unsavedChanges={createUnsavedPageApi(
              'finance',
              'Finans işlemleri'
            )}
          />
        )}
      </main>

      {showUnsavedModal && (
        <div
          className="unsaved-changes-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              stayOnCurrentPage()
            }
          }}
        >
          <div
            className="unsaved-changes-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-changes-title"
            aria-describedby="unsaved-changes-description"
          >
            <div className="unsaved-changes-icon">
              !
            </div>

            <div className="unsaved-changes-content">
              <h2 id="unsaved-changes-title">
                Kaydedilmemiş değişiklikler var
              </h2>

              <p id="unsaved-changes-description">
                Bu sayfadan ayrılırsanız yaptığınız
                değişiklikler kaybolacaktır.
              </p>

              {unsavedSourceLabels.length > 0 && (
                <div className="unsaved-source-list">
                  {unsavedSourceLabels.map(
                    (sourceLabel) => (
                      <span key={sourceLabel}>
                        {sourceLabel}
                      </span>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="unsaved-changes-actions">
              <button
                type="button"
                className="unsaved-stay-button"
                onClick={stayOnCurrentPage}
              >
                Sayfada Kal
              </button>

              <button
                type="button"
                className="unsaved-leave-button"
                onClick={discardChangesAndContinue}
              >
                Kaydetmeden Çık
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App