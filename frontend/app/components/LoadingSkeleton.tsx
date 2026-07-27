'use client'

import { ShieldCheck, Sparkles } from 'lucide-react'

export default function LoadingSkeleton() {
  return (
    <div
      className="neo-card animate-slide-up"
      style={{
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
      role="status"
      aria-label="Reconciling receipt..."
    >
      {/* Header Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          <div className="shimmer-box" style={{ height: 26, width: '45%' }} />
          <div className="shimmer-box" style={{ height: 14, width: '30%' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div className="shimmer-box" style={{ height: 12, width: 80 }} />
          <div className="shimmer-box" style={{ height: 38, width: 140, borderRadius: 10 }} />
        </div>
      </div>

      {/* Progress Checklist indicator */}
      <div
        style={{
          background: 'var(--surface-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-inner)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary)' }}>
          <Sparkles size={16} /> 1. Extracting Line Items (OCR)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary-text)' }}>
          <ShieldCheck size={16} /> 2. Reconciling Tax & Discounts
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          3. Generating Transfer Matrix
        </div>
      </div>

      {/* Rows Skeleton */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            padding: '14px 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="shimmer-box" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="shimmer-box" style={{ height: 16, width: '25%' }} />
            <div className="shimmer-box" style={{ height: 22, width: 90, borderRadius: 100 }} />
            <div className="shimmer-box" style={{ height: 22, width: 70, borderRadius: 100 }} />
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div className="shimmer-box" style={{ height: 16, width: 50 }} />
            <div className="shimmer-box" style={{ height: 16, width: 40 }} />
            <div className="shimmer-box" style={{ height: 18, width: 70 }} />
          </div>
        </div>
      ))}

      {/* Settle-up matrix Skeleton */}
      <div style={{ marginTop: 12 }}>
        <div className="shimmer-box" style={{ height: 14, width: 120, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[1, 2].map((i) => (
            <div key={i} className="shimmer-box" style={{ height: 60, width: 260, borderRadius: 14 }} />
          ))}
        </div>
      </div>
    </div>
  )
}
