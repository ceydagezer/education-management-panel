import {
  useEffect,
  useMemo,
  useState
} from 'react'

import './App.css'

import { supabase } from './lib/supabase'
import { queryClient } from './lib/queryClient'

import {
  getPackages,
  getSpecialties
} from './services/catalogService'

import {
  getTeachers
} from './services/teacherService'

import {
  getDashboardStudents,
  getScheduleStudents,
  getStudents
} from './services/studentService'

import {
  getLessonPlans,
  getLessonOccurrences
} from './services/lessonService'

import {
  getPaymentStudents
} from './services/paymentService'
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
import Reports from './pages/Reports'
import UserManagement from './pages/UserManagement'

const VALID_PAGES = [
  'dashboard',
  'students',
  'packages',
  'teachers',
  'schedule',
  'lesson-status',
  'lesson-groups',
  'payments',
  'finance',
  'reports',
  'user-management'
]

const FULL_STUDENT_DATA_PAGES = new Set([])

const STUDENT_PACKAGE_SUMMARY_PAGES = new Set([
  'schedule',
  'lesson-status'
])


const LESSON_PLAN_DATA_PAGES = new Set([
  'students',
  'schedule',
  'lesson-status'
])

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

  const [
    currentUserRole,
    setCurrentUserRole
  ] = useState(null)

  const [
    userRoleLoading,
    setUserRoleLoading
  ] = useState(false)

  const [
    userRoleError,
    setUserRoleError
  ] = useState('')

  const isAdmin =
    currentUserRole === 'admin'

  const [dataLoading, setDataLoading] =
    useState(true)

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

  /*
   * Dashboard başlangıçta yalnızca ihtiyaç duyduğu hafif öğrenci
   * alanlarını kullanır. Veli + paket ilişkilerini içeren tam öğrenci
   * modeli, gerçekten gereken bir sayfa açılana kadar yüklenmez.
   */
  const [
    dashboardStudents,
    setDashboardStudents
  ] = useState([])

  /*
   * Ders Programı; tam öğrenci profiline değil, kimlik/durum ve
   * paket-atama özetine ihtiyaç duyar. Bu veri yalnız program
   * ekranı ilk kez açıldığında yüklenir.
   */
  const [
    scheduleStudents,
    setScheduleStudents
  ] = useState([])

  const [
    scheduleStudentsLoaded,
    setScheduleStudentsLoaded
  ] = useState(false)

  const [
    scheduleStudentsLoading,
    setScheduleStudentsLoading
  ] = useState(false)

  const [
    scheduleStudentsError,
    setScheduleStudentsError
  ] = useState('')

  const [
    scheduleStudentsReloadKey,
    setScheduleStudentsReloadKey
  ] = useState(0)

  /*
   * Tahsilatlar ekranı tam öğrenci profiline ihtiyaç duymaz.
   * Sadece aktif öğrenci ve ödeme için gerekli paket alanları
   * bu ekrana özel, daha hafif bir sorguyla yüklenir.
   */
  const [
    paymentStudents,
    setPaymentStudents
  ] = useState([])

  const [
    paymentStudentsLoading,
    setPaymentStudentsLoading
  ] = useState(false)

  const [
    paymentStudentsError,
    setPaymentStudentsError
  ] = useState('')

  const [
    paymentStudentsReloadKey,
    setPaymentStudentsReloadKey
  ] = useState(0)

  const [
    students,
    setStudents
  ] = useState([])

  const [
    studentsLoaded,
    setStudentsLoaded
  ] = useState(false)

  const [
    studentsLoading,
    setStudentsLoading
  ] = useState(false)

  const [
    studentsError,
    setStudentsError
  ] = useState('')

  const [
    studentsReloadKey,
    setStudentsReloadKey
  ] = useState(0)

  const needsFullStudentData =
    FULL_STUDENT_DATA_PAGES.has(
      activePage
    )

  const needsStudentPackageSummary =
    STUDENT_PACKAGE_SUMMARY_PAGES.has(
      activePage
    )


  const needsLessonPlanData =
    LESSON_PLAN_DATA_PAGES.has(
      activePage
    )

  /*
   * Öğrenciler sayfası zaten server-side sayfalama + detay sorgusu
   * kullanıyor. Global ağır öğrenci listesi yerine Dashboard özetini
   * ortak state olarak kullan; öğrenci değişince hafif öğrenci-paket
   * özetini stale işaretle ki ilgili ekranlarda güncel atamalar alınsın.
   */
  const setStudentCollections = (nextValue) => {
    const applyUpdate = (current) =>
      typeof nextValue === 'function'
        ? nextValue(current)
        : nextValue

    setDashboardStudents(
      (current) => applyUpdate(current)
    )

    if (studentsLoaded) {
      setStudents(
        (current) => applyUpdate(current)
      )
    }

    setScheduleStudentsLoaded(false)
    setScheduleStudentsError('')
  }

  const [
    lessonPlans,
    setLessonPlans
  ] = useState([])


  const [
    lessonPlansLoaded,
    setLessonPlansLoaded
  ] = useState(false)

  const [
    lessonPlansLoading,
    setLessonPlansLoading
  ] = useState(false)

  const [
    lessonPlansError,
    setLessonPlansError
  ] = useState('')

  const [
    lessonPlansReloadKey,
    setLessonPlansReloadKey
  ] = useState(0)

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
  const clearAppData = () => {
    /*
     * Öğrenciler, Ders Grupları, Tahsilatlar, Raporlar ve Ders
     * Programı artık ortak QueryClient kullanıyor. Oturum kapanırken
     * tüm kullanıcıya bağlı cache'i tek seferde temizle; farklı bir
     * kullanıcı giriş yaptığında önceki oturum verisi görünmesin.
     */
    queryClient.clear()

    setSpecialties([])
    setPackages([])
    setTeachers([])
    setDashboardStudents([])
    setScheduleStudents([])
    setScheduleStudentsLoaded(false)
    setScheduleStudentsLoading(false)
    setScheduleStudentsError('')
    setScheduleStudentsReloadKey(0)
    setPaymentStudents([])
    setPaymentStudentsLoading(false)
    setPaymentStudentsError('')
    setPaymentStudentsReloadKey(0)
    setStudents([])
    setStudentsLoaded(false)
    setStudentsLoading(false)
    setStudentsError('')
    setStudentsReloadKey(0)
    setLessonPlans([])
    setLessonPlansLoaded(false)
    setLessonPlansLoading(false)
    setLessonPlansError('')
    setLessonPlansReloadKey(0)
    setLessonOccurrences([])
    setLessonOccurrencesLoaded(false)
    setLessonOccurrencesLoading(false)
    setLessonOccurrencesError('')
    setLessonOccurrencesReloadKey(0)
    setOtherIncomes([])
    setExpenses([])
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
              getDashboardStudents()
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
            dashboardStudentsResult
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

          setDashboardStudents(
            dashboardStudentsResult
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
  /*
   * Session token'ı yenilendiğinde Supabase yeni bir session nesnesi
   * üretebilir. Panel verilerini yalnız kullanıcı gerçekten değiştiğinde
   * veya manuel reload istendiğinde tekrar yükle.
   */
  }, [
    session?.user?.id,
    catalogReloadKey
  ])

  const retryPanelDataLoad =
    () => {
      setCatalogReloadKey(
        (current) =>
          current + 1
      )
    }

  /*
   * Ağır öğrenci sorgusunu uygulama açılışından çıkar.
   * students tablosunun veli + paket ilişkilerini içeren tam modeli
   * yalnızca bu modele ihtiyaç duyan bir ekran açıldığında yüklenir.
   */
  useEffect(() => {
    if (
      !session ||
      dataLoading ||
      !needsFullStudentData ||
      studentsLoaded
    ) {
      return undefined
    }

    let isMounted = true

    const loadFullStudents = async () => {
      setStudentsLoading(true)
      setStudentsError('')

      try {
        const result = await getStudents()

        if (!isMounted) {
          return
        }

        setStudents(result)
        setStudentsLoaded(true)
      } catch (error) {
        console.error(
          'Tam öğrenci verileri alınamadı:',
          error
        )

        if (isMounted) {
          setStudentsError(
            getReadableConnectionError(
              error,
              'Öğrenci verileri şu anda alınamadı. Lütfen tekrar deneyiniz.'
            )
          )
        }
      } finally {
        if (isMounted) {
          setStudentsLoading(false)
        }
      }
    }

    loadFullStudents()

    return () => {
      isMounted = false
    }
  }, [
    session?.user?.id,
    dataLoading,
    needsFullStudentData,
    studentsLoaded,
    studentsReloadKey
  ])

  const retryFullStudentsLoad = () => {
    setStudentsError('')
    setStudentsLoaded(false)
    setStudentsReloadKey(
      (current) => current + 1
    )
  }

  /*
   * Bütün aktif ders planlarını panel açılışında indirme.
   * Bu veri yalnız Öğrenciler, Ders Programı veya Ders Durumu
   * ekranlarından biri gerçekten açıldığında yüklenir.
   */
  useEffect(() => {
    if (
      !session ||
      dataLoading ||
      !needsLessonPlanData ||
      lessonPlansLoaded
    ) {
      return undefined
    }

    let isMounted = true

    const loadLessonPlans = async () => {
      setLessonPlansLoading(true)
      setLessonPlansError('')

      try {
        const result = await getLessonPlans()

        if (!isMounted) {
          return
        }

        setLessonPlans(result)
        setLessonPlansLoaded(true)
      } catch (error) {
        console.error(
          'Ders planları alınamadı:',
          error
        )

        if (isMounted) {
          setLessonPlansError(
            getReadableConnectionError(
              error,
              'Ders planları şu anda alınamadı. Lütfen tekrar deneyiniz.'
            )
          )
        }
      } finally {
        if (isMounted) {
          setLessonPlansLoading(false)
        }
      }
    }

    loadLessonPlans()

    return () => {
      isMounted = false
    }
  }, [
    session?.user?.id,
    dataLoading,
    needsLessonPlanData,
    lessonPlansLoaded,
    lessonPlansReloadKey
  ])

  const retryLessonPlansLoad = () => {
    setLessonPlansError('')
    setLessonPlansLoaded(false)
    setLessonPlansReloadKey(
      (current) => current + 1
    )
  }

  useEffect(() => {
    if (
      !session ||
      dataLoading ||
      !needsStudentPackageSummary ||
      scheduleStudentsLoaded
    ) {
      return undefined
    }

    let isMounted = true

    const loadScheduleStudents = async () => {
      setScheduleStudentsLoading(true)
      setScheduleStudentsError('')

      try {
        /*
         * Tam öğrenci modeli daha önce başka bir ekran için zaten
         * yüklendiyse yeni istek atmaya gerek yok; aynı veri ders
         * programı ve ders durumu için yeterli bir üst kümedir.
         */
        const result = studentsLoaded
          ? students
          : await getScheduleStudents()

        if (!isMounted) {
          return
        }

        setScheduleStudents(result)
        setScheduleStudentsLoaded(true)
      } catch (error) {
        console.error(
          'Öğrenci-paket özetleri alınamadı:',
          error
        )

        if (isMounted) {
          setScheduleStudentsError(
            getReadableConnectionError(
              error,
              'Öğrenci-paket bilgileri şu anda alınamadı. Lütfen tekrar deneyiniz.'
            )
          )
        }
      } finally {
        if (isMounted) {
          setScheduleStudentsLoading(false)
        }
      }
    }

    loadScheduleStudents()

    return () => {
      isMounted = false
    }
  }, [
    session?.user?.id,
    dataLoading,
    needsStudentPackageSummary,
    scheduleStudentsLoaded,
    scheduleStudentsReloadKey,
    studentsLoaded,
    students
  ])

  const retryScheduleStudentsLoad = () => {
    setScheduleStudentsError('')
    setScheduleStudentsLoaded(false)
    setScheduleStudentsReloadKey(
      (current) => current + 1
    )
  }

  /*
   * Tahsilatlar öğrenci/paket verisini TanStack Query cache'inde tut.
   * Sayfaya geri dönüldüğünde son gerçek veri anında gösterilir;
   * 30 saniyeden eskiyse aynı veri ekranda kalırken arka planda yenilenir.
   */
  useEffect(() => {
    const userId = session?.user?.id || ''

    if (
      !userId ||
      dataLoading ||
      activePage !== 'payments'
    ) {
      return undefined
    }

    let isMounted = true
    const queryKey = [
      'payment-students',
      userId
    ]
    const cachedStudents =
      queryClient.getQueryData(queryKey)
    const hasCachedStudents =
      Array.isArray(cachedStudents)

    if (hasCachedStudents) {
      setPaymentStudents(cachedStudents)
      setPaymentStudentsLoading(false)
    } else {
      setPaymentStudentsLoading(true)
    }

    setPaymentStudentsError('')

    const loadPaymentStudents = async () => {
      try {
        const result =
          await queryClient.fetchQuery({
            queryKey,
            queryFn: getPaymentStudents,
            staleTime: 30_000
          })

        if (!isMounted) {
          return
        }

        setPaymentStudents(result)
      } catch (error) {
        console.error(
          'Tahsilat öğrenci-paket bilgileri alınamadı:',
          error
        )

        /*
         * Cache'de kullanılabilir veri varsa kullanıcıyı tekrar boş
         * loading/error ekranına düşürme; son gerçek veriyi koru.
         */
        if (
          isMounted &&
          !hasCachedStudents
        ) {
          setPaymentStudentsError(
            getReadableConnectionError(
              error,
              'Tahsilat için öğrenci ve paket bilgileri şu anda alınamadı. Lütfen tekrar deneyiniz.'
            )
          )
        }
      } finally {
        if (isMounted) {
          setPaymentStudentsLoading(false)
        }
      }
    }

    loadPaymentStudents()

    return () => {
      isMounted = false
    }
  }, [
    session?.user?.id,
    dataLoading,
    activePage,
    paymentStudentsReloadKey
  ])

  const retryPaymentStudentsLoad = () => {
    setPaymentStudentsError('')

    const userId = session?.user?.id || ''

    if (userId) {
      queryClient.invalidateQueries({
        queryKey: [
          'payment-students',
          userId
        ]
      })
    }

    setPaymentStudentsReloadKey(
      (current) => current + 1
    )
  }

  const setPaymentStudentCollections = (
    nextValue
  ) => {
    setPaymentStudents((current) => {
      const nextStudents =
        typeof nextValue === 'function'
          ? nextValue(current)
          : nextValue

      const userId =
        session?.user?.id || ''

      if (userId) {
        queryClient.setQueryData(
          [
            'payment-students',
            userId
          ],
          nextStudents
        )
      }

      return nextStudents
    })
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
    session?.user?.id,
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
            (previousSession) => {
              const previousUserId =
                previousSession?.user?.id || ''

              const nextUserId =
                currentSession?.user?.id || ''

              /*
               * TOKEN_REFRESHED / tekrar eden SIGNED_IN olaylarında
               * kullanıcı aynıysa React state'ini gereksiz değiştirme.
               * Supabase client güncel token'ı kendi içinde yönetir.
               */
              if (
                previousUserId &&
                previousUserId === nextUserId
              ) {
                return previousSession
              }

              return currentSession
            }
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
   * GİRİŞ YAPAN KULLANICININ ROLÜ
   * =========================================================
   *
   * user_roles tablosu yalnızca kullanıcı yönetimi yetkisini
   * ayırır. Business modüllerine erişim mevcut authenticated
   * RLS politikalarıyla devam eder.
   */

  useEffect(() => {
    const userId =
      session?.user?.id || ''

    if (!userId) {
      setCurrentUserRole(null)
      setUserRoleLoading(false)
      setUserRoleError('')
      return undefined
    }

    let isMounted = true

    const loadCurrentUserRole =
      async () => {
        setUserRoleLoading(true)
        setUserRoleError('')

        try {
          const {
            data,
            error
          } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .maybeSingle()

          if (error) {
            throw error
          }

          if (!isMounted) {
            return
          }

          if (!data?.role) {
            setCurrentUserRole(null)
            setUserRoleError(
              'Kullanıcı rolü bulunamadı.'
            )
            return
          }

          setCurrentUserRole(
            data.role
          )
        } catch (error) {
          console.error(
            'Kullanıcı rolü alınamadı:',
            error
          )

          if (isMounted) {
            setCurrentUserRole(null)
            setUserRoleError(
              getReadableConnectionError(
                error,
                'Kullanıcı rolü şu anda alınamadı.'
              )
            )
          }
        } finally {
          if (isMounted) {
            setUserRoleLoading(false)
          }
        }
      }

    loadCurrentUserRole()

    return () => {
      isMounted = false
    }
  }, [session?.user?.id])

  /*
   * Admin olmayan kullanıcı daha önce localStorage'da kalan
   * kullanıcı yönetimi sayfasına doğrudan giremez.
   */
  useEffect(() => {
    if (
      !session ||
      userRoleLoading ||
      !currentUserRole
    ) {
      return
    }

    if (
      activePage === 'user-management' &&
      !isAdmin
    ) {
      setActivePage('dashboard')
    }
  }, [
    session,
    userRoleLoading,
    currentUserRole,
    activePage,
    isAdmin
  ])

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
      setDataLoading(true)

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
      page === 'user-management' &&
      !isAdmin
    ) {
      return
    }

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
        setCurrentUserRole(null)
        setUserRoleLoading(false)
        setUserRoleError('')
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
          text="Panel verileri yükleniyor..."
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
        userRole={
          currentUserRole
        }
        isAdmin={
          isAdmin
        }
        userRoleLoading={
          userRoleLoading
        }
        userRoleError={
          userRoleError
        }
      />

      <main className="dashboard">
        {needsFullStudentData &&
        !studentsLoaded ? (
          studentsError ? (
            <ErrorState
              title="Öğrenci verileri yüklenemedi"
              message={studentsError}
              onRetry={
                retryFullStudentsLoad
              }
            />
          ) : (
            <LoadingState
              text={
                studentsLoading
                  ? 'Öğrenci detayları yükleniyor...'
                  : 'Öğrenci detayları hazırlanıyor...'
              }
            />
          )
        ) : needsLessonPlanData &&
          !lessonPlansLoaded ? (
          lessonPlansError ? (
            <ErrorState
              title="Ders planları yüklenemedi"
              message={lessonPlansError}
              onRetry={
                retryLessonPlansLoad
              }
            />
          ) : (
            <LoadingState
              text={
                lessonPlansLoading
                  ? 'Ders planları yükleniyor...'
                  : 'Ders planları hazırlanıyor...'
              }
            />
          )
        ) : (
          <>
        {activePage ===
          'dashboard' && (
          <Dashboard
            students={
              studentsLoaded
                ? students
                : dashboardStudents
            }
            teachers={
              teachers
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
              studentsLoaded
                ? students
                : dashboardStudents
            }
            setStudents={
              setStudentCollections
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
            unsavedChanges={createUnsavedPageApi(
              'teachers',
              'Öğretmen işlemleri'
            )}
          />
        )}

        {activePage ===
          'schedule' && (
          scheduleStudentsLoading &&
          !scheduleStudentsLoaded ? (
            <LoadingState
              text="Ders programı öğrenci listesi yükleniyor..."
            />
          ) : scheduleStudentsError &&
            !scheduleStudentsLoaded ? (
            <ErrorState
              title="Ders programı öğrenci listesi yüklenemedi"
              message={
                scheduleStudentsError
              }
              onRetry={
                retryScheduleStudentsLoad
              }
            />
          ) : (
            <Schedule
              lessonPlans={
                lessonPlans
              }
              setLessonPlans={
                setLessonPlans
              }
              students={
                scheduleStudents
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
          )
        )}

        {activePage ===
          'lesson-status' && (
          scheduleStudentsLoading &&
          !scheduleStudentsLoaded ? (
            <LoadingState
              text="Ders durumu öğrenci listesi yükleniyor..."
            />
          ) : scheduleStudentsError &&
            !scheduleStudentsLoaded ? (
            <ErrorState
              title="Ders durumu öğrenci listesi yüklenemedi"
              message={
                scheduleStudentsError
              }
              onRetry={
                retryScheduleStudentsLoad
              }
            />
          ) : lessonOccurrencesLoading &&
            !lessonOccurrencesLoaded ? (
            <LoadingState
              text="Bu haftanın ders durumları yükleniyor..."
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
                scheduleStudents
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
            unsavedChanges={createUnsavedPageApi(
              'lesson-groups',
              'Ders grubu işlemleri'
            )}
          />
        )}

        {activePage ===
          'payments' && (
          paymentStudentsLoading &&
          paymentStudents.length === 0 ? (
            <LoadingState message="Tahsilat öğrenci bilgileri yükleniyor..." />
          ) : paymentStudentsError &&
            paymentStudents.length === 0 ? (
            <ErrorState
              title="Tahsilat öğrenci bilgileri yüklenemedi"
              message={
                paymentStudentsError
              }
              onRetry={
                retryPaymentStudentsLoad
              }
            />
          ) : (
            <Payments
              students={
                paymentStudents
              }
              setStudents={
                setPaymentStudentCollections
              }
              unsavedChanges={createUnsavedPageApi(
                'payments',
                'Tahsilat işlemleri'
              )}
            />
          )
        )}

        {activePage ===
          'finance' && (
          <Finance
            teachers={
              teachers
            }
            setOtherIncomes={
              setOtherIncomes
            }
            setExpenses={
              setExpenses
            }
            unsavedChanges={createUnsavedPageApi(
              'finance',
              'Finans işlemleri'
            )}
          />
        )}

      {activePage ===
        'reports' && (
        <Reports />
      )}

      {activePage ===
        'user-management' &&
        isAdmin && (
        <UserManagement />
      )}
          </>
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