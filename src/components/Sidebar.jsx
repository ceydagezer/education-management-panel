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
        <button
          type="button"
          className={`nav-item ${
            activePage === 'dashboard'
              ? 'active'
              : ''
          }`}
          onClick={() =>
            handleMenuClick('dashboard')
          }
        >
          Dashboard
        </button>

        <button
          type="button"
          className={`nav-item ${
            activePage === 'students'
              ? 'active'
              : ''
          }`}
          onClick={() =>
            handleMenuClick('students')
          }
        >
          Öğrenciler
        </button>

        <button
          type="button"
          className={`nav-item ${
            activePage === 'teachers'
              ? 'active'
              : ''
          }`}
          onClick={() =>
            handleMenuClick('teachers')
          }
        >
          Öğretmenler
        </button>

        <button
          type="button"
          className={`nav-item ${
            activePage === 'schedule'
              ? 'active'
              : ''
          }`}
          onClick={() =>
            handleMenuClick('schedule')
          }
        >
          Ders Programı
        </button>

        <button
          type="button"
          className={`nav-item ${
            activePage === 'lesson-status'
              ? 'active'
              : ''
          }`}
          onClick={() =>
            handleMenuClick('lesson-status')
          }
        >
          Ders Durum Takibi
        </button>

        <button
          type="button"
          className={`nav-item ${
            activePage === 'packages'
              ? 'active'
              : ''
          }`}
          onClick={() =>
            handleMenuClick('packages')
          }
        >
          Paketler
        </button>

        <button
          type="button"
          className={`nav-item ${
            activePage === 'payments'
              ? 'active'
              : ''
          }`}
          onClick={() =>
            handleMenuClick('payments')
          }
        >
          Tahsilatlar
        </button>

        <button
          type="button"
          className={`nav-item ${
            activePage === 'finance'
              ? 'active'
              : ''
          }`}
          onClick={() =>
            handleMenuClick('finance')
          }
        >
          Gelir / Gider
        </button>
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