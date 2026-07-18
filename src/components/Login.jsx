function Login({ email, password, setEmail, setPassword, handleLogin }) {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">♪</div>
        <h1>Artı Bilim Sanat Akademisi</h1>
        <p>Yönetim paneline giriş yapınız.</p>

        <form onSubmit={handleLogin} className="login-form">
          <label>E-posta</label>
          <input
            type="email"
            placeholder="ornek@artibilimsanat.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>Şifre</label>
          <input
            type="password"
            placeholder="Şifrenizi giriniz"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit">Giriş Yap</button>
        </form>

        <span>Bu panel yalnızca yetkili kullanıcılar içindir.</span>
      </div>
    </div>
  )
}

export default Login