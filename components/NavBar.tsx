import Link from 'next/link'
import WalletConnectButton from './WalletConnectButton'

export default function NavBar() {
  return (
    <header className="border-b border-white/10 bg-patriotic-navy/80 backdrop-blur">
      <div className="container flex items-center justify-between py-4">
        <Link href="/" className="text-xl font-semibold">PatriotPledge NFTs</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/marketplace">Marketplace</Link>
          <Link href="/submit">Submit Story</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/governance">Governance</Link>
          <Link href="/admin">Admin</Link>
          <WalletConnectButton />
        </nav>
      </div>
    </header>
  )
}
