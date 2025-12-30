import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { logger } from '@/lib/logger'

function detectCountry(req: NextRequest): string | null {
  const urlCountry = req.nextUrl.searchParams.get('country')
  if (urlCountry) return urlCountry.toUpperCase()
  const hdr = req.headers.get('cf-ipcountry') || req.headers.get('x-country') || ''
  if (hdr) return hdr.toUpperCase()
  const al = req.headers.get('accept-language') || ''
  if (al) return al.split(',')[0].split('-').pop()?.toUpperCase() || null
  return null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const amount = Number(body?.amount || 0)
    const donorName = body?.donorName || 'Donor'
    const txHash = body?.txHash || 'N/A'
    const countryOverride = body?.country || null

    const orgName = process.env.ORG_NAME || 'PatriotPledge NFTs'
    const orgEIN = process.env.ORG_EIN || 'TBD'
    const orgVAT = process.env.ORG_VAT || 'TBD'
    const orgAddr = process.env.ORG_ADDRESS || 'TBD'

    const country = (countryOverride || detectCountry(req) || 'US').toUpperCase()

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([612, 792])
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const draw = (text: string, y: number, size=12) => page.drawText(text, { x: 50, y, size, font, color: rgb(0.95, 0.95, 0.95) })

    draw(`${orgName} - Donation Receipt`, 740, 18)
    draw(`Donor: ${donorName}`, 700)
    draw(`Amount: $${amount.toFixed(2)}`, 680)
    draw(`Transaction: ${txHash}`, 660)
    draw(`Country: ${country}`, 640)

    if (country === 'US') {
      draw(`IRS EIN: ${orgEIN}`, 620)
      draw('This donation may be tax-deductible; consult your tax advisor.', 600)
    } else if (country === 'DE' || country === 'FR' || country === 'IT' || country === 'ES' || country === 'NL' || country === 'IE' || country === 'PT' || country === 'SE' || country === 'FI' || country === 'DK' || country === 'PL' || country === 'BE' || country === 'AT' || country === 'LU' || country === 'CZ' || country === 'HU' || country === 'RO' || country === 'GR') {
      draw(`EU VAT ID: ${orgVAT}`, 620)
      draw('Note: Donation receipts vary by member state; consult local regulations.', 600)
    } else {
      draw('Note: Local tax treatment varies by country; consult your tax advisor.', 620)
    }

    draw(`Organization Address: ${orgAddr}`, 580)
    draw('Thank you for your generous support.', 560)

    const bytes = await pdfDoc.save()
    return new NextResponse(Buffer.from(bytes), { headers: { 'Content-Type': 'application/pdf' } })
  } catch (e) {
    logger.error('[receipt/global] Error:', e)
    return NextResponse.json({ error: 'GLOBAL_RECEIPT_FAILED' }, { status: 500 })
  }
}
