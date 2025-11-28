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
    />
  );
}
