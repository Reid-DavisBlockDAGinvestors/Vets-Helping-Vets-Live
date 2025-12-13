import { Suspense } from 'react'
import CommunityHubClient from './CommunityHubClient'

export default function CommunityPage() {
  return (
    <Suspense fallback={null}>
      <CommunityHubClient />
    </Suspense>
  )
}
