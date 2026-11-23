import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/frontend/common/overlay';
import '@/frontend/styles/globals.css';

export const metadata: Metadata = {
  title: '방방곡곡',
  description: '친구들과 함께 쓰는 여행 가계부',
  icons: { icon: { url: '/bird.svg', type: 'image/svg+xml' } },
  robots: { index: false, follow: false },
  referrer: 'strict-origin',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F4F4F4',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
