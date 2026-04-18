import TelegramClient from './TelegramClient'
import DashboardWrapper from '@/components/layout/DashboardWrapper'

export const dynamic = 'force-dynamic'
export default function TelegramPage() {
  return (
    <DashboardWrapper>
      <TelegramClient />
    </DashboardWrapper>
  )
}
