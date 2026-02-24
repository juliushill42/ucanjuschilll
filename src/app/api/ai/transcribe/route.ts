import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(req: Request) {
  try {
    return NextResponse.json({ text: '', segments: [], language: 'en', duration: 0 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
