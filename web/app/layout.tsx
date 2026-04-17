import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'

export const metadata: Metadata = {
  title: 'Aqbobek AI Director | AI School Management Dashboard',
  description: 'Digital AI principal for Aqbobek Primary School. Automates attendance tracking, incident management, schedule substitutions, and regulation compliance.',
  keywords: 'school management, AI principal, attendance, EdTech, Kazakhstan, Aqbobek',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='16' fill='%232563EB'/><rect x='20' y='35' width='60' height='45' rx='4' fill='white'/><polygon points='50,10 85,38 15,38' fill='%23DBEAFE'/><rect x='40' y='55' width='20' height='25' rx='2' fill='%232563EB'/></svg>" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="layout-root">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
