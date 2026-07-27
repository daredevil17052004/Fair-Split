'use client'

import { useState, useRef, useEffect } from 'react'
import Navbar from './components/Navbar'
import ReceiptUpload from './components/ReceiptUpload'
import ResultCard, { type SplitResult } from './components/ResultCard'
import LoadingSkeleton from './components/LoadingSkeleton'
import HistoryDrawer, { type HistoryItem } from './components/HistoryDrawer'
import {
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  TrendingUp,
  FileText,
  Users,
} from 'lucide-react'

const SAMPLE_SCENARIOS = [
  {
    label: 'Ravi, Neha & Sameer',
    text: 'Three of us — Ravi, Neha, Sameer. Ravi had the cappuccino and the sandwich. Neha had the pasta and the lime soda. Sameer had the brownie. Sameer paid.',
  },
  {
    label: 'Aman, Priya, Karan & Sara (15% Off)',
    text: 'Four of us: Aman, Priya, Karan, Sara. The Gulab Jamun was shared just by Priya and Karan. Everything else was common to all four. We used a 15% off coupon. Priya paid.',
  },
  {
    label: 'Ishaan, Meera & Rohit (Drinks)',
    text: 'Ishaan, Meera, Rohit. Pizza, pasta and garlic bread shared equally by all three. The two beers were Ishaan and Rohit only. The mojito was Meera\'s. Rohit paid.',
  },
  {
    label: 'Dev, Nikhil, Anjali & Farah',
    text: 'Dev and Nikhil each had a chicken biryani. Anjali had the veg biryani. Farah had the rogan josh. The raita and soft drinks were common to all four. Anjali paid.',
  },
]

export default function Home() {
  const [imageBase64, setImageBase64] = useState<string>('')
  const [description, setDescription] = useState('')
  const [result, setResult] = useState<SplitResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'calculator' | 'history' | 'analytics'>('calculator')

  const resultRef = useRef<HTMLDivElement>(null)

  // Load saved history on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('epifi_split_history')
      if (saved) {
        setHistory(JSON.parse(saved))
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  const saveToHistory = (res: SplitResult, desc: string) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }),
      merchantName: res.receipt_meta?.restaurant_name ?? 'Restaurant Bill',
      grandTotal: res.grand_total,
      paidBy: res.paid_by,
      result: res,
      descriptionSnippet: desc.length > 50 ? `${desc.slice(0, 50)}…` : desc,
    }

    const updated = [newItem, ...history.slice(0, 19)]
    setHistory(updated)
    try {
      localStorage.setItem('epifi_split_history', JSON.stringify(updated))
    } catch {
      // Ignore storage errors
    }
  }

  const handleClearHistory = () => {
    setHistory([])
    try {
      localStorage.removeItem('epifi_split_history')
    } catch {
      // Ignore
    }
  }

  const handleImageLoad = (b64: string) => {
    setImageBase64(b64)
    setError(null)
  }

  const handleSubmit = async () => {
    if (!imageBase64) {
      setError('Please attach or upload a receipt photo first.')
      return
    }
    if (!description.trim()) {
      setError('Please specify who had what in the description text area.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt_base64: imageBase64,
          description: description.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail ?? `Server returned error status ${res.status}`)
      }

      const splitRes = data as SplitResult
      setResult(splitRes)
      saveToHistory(splitRes, description.trim())

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-container">
      {/* ── Top Navigation Bar ── */}
      <Navbar
        historyCount={history.length}
        onOpenHistory={() => setIsHistoryOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* ── Main Workspace ── */}
      <div style={{ maxWidth: 940, margin: '0 auto' }}>

        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 14px',
              background: 'var(--primary-light)',
              border: '1px solid var(--primary-border)',
              borderRadius: 100,
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--primary-text)',
              marginBottom: 16,
            }}
          >
            <Sparkles size={14} /> AI-POWERED RECEIPT RECONCILIATION
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 800,
              lineHeight: 1.15,
              color: 'var(--text-main)',
              letterSpacing: '-0.03em',
              marginBottom: 12,
            }}
          >
            Fair Split for Groups & Teams
          </h1>

          <p
            style={{
              fontSize: '1rem',
              color: 'var(--text-muted)',
              maxWidth: 580,
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            Upload your receipt photo, type natural notes on who had what, and get a fully-audited per-person breakdown with exact tax, service charge, and discounts.
          </p>
        </div>

        {/* Floating Mercury-style Stats Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 32,
          }}
        >
          <div
            className="neo-card"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: 'var(--surface-card)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--primary-light)',
                color: 'var(--primary-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                RECONCILIATION
              </p>
              <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                100% Zero Variance
              </p>
            </div>
          </div>

          <div
            className="neo-card"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: 'var(--surface-card)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--secondary-light)',
                color: 'var(--secondary-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={20} />
            </div>
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                PROPORTIONAL MATH
              </p>
              <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Fair Tax & Tip Split
              </p>
            </div>
          </div>

          <div
            className="neo-card"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: 'var(--surface-card)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: '#FFF7ED',
                color: '#C2410C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={20} />
            </div>
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                SETTLE-UP ENGINE
              </p>
              <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Minimizes P2P Transfers
              </p>
            </div>
          </div>
        </div>

        {/* ── Form Card ── */}
        <section
          className="neo-card"
          style={{
            padding: '32px 36px',
            marginBottom: 36,
            background: 'var(--surface-card)',
          }}
          aria-label="Bill split form"
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 24,
              marginBottom: 24,
            }}
          >
            {/* Left Column — Receipt Upload */}
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted)',
                  marginBottom: 10,
                }}
                htmlFor="receipt-drop-zone"
              >
                <FileText size={14} /> 1. Upload Receipt Image
              </label>

              <ReceiptUpload
                onImageLoad={handleImageLoad}
                imageBase64={imageBase64 || null}
              />
            </div>

            {/* Right Column — Natural Language Description */}
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted)',
                  marginBottom: 10,
                }}
                htmlFor="description-input"
              >
                <Users size={14} /> 2. Who had what & who paid?
              </label>

              <textarea
                id="description-input"
                className="neo-textarea"
                placeholder={`e.g. "Ravi had cappuccino & sandwich. Neha had pasta & lime soda. Sameer had brownie. Sameer paid."`}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  setError(null)
                }}
                rows={7}
                aria-label="Description of who had what"
              />

              {/* Sample Scenarios Quick-Fills */}
              <div style={{ marginTop: 12 }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  Quick Sample Scenarios:
                </span>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SAMPLE_SCENARIOS.map((scenario) => (
                    <button
                      key={scenario.label}
                      type="button"
                      onClick={() => {
                        setDescription(scenario.text)
                        setError(null)
                      }}
                      className="sample-chip"
                    >
                      {scenario.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              style={{
                marginBottom: 20,
                padding: '12px 16px',
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-inner)',
                color: 'var(--danger-text)',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
              role="alert"
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            id="split-btn"
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>⏳ Analyzing Receipt & Reconciling...</>
            ) : (
              <>
                Calculate Fair Split <ArrowRight size={18} />
              </>
            )}
          </button>
        </section>

        {/* ── Results Container ── */}
        <div ref={resultRef} style={{ scrollMarginTop: 30 }}>
          {loading && <LoadingSkeleton />}
          {result && !loading && <ResultCard result={result} />}
        </div>
      </div>

      {/* ── Split History Drawer ── */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectHistoryItem={(item) => {
          setResult(item.result)
          setDescription(item.descriptionSnippet)
          setTimeout(() => {
            resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 100)
        }}
        onClearHistory={handleClearHistory}
      />
    </main>
  )
}
