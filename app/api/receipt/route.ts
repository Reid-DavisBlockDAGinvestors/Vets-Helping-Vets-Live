import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export async function POST(req: NextRequest) {
  try {
    const { amount, donorName, txHash, ein } = await req.json()
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([612, 792])
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const draw = (text: string, y: number, size=12) => page.drawText(text, { x: 50, y, size, font, color: rgb(0.95, 0.95, 0.95) })
    draw('PatriotPledge NFTs - Tax Receipt', 740, 18)
    draw(`Donor: ${donorName}`, 700)
    draw(`Amount: $${amount}`, 680)
    draw(`Transaction: ${txHash}`, 660)
    draw(`Nonprofit EIN: ${ein || 'TBD'}`, 640)
    draw('Thank you for your generous support.', 600)
    const bytes = await pdfDoc.save()
    return new NextResponse(Buffer.from(bytes), { headers: { 'Content-Type': 'application/pdf' } })
  } catch (e: any) {
    console.error('receipt error', e)
    return NextResponse.json({ error: 'RECEIPT_FAILED' }, { status: 500 })
  }
}
