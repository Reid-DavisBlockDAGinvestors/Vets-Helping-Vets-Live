'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('user')
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    setMsg('')
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) {
        setMsg('Please sign in to manage your profile.')
        return
      }
      const res = await fetch('/api/profile/username', {
        headers: { authorization: `Bearer ${token}` }
      })
      const data = await res.json().catch(()=>({}))
      if (res.ok) {
        setUsername(data?.username || '')
        setEmail(data?.email || '')
        setRole(data?.role || 'user')
      } else {
        setMsg(data?.error || 'Failed to load profile')
      }
    } catch (e: any) {
      setMsg(e?.message || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    setMsg('')
    try {
      const uname = username.trim()
      if (!uname) { setMsg('Username is required'); return }
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) { setMsg('Please sign in'); return }
      const res = await fetch('/api/profile/username', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: uname })
      })
      const data = await res.json().catch(()=>({}))
      if (res.ok) {
        setMsg('Saved')
        setUsername(data?.username || uname)
      } else {
        setMsg(data?.error || 'Save failed')
      }
    } catch (e: any) {
      setMsg(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold">Your Profile</h1>
      <div className="mt-4 rounded border border-white/10 p-4 max-w-lg">
        {loading ? (
          <div className="opacity-70 text-sm">Loading...</div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="text-xs opacity-70">Email</div>
              <div className="text-sm">{email || '—'}</div>
            </div>
            <div>
              <div className="text-xs opacity-70">Role</div>
              <div className="text-sm">{role}</div>
            </div>
            <div>
              <div className="text-xs opacity-70">Username</div>
              <input
                className="w-full rounded bg-white/10 p-2"
                placeholder="Set your username"
                value={username}
                onChange={e=>setUsername(e.target.value)}
              />
              <div className="text-xs opacity-70 mt-1">3-20 lowercase letters, numbers, or underscore; must start with a letter.</div>
            </div>
            <div>
              <button disabled={saving} onClick={save} className="rounded bg-patriotic-red px-4 py-2">Save</button>
            </div>
            {msg && <div className="text-xs opacity-80 break-all">{msg}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
