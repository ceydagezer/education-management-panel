import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  createPanelUser,
  deletePanelUser,
  getManagedUsers,
  resetPanelUserPassword,
  setPanelUserRole
} from '../services/userManagementService'

import '../styles/UserManagement.css'

const PASSWORD_LENGTH = 14
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz'
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%*-_'
const ALL_PASSWORD_CHARS =
  LOWERCASE +
  UPPERCASE +
  DIGITS +
  SYMBOLS

function randomIndex(max) {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0] % max
}

function pickRandom(source) {
  return source[randomIndex(source.length)]
}

function generateStrongPassword() {
  const chars = [
    pickRandom(LOWERCASE),
    pickRandom(UPPERCASE),
    pickRandom(DIGITS),
    pickRandom(SYMBOLS)
  ]

  while (chars.length < PASSWORD_LENGTH) {
    chars.push(
      pickRandom(ALL_PASSWORD_CHARS)
    )
  }

  for (
    let index = chars.length - 1;
    index > 0;
    index -= 1
  ) {
    const swapIndex =
      randomIndex(index + 1)

    const current = chars[index]
    chars[index] = chars[swapIndex]
    chars[swapIndex] = current
  }

  return chars.join('')
}

const formatDateTime = (value) => {
  if (!value) return '-'

  const date = new Date(value)

  if (
    Number.isNaN(date.getTime())
  ) {
    return '-'
  }

  return new Intl.DateTimeFormat(
    'tr-TR',
    {
      dateStyle: 'short',
      timeStyle: 'short'
    }
  ).format(date)
}

function UserManagement() {
  const [users, setUsers] =
    useState([])
  const [loading, setLoading] =
    useState(true)
  const [error, setError] =
    useState('')

  const [
    createForm,
    setCreateForm
  ] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'staff'
  })

  const [
    showCreatePassword,
    setShowCreatePassword
  ] = useState(false)

  const [
    createLoading,
    setCreateLoading
  ] = useState(false)

  const [
    createError,
    setCreateError
  ] = useState('')

  const [
    createdCredential,
    setCreatedCredential
  ] = useState(null)

  const [
    actionMessage,
    setActionMessage
  ] = useState('')

  const [
    actionError,
    setActionError
  ] = useState('')

  const [
    roleLoadingUserId,
    setRoleLoadingUserId
  ] = useState('')

  const [
    deleteLoadingUserId,
    setDeleteLoadingUserId
  ] = useState('')

  const [
    resetUser,
    setResetUser
  ] = useState(null)

  const [
    resetPassword,
    setResetPassword
  ] = useState('')

  const [
    resetPasswordAgain,
    setResetPasswordAgain
  ] = useState('')

  const [
    showResetPassword,
    setShowResetPassword
  ] = useState(false)

  const [
    resetLoading,
    setResetLoading
  ] = useState(false)

  const loadUsers =
    useCallback(async () => {
      setLoading(true)
      setError('')

      try {
        const result =
          await getManagedUsers()

        setUsers(result)
      } catch (loadError) {
        console.error(
          'Kullanıcı listesi alınamadı:',
          loadError
        )

        setError(
          loadError?.message ||
            'Kullanıcı listesi alınamadı.'
        )
      } finally {
        setLoading(false)
      }
    }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const adminCount =
    useMemo(
      () =>
        users.filter(
          (user) =>
            user.role === 'admin'
        ).length,
      [users]
    )

  const staffCount =
    users.length - adminCount

  const handleCreateFieldChange =
    (event) => {
      const {
        name,
        value
      } = event.target

      setCreateForm(
        (current) => ({
          ...current,
          [name]: value
        })
      )

      setCreateError('')
      setCreatedCredential(null)
    }

  const generateCreatePassword =
    () => {
      setCreateForm(
        (current) => ({
          ...current,
          password:
            generateStrongPassword()
        })
      )

      setShowCreatePassword(true)
      setCreateError('')
      setCreatedCredential(null)
    }

  const copyText =
    async (text) => {
      try {
        await navigator.clipboard
          .writeText(text)

        setActionError('')
        setActionMessage(
          'Panoya kopyalandı.'
        )
      } catch {
        setActionMessage('')
        setActionError(
          'Panoya kopyalanamadı.'
        )
      }
    }

  const handleCreateUser =
    async (event) => {
      event.preventDefault()

      if (createLoading) return

      setCreateLoading(true)
      setCreateError('')
      setCreatedCredential(null)
      setActionError('')
      setActionMessage('')

      const credential = {
        fullName:
          createForm.fullName.trim(),
        email:
          createForm.email
            .trim()
            .toLowerCase(),
        password:
          createForm.password,
        role:
          createForm.role
      }

      try {
        await createPanelUser(
          credential
        )

        setCreatedCredential(
          credential
        )

        setCreateForm({
          fullName: '',
          email: '',
          password: '',
          role: 'staff'
        })

        setShowCreatePassword(false)
        await loadUsers()
      } catch (requestError) {
        console.error(
          'Kullanıcı oluşturulamadı:',
          requestError
        )

        setCreateError(
          requestError?.message ||
            'Kullanıcı oluşturulamadı.'
        )
      } finally {
        setCreateLoading(false)
      }
    }

  const handleChangeRole =
    async (user) => {
      if (roleLoadingUserId) {
        return
      }

      const nextRole =
        user.role === 'admin'
          ? 'staff'
          : 'admin'

      const label =
        nextRole === 'admin'
          ? 'admin'
          : 'personel'

      if (
        !window.confirm(
          `${user.fullName || user.email} kullanıcısını ${label} yapmak istediğinize emin misiniz?`
        )
      ) {
        return
      }

      setRoleLoadingUserId(user.id)
      setActionError('')
      setActionMessage('')

      try {
        const result =
          await setPanelUserRole(
            user.id,
            nextRole
          )

        setActionMessage(
          result?.message ||
            'Kullanıcı rolü güncellendi.'
        )

        await loadUsers()
      } catch (roleError) {
        console.error(
          'Kullanıcı rolü değiştirilemedi:',
          roleError
        )

        setActionError(
          roleError?.message ||
            'Kullanıcı rolü değiştirilemedi.'
        )
      } finally {
        setRoleLoadingUserId('')
      }
    }

  const handleDeleteUser =
    async (user) => {
      if (deleteLoadingUserId) {
        return
      }

      if (user.role === 'admin') {
        setActionMessage('')
        setActionError(
          'Admin kullanıcı doğrudan silinemez. Önce Personel Yap işlemini kullanınız.'
        )
        return
      }

      const userLabel =
        user.fullName ||
        user.email ||
        'Bu kullanıcı'

      const confirmed =
        window.confirm(
          `${userLabel} hesabı kalıcı olarak silinecek ve artık sisteme giriş yapamayacak. Devam edilsin mi?`
        )

      if (!confirmed) {
        return
      }

      setDeleteLoadingUserId(user.id)
      setActionError('')
      setActionMessage('')

      try {
        const result =
          await deletePanelUser(
            user.id
          )

        setActionMessage(
          result?.message ||
            'Kullanıcı sistemden silindi.'
        )

        await loadUsers()
      } catch (deleteError) {
        console.error(
          'Kullanıcı silinemedi:',
          deleteError
        )

        setActionError(
          deleteError?.message ||
            'Kullanıcı silinemedi.'
        )
      } finally {
        setDeleteLoadingUserId('')
      }
    }

  const openResetPassword =
    (user) => {
      setResetUser(user)
      setResetPassword('')
      setResetPasswordAgain('')
      setShowResetPassword(false)
      setActionError('')
      setActionMessage('')
    }

  const closeResetPassword =
    () => {
      if (resetLoading) return

      setResetUser(null)
      setResetPassword('')
      setResetPasswordAgain('')
      setShowResetPassword(false)
    }

  const generateResetPassword =
    () => {
      const password =
        generateStrongPassword()

      setResetPassword(password)
      setResetPasswordAgain(password)
      setShowResetPassword(true)
      setActionError('')
      setActionMessage('')
    }

  const handleResetPassword =
    async (event) => {
      event.preventDefault()

      if (
        !resetUser ||
        resetLoading
      ) {
        return
      }

      if (
        resetPassword !==
        resetPasswordAgain
      ) {
        setActionError(
          'Yeni şifreler birbiriyle aynı olmalıdır.'
        )
        return
      }

      if (
        !window.confirm(
          `${resetUser.fullName || resetUser.email} kullanıcısının mevcut şifresi geçersiz olacak ve yeni şifre kaydedilecek. Devam edilsin mi?`
        )
      ) {
        return
      }

      setResetLoading(true)
      setActionError('')
      setActionMessage('')

      const passwordToShare =
        resetPassword

      try {
        const result =
          await resetPanelUserPassword(
            resetUser.id,
            passwordToShare
          )

        setActionMessage(
          result?.message ||
            'Kullanıcının şifresi yenilendi.'
        )

        setCreatedCredential({
          fullName:
            resetUser.fullName,
          email:
            resetUser.email,
          password:
            passwordToShare,
          role:
            resetUser.role,
          isPasswordReset: true
        })

        setResetUser(null)
        setResetPassword('')
        setResetPasswordAgain('')
        setShowResetPassword(false)
      } catch (resetError) {
        console.error(
          'Şifre yenilenemedi:',
          resetError
        )

        setActionError(
          resetError?.message ||
            'Şifre yenilenemedi.'
        )
      } finally {
        setResetLoading(false)
      }
    }

  return (
    <div className="user-management-page">
      <div className="user-management-header">
        <div>
          <h1>Kullanıcı Yönetimi</h1>
          <p>
            Panel kullanıcılarını oluşturun,
            rollerini yönetin ve gerektiğinde
            yeni şifre belirleyin.
          </p>
        </div>
      </div>

      <div className="user-management-summary">
        <div className="user-summary-card">
          <span>Toplam Kullanıcı</span>
          <strong>{users.length}</strong>
        </div>

        <div className="user-summary-card">
          <span>Admin</span>
          <strong>{adminCount}</strong>
        </div>

        <div className="user-summary-card">
          <span>Personel</span>
          <strong>{staffCount}</strong>
        </div>
      </div>

      <section className="user-management-card">
        <div className="user-card-heading">
          <div>
            <h2>Kullanıcı Oluştur</h2>
            <p>
              Şifreyi siz belirleyebilir veya
              güvenli rastgele şifre
              oluşturabilirsiniz. Şifre daha
              sonra görüntülenemez; unutulursa
              admin yeni şifre belirler.
            </p>
          </div>
        </div>

        <form
          className="user-create-form"
          onSubmit={handleCreateUser}
        >
          <label>
            <span>Ad Soyad *</span>
            <input
              type="text"
              name="fullName"
              value={createForm.fullName}
              onChange={handleCreateFieldChange}
              maxLength={120}
              required
              autoComplete="off"
              placeholder="Örn. Ad Soyad"
            />
          </label>

          <label>
            <span>E-posta *</span>
            <input
              type="email"
              name="email"
              value={createForm.email}
              onChange={handleCreateFieldChange}
              required
              autoComplete="off"
              placeholder="ornek@firma.com"
            />
          </label>

          <label>
            <span>Rol *</span>
            <select
              name="role"
              value={createForm.role}
              onChange={handleCreateFieldChange}
            >
              <option value="staff">
                Personel
              </option>
              <option value="admin">
                Admin
              </option>
            </select>
          </label>

          <label className="user-password-field">
            <span>İlk Şifre *</span>

            <div className="user-password-input-row">
              <input
                type={
                  showCreatePassword
                    ? 'text'
                    : 'password'
                }
                name="password"
                value={createForm.password}
                onChange={handleCreateFieldChange}
                required
                minLength={10}
                autoComplete="new-password"
                placeholder="En az 10 karakter"
              />

              <button
                type="button"
                className="user-secondary-button"
                onClick={() =>
                  setShowCreatePassword(
                    (current) =>
                      !current
                  )
                }
              >
                {showCreatePassword
                  ? 'Gizle'
                  : 'Göster'}
              </button>
            </div>
          </label>

          <div className="user-create-actions">
            <button
              type="button"
              className="user-secondary-button"
              onClick={generateCreatePassword}
            >
              Rastgele Şifre Oluştur
            </button>

            <button
              type="submit"
              className="user-primary-button"
              disabled={createLoading}
            >
              {createLoading
                ? 'Oluşturuluyor...'
                : 'Kullanıcı Oluştur'}
            </button>
          </div>
        </form>

        {createError && (
          <div className="user-message user-message-error">
            {createError}
          </div>
        )}

        {createdCredential && (
          <div className="user-credential-box">
            <div>
              <strong>
                {createdCredential.isPasswordReset
                  ? 'Yeni giriş bilgileri hazır'
                  : 'Kullanıcı oluşturuldu'}
              </strong>
              <p>
                Bu şifreyi kullanıcıya güvenli
                şekilde iletin. Sistem eski
                şifreyi daha sonra göstermez.
              </p>
            </div>

            <div className="user-credential-grid">
              <span>E-posta</span>
              <code>
                {createdCredential.email}
              </code>

              <span>Şifre</span>
              <code>
                {createdCredential.password}
              </code>
            </div>

            <div className="user-credential-actions">
              <button
                type="button"
                className="user-secondary-button"
                onClick={() =>
                  copyText(createdCredential.email)
                }
              >
                E-postayı Kopyala
              </button>

              <button
                type="button"
                className="user-secondary-button"
                onClick={() =>
                  copyText(createdCredential.password)
                }
              >
                Şifreyi Kopyala
              </button>

              <button
                type="button"
                className="user-secondary-button"
                onClick={() =>
                  setCreatedCredential(null)
                }
              >
                Kapat
              </button>
            </div>
          </div>
        )}
      </section>

      {actionMessage && (
        <div className="user-message user-message-success user-global-message">
          {actionMessage}
        </div>
      )}

      {actionError && (
        <div className="user-message user-message-error user-global-message">
          {actionError}
        </div>
      )}

      <section className="user-management-card">
        <div className="user-card-heading user-list-heading">
          <div>
            <h2>Panel Kullanıcıları</h2>
            <p>
              Adminler kullanıcı yönetimini
              yapabilir; personel diğer iş
              modüllerini kullanır.
            </p>
          </div>

          <button
            type="button"
            className="user-secondary-button"
            onClick={loadUsers}
            disabled={loading}
          >
            Yenile
          </button>
        </div>

        {loading ? (
          <div className="user-list-state">
            Kullanıcılar yükleniyor...
          </div>
        ) : error ? (
          <div className="user-list-state user-list-error">
            <p>{error}</p>
            <button
              type="button"
              className="user-secondary-button"
              onClick={loadUsers}
            >
              Tekrar Dene
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="user-list-state">
            Henüz kullanıcı bulunmuyor.
          </div>
        ) : (
          <div className="user-table-wrap">
            <table className="user-management-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>E-posta</th>
                  <th>Rol</th>
                  <th>Kayıt Tarihi</th>
                  <th>İşlemler</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      {user.fullName || '-'}
                    </td>
                    <td>
                      {user.email || '-'}
                    </td>
                    <td>
                      <span
                        className={`user-role-badge ${
                          user.role === 'admin'
                            ? 'admin'
                            : 'staff'
                        }`}
                      >
                        {user.role === 'admin'
                          ? 'Admin'
                          : 'Personel'}
                      </span>
                    </td>
                    <td>
                      {formatDateTime(user.createdAt)}
                    </td>
                    <td>
                      <div className="user-row-actions">
                        <button
                          type="button"
                          className="user-secondary-button"
                          onClick={() =>
                            openResetPassword(user)
                          }
                        >
                          Yeni Şifre
                        </button>

                        <button
                          type="button"
                          className="user-secondary-button"
                          disabled={
                            roleLoadingUserId === user.id
                          }
                          onClick={() =>
                            handleChangeRole(user)
                          }
                        >
                          {roleLoadingUserId === user.id
                            ? 'Kaydediliyor...'
                            : user.role === 'admin'
                              ? 'Personel Yap'
                              : 'Admin Yap'}
                        </button>

                        {user.role !== 'admin' && (
                          <button
                            type="button"
                            className="user-danger-button"
                            disabled={
                              deleteLoadingUserId === user.id
                            }
                            onClick={() =>
                              handleDeleteUser(user)
                            }
                          >
                            {deleteLoadingUserId === user.id
                              ? 'Siliniyor...'
                              : 'Kullanıcıyı Sil'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {resetUser && (
        <div
          className="user-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeResetPassword()
            }
          }}
        >
          <div
            className="user-password-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-password-modal-title"
          >
            <div className="user-password-modal-heading">
              <div>
                <h2 id="user-password-modal-title">
                  Yeni Şifre Belirle
                </h2>
                <p>
                  {resetUser.fullName ||
                    resetUser.email}
                </p>
              </div>

              <button
                type="button"
                className="user-modal-close"
                onClick={closeResetPassword}
                disabled={resetLoading}
                aria-label="Kapat"
              >
                ×
              </button>
            </div>

            <form
              className="user-reset-form"
              onSubmit={handleResetPassword}
            >
              <label>
                <span>Yeni Şifre *</span>
                <input
                  type={
                    showResetPassword
                      ? 'text'
                      : 'password'
                  }
                  value={resetPassword}
                  onChange={(event) =>
                    setResetPassword(
                      event.target.value
                    )
                  }
                  required
                  minLength={10}
                  autoComplete="new-password"
                />
              </label>

              <label>
                <span>
                  Yeni Şifre Tekrar *
                </span>
                <input
                  type={
                    showResetPassword
                      ? 'text'
                      : 'password'
                  }
                  value={resetPasswordAgain}
                  onChange={(event) =>
                    setResetPasswordAgain(
                      event.target.value
                    )
                  }
                  required
                  minLength={10}
                  autoComplete="new-password"
                />
              </label>

              <div className="user-reset-options">
                <button
                  type="button"
                  className="user-secondary-button"
                  onClick={generateResetPassword}
                >
                  Rastgele Şifre Oluştur
                </button>

                <button
                  type="button"
                  className="user-secondary-button"
                  onClick={() =>
                    setShowResetPassword(
                      (current) =>
                        !current
                    )
                  }
                >
                  {showResetPassword
                    ? 'Şifreyi Gizle'
                    : 'Şifreyi Göster'}
                </button>
              </div>

              <div className="user-modal-actions">
                <button
                  type="button"
                  className="user-secondary-button"
                  onClick={closeResetPassword}
                  disabled={resetLoading}
                >
                  Vazgeç
                </button>

                <button
                  type="submit"
                  className="user-primary-button"
                  disabled={resetLoading}
                >
                  {resetLoading
                    ? 'Kaydediliyor...'
                    : 'Yeni Şifreyi Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement
