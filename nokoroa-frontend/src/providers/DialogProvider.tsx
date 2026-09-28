'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

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

  // open* と switchTo* は表示するダイアログを差し替えるだけで挙動が同じなので
  // 実装は 1 つに統合し、呼び出し側の意図が読める名前だけ両方公開する
  const showLogin = useCallback(() => setDialogType('login'), []);
  const showSignup = useCallback(() => setDialogType('signup'), []);
  const closeDialog = useCallback(() => setDialogType(null), []);

  const value = useMemo(
    () => ({
      openLogin: showLogin,
      openSignup: showSignup,
      closeDialog,
      switchToLogin: showLogin,
      switchToSignup: showSignup,
    }),
    [showLogin, showSignup, closeDialog],
  );

  return (
    <DialogContext.Provider value={value}>
      {children}

      {/* ダイアログのレンダリング */}
      {dialogType === 'login' && (
        <LoginDialog onClose={closeDialog} onSwitchToSignup={showSignup} />
      )}
      {dialogType === 'signup' && (
        <SignUpDialog onClose={closeDialog} onSwitchToLogin={showLogin} />
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
