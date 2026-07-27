'use client'

import { ShieldCheck, History, ChevronDown, Sparkles, Building2 } from 'lucide-react'

interface NavbarProps {
  historyCount: number
  onOpenHistory: () => void
  activeTab: 'calculator' | 'history' | 'analytics'
  setActiveTab: (tab: 'calculator' | 'history' | 'analytics') => void
}

export default function Navbar({
  historyCount,
  onOpenHistory,
  activeTab,
  setActiveTab,
}: NavbarProps) {
  return (
    <header className="no-print" style={{ marginBottom: 32 }}>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          background: 'var(--surface-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-sm)',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        {/* Left — Brand Logo & Product Tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
            }}
          >
            <ShieldCheck size={22} strokeWidth={2.5} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  letterSpacing: '-0.03em',
                  color: 'var(--text-main)',
                }}
              >
                FairSplit
              </span>


            </div>

          </div>
        </div>

        {/* Center — Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--surface-subtle)',
            padding: 4,
            borderRadius: 'var(--radius-inner)',
            border: '1px solid var(--border)',
            gap: 2,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('calculator')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'calculator' ? 'var(--surface-card)' : 'transparent',
              color: activeTab === 'calculator' ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: activeTab === 'calculator' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Sparkles size={14} style={{ color: activeTab === 'calculator' ? 'var(--primary)' : 'inherit' }} />
            Split Calculator
          </button>

          <button
            type="button"
            onClick={onOpenHistory}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'history' ? 'var(--surface-card)' : 'transparent',
              color: activeTab === 'history' ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: activeTab === 'history' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <History size={14} />
            Split History
            {historyCount > 0 && (
              <span
                style={{
                  padding: '1px 6px',
                  background: 'var(--primary-light)',
                  color: 'var(--primary-text)',
                  borderRadius: 100,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                }}
              >
                {historyCount}
              </span>
            )}
          </button>
        </div>

        {/* Right — Workspace & Profile Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: 'var(--surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-inner)',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--text-body)',
              cursor: 'pointer',
            }}
          >
            <Building2 size={14} style={{ color: 'var(--secondary)' }} />
            <span>Personal Workspace</span>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          </div>

          <span
            className="badge-blue"
            style={{ padding: '5px 10px', fontSize: '0.75rem', fontFamily: 'monospace' }}
          >
            INR ₹
          </span>
        </div>
      </nav>
    </header>
  )
}
