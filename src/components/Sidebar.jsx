import academyLogo from '../assets/LOGO.JPG'

const menuItems = [
  { id: 'dashboard', label: 'Ana Sayfa' },
  { id: 'students', label: 'Öğrenciler' },
  { id: 'teachers', label: 'Öğretmenler' },
  { id: 'lesson-groups', label: 'Ders Grupları' },
  { id: 'schedule', label: 'Ders Programı' },
  {
    id: 'lesson-status',
    label: 'Ders Durum Takibi'
  },
  { id: 'packages', label: 'Paketler' },
  { id: 'payments', label: 'Tahsilatlar' },
  { id: 'finance', label: 'Finans' },
  { id: 'reports', label: 'Raporlar' }
]

const adminMenuItem = {
  id: 'user-management',
  label: 'Kullanıcı Yönetimi'
}

function Sidebar({
  activePage,
  handleMenuClick,
  handleLogout,
  isAdmin = false
}) {
  const visibleMenuItems =
    isAdmin
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
        {visibleMenuItems.map((item) => (
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
          >
            {item.label}
          </button>
        ))}
      </nav>

      <button
        type="button"
        className="logout-button"
        onClick={handleLogout}
      >
        Çıkış Yap
      </button>
    </aside>
  )
}

export default Sidebar
