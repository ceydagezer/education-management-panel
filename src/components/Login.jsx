function Login({
  email,
  password,
  setEmail,
  setPassword,
  handleLogin,
  loginError,
  loginLoading
}) {
  return (
    <div className="login-page">
      <div className="login-card">
        <div
          className="login-logo"
          aria-hidden="true"
        >
          ♪
        </div>

        <h1>Artı Bilim Sanat Akademisi</h1>

        <p>
          Yönetim paneline giriş yapınız.
        </p>

        <form
          onSubmit={handleLogin}
          className="login-form"
        >
          <label htmlFor="login-email">
            E-posta
          </label>

          <input
            id="login-email"
            type="email"
            placeholder="ornek@artibilimsanat.com"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            autoComplete="email"
            required
            disabled={loginLoading}
          />

          <label htmlFor="login-password">
            Şifre
          </label>

          <input
            id="login-password"
            type="password"
            placeholder="Şifrenizi giriniz"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            autoComplete="current-password"
            required
            disabled={loginLoading}
          />

          {loginError && (
            <div
              className="login-error"
              role="alert"
              aria-live="polite"
            >
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={loginLoading}
          >
            {loginLoading
              ? 'Giriş yapılıyor...'
              : 'Giriş Yap'}
          </button>
        </form>

        <span>
          Bu panel yalnızca yetkili kullanıcılar
          içindir.
        </span>
      </div>
    </div>
  )
}

export default Login