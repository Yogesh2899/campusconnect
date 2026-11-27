import { otpEmail } from './otp-email'

export class MailDeliveryError extends Error {
  constructor(readonly reason: 'configuration' | 'connection' | 'rejected', readonly status?: number) {
    super('Email delivery is unavailable')
  }
}

export async function sendMail(to: string, subject: string, text: string | { htmlContent: string }) {
  if (!process.env.BREVO_API_KEY || !process.env.EMAIL_FROM) {
    throw new MailDeliveryError('configuration')
  }
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { email: process.env.EMAIL_FROM, name: 'Thapar Connect' },
      to: [{ email: to }], subject,
      ...(typeof text === 'string' ? { textContent: text } : text),
    }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => { throw new MailDeliveryError('connection') })
  if (!response.ok) throw new MailDeliveryError('rejected', response.status)
}

export function sendOtpMail(to: string, code: string, purpose: 'verify' | 'sign-in') {
  const subject = purpose === 'sign-in' ? 'Sign in to Thapar Connect' : 'Your Thapar Connect verification code'
  return sendMail(to, subject, { htmlContent: otpEmail(code, purpose, process.env.BETTER_AUTH_URL) })
}


