interface Props {
  params: Promise<{ token: string }>
}

export default async function PaymentSuccessPage({ params }: Props) {
  await params // ensure params is awaited per Next.js 15 pattern

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border max-w-md w-full p-8 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Paiement réussi</h1>
        <p className="text-gray-500">
          Votre paiement a été traité avec succès. Vous recevrez une confirmation par email.
        </p>
        <p className="text-sm text-gray-400">
          Le traitement peut prendre quelques instants. Merci pour votre règlement.
        </p>
      </div>
    </div>
  )
}
