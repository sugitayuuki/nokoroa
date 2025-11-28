'use client';

import { Box, LinearProgress } from '@mui/material';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';

type NavigationContextType = {
  isNavigating: boolean;
  setIsNavigating: (isNavigating: boolean) => void;
};

const NavigationContext = createContext<NavigationContextType | undefined>(
  undefined,
);

export function NavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();

  // ページ変更時にローディング状態をリセット
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  return (
    <NavigationContext.Provider value={{ isNavigating, setIsNavigating }}>
      {/* グローバルローディングインジケーター */}
      {isNavigating && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1300,
          }}
        >
          <LinearProgress color="primary" />
        </Box>
      )}
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
