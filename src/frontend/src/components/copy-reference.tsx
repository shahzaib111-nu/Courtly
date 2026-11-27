import { useState } from 'react'
import { Copy } from 'lucide-react'

export function CopyReference({ value, label = 'booking reference' }: { value?: string; label?: string }) {
  const [status, setStatus] = useState('')
  if (!value) return <span>Unavailable</span>
  async function copy(reference: string) {
    try {
      await navigator.clipboard.writeText(reference)
      setStatus('Copied')
    } catch {
      setStatus('Select the reference to copy it manually')
    }
  }
  return <span className="copy-reference">
    <span className="copy-reference-value" data-expanded={status.startsWith('Select')} title={value}>{value}</span>
    <button className="icon-button" type="button" aria-label={'Copy ' + label} title={'Copy ' + label} onClick={() => void copy(value)}>
      <Copy size={14} aria-hidden="true" />
    </button>
    <span className="copy-reference-status" role="status">{status}</span>
  </span>
}
