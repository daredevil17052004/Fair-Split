import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EpiFi FairSplit — Enterprise Neo-Banking Receipt Reconciliation',
  description:
    'Upload itemized receipts and describe individual items. Get fully-audited per-person bill splits with proportional tax, service charge, and discounts.',
  keywords: 'fintech, receipt split, neo-banking, expense reconciliation, EpiFi, AI split',
  openGraph: {
    title: 'EpiFi FairSplit — Precision Expense Reconciliation',
    description: 'Enterprise-grade receipt OCR and fair bill splitter',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
