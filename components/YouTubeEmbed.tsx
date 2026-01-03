'use client'

interface YouTubeEmbedProps {
  url: string
  className?: string
}

/**
 * Extracts YouTube video ID from various URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://youtube.com/shorts/VIDEO_ID
 */
function extractYouTubeId(url: string): string | null {
  if (!url) return null
  
  // Try various YouTube URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/ // Just the video ID
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  
  return null
}

/**
 * YouTubeEmbed - Responsive YouTube video player
 * Supports various YouTube URL formats
 */
export function YouTubeEmbed({ url, className = '' }: YouTubeEmbedProps) {
  const videoId = extractYouTubeId(url)
  
  if (!videoId) {
    return null
  }
  
  return (
    <div className={`relative w-full ${className}`} data-testid="youtube-embed">
      <div className="relative pb-[56.25%] h-0 overflow-hidden rounded-xl border border-white/10">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0`}
          title="Campaign Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute top-0 left-0 w-full h-full"
          loading="lazy"
        />
      </div>
    </div>
  )
}

export default YouTubeEmbed
