import { useEffect, useState } from 'react'
import { ApiError } from './api'

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    load: typeof load
    attempt: number
    data?: T
    error?: string
  }>()

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ load, attempt, data })
    }).catch(error => {
      if (!controller.signal.aborted) {
        setResult({ load, attempt, error: error instanceof ApiError ? error.message : 'This content could not be loaded.' })
      }
    })
    return () => controller.abort()
  }, [load, attempt])

  const current = result?.load === load && result.attempt === attempt ? result : undefined
  return { data: current?.data, error: current?.error, loading: !current, retry: () => setAttempt(attempt + 1) }
}
