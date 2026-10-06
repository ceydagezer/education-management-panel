/*
 * Ortak geri bildirim sistemi
 *
 * Tarayıcının alert / confirm / prompt pencereleri yerine panelin
 * kendi tasarımıyla bildirim ve onay pencereleri gösterir.
 *
 *   notify('Öğrenci seçiniz.')              -> uyarı bildirimi
 *   notify.success('Tahsilat kaydedildi.')  -> başarı bildirimi
 *   notify.error('Kayıt alınamadı.')        -> hata bildirimi
 *
 *   if (!(await confirmDialog({ title, message, confirmText, tone: 'danger' }))) return
 *
 *   const reason = await promptDialog({ title, message, label })
 *   if (reason === null) return   // vazgeçildi
 *
 * Ekrandaki görünüm components/FeedbackHost.jsx içindedir.
 */

const listeners = new Set()

let state = {
  toasts: [],
  dialogs: []
}

let nextId = 1

const emit = () => {
  listeners.forEach((listener) => listener(state))
}

const setState = (updater) => {
  state = updater(state)
  emit()
}

export const subscribeFeedback = (listener) => {
  listeners.add(listener)
  listener(state)

  return () => {
    listeners.delete(listener)
  }
}

export const getFeedbackState = () => state

/*
 * Hata içeren mesajlar kırmızı, diğerleri (eksik alan, bilgi) sarı
 * gösterilir. Böylece eski alert() çağrıları tek tek sınıflanmadan
 * doğru tonda görünür.
 */
const ERROR_PATTERN =
  /(alınamadı|kaydedilemedi|silinemedi|güncellenemedi|oluşturulamadı|yüklenemedi|edilemedi|yapılamadı|başarısız|hata|bağlantı|ulaşılamadı|zaman aşımı)/i

const detectTone = (message) =>
  ERROR_PATTERN.test(String(message || '')) ? 'error' : 'warning'

const TOAST_DURATION = {
  success: 3500,
  info: 4500,
  warning: 5500,
  error: 7000
}

export const dismissToast = (id) => {
  setState((current) => ({
    ...current,
    toasts: current.toasts.filter((toast) => toast.id !== id)
  }))
}

const showToast = (message, tone, options = {}) => {
  const text = String(message ?? '').trim()

  if (!text) {
    return null
  }

  const id = nextId++

  // Aynı mesaj üst üste gelirse tekrar gösterme, süresini yenile.
  const duplicate = state.toasts.find(
    (toast) => toast.message === text && toast.tone === tone
  )

  if (duplicate) {
    dismissToast(duplicate.id)
  }

  setState((current) => ({
    ...current,
    toasts: [
      ...current.toasts.slice(-3),
      {
        id,
        tone,
        title: options.title || '',
        message: text
      }
    ]
  }))

  const duration = options.duration ?? TOAST_DURATION[tone]

  if (duration > 0) {
    window.setTimeout(() => dismissToast(id), duration)
  }

  return id
}

export function notify(message, options = {}) {
  return showToast(
    message,
    options.tone || detectTone(message),
    options
  )
}

notify.success = (message, options) =>
  showToast(message, 'success', options)

notify.error = (message, options) =>
  showToast(message, 'error', options)

notify.warning = (message, options) =>
  showToast(message, 'warning', options)

notify.info = (message, options) =>
  showToast(message, 'info', options)

/*
 * Pencereler sırayla gösterilir; her biri bir Promise döndürür.
 */
const openDialog = (dialog) =>
  new Promise((resolve) => {
    const id = nextId++

    setState((current) => ({
      ...current,
      dialogs: [
        ...current.dialogs,
        {
          ...dialog,
          id,
          resolve: (value) => {
            setState((latest) => ({
              ...latest,
              dialogs: latest.dialogs.filter((item) => item.id !== id)
            }))
            resolve(value)
          }
        }
      ]
    }))
  })

const normalizeOptions = (options) =>
  typeof options === 'string'
    ? { message: options }
    : options || {}

/*
 * Mesaj ilk satırı başlık olarak kullanılır; başlık verilmezse
 * eski confirm() metinleri de düzgün görünür.
 */
const splitTitle = (options, fallbackTitle) => {
  if (options.title) {
    return options
  }

  const message = String(options.message || '').trim()
  const [firstPart, ...rest] = message.split(/\n\s*\n/)

  if (rest.length > 0 && firstPart.length <= 120) {
    return {
      ...options,
      title: firstPart,
      message: rest.join('\n\n')
    }
  }

  return {
    ...options,
    title: fallbackTitle,
    message
  }
}

/*
 * Geri dönüşü zor işlemler (silme, iptal, pasife alma) kırmızı
 * tonda gösterilir; ton ayrıca verilirse o kullanılır.
 */
const DANGER_PATTERN =
  /(silin|silmek|sil\b|iptal|kaldır|pasife|vazgeç|çıkarmak|geçersiz)/i

const DANGER_CONFIRM_TEXTS = [
  [/silin|silmek|sil\b/i, 'Evet, Sil'],
  [/iptal/i, 'Evet, İptal Et'],
  [/kaldır/i, 'Evet, Kaldır'],
  [/pasife/i, 'Evet, Pasife Al'],
  [/çıkarmak/i, 'Evet, Çıkar']
]

/*
 * "... Devam edilsin mi?" gibi kalıp sonları pencerede gereksiz;
 * soru zaten düğmelerle soruluyor.
 */
const cleanQuestionTail = (message) =>
  String(message || '')
    .replace(
      /\s*(Devam (edilsin|etmek istiyor musunuz)[^?]*\?)\s*$/i,
      ''
    )
    .trim()

export function confirmDialog(options) {
  const raw = normalizeOptions(options)
  const fullText = `${raw.title || ''} ${raw.message || ''}`
  const isDanger =
    raw.tone ? raw.tone === 'danger' : DANGER_PATTERN.test(fullText)

  const dangerText = isDanger
    ? DANGER_CONFIRM_TEXTS.find(([pattern]) =>
        pattern.test(fullText)
      )?.[1]
    : null

  const normalized = splitTitle(
    {
      ...raw,
      message: raw.title
        ? raw.message
        : cleanQuestionTail(raw.message)
    },
    isDanger ? 'Emin misiniz?' : 'Onaylıyor musunuz?'
  )

  return openDialog({
    type: 'confirm',
    tone: isDanger ? 'danger' : 'default',
    confirmText: dangerText || (isDanger ? 'Evet, Devam Et' : 'Onayla'),
    cancelText: 'Vazgeç',
    ...normalized
  })
}

export function promptDialog(options) {
  const normalized = splitTitle(
    normalizeOptions(options),
    'Bilgi girin'
  )

  return openDialog({
    type: 'prompt',
    tone: 'default',
    confirmText: 'Kaydet',
    cancelText: 'Vazgeç',
    defaultValue: '',
    placeholder: '',
    inputType: 'text',
    multiline: false,
    required: false,
    validate: null,
    ...normalized
  })
}

/*
 * Kullanıcının mutlaka okuması gereken uyarılar (ör. işlemin neden
 * yapılamadığı) köşede kaybolan bildirim yerine ekranın ortasında,
 * tek "Tamam" düğmeli pencerede gösterilir.
 *
 *   await alertDialog({ title: 'Grup silinemez', message: '...' })
 */
export function alertDialog(options) {
  const normalized = splitTitle(
    normalizeOptions(options),
    'Uyarı'
  )

  return openDialog({
    type: 'alert',
    tone: 'warning',
    confirmText: 'Tamam',
    ...normalized
  })
}
