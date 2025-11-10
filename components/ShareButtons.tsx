'use client'

export default function ShareButtons({ url, text }: { url: string; text: string }) {
  const shareX = () => {
    const link = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    window.open(link, '_blank', 'noopener,noreferrer')
  }
  const shareTelegram = () => {
    const link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
    window.open(link, '_blank', 'noopener,noreferrer')
  }
  return (
    <div className="flex gap-2 text-sm">
      <button onClick={shareX} className="rounded bg-white/10 px-3 py-1">Share on X</button>
      <button onClick={shareTelegram} className="rounded bg-white/10 px-3 py-1">Share on Telegram</button>
    </div>
  )
}
