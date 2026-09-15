import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Brutal Fist',
  description: 'Brutal Fist game cockpit and live preview',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
