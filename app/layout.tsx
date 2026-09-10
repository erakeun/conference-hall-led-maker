import type { Metadata } from 'next';
import Script from 'next/script';
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
      <head>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-REQY4913H3" strategy="afterInteractive" />
        <Script id="ga4-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-REQY4913H3');
        `}</Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
