/**
 * Offline Page
 * 
 * Shown when user is offline and page isn't cached
 * Psychology: Maintain trust even when offline
 * - Reassuring message
 * - Clear instructions
 * - Maintains brand experience
 */

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="mb-6">
          <span className="text-6xl">📡</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-4">
          You're Offline
        </h1>

        {/* Message */}
        <p className="text-white/70 mb-6">
          It looks like you've lost your internet connection. 
          Don't worry - your progress is saved and you can continue 
          browsing campaigns you've already viewed.
        </p>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
          >
            Try Again
          </button>
          
          <a
            href="/marketplace"
            className="block w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
          >
            Browse Cached Campaigns
          </a>
        </div>

        {/* Trust message */}
        <p className="mt-8 text-sm text-white/50">
          🎖️ PatriotPledge - Supporting Veterans Even Offline
        </p>
      </div>
    </div>
  )
}
