/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker production builds
  output: 'standalone',
  
  // Webpack config to handle optional dependencies in wallet packages
  webpack: (config, { isServer }) => {
    // Handle optional Solana dependencies from @reown/appkit-adapter-wagmi
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@solana/kit': false,
      'porto/internal': false,
    }
    
    // Ignore optional peer dependencies
    config.externals = config.externals || []
    if (!isServer) {
      config.externals.push({
        '@solana/kit': 'commonjs @solana/kit',
        'porto/internal': 'commonjs porto/internal',
      })
    }
    
    return config
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com https://js.stripe.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https: ipfs:",
              "font-src 'self' https://fonts.gstatic.com https://fonts.reown.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.nownodes.io https://bdag.nownodes.io https://rpc.awakening.bdagscan.com https://api.pinata.cloud https://gateway.pinata.cloud https://api.stripe.com https://challenges.cloudflare.com https://api.web3modal.org https://*.walletconnect.org wss://*.walletconnect.org https://*.walletconnect.com wss://*.walletconnect.com https://rpc.walletconnect.org https://explorer-api.walletconnect.com https://pulse.walletconnect.org",
              "frame-src 'self' https://challenges.cloudflare.com https://js.stripe.com https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              "upgrade-insecure-requests"
            ].join('; ')
          }
        ]
      }
    ]
  }
};

export default nextConfig;
