import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DeleteDebtorButton } from '@/components/features/debtors/delete-debtor-button'

export default async function DebtorsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: debtors } = await supabase
    .from('debtors')
    .select('id, company_name, contact_name, contact_email, city, created_at')
    .order('company_name', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Débiteurs</h1>
          <p className="text-sm text-muted-foreground">
            {debtors?.length ?? 0} entreprise{(debtors?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/debtors/new"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nouveau débiteur
        </Link>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debtors?.map((debtor) => (
              <TableRow key={debtor.id}>
                <TableCell className="font-medium">{debtor.company_name}</TableCell>
                <TableCell>{debtor.contact_name ?? '—'}</TableCell>
                <TableCell>{debtor.contact_email ?? '—'}</TableCell>
                <TableCell>{debtor.city ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/debtors/${debtor.id}/edit`}
                      className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <DeleteDebtorButton id={debtor.id} companyName={debtor.company_name} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!debtors || debtors.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  Aucun débiteur. Commencez par en{' '}
                  <Link href="/debtors/new" className="font-medium underline-offset-4 hover:underline">
                    créer un
                  </Link>
                  .
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
