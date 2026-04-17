import { Resend } from 'resend'

export interface SendReminderEmailParams {
  to: string
  subject: string
  body: string          // plain-text body (rendered as HTML with line breaks)
  fromName?: string
  fromEmail?: string
}

export async function sendReminderEmail({
  to,
  subject,
  body,
  fromName = 'Recouvrement B2B',
  fromEmail = 'relances@recouvrement-b2b.fr',
}: SendReminderEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Missing RESEND_API_KEY environment variable')
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  const htmlBody = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
    html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.6;max-width:600px;margin:0 auto;padding:24px">
  <p>${htmlBody}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#999">Ce message a été envoyé automatiquement. Ne pas répondre à cet email.</p>
</body>
</html>`,
  })

  if (error) throw new Error(`Resend error: ${error.message}`)
  return data
}
