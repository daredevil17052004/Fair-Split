'use client'

import { useCallback, useRef, useState } from 'react'
import { UploadCloud, Image as ImageIcon, Maximize2, Trash2, Camera, CheckCircle2, X } from 'lucide-react'

interface Props {
  onImageLoad: (base64: string) => void
  imageBase64: string | null
}

/** Compress an image to max 1500px wide, JPEG 85%, returning raw base64. */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const url = URL.createObjectURL(file)

    img.onload = () => {
      const MAX_W = 1500
      const scale = Math.min(1, MAX_W / img.naturalWidth)
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not available')); return }
      ctx.drawImage(img, 0, 0, w, h)

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      const base64 = dataUrl.split(',')[1]
      URL.revokeObjectURL(url)
      resolve(base64)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load image'))
    }

    img.src = url
  })
}

// Generate realistic SVG canvas sample receipts as base64 JPEG data URL for quick testing
function createSampleReceiptDataUrl(title: string, amount: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 550
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // Paper background
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, 400, 550)

  // Header & Border
  ctx.strokeStyle = '#E2E8F0'
  ctx.lineWidth = 4
  ctx.strokeRect(10, 10, 380, 530)

  ctx.fillStyle = '#0F172A'
  ctx.font = 'bold 22px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(title, 200, 55)

  ctx.font = '12px monospace'
  ctx.fillStyle = '#64748B'
  ctx.fillText('GSTIN: 27AAAAA0000A1Z5 | BILL #INV-8924', 200, 80)
  ctx.fillText('Date: 27-JUL-2026 08:45 PM', 200, 98)

  // Divider
  ctx.strokeStyle = '#94A3B8'
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(30, 115)
  ctx.lineTo(370, 115)
  ctx.stroke()
  ctx.setLineDash([])

  // Items
  const items = [
    { name: '1x Cappuccino Regular', price: '₹220.00' },
    { name: '1x Artisan Club Sandwich', price: '₹480.00' },
    { name: '1x Creamy Penne Pasta', price: '₹550.00' },
    { name: '1x Fresh Lime Soda', price: '₹140.00' },
    { name: '1x Sizzling Brownie', price: '₹320.00' },
  ]

  ctx.textAlign = 'left'
  ctx.font = '13px monospace'
  ctx.fillStyle = '#1E293B'
  let y = 150
  items.forEach((item) => {
    ctx.fillText(item.name, 35, y)
    ctx.textAlign = 'right'
    ctx.fillText(item.price, 365, y)
    ctx.textAlign = 'left'
    y += 32
  })

  // Subtotal divider
  ctx.beginPath()
  ctx.moveTo(30, y + 10)
  ctx.lineTo(370, y + 10)
  ctx.stroke()
  y += 35

  ctx.fillText('Subtotal:', 35, y)
  ctx.textAlign = 'right'
  ctx.fillText('₹1,710.00', 365, y)
  ctx.textAlign = 'left'
  y += 24

  ctx.fillText('CGST (2.5%):', 35, y)
  ctx.textAlign = 'right'
  ctx.fillText('₹42.75', 365, y)
  ctx.textAlign = 'left'
  y += 24

  ctx.fillText('SGST (2.5%):', 35, y)
  ctx.textAlign = 'right'
  ctx.fillText('₹42.75', 365, y)
  ctx.textAlign = 'left'
  y += 24

  ctx.fillText('Service Charge (5%):', 35, y)
  ctx.textAlign = 'right'
  ctx.fillText('₹85.50', 365, y)
  ctx.textAlign = 'left'
  y += 35

  // Grand total box
  ctx.fillStyle = '#ECFDF5'
  ctx.fillRect(30, y - 18, 340, 45)
  ctx.strokeStyle = '#10B981'
  ctx.strokeRect(30, y - 18, 340, 45)

  ctx.fillStyle = '#047857'
  ctx.font = 'bold 16px sans-serif'
  ctx.fillText('GRAND TOTAL:', 45, y + 10)
  ctx.textAlign = 'right'
  ctx.fillText(amount, 355, y + 10)

  return canvas.toDataURL('image/jpeg', 0.95).split(',')[1]
}

export default function ReceiptUpload({ onImageLoad, imageBase64 }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image (JPG, PNG, WebP).')
        return
      }

      if (file.size > 25 * 1024 * 1024) {
        setError('Image size exceeds 25 MB limit.')
        return
      }

      setError(null)
      setIsProcessing(true)

      try {
        const base64 = await compressImage(file)
        onImageLoad(base64)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to compress image')
      } finally {
        setIsProcessing(false)
      }
    },
    [onImageLoad],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const loadSampleReceipt = (title: string, amount: string) => {
    setError(null)
    setIsProcessing(true)
    setTimeout(() => {
      const b64 = createSampleReceiptDataUrl(title, amount)
      onImageLoad(b64)
      setIsProcessing(false)
    }, 150)
  }

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    onImageLoad('')
    setError(null)
  }

  return (
    <div>
      {imageBase64 ? (
        <div
          className="neo-card"
          style={{
            position: 'relative',
            borderRadius: 'var(--radius-inner)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'var(--surface-subtle)',
          }}
        >
          <div style={{ height: 210, width: '100%', overflow: 'hidden', position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${imageBase64}`}
              alt="Uploaded receipt"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />

            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(15,23,42,0.7) 0%, transparent 60%)',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                padding: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#FFFFFF' }}>
                <CheckCircle2 size={16} style={{ color: '#10B981' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                  Receipt Attached & OCR Ready
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  style={{
                    background: 'rgba(255,255,255,0.9)',
                    color: 'var(--text-main)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Maximize2 size={12} /> Inspect
                </button>

                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div
            id="receipt-drop-zone"
            role="button"
            tabIndex={0}
            aria-label="Upload receipt image"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragEnter={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            style={{
              border: isDragging ? '2px dashed var(--secondary)' : '2px dashed var(--border)',
              borderRadius: 'var(--radius-inner)',
              padding: '28px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragging ? 'var(--secondary-light)' : 'var(--surface-subtle)',
              minHeight: 200,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: isProcessing ? 'var(--secondary-light)' : 'var(--surface-card)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isProcessing ? 'var(--secondary)' : 'var(--text-muted)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {isProcessing ? (
                <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
              ) : (
                <UploadCloud size={22} style={{ color: 'var(--secondary)' }} />
              )}
            </div>

            <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {isProcessing ? 'Optimizing receipt details…' : 'Drop restaurant receipt here'}
            </p>

            {!isProcessing && (
              <>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  or <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>click to select photo</span>
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', marginTop: 2 }}>
                  JPG, PNG, WebP · Auto OCR Enhanced
                </span>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              id="receipt-file-input"
              aria-label="Upload receipt file"
            />
          </div>

          {/* Quick preset sample receipt button */}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Sample Receipt:
            </span>
            <button
              type="button"
              onClick={() => loadSampleReceipt('THE GRAND BISTRO', '₹1,881.00')}
              className="sample-chip"
              style={{ background: 'var(--surface-card)', border: '1px solid var(--border)' }}
            >
              <Camera size={12} /> Auto-Generate Sample Bill
            </button>
          </div>
        </div>
      )}

      {error && (
        <p style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--danger-text)', fontWeight: 600 }}>
          ⚠️ {error}
        </p>
      )}

      {/* Image Full Modal Inspection */}
      {isModalOpen && imageBase64 && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface-card)',
              padding: 16,
              borderRadius: 'var(--radius-card)',
              maxWidth: 600,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: 'var(--shadow-modal)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ImageIcon size={16} /> Receipt Photo Preview
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: '70vh', borderRadius: 8, border: '1px solid var(--border)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/jpeg;base64,${imageBase64}`}
                alt="Receipt Full Preview"
                style={{ width: '100%', display: 'block' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
