import { NextRequest, NextResponse } from 'next/server'
import { getAllLevelBonusConfigs, setLevelBonusText } from '@/lib/workforce-score-service'
import { LEVEL_ORDER, type WorkforceLevel } from '@/lib/workforce-score-constants'

export const dynamic = 'force-dynamic'

export async function GET() {
  const configs = await getAllLevelBonusConfigs()
  return NextResponse.json({ configs })
}

export async function PATCH(req: NextRequest) {
  const { level, bonusText } = await req.json()
  if (!LEVEL_ORDER.includes(level)) {
    return NextResponse.json({ error: 'Ungültiges Level' }, { status: 400 })
  }

  const config = await setLevelBonusText(level as WorkforceLevel, bonusText ?? '')
  return NextResponse.json({ config })
}
