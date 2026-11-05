import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { OnboardingView } from '@/features/auth/onboarding-view';

export const metadata: Metadata = { title: 'Welcome' };

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <OnboardingView />
    </Suspense>
  );
}
