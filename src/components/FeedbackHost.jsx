import { useEffect, useRef, useState } from 'react'
import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Info,
  PencilLine,
  TriangleAlert,
  X
} from 'lucide-react'

import {
  dismissToast,
  getFeedbackState,
  subscribeFeedback
} from '../lib/feedback'

import '../styles/feedback.css'

const TOAST_ICONS = {
  success: CircleCheck,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info
}

function FeedbackDialog({ dialog }) {
  const [value, setValue] = useState(
    String(dialog.defaultValue ?? '')
  )
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const confirmRef = useRef(null)

  const isPrompt = dialog.type === 'prompt'
  const isAlert = dialog.type === 'alert'
  const isDanger = dialog.tone === 'danger'
  const isWarning = dialog.tone === 'warning'

  useEffect(() => {
    const target = isPrompt
      ? inputRef.current
      : confirmRef.current

    target?.focus()

    if (isPrompt && inputRef.current?.select) {
      inputRef.current.select()
    }
  }, [isPrompt])

  const cancel = () => {
    dialog.resolve(isPrompt ? null : isAlert ? true : false)
  }

  const submit = () => {
    if (!isPrompt) {
      dialog.resolve(true)
      return
    }

    const trimmed = value.trim()

    if (dialog.required && !trimmed) {
      setError('Bu alan boş bırakılamaz.')
      inputRef.current?.focus()
      return
    }

    const validationError = dialog.validate
      ? dialog.validate(trimmed)
      : ''

    if (validationError) {
      setError(validationError)
      inputRef.current?.focus()
      return
    }

    dialog.resolve(value)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      cancel()
    }

    if (
      event.key === 'Enter' &&
      !(dialog.multiline && event.target.tagName === 'TEXTAREA')
    ) {
      event.preventDefault()
      submit()
    }
  }

  const Icon = isPrompt
    ? PencilLine
    : isDanger || isWarning
      ? TriangleAlert
      : CircleHelp

  return (
    <div
      className="feedback-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          cancel()
        }
      }}
    >
      <div
        className={`feedback-dialog ${isDanger ? 'danger' : ''} ${
          isWarning ? 'warning' : ''
        } ${isAlert ? 'alert' : ''}`}
        role={isPrompt ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby={`feedback-dialog-title-${dialog.id}`}
        aria-describedby={`feedback-dialog-message-${dialog.id}`}
        onKeyDown={handleKeyDown}
      >
        <div className="feedback-dialog-icon" aria-hidden="true">
          <Icon size={26} strokeWidth={2} />
        </div>

        <h2 id={`feedback-dialog-title-${dialog.id}`}>
          {dialog.title}
        </h2>

        {dialog.message && (
          <p id={`feedback-dialog-message-${dialog.id}`}>
            {dialog.message}
          </p>
        )}

        {isPrompt && (
          <div className="feedback-dialog-field">
            {dialog.label && (
              <label htmlFor={`feedback-dialog-input-${dialog.id}`}>
                {dialog.label}
              </label>
            )}

            {dialog.multiline ? (
              <textarea
                id={`feedback-dialog-input-${dialog.id}`}
                ref={inputRef}
                value={value}
                placeholder={dialog.placeholder}
                rows={3}
                onChange={(event) => {
                  setValue(event.target.value)
                  setError('')
                }}
              />
            ) : (
              <input
                id={`feedback-dialog-input-${dialog.id}`}
                ref={inputRef}
                type={dialog.inputType}
                value={value}
                placeholder={dialog.placeholder}
                min={dialog.min}
                max={dialog.max}
                autoComplete="off"
                onChange={(event) => {
                  setValue(event.target.value)
                  setError('')
                }}
              />
            )}

            {error ? (
              <small className="feedback-dialog-error">{error}</small>
            ) : (
              dialog.hint && <small>{dialog.hint}</small>
            )}
          </div>
        )}

        <div className="feedback-dialog-actions">
          {!isAlert && (
            <button
              type="button"
              className="feedback-dialog-cancel"
              onClick={cancel}
            >
              {dialog.cancelText}
            </button>
          )}

          <button
            type="button"
            ref={confirmRef}
            className={`feedback-dialog-confirm ${isDanger ? 'danger' : ''}`}
            onClick={submit}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

function FeedbackHost() {
  const [feedbackState, setFeedbackState] = useState(getFeedbackState)

  useEffect(() => subscribeFeedback(setFeedbackState), [])

  const activeDialog = feedbackState.dialogs[0]

  return (
    <>
      <div
        className="feedback-toast-region"
        role="status"
        aria-live="polite"
      >
        {feedbackState.toasts.map((toast) => {
          const Icon = TOAST_ICONS[toast.tone] || Info

          return (
            <div
              key={toast.id}
              className={`feedback-toast ${toast.tone}`}
              role={toast.tone === 'error' ? 'alert' : undefined}
            >
              <span className="feedback-toast-icon" aria-hidden="true">
                <Icon size={20} strokeWidth={2.2} />
              </span>

              <div className="feedback-toast-content">
                {toast.title && <strong>{toast.title}</strong>}
                <p>{toast.message}</p>
              </div>

              <button
                type="button"
                className="feedback-toast-close"
                onClick={() => dismissToast(toast.id)}
                aria-label="Bildirimi kapat"
              >
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>

      {activeDialog && (
        <FeedbackDialog
          key={activeDialog.id}
          dialog={activeDialog}
        />
      )}
    </>
  )
}

export default FeedbackHost
