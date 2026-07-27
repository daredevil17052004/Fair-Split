'use client'

import { useState } from 'react'
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Calendar,
  CreditCard,
  Copy,
  Download,
  Printer,
  ChevronDown,
  ArrowRight,
  Sparkles,
  Info,
  Check,
} from 'lucide-react'

export interface PersonSplit {
  name: string
  items: string[]
  subtotal: number
  tax_share: number
  service_share: number
  discount_share: number
  total: number
}

export interface Reconciliation {
  sum_of_person_totals: number
  matches_bill: boolean
}

export interface SettleUpItem {
  from: string
  to: string
  amount: number
}

export interface ReceiptMeta {
  restaurant_name: string | null
  bill_number: string | null
  date: string | null
  currency: string
}

export interface SplitResult {
  per_person: PersonSplit[]
  grand_total: number
  reconciliation: Reconciliation
  paid_by: string | null
  settle_up: SettleUpItem[]
  assumptions: string[]
  flags: string[]
  receipt_meta?: ReceiptMeta
}

function fmt(amount: number, currency = '₹') {
  if (amount === 0) return '—'
  const sign = amount < 0 ? '-' : ''
  return `${sign}${currency}${Math.abs(amount).toLocaleString('en-IN')}`
}

function InitialsAvatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/)
  const text = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)

  const colors = [
    { bg: '#EFF6FF', color: '#1D4ED8' },
    { bg: '#ECFDF5', color: '#047857' },
    { bg: '#F5F3FF', color: '#6D28D9' },
    { bg: '#FFF7ED', color: '#C2410C' },
  ]
  const charCode = name.charCodeAt(0) || 0
  const theme = colors[charCode % colors.length]

  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: theme.bg,
        color: theme.color,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.72rem',
        fontWeight: 800,
        flexShrink: 0,
        border: '1px solid rgba(0,0,0,0.05)',
      }}
    >
      {text.toUpperCase()}
    </div>
  )
}

function LinearAccordion({
  title,
  icon,
  items,
  variant = 'default',
  defaultOpen = false,
}: {
  title: string
  icon: React.ReactNode
  items: string[]
  variant?: 'default' | 'flags'
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border)',
        padding: '16px 24px',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: variant === 'flags' ? 'var(--warning-text)' : 'var(--secondary)' }}>
            {icon}
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {title}
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 100,
              fontSize: '0.7rem',
              fontWeight: 700,
              background: variant === 'flags' ? 'var(--warning-bg)' : 'var(--surface-subtle)',
              color: variant === 'flags' ? 'var(--warning-text)' : 'var(--text-muted)',
              border: `1px solid ${variant === 'flags' ? 'var(--warning-border)' : 'var(--border)'}`,
            }}
          >
            {items.length}
          </span>
        </div>

        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          {items.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              No items logged.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((item, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-body)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: variant === 'flags' ? 'var(--warning-bg)' : 'var(--surface-subtle)',
                    borderLeft: `3px solid ${variant === 'flags' ? '#F59E0B' : 'var(--secondary)'}`,
                    lineHeight: 1.5,
                  }}
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function ResultCard({ result }: { result: SplitResult }) {
  const {
    per_person,
    grand_total,
    reconciliation,
    paid_by,
    settle_up,
    assumptions,
    flags,
    receipt_meta,
  } = result

  const [copiedToast, setCopiedToast] = useState<string | null>(null)
  const [settledItems, setSettledItems] = useState<Record<number, boolean>>({})

  const currency = receipt_meta?.currency === 'INR' ? '₹' : receipt_meta?.currency ?? '₹'

  const showToast = (msg: string) => {
    setCopiedToast(msg)
    setTimeout(() => setCopiedToast(null), 3000)
  }

  const copySummaryText = () => {
    let text = `🧾 *${receipt_meta?.restaurant_name ?? 'Restaurant Bill'} — Fair Split*\n`
    text += `Grand Total: ${currency}${grand_total.toLocaleString('en-IN')}\n`
    if (paid_by) text += `Paid by: ${paid_by}\n\n`

    text += `*Per Person Breakdown:*\n`
    per_person.forEach((p) => {
      text += `• ${p.name}: ${currency}${p.total.toLocaleString('en-IN')}\n`
    })

    if (settle_up.length > 0) {
      text += `\n*Settle Up:*\n`
      settle_up.forEach((s) => {
        text += `• ${s.from} ➔ ${s.to}: ${currency}${s.amount.toLocaleString('en-IN')}\n`
      })
    }

    navigator.clipboard.writeText(text)
    showToast('Summary copied to clipboard!')
  }

  const downloadCSV = () => {
    let csv = 'Name,Items,Subtotal,Service Share,Tax Share,Discount Share,Net Total\n'
    per_person.forEach((p) => {
      csv += `"${p.name}","${p.items.join('; ')}",${p.subtotal},${p.service_share},${p.tax_share},${p.discount_share},${p.total}\n`
    })

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Bill_Split_${receipt_meta?.restaurant_name ?? 'Reconciliation'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Downloaded CSV breakdown!')
  }

  const toggleSettleItem = (index: number) => {
    setSettledItems((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  return (
    <div className="animate-slide-up">
      <div className="neo-card" style={{ overflow: 'hidden' }}>

        {/* ── Statement Header Bar ── */}
        <div
          style={{
            padding: '24px 28px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(to bottom, #FFFFFF, var(--surface-subtle))',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          {/* Merchant Details */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h2
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  letterSpacing: '-0.02em',
                }}
              >
                {receipt_meta?.restaurant_name ?? 'Restaurant Receipt Split'}
              </h2>
              <span className="badge-emerald" style={{ fontSize: '0.7rem' }}>
                <ShieldCheck size={14} /> Audit Reconciled
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
              {receipt_meta?.bill_number && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Receipt size={14} /> Bill #{receipt_meta.bill_number}
                </span>
              )}
              {receipt_meta?.date && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={14} /> {receipt_meta.date}
                </span>
              )}
              {paid_by && (
                <span className="badge-blue" style={{ fontSize: '0.72rem' }}>
                  <CreditCard size={12} /> Paid by {paid_by}
                </span>
              )}
            </div>
          </div>

          {/* Grand Total & Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <div
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-inner)',
                padding: '12px 20px',
                textAlign: 'right',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                RECONCILED GRAND TOTAL
              </span>
              <div
                className="tabular-nums"
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  lineHeight: 1.1,
                  fontFamily: 'Plus Jakarta Sans',
                }}
              >
                {currency}{grand_total.toLocaleString('en-IN')}
              </div>

              <div style={{ marginTop: 4 }}>
                {reconciliation.matches_bill ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--primary-text)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={13} /> Zero Variance Reconciled
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: 'var(--warning-text)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={13} /> Variance Audited
                  </span>
                )}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="no-print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" onClick={copySummaryText} className="btn-secondary" title="Copy text summary">
                <Copy size={14} /> Copy
              </button>
              <button type="button" onClick={downloadCSV} className="btn-secondary" title="Export CSV">
                <Download size={14} /> CSV
              </button>
              <button type="button" onClick={() => window.print()} className="btn-secondary" title="Print document">
                <Printer size={14} /> Print
              </button>
            </div>
          </div>
        </div>

        {/* ── Per-Person Breakdown Table ── */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Per-Person Proportional Breakdown
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {per_person.length} participant{per_person.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="fintech-table-container">
            <table className="fintech-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Itemized Shares</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                  <th style={{ textAlign: 'right' }}>Service</th>
                  <th style={{ textAlign: 'right' }}>Tax</th>
                  <th style={{ textAlign: 'right' }}>Discount</th>
                  <th style={{ textAlign: 'right' }}>Net Total</th>
                </tr>
              </thead>
              <tbody>
                {per_person.map((p) => (
                  <tr key={p.name}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <InitialsAvatar name={p.name} />
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{p.name}</span>
                          {p.name === paid_by && (
                            <span
                              style={{
                                display: 'inline-block',
                                marginLeft: 6,
                                padding: '1px 6px',
                                background: 'var(--primary-light)',
                                color: 'var(--primary-text)',
                                borderRadius: 100,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                              }}
                            >
                              Payer
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 220 }}>
                        {p.items.length === 0 ? (
                          <span style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>—</span>
                        ) : (
                          p.items.map((item, i) => (
                            <span
                              key={i}
                              style={{
                                padding: '2px 8px',
                                background: 'var(--surface-subtle)',
                                border: '1px solid var(--border)',
                                borderRadius: 100,
                                fontSize: '0.72rem',
                                color: 'var(--text-body)',
                                fontWeight: 500,
                              }}
                            >
                              {item}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }} className="tabular-nums">
                      {fmt(p.subtotal, currency)}
                    </td>

                    <td style={{ textAlign: 'right' }} className="tabular-nums">
                      {fmt(p.service_share, currency)}
                    </td>

                    <td style={{ textAlign: 'right' }} className="tabular-nums">
                      {fmt(p.tax_share, currency)}
                    </td>

                    <td style={{ textAlign: 'right' }} className="tabular-nums">
                      {p.discount_share !== 0 ? (
                        <span style={{ color: 'var(--primary-text)', fontWeight: 600 }}>
                          {fmt(p.discount_share, currency)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }} className="tabular-nums">
                      <span
                        style={{
                          fontFamily: 'Plus Jakarta Sans',
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          color: 'var(--primary-text)',
                        }}
                      >
                        {currency}{p.total.toLocaleString('en-IN')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Settle-Up Transfers Matrix ── */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Settle-Up Transfers Matrix
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Minimizes peer-to-peer transfers
            </span>
          </div>

          {settle_up.length === 0 ? (
            <div
              style={{
                padding: 16,
                background: 'var(--surface-card)',
                borderRadius: 'var(--radius-inner)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
              }}
            >
              <Info size={18} style={{ color: 'var(--secondary)' }} />
              {paid_by ? `${paid_by} paid the exact bill total — no transfers required.` : 'No payer detected in notes.'}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 12,
              }}
            >
              {settle_up.map((s, i) => {
                const isSettled = settledItems[i]
                return (
                  <div
                    key={i}
                    style={{
                      background: isSettled ? 'var(--primary-light)' : 'var(--surface-card)',
                      border: `1px solid ${isSettled ? 'var(--primary-border)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-inner)',
                      padding: '16px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      transition: 'all 0.2s ease',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{s.from}</span>
                        <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontWeight: 800, color: 'var(--secondary-text)' }}>{s.to}</span>
                      </div>

                      <div
                        className="tabular-nums"
                        style={{
                          fontSize: '1.2rem',
                          fontWeight: 800,
                          color: isSettled ? 'var(--primary-text)' : 'var(--text-main)',
                          marginTop: 4,
                          fontFamily: 'Plus Jakarta Sans',
                        }}
                      >
                        {currency}{s.amount.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSettleItem(i)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-pill)',
                        border: `1px solid ${isSettled ? 'var(--primary-border)' : 'var(--border)'}`,
                        background: isSettled ? '#FFFFFF' : 'var(--surface-subtle)',
                        color: isSettled ? 'var(--primary-text)' : 'var(--text-body)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isSettled ? <Check size={12} /> : null}
                      {isSettled ? 'Paid' : 'Mark Paid'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Collapsible Audit Trail ── */}
        <LinearAccordion
          title="Assumptions & Deductions Log"
          icon={<Sparkles size={18} />}
          items={assumptions}
          defaultOpen={assumptions.length > 0}
        />

        <LinearAccordion
          title="Audit Flags & Warnings"
          icon={<AlertTriangle size={18} />}
          items={flags}
          variant="flags"
          defaultOpen={flags.length > 0}
        />

      </div>

      {/* Toast popup */}
      {copiedToast && (
        <div className="toast-container no-print">
          <div className="toast">
            <CheckCircle2 size={18} style={{ color: '#10B981' }} />
            {copiedToast}
          </div>
        </div>
      )}
    </div>
  )
}
