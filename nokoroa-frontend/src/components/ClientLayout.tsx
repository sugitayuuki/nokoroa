'use client';

import { useEffect, useState } from 'react';

import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';
import { getToken } from '@/utils/auth';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(!!getToken());
  }, []);

  return (
    <>
      <Header />
      <main>{children}</main>
      {!isAuthenticated && <Footer />}
    </>
  );
}
