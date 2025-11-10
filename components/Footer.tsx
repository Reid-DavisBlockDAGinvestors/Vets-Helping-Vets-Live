export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-patriotic-navy">
      <div className="container py-6 text-sm text-white/70">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} PatriotPledge NFTs · vetshelpingvets.life</p>
          <p>1% nonprofit fee for operations · Transparent and auditable</p>
        </div>
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-3">
            <a className="underline" href="https://awakening.bdagscan.com" target="_blank" rel="noreferrer">BlockDAG Explorer</a>
            <a className="underline" href="https://awakening.bdagscan.com/faucet" target="_blank" rel="noreferrer">Faucet</a>
            <a className="underline" href="https://rpc.awakening.bdagscan.com" target="_blank" rel="noreferrer">RPC</a>
            <a className="underline" href="https://nownodes.io/nodes/bdag-blockdag" target="_blank" rel="noreferrer">Alt RPC</a>
          </div>
          <a className="underline" href="https://t.me/+bXthKkX7onU5ZmI1" target="_blank" rel="noreferrer">Join BlockDAG Buildathon Telegram</a>
        </div>
      </div>
    </footer>
  )
}
