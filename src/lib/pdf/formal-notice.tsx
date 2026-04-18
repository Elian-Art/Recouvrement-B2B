import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Invoice, Debtor, Organization } from '@/types/database'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    padding: 60,
    color: '#1a1a1a',
    lineHeight: 1.6,
  },
  header: {
    marginBottom: 40,
    borderBottom: '2px solid #1a1a1a',
    paddingBottom: 16,
  },
  orgName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  orgAddress: {
    fontSize: 10,
    color: '#555',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    borderBottom: '1px solid #ddd',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 160,
    color: '#555',
    fontSize: 10,
  },
  value: {
    flex: 1,
    fontSize: 10,
  },
  amountBox: {
    backgroundColor: '#f5f5f5',
    border: '1px solid #ddd',
    padding: 12,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
  },
  amountValue: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#c0392b',
  },
  body: {
    fontSize: 10,
    lineHeight: 1.8,
    marginBottom: 20,
  },
  signature: {
    marginTop: 40,
    borderTop: '1px solid #ddd',
    paddingTop: 16,
    fontSize: 10,
    color: '#555',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 60,
    right: 60,
    fontSize: 8,
    color: '#aaa',
    textAlign: 'center',
    borderTop: '1px solid #eee',
    paddingTop: 8,
  },
})

export interface FormalNoticeData {
  invoice: Invoice
  debtor: Debtor
  org: Organization
  generatedAt: string
}

function FormalNoticeDocument({ data }: { data: FormalNoticeData }) {
  const { invoice, debtor, org, generatedAt } = data
  const today = formatDate(generatedAt)

  return (
    <Document
      title={`Mise en demeure — Facture ${invoice.invoice_number}`}
      author={org.name}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.orgName}>{org.name}</Text>
          <Text style={styles.orgAddress}>{org.billing_email ?? ''}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Mise en Demeure</Text>

        {/* Date */}
        <View style={[styles.section, { flexDirection: 'row', justifyContent: 'space-between' }]}>
          <View>
            <Text style={{ fontSize: 10, color: '#555' }}>Destinataire</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>{debtor.company_name}</Text>
            {debtor.contact_name ? <Text style={{ fontSize: 10 }}>{debtor.contact_name}</Text> : null}
            {debtor.contact_email ? <Text style={{ fontSize: 10 }}>{debtor.contact_email}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, color: '#555' }}>Date</Text>
            <Text style={{ fontSize: 10 }}>{today}</Text>
            <Text style={{ fontSize: 10, color: '#555', marginTop: 4 }}>Référence</Text>
            <Text style={{ fontSize: 10 }}>{invoice.invoice_number}</Text>
          </View>
        </View>

        {/* Amount box */}
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Montant dû</Text>
          <Text style={styles.amountValue}>{formatCurrency(invoice.amount_cents, invoice.currency)}</Text>
        </View>

        {/* Invoice details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détails de la créance</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Numéro de facture</Text>
            <Text style={styles.value}>{invoice.invoice_number}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date d&apos;émission</Text>
            <Text style={styles.value}>{formatDate(invoice.issued_at)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date d&apos;échéance</Text>
            <Text style={styles.value}>{formatDate(invoice.due_at)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Montant total</Text>
            <Text style={styles.value}>{formatCurrency(invoice.amount_cents, invoice.currency)}</Text>
          </View>
          {invoice.description ? (
            <View style={styles.row}>
              <Text style={styles.label}>Description</Text>
              <Text style={styles.value}>{invoice.description}</Text>
            </View>
          ) : null}
        </View>

        {/* Letter body */}
        <View style={styles.section}>
          <Text style={styles.body}>
            Par la présente, nous mettons en demeure {debtor.company_name} de procéder au règlement
            immédiat de la somme de {formatCurrency(invoice.amount_cents, invoice.currency)},
            correspondant à la facture n° {invoice.invoice_number} émise le {formatDate(invoice.issued_at)},
            dont l&apos;échéance était fixée au {formatDate(invoice.due_at)}.
          </Text>
          <Text style={styles.body}>
            Malgré nos relances successives, cette somme reste impayée à ce jour. Nous vous accordons
            un délai de 8 jours à compter de la réception de ce courrier pour vous acquitter de cette
            dette. Passé ce délai, nous nous réservons le droit d&apos;engager toutes poursuites judiciaires
            nécessaires au recouvrement de cette créance, ainsi que des frais et intérêts de retard
            légaux qui s&apos;y rapportent.
          </Text>
          <Text style={styles.body}>
            Dans l&apos;attente de votre règlement, veuillez agréer, l&apos;expression de nos salutations distinguées.
          </Text>
        </View>

        {/* Signature */}
        <View style={styles.signature}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 4 }}>{org.name}</Text>
          <Text>Le service recouvrement</Text>
          <Text>{today}</Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Document généré automatiquement — {org.name} — {today}
        </Text>
      </Page>
    </Document>
  )
}

export async function generateFormalNoticePDF(data: FormalNoticeData): Promise<Buffer> {
  const buffer = await renderToBuffer(<FormalNoticeDocument data={data} />)
  return Buffer.from(buffer)
}
