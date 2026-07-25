import '../styles/AsyncState.css'

export function LoadingState({
  text = 'Yükleniyor...'
}) {
  return (
    <div
      className="async-state"
      role="status"
      aria-live="polite"
    >
      <div className="async-spinner" />
      <p>{text}</p>
    </div>
  )
}

export function ErrorState({
  title = 'Bir hata oluştu',
  message = 'İşlem tamamlanamadı.',
  onRetry
}) {
  return (
    <div
      className="async-state async-error-state"
      role="alert"
    >
      <div className="async-state-icon">!</div>
      <h3>{title}</h3>
      <p>{message}</p>

      {typeof onRetry === 'function' && (
        <button
          type="button"
          className="async-retry-button"
          onClick={onRetry}
        >
          Tekrar Dene
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  title = 'Henüz kayıt bulunmuyor',
  message = 'Yeni bir kayıt ekleyerek başlayabilirsiniz.',
  actionText,
  onAction
}) {
  return (
    <div className="async-state async-empty-state">
      <div className="async-state-icon">—</div>
      <h3>{title}</h3>
      <p>{message}</p>

      {actionText &&
        typeof onAction === 'function' && (
          <button
            type="button"
            className="async-action-button"
            onClick={onAction}
          >
            {actionText}
          </button>
        )}
    </div>
  )
}

export function LoadingButton({
  loading = false,
  loadingText = 'İşleniyor...',
  disabled,
  children,
  className = '',
  ...buttonProps
}) {
  return (
    <button
      {...buttonProps}
      className={`async-loading-button ${className}`.trim()}
      disabled={loading || disabled}
      aria-busy={loading}
    >
      {loading && (
        <span className="async-button-spinner" />
      )}

      <span>
        {loading ? loadingText : children}
      </span>
    </button>
  )
}
