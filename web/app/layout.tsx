import type { Metadata } from 'next'
import './globals.css'
import DirectorAgentWidget from '@/components/DirectorAgentWidget'

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
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%232563EB'/><path d='M50 15L85 35V55L50 75L15 55V35Z' fill='none' stroke='white' stroke-width='4'/><circle cx='50' cy='55' r='8' fill='white'/></svg>" />
      </head>
      <body>
        {children}
        <DirectorAgentWidget />
      </body>
    </html>
  )
}
