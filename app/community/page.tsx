import { Suspense } from 'react'
import CommunityHubClient from './CommunityHubClientV2'

export default function CommunityPage() {
  return (
    <Suspense fallback={null}>
      <CommunityHubClient />
    </Suspense>
  )
}
