import { NextResponse } from 'next/server'

/**
 * Health Check Endpoint
 * Used by Docker, load balancers, and monitoring systems
 * GET /api/health
 */
export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.1.0',
  }

  return NextResponse.json(health, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
