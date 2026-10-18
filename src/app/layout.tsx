import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'ModulMate — Ruang belajarmu', description: 'Pahami modul, tanyakan konsep, dan belajar dengan sumber yang jelas.' };
export default function RootLayout({ children }: Readonly<{children:React.ReactNode}>) {
  return <html lang="id"><body>{children}</body></html>;
}
