'use client'

import { NextIntlClientProvider } from 'next-intl'

interface Props {
  locale: string
  messages: Record<string, unknown>
  children: React.ReactNode
}

export function I18nProvider({ locale, messages, children }: Props) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
