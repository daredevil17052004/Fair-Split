import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL =
  process.env.BACKEND_URL || 'http://localhost:8000'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const upstream = await fetch(`${BACKEND_URL}/api/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // 60-second timeout for AI processing
      signal: AbortSignal.timeout(60_000),
    })

    const data = await upstream.json()

    return NextResponse.json(data, { status: upstream.status })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown error'
    const isTimeout = message.toLowerCase().includes('timeout') ||
      message.toLowerCase().includes('aborted')

    return NextResponse.json(
      {
        detail: isTimeout
          ? 'Request timed out (60 s). The backend may be cold-starting — please retry.'
          : `Proxy error: ${message}`,
      },
      { status: isTimeout ? 504 : 500 },
    )
  }
}
