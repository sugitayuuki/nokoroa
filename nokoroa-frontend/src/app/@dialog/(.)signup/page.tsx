'use client';

import { useRouter } from 'next/navigation';

import SignUpDialog from '@/components/auth/SignUpDialog';

export default function SignUpModal() {
  const router = useRouter();
  return (
    <SignUpDialog
      onClose={() => {
        router.back();
      }}
      // 登録できたがサインインは未完了のとき、ここを渡さないと
      // 「ログインしてご利用ください」と案内した先へ進めない
      onSwitchToLogin={() => {
        router.replace('/login');
      }}
    />
  );
}
