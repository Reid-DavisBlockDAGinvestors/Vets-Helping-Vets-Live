import StoryForm from '@/components/StoryForm'

export default function SubmitPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-purple-900/20 to-transparent" />
        <div className="container py-12 relative">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Start Your Fundraiser
          </h1>
          <p className="mt-3 text-lg text-white/70 max-w-2xl">
            Create a Living NFT that tells your story and evolves with your journey. 
            Veterans, families, and community members welcome.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-green-400">
              <span>✓</span> Free to submit
            </div>
            <div className="flex items-center gap-2 text-green-400">
              <span>✓</span> Reviewed within 24-48 hours
            </div>
            <div className="flex items-center gap-2 text-green-400">
              <span>✓</span> 100% transparent on-chain
            </div>
          </div>
        </div>
      </div>
      
      {/* Form */}
      <div className="container py-10">
        <StoryForm />
      </div>
    </div>
  )
}
