import {
  useEffect,
  useMemo,
  useState
} from 'react'

import './App.css'

import { supabase } from './lib/supabase'

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
  /*
   * =========================================================
   * SUPABASE AUTH
   * =========================================================
   */

  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [activePage, setActivePage] =
    useState('dashboard')

  /*
   * =========================================================
   * KAYDEDİLMEMİŞ DEĞİŞİKLİKLER
   * =========================================================
   */

  const [unsavedSources, setUnsavedSources] =
    useState({})

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

  /*
   * =========================================================
   * VERİLER
   *
   * Örnek kayıtlar kaldırıldı.
   * Bu state'ler sonraki adımlarda Supabase tablolarından
   * doldurulacak.
   * =========================================================
   */

  const [specialties, setSpecialties] = useState([])
  const [packages, setPackages] = useState([])
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [lessonPlans, setLessonPlans] = useState([])

  const [payments, setPayments] = useState([])
  const [otherIncomes, setOtherIncomes] = useState([])
  const [expenses, setExpenses] = useState([])
  const [teacherPayments, setTeacherPayments] =
    useState([])

  /*
   * =========================================================
   * SUPABASE OTURUM KONTROLÜ
   * =========================================================
   */

  useEffect(() => {
    let isMounted = true

    const loadInitialSession = async () => {
      try {
        const {
          data: { session: currentSession },
          error
        } = await supabase.auth.getSession()

        if (error) {
          console.error(
            'Supabase oturumu alınamadı:',
            error.message
          )
        }

        if (isMounted) {
          setSession(currentSession)
          setAuthLoading(false)
        }
      } catch (error) {
        console.error(
          'Oturum kontrolü sırasında hata:',
          error
        )

        if (isMounted) {
          setSession(null)
          setAuthLoading(false)
        }
      }
    }

    loadInitialSession()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (!isMounted) {
          return
        }

        setSession(currentSession)
        setAuthLoading(false)
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  /*
   * =========================================================
   * KAYDEDİLMEMİŞ DEĞİŞİKLİKLER API
   * =========================================================
   */

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

      const nextSources = {
        ...current
      }

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

  function requestUnsavedAction(action) {
    if (!hasUnsavedChanges) {
      action()
      return
    }

    setPendingAction(() => action)
    setShowUnsavedModal(true)
  }

  const createUnsavedPageApi = (
    sourceKey,
    sourceLabel
  ) => ({
    sourceKey,
    sourceLabel,

    markDirty: () => {
      setUnsavedSource(
        sourceKey,
        true,
        sourceLabel
      )
    },

    markClean: () => {
      clearUnsavedSource(sourceKey)
    },

    requestAction: (action) => {
      requestUnsavedAction(action)
    },

    hasUnsavedChanges:
      Boolean(unsavedSources[sourceKey])
  })

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
   * =========================================================
   * SAYFA YENİLEME / SEKME KAPATMA KORUMASI
   * =========================================================
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
   * =========================================================
   * ORTAK UYARI PENCERESİ
   * =========================================================
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
   * =========================================================
   * GİRİŞ İŞLEMİ
   * =========================================================
   */

  const handleLogin = async (event) => {
    event.preventDefault()

    const cleanEmail = email.trim()

    if (!cleanEmail || !password) {
      alert(
        'Lütfen e-posta ve şifre alanlarını doldurunuz.'
      )
      return
    }

    setLoginLoading(true)

    try {
      const { error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        })

      if (error) {
        if (
          error.message ===
          'Invalid login credentials'
        ) {
          alert('E-posta veya şifre hatalı.')
        } else {
          alert(
            `Giriş yapılamadı: ${error.message}`
          )
        }

        return
      }

      setPassword('')
    } catch (error) {
      console.error(
        'Giriş sırasında beklenmeyen hata:',
        error
      )

      alert(
        'Giriş sırasında beklenmeyen bir hata oluştu.'
      )
    } finally {
      setLoginLoading(false)
    }
  }

  /*
   * =========================================================
   * MENÜ GEÇİŞİ
   * =========================================================
   */

  const handleMenuClick = (page) => {
    if (page === activePage) {
      return
    }

    requestUnsavedAction(() => {
      setActivePage(page)
    })
  }

  /*
   * =========================================================
   * ÇIKIŞ İŞLEMİ
   * =========================================================
   */

  const performLogout = async () => {
    try {
      const { error } =
        await supabase.auth.signOut()

      if (error) {
        alert(
          `Çıkış yapılamadı: ${error.message}`
        )
        return
      }

      clearAllUnsavedSources()

      setSession(null)
      setActivePage('dashboard')
      setEmail('')
      setPassword('')
    } catch (error) {
      console.error(
        'Çıkış sırasında beklenmeyen hata:',
        error
      )

      alert(
        'Çıkış sırasında beklenmeyen bir hata oluştu.'
      )
    }
  }

  const handleLogout = () => {
    requestUnsavedAction(performLogout)
  }

  /*
   * =========================================================
   * OTURUM KONTROL EKRANI
   * =========================================================
   */

  if (authLoading) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-spinner" />

        <p>Oturum kontrol ediliyor...</p>
      </div>
    )
  }

  /*
   * =========================================================
   * LOGIN SAYFASI
   * =========================================================
   */

  if (!session) {
    return (
      <Login
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        handleLogin={handleLogin}
        loginLoading={loginLoading}
      />
    )
  }

  /*
   * =========================================================
   * PANEL
   * =========================================================
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
            specialties={specialties}
            setSpecialties={setSpecialties}
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
            students={students}
            lessonPlans={lessonPlans}
            payments={payments}
            teacherPayments={teacherPayments}
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
              event.target ===
              event.currentTarget
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
                onClick={
                  discardChangesAndContinue
                }
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