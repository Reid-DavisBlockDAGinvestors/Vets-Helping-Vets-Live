'use client'

import { useState } from 'react'

export default function StoryForm() {
  const [title, setTitle] = useState('')
  const [story, setStory] = useState('')
  const [category, setCategory] = useState<'veteran' | 'general'>('veteran')
  const [goal, setGoal] = useState<number>(1000)
  const [wallet, setWallet] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [snippet, setSnippet] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const b64 = await f.arrayBuffer().then(b => Buffer.from(b).toString('base64'))
    setImage(`data:${f.type};base64,${b64}`)
  }

  const mintPreview = async () => {
    const res = await fetch('/api/ipfs-json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: title || 'Untitled',
        description: story,
        image,
        attributes: [
          { trait_type: 'category', value: category },
          snippet ? { trait_type: 'snippet', value: snippet } : undefined
        ].filter(Boolean)
      })
    })
    const data = await res.json()
    alert('Preview TokenURI: ' + data?.uri)
  }

  const callAI = async (mode: 'summarize' | 'improve') => {
    try {
      setAiBusy(true)
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, story, mode })
      })
      const data = await res.json()
      if (data?.text) {
        if (mode === 'summarize') setSnippet(data.text)
        else setStory(data.text)
      } else {
        alert('AI did not return content')
      }
    } catch (e) {
      console.error(e)
      alert('AI request failed')
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <form className="space-y-4">
      <div className="rounded border border-white/10 p-3">
        <div className="text-sm mb-2">Choose Fundraising Type</div>
        <div className="flex gap-2" data-testid="category-toggle">
          <button type="button" onClick={()=>setCategory('veteran')} className={`rounded px-3 py-2 text-sm ${category==='veteran' ? 'bg-patriotic-red' : 'bg-white/10'}`}>Veteran</button>
          <button type="button" onClick={()=>setCategory('general')} className={`rounded px-3 py-2 text-sm ${category==='general' ? 'bg-patriotic-red' : 'bg-white/10'}`}>General / Non‑veteran</button>
        </div>
      </div>
      <div>
        <label className="text-sm">Title</label>
        <input className="w-full rounded bg-white/10 p-2" value={title} onChange={e=>setTitle(e.target.value)} data-testid="input-title" />
      </div>
      <div>
        <label className="text-sm">Story</label>
        <textarea className="w-full rounded bg-white/10 p-2 h-40" value={story} onChange={e=>setStory(e.target.value)} data-testid="input-story" />
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={aiBusy} onClick={()=>callAI('summarize')} className="rounded bg-white/10 px-3 py-1 text-sm" data-testid="btn-ai-summarize">AI Summarize</button>
          <button type="button" disabled={aiBusy} onClick={()=>callAI('improve')} className="rounded bg-white/10 px-3 py-1 text-sm" data-testid="btn-ai-improve">AI Improve</button>
        </div>
      </div>
      {snippet && (
        <div>
          <label className="text-sm">AI Snippet</label>
          <textarea className="w-full rounded bg-white/10 p-2 h-24" value={snippet} onChange={e=>setSnippet(e.target.value)} data-testid="input-snippet" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="text-sm">Goal (USD)</label>
          <input type="number" className="w-full rounded bg-white/10 p-2" value={goal} onChange={e=>setGoal(Number(e.target.value))} />
        </div>
        <div>
          <label className="text-sm">Creator Wallet</label>
          <input className="w-full rounded bg-white/10 p-2" value={wallet} onChange={e=>setWallet(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-sm">Image/Video</label>
        <input type="file" accept="image/*,video/*" onChange={onFile} data-testid="input-media" />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={mintPreview} className="rounded bg-patriotic-red px-4 py-2" data-testid="btn-preview">Generate NFT Preview</button>
        <button type="button" onClick={()=>alert('Mint flow placeholder')} className="rounded bg-white/10 px-4 py-2" data-testid="btn-mint">Mint on BlockDAG</button>
      </div>
    </form>
  )
}
