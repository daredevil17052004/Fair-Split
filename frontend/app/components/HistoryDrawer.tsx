'use client'

import { X, History, Trash2, ArrowRight, Receipt, Calendar, CreditCard } from 'lucide-react'
import type { SplitResult } from './ResultCard'

export interface HistoryItem {
  id: string
  timestamp: string
  merchantName: string
  grandTotal: number
  paidBy: string | null
  result: SplitResult
  descriptionSnippet: string
}

interface HistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
  history: HistoryItem[]
  onSelectHistoryItem: (item: HistoryItem) => void
  onClearHistory: () => void
}

export default function HistoryDrawer({
  isOpen,
  onClose,
  history,
  onSelectHistoryItem,
  onClearHistory,
}: HistoryDrawerProps) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay no-print" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: 440,
          background: 'var(--surface-card)',
          boxShadow: 'var(--shadow-modal)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 150,
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--primary-light)',
                color: 'var(--primary-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <History size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Split History</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {history.length} saved transaction reconciliation{history.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 6,
              borderRadius: 6,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <Receipt size={40} style={{ color: 'var(--text-light)', marginBottom: 12 }} />
              <p style={{ fontWeight: 600, color: 'var(--text-body)', fontSize: '0.9rem' }}>
                No recent bill splits
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Calculated receipt splits will automatically save here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectHistoryItem(item)
                    onClose()
                  }}
                  className="neo-card neo-card-hover"
                  style={{
                    padding: 16,
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-inner)',
                    background: 'var(--surface-card)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <h4
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: 'var(--text-main)',
                        }}
                      >
                        {item.merchantName}
                      </h4>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          marginTop: 4,
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Calendar size={12} /> {item.timestamp}
                        </span>
                        {item.paidBy && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <CreditCard size={12} /> {item.paidBy}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        className="tabular-nums"
                        style={{
                          fontSize: '1rem',
                          fontWeight: 800,
                          color: 'var(--primary-text)',
                        }}
                      >
                        ₹{item.grandTotal.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-body)',
                      background: 'var(--surface-subtle)',
                      padding: '6px 10px',
                      borderRadius: 6,
                      marginTop: 6,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    "{item.descriptionSnippet}"
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 4,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: 'var(--secondary)',
                      marginTop: 10,
                    }}
                  >
                    View Reconciliation <ArrowRight size={12} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface-subtle)',
            }}
          >
            <button
              type="button"
              onClick={onClearHistory}
              className="btn-secondary"
              style={{
                width: '100%',
                color: 'var(--danger-text)',
                borderColor: 'var(--danger-border)',
                background: 'var(--danger-bg)',
              }}
            >
              <Trash2 size={14} /> Clear History
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
