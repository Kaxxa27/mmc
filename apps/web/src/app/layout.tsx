import type { Metadata, Viewport } from 'next';
import { THEME_SCRIPT } from '@/lib/theme';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'My Movie Catalog', template: '%s · My Movie Catalog' },
  description:
    'Discover movies, keep your watchlist, share a catalog with family and plan movie nights.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
