# Video Media Implementation Plan

## Overview

This document outlines a comprehensive plan for adding video media support to PatriotPledge NFT submissions, campaign updates, and the donor dashboard.

---

## Option Analysis

### Option 1: YouTube Integration (RECOMMENDED)

**Pros:**
- ✅ **Zero storage costs** - YouTube hosts all video
- ✅ **Free unlimited uploads** - No bandwidth limits
- ✅ **Built-in compression** - YouTube auto-transcodes
- ✅ **CDN delivery** - Fast global playback
- ✅ **Mobile-optimized** - Works on all devices
- ✅ **Embeddable** - Easy iframe integration
- ✅ **Analytics** - View counts, engagement tracking
- ✅ **SEO benefits** - Videos discoverable on YouTube

**Cons:**
- ❌ Requires YouTube account
- ❌ Ads may appear (unless YouTube Premium)
- ❌ Content must comply with YouTube ToS
- ❌ Less control over player UI

**Implementation:**
```typescript
// Schema addition
ALTER TABLE submissions ADD COLUMN video_url VARCHAR(500);
ALTER TABLE campaign_updates ADD COLUMN video_url VARCHAR(500);

// Component
<YouTubeEmbed videoId={extractYouTubeId(video_url)} />
```

**Effort:** 1-2 days

---

### Option 2: Direct Upload with Compression (Self-Hosted)

**Pros:**
- ✅ Full control over content
- ✅ Custom player UI
- ✅ No third-party dependencies
- ✅ No ads

**Cons:**
- ❌ **Expensive storage** - Video is large (1min = ~100MB raw)
- ❌ **Bandwidth costs** - Streaming costs add up
- ❌ **Complex compression** - Need FFmpeg or cloud service
- ❌ **Processing time** - Compression takes minutes
- ❌ **CDN required** - For global delivery

**Storage Estimates:**
| Quality | 1 min | 10 min | 1 hour |
|---------|-------|--------|--------|
| 1080p compressed | ~50MB | ~500MB | ~3GB |
| 720p compressed | ~25MB | ~250MB | ~1.5GB |
| 480p compressed | ~10MB | ~100MB | ~600MB |

**Monthly Cost Estimate (100 campaigns, 5min avg video):**
- Storage: ~25GB = $0.60/mo (Supabase)
- Bandwidth: ~250GB = $25/mo (if each video watched 10x)
- **Total: ~$25-50/month**

**Implementation Options:**
1. **Supabase Storage** - Simple, integrated
2. **Cloudflare R2** - Cheap bandwidth, no egress fees
3. **AWS S3 + CloudFront** - Scalable, complex
4. **Bunny.net** - Video-optimized CDN

**Compression Service Options:**
1. **Mux.com** - Video API, $0.015/min encoding
2. **Cloudflare Stream** - $5/1000 min storage, $1/1000 min delivered
3. **Self-hosted FFmpeg** - Free but complex
4. **Client-side compression** - Browser-based, limited

**Effort:** 1-2 weeks

---

### Option 3: Hybrid Approach (BALANCED)

Combine YouTube for primary videos with direct upload for short clips:

1. **Campaign Story Video** → YouTube link (unlimited, free)
2. **Quick Update Clips** → Direct upload (<30 sec, compressed)
3. **NFT Preview** → Short GIF/MP4 (<10 sec)

**Benefits:**
- Best of both worlds
- Storage costs contained
- Professional main videos on YouTube
- Quick updates without leaving platform

**Effort:** 1 week

---

## Recommended Implementation: YouTube + Short Clips

### Phase 1: YouTube Integration (Week 1)

#### Database Changes
```sql
-- Add video fields to submissions
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS video_url VARCHAR(500);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS video_thumbnail VARCHAR(500);

-- Add video fields to campaign updates
ALTER TABLE campaign_updates ADD COLUMN IF NOT EXISTS video_url VARCHAR(500);
ALTER TABLE campaign_updates ADD COLUMN IF NOT EXISTS video_thumbnail VARCHAR(500);

-- Create media table for future expansion
CREATE TABLE IF NOT EXISTS campaign_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  update_id UUID REFERENCES campaign_updates(id) ON DELETE CASCADE,
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('video', 'image', 'document')),
  source VARCHAR(20) NOT NULL CHECK (source IN ('youtube', 'upload', 'ipfs')),
  url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  title VARCHAR(200),
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_campaign_media_submission ON campaign_media(submission_id);
CREATE INDEX idx_campaign_media_update ON campaign_media(update_id);
```

#### UI Components

**1. YouTube URL Input (Submit Form)**
```tsx
// components/submit/VideoInput.tsx
export function VideoInput({ value, onChange }: VideoInputProps) {
  const [preview, setPreview] = useState<string | null>(null)
  
  const handleUrlChange = (url: string) => {
    onChange(url)
    const videoId = extractYouTubeId(url)
    if (videoId) {
      setPreview(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`)
    }
  }
  
  return (
    <div data-testid="video-input">
      <label>Video URL (YouTube)</label>
      <input 
        type="url"
        placeholder="https://youtube.com/watch?v=..."
        value={value}
        onChange={(e) => handleUrlChange(e.target.value)}
      />
      {preview && (
        <div className="mt-2">
          <img src={preview} alt="Video thumbnail" className="rounded-lg" />
          <p className="text-sm text-white/50">Video preview</p>
        </div>
      )}
    </div>
  )
}
```

**2. YouTube Embed Player**
```tsx
// components/media/YouTubePlayer.tsx
export function YouTubePlayer({ videoId, title }: YouTubePlayerProps) {
  return (
    <div 
      data-testid="youtube-player"
      className="relative w-full aspect-video rounded-lg overflow-hidden"
    >
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  )
}
```

**3. Story Page Video Section**
```tsx
// In story/[id]/page.tsx
{campaign.video_url && (
  <section data-testid="campaign-video-section" className="mt-8">
    <h2 className="text-xl font-bold mb-4">📹 Campaign Video</h2>
    <YouTubePlayer 
      videoId={extractYouTubeId(campaign.video_url)} 
      title={campaign.title}
    />
  </section>
)}
```

#### Utility Functions
```typescript
// lib/video.ts
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function getYouTubeThumbnail(videoId: string, quality: 'default' | 'hq' | 'maxres' = 'hq'): string {
  const qualities = {
    default: 'default',
    hq: 'hqdefault', 
    maxres: 'maxresdefault'
  }
  return `https://img.youtube.com/vi/${videoId}/${qualities[quality]}.jpg`
}

export function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null
}
```

---

### Phase 2: Short Clip Upload (Week 2)

For quick update clips (<30 seconds), allow direct upload with client-side compression:

#### Client-Side Compression
```typescript
// lib/videoCompression.ts
export async function compressVideo(
  file: File, 
  options: { maxDuration?: number; maxSize?: number; quality?: number }
): Promise<Blob> {
  const { maxDuration = 30, maxSize = 10 * 1024 * 1024, quality = 0.7 } = options
  
  // Use browser MediaRecorder for compression
  const video = document.createElement('video')
  video.src = URL.createObjectURL(file)
  await video.play()
  
  // Check duration
  if (video.duration > maxDuration) {
    throw new Error(`Video must be ${maxDuration} seconds or less`)
  }
  
  // Use Canvas + MediaRecorder for compression
  const canvas = document.createElement('canvas')
  canvas.width = 720 // 720p max
  canvas.height = Math.round(720 * (video.videoHeight / video.videoWidth))
  
  const ctx = canvas.getContext('2d')!
  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 1000000 // 1Mbps
  })
  
  // ... recording logic
  
  return compressedBlob
}
```

#### Upload API
```typescript
// app/api/media/upload/route.ts
export async function POST(req: NextRequest) {
  // Verify auth
  // Check file size (<10MB)
  // Upload to Supabase Storage
  // Return URL
}
```

---

### Phase 3: Donor Dashboard Integration (Week 3)

Add video viewing to the donor dashboard:

```tsx
// components/dashboard/PurchasedNFT.tsx
{purchase.campaign.video_url && (
  <button 
    onClick={() => setShowVideo(true)}
    className="flex items-center gap-2 text-blue-400"
  >
    <PlayIcon /> Watch Story Video
  </button>
)}

{showVideo && (
  <Modal onClose={() => setShowVideo(false)}>
    <YouTubePlayer videoId={extractYouTubeId(purchase.campaign.video_url)} />
  </Modal>
)}
```

---

## NFT Metadata Integration

To attach video to the NFT itself (viewable in wallets/marketplaces):

```json
{
  "name": "Campaign: Helping Veterans",
  "description": "...",
  "image": "ipfs://...",
  "animation_url": "https://youtube.com/watch?v=...",
  "attributes": [
    { "trait_type": "Has Video", "value": "Yes" },
    { "trait_type": "Video Platform", "value": "YouTube" }
  ]
}
```

Note: `animation_url` is the ERC-721 metadata standard for video/audio.

---

## Cost Summary

| Approach | Monthly Cost | Setup Time | Maintenance |
|----------|--------------|------------|-------------|
| YouTube Only | $0 | 2-3 days | Minimal |
| Self-Hosted | $25-100+ | 1-2 weeks | High |
| Hybrid | $5-15 | 1 week | Low |

---

## Recommended Roadmap

1. **Week 1**: YouTube integration for main campaign videos
2. **Week 2**: Short clip upload for updates (<30 sec)
3. **Week 3**: Dashboard integration + NFT metadata
4. **Week 4**: Analytics + reporting

---

## Security Considerations

1. **Content Moderation**: Admin review before videos go live
2. **Rate Limiting**: Max 1 video upload per hour per user
3. **Size Limits**: 10MB for direct uploads
4. **Format Validation**: Only accept known video MIME types
5. **Malware Scanning**: Scan uploads before processing

---

## Testing Plan

1. **E2E Tests**: Playwright tests for video upload flow
2. **Unit Tests**: Video URL extraction, compression
3. **Manual Tests**: Cross-browser video playback
4. **Load Tests**: Multiple concurrent video uploads

---

## Decision Required

**Recommended: Option 1 (YouTube) + Phase 2 (Short Clips)**

This provides:
- Zero storage costs for main videos
- Quick updates without leaving platform
- Professional presentation
- Minimal maintenance

**Action Items:**
1. Approve this plan
2. Create database migration
3. Build UI components
4. Test on staging
5. Deploy to production
