import './globals.css';
import 'react-toastify/dist/ReactToastify.css';

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ToastContainer } from 'react-toastify';

import Layout from '@/components/layout/Layout';
import { AuthProvider } from '@/providers/AuthProvider';
import { DialogProvider } from '@/providers/DialogProvider';
import { NavigationProvider } from '@/providers/NavigationProvider';
import CustomThemeProvider from '@/theme/ThemeProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Nokoroa',
  description: '旅行の思い出を共有できるアプリケーションです。',
};

export default function RootLayout({
  children,
  dialog,
}: Readonly<{
  children: React.ReactNode;
  dialog?: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <CustomThemeProvider>
          <NavigationProvider>
            <AuthProvider>
              <DialogProvider>
                <Layout>
                  {children}
                  {dialog}
                </Layout>
                <ToastContainer
                  position="top-right"
                  autoClose={5000}
                  hideProgressBar={false}
                  newestOnTop={false}
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                  theme="light"
                />
              </DialogProvider>
            </AuthProvider>
          </NavigationProvider>
        </CustomThemeProvider>
      </body>
    </html>
  );
}
