import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { SignInView } from '@/features/auth/sign-in-view';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SignInView />
    </Suspense>
  );
}
