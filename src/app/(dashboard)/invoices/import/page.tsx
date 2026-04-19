import { ImportWizard } from './_components/import-wizard'

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Importer des factures</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Importez vos factures depuis un fichier CSV ou Excel.
        </p>
      </div>
      <ImportWizard />
    </div>
  )
}
