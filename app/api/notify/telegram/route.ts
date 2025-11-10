import { NextRequest, NextResponse } from 'next/server'

// Placeholder Telegram notifier. Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to send real messages.
export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()
    if (!message) return NextResponse.json({ error: 'NO_MESSAGE' }, { status: 400 })

    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID

    if (!token || !chatId) {
      console.log('[telegram] missing envs, message:', message)
      return NextResponse.json({ ok: true, mode: 'logged' })
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message })
    })
    if (!res.ok) throw new Error('TELEGRAM_SEND_FAILED')

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('telegram notify error', e)
    return NextResponse.json({ error: 'TELEGRAM_NOTIFY_FAILED' }, { status: 500 })
  }
}
