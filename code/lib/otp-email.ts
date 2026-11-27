export const OTP_MINUTES = 10

export function otpEmail(code: string, purpose: 'verify' | 'sign-in', origin?: string) {
  if (!/^[0-9]{6}$/.test(code)) throw new Error('Expected a six-digit code')

  const base = origin && URL.canParse(origin) ? new URL(origin) : null
  const banner = base?.protocol === 'https:' ? new URL('/otp-campus.jpg', base).href : null
  const image = banner ? `<td width="42%" align="right" valign="middle">
    <img src="${banner}" alt="" width="270" style="display:block;width:100%;max-width:270px;height:auto;border:0">
  </td>` : ''
  const instruction = purpose === 'sign-in'
    ? 'Use the one-time code below to sign in to Thapar Connect.'
    : 'You’re almost there! Use the one-time code below to verify your email address and continue with Thapar Connect.'
  const digits = [...code].map(digit => `<td align="center" width="45" bgcolor="#fff4f6" style="height:52px;border:1px solid #e87585;border-radius:8px;font:700 28px Arial,sans-serif;color:#101a36">${digit}</td>`).join('')

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thapar Connect one-time code</title></head>
<body style="margin:0;padding:0;background:#eff2fd;color:#101a36;font:16px Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#eff2fd">
<tr><td align="center" style="padding:16px 8px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width:660px;border:1px solid #e3e6f5;border-radius:14px">
    <tr><td bgcolor="#0b1733" style="border-radius:13px 13px 0 0">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
        <td style="padding:20px 12px 20px 20px;color:#fff">
          <span style="display:inline-block;background:#d70b2d;border-radius:8px;padding:3px 9px;color:#fff;font:bold 31px Arial,sans-serif">ti</span>
          <p style="margin:9px 0 3px;font:bold 23px Arial,sans-serif;color:#fff">Thapar <span style="color:#ff5365">Connect</span></p>
          <p style="margin:0;font-size:12px;color:#c2cce3">Connect · Collaborate · Grow</p>
        </td>${image}
      </tr></table>
    </td></tr>
    <tr><td style="padding:22px 18px 18px">
      <h1 style="margin:0 0 10px;font-size:32px;line-height:1.15;color:#101a36">Hello! <span aria-hidden="true">👋</span></h1>
      <p style="margin:0 0 18px;line-height:1.5">${instruction}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#fff1f5" style="border:1px solid #f4b7c5;border-radius:12px">
        <tr><td align="center" style="padding:13px 4px;color:#101a36">
          <div aria-hidden="true" style="color:#d50b31;font-size:22px">🔒</div>
          <h2 style="margin:4px 0 8px;font-size:20px">Your OTP Code</h2>
          <table role="presentation" aria-hidden="true" width="100%" cellspacing="4" cellpadding="0" style="max-width:360px"><tr>${digits}</tr></table>
          <p style="margin:9px 0 5px;font-size:15px">Select to copy <strong id="copyable-code" dir="ltr" style="white-space:nowrap;font:bold 20px 'Courier New',monospace;color:#101a36;user-select:all">${code}</strong></p>
          <p style="margin:0;font-size:14px">This code expires in <strong style="color:#b3082b">${OTP_MINUTES} minutes.</strong></p>
        </td></tr>
      </table>
      <p style="margin:16px 0;padding:12px;background:#fbe0e6;color:#a60d2c;border-radius:8px;font-size:14px">For your security, please do not share this code with anyone.</p>
      <p style="margin:0;font-size:14px;line-height:1.45">Best regards,<br><strong>Thapar Connect Team</strong><br><em>Thapar Institute of Engineering &amp; Technology, Patiala</em></p>
    </td></tr>
    <tr><td align="center" bgcolor="#0b1733" style="padding:17px 12px;border-bottom:5px solid #d70b2d;border-radius:0 0 13px 13px;color:#fff;font-size:13px">
      <strong>Thapar Institute of Engineering &amp; Technology</strong>
      <p style="margin:5px 0 0;color:#c2cce3;font-size:12px">Dream · Discover · Achieve</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`
}
