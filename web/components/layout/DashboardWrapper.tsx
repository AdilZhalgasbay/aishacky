import Sidebar from '@/components/layout/Sidebar'

export default function DashboardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="layout-root">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
