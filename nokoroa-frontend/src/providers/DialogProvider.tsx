'use client';

import { createContext, useContext, useState } from 'react';

import LoginDialog from '@/components/auth/LoginDialog';
import SignUpDialog from '@/components/auth/SignUpDialog';

type DialogType = 'login' | 'signup' | null;

interface DialogContextType {
  openLogin: () => void;
  openSignup: () => void;
  closeDialog: () => void;
  switchToLogin: () => void;
  switchToSignup: () => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialogType, setDialogType] = useState<DialogType>(null);

  const openLogin = () => setDialogType('login');
  const openSignup = () => setDialogType('signup');
  const closeDialog = () => setDialogType(null);
  const switchToLogin = () => setDialogType('login');
  const switchToSignup = () => setDialogType('signup');

  return (
    <DialogContext.Provider
      value={{
        openLogin,
        openSignup,
        closeDialog,
        switchToLogin,
        switchToSignup,
      }}
    >
      {children}

      {/* ダイアログのレンダリング */}
      {dialogType === 'login' && (
        <LoginDialog onClose={closeDialog} onSwitchToSignup={switchToSignup} />
      )}
      {dialogType === 'signup' && (
        <SignUpDialog onClose={closeDialog} onSwitchToLogin={switchToLogin} />
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
