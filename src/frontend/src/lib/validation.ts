import type { RegistrationRole } from './contracts'

const personName = /^(?=.*\p{L})[\p{L} .'-]{2,100}$/u
const emailAddress = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/
const academicAddress = /^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)*(edu|ac)(\.[A-Za-z]{2,})*$/

export function normalizePhone(value: string) {
  const raw = value.trim()
  if (!/^[+\d\s()-]{10,20}$/.test(raw)) return ''
  let digits = raw.replace(/[\s()-]/g, '')
  if (digits.startsWith('+92')) digits = '0' + digits.slice(3)
  else if (digits.startsWith('0092')) digits = '0' + digits.slice(4)
  else if (digits.startsWith('92') && digits.length === 12) digits = '0' + digits.slice(2)
  return /^03\d{9}$/.test(digits) ? digits.slice(0, 4) + '-' + digits.slice(4) : ''
}

export function localDate(date = new Date()) {
  const parts = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
  return parts.map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0')).join('-')
}

export function validDate(value: string) {
  const date = new Date(value + 'T00:00:00')
  return !Number.isNaN(date.getTime()) && localDate(date) === value
}

function birthDate(value: string, role: RegistrationRole) {
  if (!validDate(value)) return 'Enter a valid date of birth.'
  const today = localDate()
  const age = Number(today.slice(0, 4)) - Number(value.slice(0, 4))
    - Number(today.slice(5) < value.slice(5))
  if (value >= today || age > 100) return 'Enter a past date of birth and an age of 100 or under.'
  if (role === 'MANAGER' && age < 18) return 'Arena managers must be at least 18.'
  if (age < 5) return 'Players must be at least 5.'
  return ''
}

export const validate = {
  name: (value: string) => personName.test(value.trim()) ? '' : 'Use 2–100 characters with at least one letter.',
  email: (value: string) => value.length <= 100 && emailAddress.test(value.trim()) ? '' : 'Enter a valid email address.',
  username: (value: string) => !value || /^[A-Za-z0-9._]{3,30}$/.test(value)
    ? '' : 'Use 3–30 letters, numbers, periods, or underscores.',
  phone: (value: string) => normalizePhone(value) ? '' : 'Enter a Pakistani mobile number starting with 03 or +92.',
  password: (value: string) => value.length >= 8 && value.length <= 100 && /\p{L}/u.test(value) && /\p{Nd}/u.test(value)
    ? '' : 'Use 8–100 characters with at least one letter and one number.',
  birthDate,
  studentId: (value: string) => !value || /^[A-Za-z0-9-]{3,30}$/.test(value)
    ? '' : 'Use 3–30 letters, numbers, or hyphens.',
  universityEmail: (value: string) => !value || (value.length <= 100 && academicAddress.test(value))
    ? '' : 'Enter a university email with an edu or ac domain.',
}
