import academyLogo from '../assets/LOGO.JPG'

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
  LogOut
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
    label: 'Tahsilatlar',
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

function Sidebar({
  activePage,
  handleMenuClick,
  handleLogout,
  isAdmin = false
}) {
  const visibleMenuItems = isAdmin
    ? [...menuItems, adminMenuItem]
    : menuItems

  return (
    <aside className="sidebar">
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
      </div>

      <nav className="sidebar-nav">
        {visibleMenuItems.map((item) => {
          const Icon = item.icon

          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${
                activePage === item.id
                  ? 'active'
                  : ''
              }`}
              onClick={() =>
                handleMenuClick(item.id)
              }
              title={item.label}
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
        title="Çıkış Yap"
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
  )
}

export default Sidebar