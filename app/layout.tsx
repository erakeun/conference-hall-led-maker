import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '컨퍼런스홀 LED 현수막 제작기 | Hanyang University ERICA',
  description: '한양대학교 ERICA 컨퍼런스홀 중강당 LED 현수막 전용 제작기',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
