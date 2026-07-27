const menuItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'students', label: 'Öğrenciler' },
  { id: 'teachers', label: 'Öğretmenler' },
  { id: 'schedule', label: 'Ders Programı' },
  {
    id: 'lesson-status',
    label: 'Ders Durum Takibi'
  },
  { id: 'packages', label: 'Paketler' },
  { id: 'payments', label: 'Tahsilatlar' },
  { id: 'finance', label: 'Finans' }
]

function Sidebar({
  activePage,
  handleMenuClick,
  handleLogout
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">♪</div>

        <div>
          <h2>Artı Akademi</h2>
          <p>Bilim Sanat Paneli</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
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