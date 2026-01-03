'use client'

import Link from 'next/link'
import SocialLinks from './SocialLinks'

export default function Footer() {
  return (
    <footer data-testid="main-footer" className="border-t border-white/10 bg-patriotic-navy">
      <div className="container py-6 text-sm text-white/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p>© {new Date().getFullYear()} PatriotPledge NFTs · vetshelpingvets.life</p>
            <p className="mt-1">1% platform fee + 1% nonprofit fee · 98% to recipients · Transparent and auditable</p>
          </div>
          <SocialLinks />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="underline hover:text-white transition-colors" href="/my-bug-reports">My Bug Reports</Link>
          <span className="text-white/30">·</span>
          <a className="underline" href="https://awakening.bdagscan.com" target="_blank" rel="noreferrer">BlockDAG Explorer</a>
          <a className="underline" href="https://awakening.bdagscan.com/faucet" target="_blank" rel="noreferrer">Faucet</a>
          <a className="underline" href="https://rpc.awakening.bdagscan.com" target="_blank" rel="noreferrer">RPC</a>
          <a className="underline" href="https://nownodes.io/nodes/bdag-blockdag" target="_blank" rel="noreferrer">Alt RPC</a>
        </div>
      </div>
    </footer>
  )
}
