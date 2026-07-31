import {
  useEffect,
  useMemo,
  useState
} from 'react'

import './App.css'

import { supabase } from './lib/supabase'

import {
  getPackages,
  getSpecialties
} from './services/catalogService'

import {
  getTeachers
} from './services/teacherService'

import {
  getStudents
} from './services/studentService'

import {
  getLessonPlans,
  getLessonOccurrences
} from './services/lessonService'


import {
  getTeacherPayments
} from './services/financeService'

import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'

import {
  ErrorState,
  LoadingState
} from './components/AsyncState'

import Students from './pages/Students'
import Schedule from './pages/Schedule'
import Packages from './pages/Packages'
import Teachers from './pages/Teachers'
import Payments from './pages/Payments'
import Finance from './pages/Finance'
import LessonStatusTracking from './pages/LessonStatusTracking'
import LessonGroups from './pages/LessonGroups'

const VALID_PAGES = [
  'dashboard',
  'students',
  'packages',
  'teachers',
  'schedule',
  'lesson-status',
  'lesson-groups',
  'payments',
  'finance'
]

const getReadableConnectionError = (
  error,
  fallbackMessage
) => {
  if (
    typeof navigator !== 'undefined' &&
    !navigator.onLine
  ) {
    return 'İnternet bağlantısı bulunamadı. Bağlantınızı kontrol edip tekrar deneyiniz.'
  }

  const message = String(
    error?.message || ''
  ).toLocaleLowerCase('tr-TR')

  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('zaman aşımı')
  ) {
    return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyiniz.'
  }

  return fallbackMessage
}

function App() {
  /*
   * =========================================================
   * SUPABASE AUTH
   * =========================================================
   */

  const [session, setSession] =
    useState(null)

  const [authLoading, setAuthLoading] =
    useState(true)

  const [authError, setAuthError] =
    useState('')

  const [authCheckKey, setAuthCheckKey] =
    useState(0)

  const [loginLoading, setLoginLoading] =
    useState(false)

  const [loginError, setLoginError] =
    useState('')

  const [dataLoading, setDataLoading] =
    useState(false)

  const [dataError, setDataError] =
    useState('')

  const [
    catalogReloadKey,
    setCatalogReloadKey
  ] = useState(0)

  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [activePage, setActivePage] =
    useState(() => {
      const savedPage =
        localStorage.getItem(
          'arti-akademi-active-page'
        )

      return VALID_PAGES.includes(savedPage)
        ? savedPage
        : 'dashboard'
    })

  useEffect(() => {
    localStorage.setItem(
      'arti-akademi-active-page',
      activePage
    )
  }, [activePage])

  /*
   * =========================================================
   * KAYDEDİLMEMİŞ DEĞİŞİKLİKLER
   * =========================================================
   */

  const [
    unsavedSources,
    setUnsavedSources
  ] = useState({})

  const [
    showUnsavedModal,
    setShowUnsavedModal
  ] = useState(false)

  const [
    pendingAction,
    setPendingAction
  ] = useState(null)

  const hasUnsavedChanges =
    Object.keys(
      unsavedSources
    ).length > 0

  const unsavedSourceLabels =
    useMemo(
      () =>
        Object.values(
          unsavedSources
        ),
      [unsavedSources]
    )

  /*
   * =========================================================
   * VERİLER
   * =========================================================
   */

  const [
    specialties,
    setSpecialties
  ] = useState([])

  const [
    packages,
    setPackages
  ] = useState([])

  const [
    teachers,
    setTeachers
  ] = useState([])

  const [
    students,
    setStudents
  ] = useState([])

  const [
    lessonPlans,
    setLessonPlans
  ] = useState([])

  const [
    lessonOccurrences,
    setLessonOccurrences
  ] = useState([])

  const [
    lessonOccurrencesLoaded,
    setLessonOccurrencesLoaded
  ] = useState(false)

  const [
    lessonOccurrencesLoading,
    setLessonOccurrencesLoading
  ] = useState(false)

  const [
    lessonOccurrencesError,
    setLessonOccurrencesError
  ] = useState('')

  const [
    lessonOccurrencesReloadKey,
    setLessonOccurrencesReloadKey
  ] = useState(0)


  const [
    otherIncomes,
    setOtherIncomes
  ] = useState([])

  const [
    expenses,
    setExpenses
  ] = useState([])

  const [
    teacherPayments,
    setTeacherPayments
  ] = useState([])

  const clearAppData = () => {
    setSpecialties([])
    setPackages([])
    setTeachers([])
    setStudents([])
    setLessonPlans([])
    setLessonOccurrences([])
    setLessonOccurrencesLoaded(false)
    setLessonOccurrencesLoading(false)
    setLessonOccurrencesError('')
    setLessonOccurrencesReloadKey(0)
    setOtherIncomes([])
    setExpenses([])
    setTeacherPayments([])
    setDataError('')
    setDataLoading(false)
  }

  /*
   * =========================================================
   * SUPABASE PANEL VERİLERİNİ YÜKLE
   * =========================================================
   */

  useEffect(() => {
    if (!session) {
      return undefined
    }

    let isMounted = true
    let timeoutId

    const loadPanelData =
      async () => {
        setDataLoading(true)
        setDataError('')

        if (
          typeof navigator !==
            'undefined' &&
          !navigator.onLine
        ) {
          if (isMounted) {
            setDataError(
              'İnternet bağlantısı bulunamadı. Bağlantınızı kontrol edip tekrar deneyiniz.'
            )
            setDataLoading(false)
          }

          return
        }

        try {
          const panelDataPromise =
            Promise.all([
              getSpecialties(),
              getPackages(),
              getTeachers(),
              getStudents(),
              getLessonPlans(),
              getTeacherPayments()
            ])

          const timeoutPromise =
            new Promise(
              (_, reject) => {
                timeoutId =
                  window.setTimeout(
                    () => {
                      reject(
                        new Error(
                          'Panel verileri zaman aşımına uğradı.'
                        )
                      )
                    },
                    10000
                  )
              }
            )

          const [
            specialtiesResult,
            packagesResult,
            teachersResult,
            studentsResult,
            lessonPlansResult,
            teacherPaymentsResult
          ] = await Promise.race([
            panelDataPromise,
            timeoutPromise
          ])

          if (timeoutId) {
            window.clearTimeout(
              timeoutId
            )
          }

          if (!isMounted) {
            return
          }

          setSpecialties(
            specialtiesResult
          )

          setPackages(
            packagesResult
          )

          setTeachers(
            teachersResult
          )

          setStudents(
            studentsResult
          )

          setLessonPlans(
            lessonPlansResult
          )

          setTeacherPayments(
            teacherPaymentsResult
          )
        } catch (error) {
          console.error(
            'Panel verileri yüklenemedi:',
            error
          )

          if (timeoutId) {
            window.clearTimeout(
              timeoutId
            )
          }

          if (isMounted) {
            setDataError(
              getReadableConnectionError(
                error,
                'Panel verileri şu anda yüklenemedi. Lütfen kısa bir süre sonra tekrar deneyiniz.'
              )
            )
          }
        } finally {
          if (isMounted) {
            setDataLoading(false)
          }
        }
      }

    loadPanelData()

    return () => {
      isMounted = false

      if (timeoutId) {
        window.clearTimeout(
          timeoutId
        )
      }
    }
  }, [
    session,
    catalogReloadKey
  ])

  const retryPanelDataLoad =
    () => {
      setCatalogReloadKey(
        (current) =>
          current + 1
      )
    }

  useEffect(() => {
    const retryWhenOnline = () => {
      if (!dataError) {
        return
      }

      setDataError('')
      setCatalogReloadKey(
        (current) =>
          current + 1
      )
    }

    window.addEventListener(
      'online',
      retryWhenOnline
    )

    return () => {
      window.removeEventListener(
        'online',
        retryWhenOnline
      )
    }
  }, [dataError])

  useEffect(() => {
    const markOccurrencesStale = () => {
      setLessonOccurrencesLoaded(false)
    }

    window.addEventListener(
      'arti-akademi-lesson-occurrences-stale',
      markOccurrencesStale
    )

    return () => {
      window.removeEventListener(
        'arti-akademi-lesson-occurrences-stale',
        markOccurrencesStale
      )
    }
  }, [])

  useEffect(() => {
    if (
      !session ||
      activePage !== 'lesson-status' ||
      lessonOccurrencesLoaded
    ) {
      return undefined
    }

    let isMounted = true

    const loadLessonOccurrences =
      async () => {
        setLessonOccurrencesLoading(true)
        setLessonOccurrencesError('')

        try {
          const result =
            await getLessonOccurrences()

          if (!isMounted) {
            return
          }

          setLessonOccurrences(result)
          setLessonOccurrencesLoaded(true)
        } catch (error) {
          console.error(
            'Ders durum kayıtları alınamadı:',
            error
          )

          if (isMounted) {
            setLessonOccurrencesError(
              getReadableConnectionError(
                error,
                'Ders durum kayıtları şu anda alınamadı. Lütfen tekrar deneyiniz.'
              )
            )
          }
        } finally {
          if (isMounted) {
            setLessonOccurrencesLoading(false)
          }
        }
      }

    loadLessonOccurrences()

    return () => {
      isMounted = false
    }
  }, [
    session,
    activePage,
    lessonOccurrencesLoaded,
    lessonOccurrencesReloadKey
  ])

  /*
   * =========================================================
   * SUPABASE OTURUM KONTROLÜ
   * =========================================================
   */

  useEffect(() => {
    let isMounted = true
    let timeoutId

    const loadInitialSession =
      async () => {
        setAuthLoading(true)
        setAuthError('')

        if (
          typeof navigator !==
            'undefined' &&
          !navigator.onLine
        ) {
          if (isMounted) {
            setSession(null)
            setAuthLoading(false)
            setAuthError(
              'İnternet bağlantısı bulunamadı. Bağlantınızı kontrol edip tekrar deneyiniz.'
            )
          }

          return
        }

        try {
          const sessionPromise =
            supabase.auth.getSession()

          const timeoutPromise =
            new Promise(
              (_, reject) => {
                timeoutId =
                  window.setTimeout(
                    () => {
                      reject(
                        new Error(
                          'Oturum kontrolü zaman aşımına uğradı.'
                        )
                      )
                    },
                    8000
                  )
              }
            )

          const {
            data: {
              session:
                currentSession
            },
            error
          } = await Promise.race([
            sessionPromise,
            timeoutPromise
          ])

          if (timeoutId) {
            window.clearTimeout(
              timeoutId
            )
          }

          if (error) {
            throw error
          }

          if (isMounted) {
            setSession(
              currentSession
            )
            setAuthError('')
            setAuthLoading(false)
          }
        } catch (error) {
          console.error(
            'Oturum kontrolü sırasında hata:',
            error
          )

          if (timeoutId) {
            window.clearTimeout(
              timeoutId
            )
          }

          if (isMounted) {
            setSession(null)
            setAuthError(
              getReadableConnectionError(
                error,
                'Oturum kontrolü tamamlanamadı. Lütfen tekrar deneyiniz.'
              )
            )
            setAuthLoading(false)
          }
        }
      }

    loadInitialSession()

    const {
      data: {
        subscription
      }
    } =
      supabase.auth.onAuthStateChange(
        (
          _event,
          currentSession
        ) => {
          if (!isMounted) {
            return
          }

          setSession(
            currentSession
          )
          setAuthError('')
          setAuthLoading(false)

          if (!currentSession) {
            clearAppData()
          }
        }
      )

    const handleOnline = () => {
      if (!isMounted) {
        return
      }

      setAuthCheckKey(
        (current) =>
          current + 1
      )
    }

    const handleOffline = () => {
      if (!isMounted) {
        return
      }

      setAuthLoading(false)
      setAuthError(
        'İnternet bağlantısı kesildi. Bağlantınızı kontrol edip tekrar deneyiniz.'
      )
    }

    window.addEventListener(
      'online',
      handleOnline
    )

    window.addEventListener(
      'offline',
      handleOffline
    )

    return () => {
      isMounted = false

      if (timeoutId) {
        window.clearTimeout(
          timeoutId
        )
      }

      window.removeEventListener(
        'online',
        handleOnline
      )

      window.removeEventListener(
        'offline',
        handleOffline
      )

      subscription.unsubscribe()
    }
  }, [authCheckKey])

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
    setUnsavedSources(
      (current) => {
        if (isDirty) {
          return {
            ...current,
            [sourceKey]:
              sourceLabel
          }
        }

        if (
          !(
            sourceKey in
            current
          )
        ) {
          return current
        }

        const nextSources = {
          ...current
        }

        delete nextSources[
          sourceKey
        ]

        return nextSources
      }
    )
  }

  const clearUnsavedSource = (
    sourceKey
  ) => {
    setUnsavedSource(
      sourceKey,
      false
    )
  }

  const clearAllUnsavedSources =
    () => {
      setUnsavedSources({})
    }

  function requestUnsavedAction(
    action
  ) {
    if (!hasUnsavedChanges) {
      action()
      return
    }

    setPendingAction(
      () => action
    )

    setShowUnsavedModal(
      true
    )
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
      clearUnsavedSource(
        sourceKey
      )
    },

    requestAction: (
      action
    ) => {
      requestUnsavedAction(
        action
      )
    },

    hasUnsavedChanges:
      Boolean(
        unsavedSources[
          sourceKey
        ]
      )
  })

  const stayOnCurrentPage =
    () => {
      setPendingAction(null)

      setShowUnsavedModal(
        false
      )
    }

  const discardChangesAndContinue =
    () => {
      const actionToRun =
        pendingAction

      window.dispatchEvent(
        new CustomEvent(
          'arti-akademi-discard-drafts'
        )
      )

      clearAllUnsavedSources()

      setPendingAction(null)

      setShowUnsavedModal(
        false
      )

      if (
        typeof actionToRun ===
        'function'
      ) {
        actionToRun()
      }
    }

  /*
   * =========================================================
   * SAYFA YENİLEME / SEKME KAPATMA KORUMASI
   * =========================================================
   */

  useEffect(() => {
    if (
      !hasUnsavedChanges
    ) {
      return undefined
    }

    const handleBeforeUnload =
      (event) => {
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
    if (
      !showUnsavedModal
    ) {
      return undefined
    }

    const previousOverflow =
      document.body.style
        .overflow

    document.body.style.overflow =
      'hidden'

    const handleModalKeyDown =
      (event) => {
        if (
          event.key ===
          'Escape'
        ) {
          setPendingAction(null)

          setShowUnsavedModal(
            false
          )
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

  const handleLogin =
    async (event) => {
      event.preventDefault()

      const cleanEmail =
        email.trim()

      setLoginError('')

      if (
        !cleanEmail ||
        !password
      ) {
        setLoginError(
          'Lütfen e-posta ve şifre alanlarını doldurunuz.'
        )

        return
      }

      setLoginLoading(true)

      try {
        const { error } =
          await supabase.auth.signInWithPassword(
            {
              email:
                cleanEmail,
              password
            }
          )

        if (error) {
          if (
            error.message ===
            'Invalid login credentials'
          ) {
            setLoginError(
              'E-posta veya şifre hatalı.'
            )
          } else {
            setLoginError(
              getReadableConnectionError(
                error,
                'Giriş yapılamadı. Lütfen bilgilerinizi kontrol edip tekrar deneyiniz.'
              )
            )
          }

          return
        }

        setPassword('')
        setLoginError('')
      } catch (error) {
        console.error(
          'Giriş sırasında beklenmeyen hata:',
          error
        )

        setLoginError(
          getReadableConnectionError(
            error,
            'Giriş sırasında beklenmeyen bir hata oluştu.'
          )
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

  const handleMenuClick = (
    page
  ) => {
    if (
      page === activePage
    ) {
      return
    }

    requestUnsavedAction(
      () => {
        setActivePage(page)
      }
    )
  }

  /*
   * =========================================================
   * ÇIKIŞ İŞLEMİ
   * =========================================================
   */

  const performLogout =
    async () => {
      try {
        const { error } =
          await supabase.auth.signOut()

        if (error) {
          alert(
            getReadableConnectionError(
              error,
              'Çıkış işlemi tamamlanamadı. Lütfen tekrar deneyiniz.'
            )
          )

          return
        }

        /*
         * Oturum kapandıktan sonra giriş ekranına geçişi
         * bekletmeden ve boş ekran oluşturmadan tamamla.
         */
        setSession(null)
        setAuthLoading(false)
        setAuthError('')
        setDataLoading(false)
        setDataError('')

        clearAllUnsavedSources()
        clearAppData()

        localStorage.removeItem(
          'arti-akademi-active-page'
        )

        setActivePage(
          'dashboard'
        )

        setEmail('')
        setPassword('')
        setLoginError('')
      } catch (error) {
        console.error(
          'Çıkış sırasında beklenmeyen hata:',
          error
        )

        alert(
          getReadableConnectionError(
            error,
            'Çıkış sırasında beklenmeyen bir hata oluştu.'
          )
        )
      }
    }

  const handleLogout = () => {
    requestUnsavedAction(
      performLogout
    )
  }

  /*
   * =========================================================
   * OTURUM KONTROL EKRANI
   * =========================================================
   */

  if (authLoading) {
    return (
      <div className="app-loading-screen">
        <LoadingState
          text="Oturum kontrol ediliyor..."
        />
      </div>
    )
  }

  if (authError) {
    return (
      <div className="app-loading-screen">
        <ErrorState
          title="Bağlantı kurulamadı"
          message={authError}
          onRetry={() => {
            setAuthError('')
            setAuthCheckKey(
              (current) =>
                current + 1
            )
          }}
        />
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
        setPassword={
          setPassword
        }
        handleLogin={
          handleLogin
        }
        loginLoading={
          loginLoading
        }
        loginError={
          loginError
        }
      />
    )
  }

  if (dataLoading) {
    return (
      <div className="app-loading-screen">
        <LoadingState
          text="Branşlar, paketler, öğretmenler, öğrenciler, ders programı ve öğretmen ödeme kayıtları yükleniyor..."
        />
      </div>
    )
  }

  if (dataError) {
    return (
      <div className="app-loading-screen">
        <ErrorState
          title="Panel verileri yüklenemedi"
          message={dataError}
          onRetry={
            retryPanelDataLoad
          }
        />
      </div>
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
        activePage={
          activePage
        }
        handleMenuClick={
          handleMenuClick
        }
        handleLogout={
          handleLogout
        }
      />

      <main className="dashboard">
        {activePage ===
          'dashboard' && (
          <Dashboard
            students={
              students
            }
            teachers={
              teachers
            }
            lessonPlans={
              lessonPlans
            }
            onNavigate={
              handleMenuClick
            }
          />
        )}

        {activePage ===
          'students' && (
          <Students
            students={
              students
            }
            setStudents={
              setStudents
            }
            lessonPlans={
              lessonPlans
            }
            setLessonPlans={
              setLessonPlans
            }
            packages={
              packages
            }
            teachers={
              teachers
            }
            unsavedChanges={createUnsavedPageApi(
              'students',
              'Öğrenci işlemleri'
            )}
          />
        )}

        {activePage ===
          'packages' && (
          <Packages
            packages={
              packages
            }
            setPackages={
              setPackages
            }
            specialties={
              specialties
            }
            setSpecialties={
              setSpecialties
            }
            unsavedChanges={createUnsavedPageApi(
              'packages',
              'Paket işlemleri'
            )}
          />
        )}

        {activePage ===
          'teachers' && (
          <Teachers
            teachers={
              teachers
            }
            setTeachers={
              setTeachers
            }
            specialties={
              specialties
            }
            setSpecialties={
              setSpecialties
            }
            students={
              students
            }
            lessonPlans={
              lessonPlans
            }
            teacherPayments={
              teacherPayments
            }
            unsavedChanges={createUnsavedPageApi(
              'teachers',
              'Öğretmen işlemleri'
            )}
          />
        )}

        {activePage ===
          'schedule' && (
          <Schedule
            lessonPlans={
              lessonPlans
            }
            setLessonPlans={
              setLessonPlans
            }
            students={
              students
            }
            teachers={
              teachers
            }
            packages={
              packages
            }
            unsavedChanges={createUnsavedPageApi(
              'schedule',
              'Ders programı işlemleri'
            )}
          />
        )}

        {activePage ===
          'lesson-status' && (
          lessonOccurrencesLoading &&
          !lessonOccurrencesLoaded ? (
            <LoadingState
              text="Ders durum kayıtları yükleniyor..."
            />
          ) : lessonOccurrencesError &&
            !lessonOccurrencesLoaded ? (
            <ErrorState
              title="Ders durum kayıtları yüklenemedi"
              message={
                lessonOccurrencesError
              }
              onRetry={() => {
                setLessonOccurrencesError('')
                setLessonOccurrencesLoaded(false)
                setLessonOccurrencesReloadKey(
                  (current) => current + 1
                )
              }}
            />
          ) : (
            <LessonStatusTracking
              lessons={
                lessonOccurrences
              }
              setLessons={
                setLessonOccurrences
              }
              lessonPlans={
                lessonPlans
              }
              teachers={
                teachers
              }
              students={
                students
              }
              packages={
                packages
              }
              unsavedChanges={createUnsavedPageApi(
                'lesson-status',
                'Ders durumu işlemleri'
              )}
            />
          )
        )}

        {activePage ===
          'lesson-groups' && (
          <LessonGroups
            specialties={
              specialties
            }
            teachers={
              teachers
            }
            students={
              students
            }
            packages={
              packages
            }
            unsavedChanges={createUnsavedPageApi(
              'lesson-groups',
              'Ders grubu işlemleri'
            )}
          />
        )}

        {activePage ===
          'payments' && (
          <Payments
            students={
              students
            }
            setStudents={
              setStudents
            }
            unsavedChanges={createUnsavedPageApi(
              'payments',
              'Tahsilat işlemleri'
            )}
          />
        )}

        {activePage ===
          'finance' && (
          <Finance
            students={
              students
            }
            teachers={
              teachers
            }
            packages={
              packages
            }
            lessonPlans={
              lessonPlans
            }
            otherIncomes={
              otherIncomes
            }
            setOtherIncomes={
              setOtherIncomes
            }
            expenses={
              expenses
            }
            setExpenses={
              setExpenses
            }
            teacherPayments={
              teacherPayments
            }
            setTeacherPayments={
              setTeacherPayments
            }
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
          onMouseDown={(
            event
          ) => {
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
                Kaydedilmemiş
                değişiklikler var
              </h2>

              <p id="unsaved-changes-description">
                Bu sayfadan
                ayrılırsanız yaptığınız
                değişiklikler
                kaybolacaktır.
              </p>

              {unsavedSourceLabels.length >
                0 && (
                <div className="unsaved-source-list">
                  {unsavedSourceLabels.map(
                    (
                      sourceLabel
                    ) => (
                      <span
                        key={
                          sourceLabel
                        }
                      >
                        {
                          sourceLabel
                        }
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
                onClick={
                  stayOnCurrentPage
                }
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