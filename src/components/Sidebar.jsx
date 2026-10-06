import academyLogo from '../assets/LOGO.JPG'

import { useEffect, useState } from 'react'

import {
  Home,
  Users,
  GraduationCap,
  Layers,
  CalendarDays,
  ClipboardCheck,
  Package,
  CreditCard,
  Wallet,
  BarChart3,
  UserCog,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X
} from 'lucide-react'

const menuItems = [
  {
    id: 'dashboard',
    label: 'Ana Sayfa',
    icon: Home
  },
  {
    id: 'students',
    label: 'Öğrenciler',
    icon: Users
  },
  {
    id: 'teachers',
    label: 'Öğretmenler',
    icon: GraduationCap
  },
  {
    id: 'lesson-groups',
    label: 'Ders Grupları',
    icon: Layers
  },
  {
    id: 'schedule',
    label: 'Ders Programı',
    icon: CalendarDays
  },
  {
    id: 'lesson-status',
    label: 'Ders Durum Takibi',
    icon: ClipboardCheck
  },
  {
    id: 'packages',
    label: 'Paketler',
    icon: Package
  },
  {
    id: 'payments',
    label: 'Öğrenci Tahsilatları',
    icon: CreditCard
  },
  {
    id: 'finance',
    label: 'Finans',
    icon: Wallet
  },
  {
    id: 'reports',
    label: 'Raporlar',
    icon: BarChart3
  }
]

const adminMenuItem = {
  id: 'user-management',
  label: 'Kullanıcı Yönetimi',
  icon: UserCog
}

const COLLAPSE_STORAGE_KEY =
  'arti-akademi-sidebar-collapsed'

const readCollapsedPreference = () => {
  try {
    return (
      localStorage.getItem(
        COLLAPSE_STORAGE_KEY
      ) === 'true'
    )
  } catch {
    return false
  }
}

/*
 * Bilgisayarda menü yazılarıyla birlikte açık durur; istenirse
 * simge görünümüne küçültülür (tercih hatırlanır).
 * Telefonda üstte ince bir çubuk ve ☰ düğmesiyle açılan
 * kayan menü kullanılır.
 */
function Sidebar({
  activePage,
  handleMenuClick,
  handleLogout,
  isAdmin = false
}) {
  const [collapsed, setCollapsed] =
    useState(readCollapsedPreference)

  const [mobileOpen, setMobileOpen] =
    useState(false)

  const visibleMenuItems = isAdmin
    ? [...menuItems, adminMenuItem]
    : menuItems

  const activeItem =
    visibleMenuItems.find(
      (item) => item.id === activePage
    )

  useEffect(() => {
    try {
      localStorage.setItem(
        COLLAPSE_STORAGE_KEY,
        String(collapsed)
      )
    } catch {
      // Tarayıcı depolaması kapalıysa tercih yalnız bu oturumda kalır.
    }
  }, [collapsed])

  useEffect(() => {
    if (!mobileOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
      }
    }

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow = 'hidden'
    document.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {
      document.body.style.overflow =
        previousOverflow
      document.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [mobileOpen])

  const selectItem = (itemId) => {
    setMobileOpen(false)
    handleMenuClick(itemId)
  }

  return (
    <>
      <header className="mobile-topbar">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={() => setMobileOpen(true)}
          aria-label="Menüyü aç"
          aria-expanded={mobileOpen}
        >
          <Menu size={22} strokeWidth={2.2} />
        </button>

        <div className="mobile-topbar-title">
          <img
            src={academyLogo}
            alt=""
            className="mobile-topbar-logo"
          />
          <span>
            {activeItem?.label || 'Artı Akademi'}
          </span>
        </div>
      </header>

      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          role="presentation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`sidebar ${
          collapsed ? 'collapsed' : ''
        } ${mobileOpen ? 'mobile-open' : ''}`}
        aria-label="Ana menü"
      >
        <div className="brand">
          <div className="brand-logo-frame">
            <img
              src={academyLogo}
              alt="Artı Akademi"
              className="brand-logo-image"
            />
          </div>

          <div className="brand-text">
            <h2>Artı Akademi</h2>
            <p>Yönetici Paneli</p>
          </div>

          <button
            type="button"
            className="sidebar-close-button"
            onClick={() => setMobileOpen(false)}
            aria-label="Menüyü kapat"
          >
            <X size={20} />
          </button>
        </div>

        <button
          type="button"
          className="sidebar-collapse-button"
          onClick={() =>
            setCollapsed((current) => !current)
          }
          title={
            collapsed
              ? 'Menüyü genişlet'
              : 'Menüyü daralt'
          }
          aria-label={
            collapsed
              ? 'Menüyü genişlet'
              : 'Menüyü daralt'
          }
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <>
              <PanelLeftClose size={18} />
              <span>Menüyü daralt</span>
            </>
          )}
        </button>

        <nav className="sidebar-nav">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon
            const isActive =
              activePage === item.id

            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${
                  isActive ? 'active' : ''
                }`}
                onClick={() =>
                  selectItem(item.id)
                }
                title={
                  collapsed
                    ? item.label
                    : undefined
                }
                aria-current={
                  isActive ? 'page' : undefined
                }
              >
                <Icon
                  className="nav-icon"
                  size={20}
                  strokeWidth={2}
                />

                <span className="nav-label">
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>

        <button
          type="button"
          className="logout-button"
          onClick={handleLogout}
          title={
            collapsed
              ? 'Çıkış Yap'
              : undefined
          }
        >
          <LogOut
            className="logout-icon"
            size={20}
            strokeWidth={2}
          />

          <span className="logout-label">
            Çıkış Yap
          </span>
        </button>
      </aside>
    </>
  )
}

export default Sidebar
