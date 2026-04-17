import type { Reminder } from '@/types/database'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const statusConfig = {
  scheduled: { label: 'Planifiée', variant: 'secondary' as const },
  sent: { label: 'Envoyée', variant: 'default' as const },
  failed: { label: 'Échec', variant: 'destructive' as const },
}

const channelLabel = { email: 'Email', sms: 'SMS' }

interface Props {
  reminders: Reminder[]
}

export function ReminderTimeline({ reminders }: Props) {
  if (reminders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune relance enregistrée pour cette facture.
      </p>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
      <ul className="space-y-4">
        {reminders.map((reminder) => {
          const { label, variant } = statusConfig[reminder.status]
          return (
            <li key={reminder.id} className="relative pl-10">
              <div className="absolute left-0 top-1 h-7 w-7 rounded-full border-2 border-border bg-background flex items-center justify-center">
                {reminder.channel === 'email' ? (
                  <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div className="bg-card border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{channelLabel[reminder.channel]}</span>
                  <Badge variant={variant} className="text-xs">{label}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {reminder.sent_at
                      ? `Envoyée le ${formatDate(reminder.sent_at)}`
                      : `Planifiée le ${formatDate(reminder.scheduled_at)}`
                    }
                  </span>
                </div>
                {reminder.subject && (
                  <p className="text-xs text-muted-foreground">Sujet : {reminder.subject}</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
