import StoryForm from '@/components/StoryForm'

export default function SubmitPage() {
  return (
    <div className="container py-10">
      <h1 className="text-2xl font-semibold">Submit Your Story & Mint an NFT</h1>
      <p className="mt-2 text-white/80">Veterans, families, and non-veterans can create fundraisers. Upload media, set goals and milestones, and mint a dynamic NFT.</p>
      <div className="mt-6">
        <StoryForm />
      </div>
    </div>
  )
}
