import { useEffect, useId, useRef, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { AlertCircle, Check, Eye, EyeOff, LoaderCircle, X } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Courtly home">
      <span className="brand-mark" aria-hidden="true"><i /></span>
      <span>Courtly<span className="brand-period">.</span></span>
    </Link>
  )
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export function Field({ label, error, hint, type, ...props }: FieldProps) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const password = type === 'password'
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-wrap">
        <input {...props} id={id} type={password && visible ? 'text' : type}
          className={password ? 'has-icon' : undefined} aria-invalid={!!error}
          aria-describedby={error || hint ? id + '-description' : undefined} />
        {password && (
          <button className="password-toggle" type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}
            title={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        )}
      </div>
      {(error || hint) && <span id={id + '-description'} className={error ? 'field-error' : 'field-hint'}>{error || hint}</span>}
    </div>
  )
}

export function Message({ kind = 'error', children }: { kind?: 'error' | 'success'; children: ReactNode }) {
  const Icon = kind === 'success' ? Check : AlertCircle
  return (
    <div className={`message message--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon size={19} aria-hidden="true" /><div>{children}</div>
    </div>
  )
}

export function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <button className="button button--primary form-submit" type="submit" disabled={busy}>
    {busy && <LoaderCircle className="spinner" size={18} aria-hidden="true" />}{children}
  </button>
}

export function Skeleton({ label, count = 3 }: { label: string; count?: number }) {
  return <div className="skeleton-grid" role="status" aria-label={label}>
    {Array.from({ length: count }, (_, i) => <div className="skeleton" key={i} aria-hidden="true" />)}
  </div>
}

export function ContentError({ error, retry }: { error: string; retry: () => void }) {
  return <Message>{error} <button type="button" className="text-link inline-retry" onClick={retry}>Try again</button></Message>
}

export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])
  return <dialog ref={ref} className="dialog" aria-labelledby={id}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => {
      if (event.target === event.currentTarget) {
        const box = event.currentTarget.getBoundingClientRect()
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
      }
    }}>
    <div className="dialog-heading"><h2 id={id}>{title}</h2>
      <button className="icon-button" aria-label="Close" onClick={onClose}><X size={23} /></button>
    </div>
    {children}
  </dialog>
}

export function Toast({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="toast" role="status">
    <Check size={18} aria-hidden="true" /><span>{children}</span>
    <button type="button" className="icon-button" onClick={onClose} aria-label="Dismiss notification"><X size={18} /></button>
  </div>
}
