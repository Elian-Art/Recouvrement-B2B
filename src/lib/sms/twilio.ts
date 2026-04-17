import twilio from 'twilio'

export async function sendReminderSMS(to: string, body: string) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    throw new Error('Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN or TWILIO_PHONE_NUMBER')
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  const message = await client.messages.create({
    from: TWILIO_PHONE_NUMBER,
    to,
    body,
  })
  return message.sid
}
