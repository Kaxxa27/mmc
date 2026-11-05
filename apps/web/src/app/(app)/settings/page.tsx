import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { SettingsView } from '@/features/settings/settings-view';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SettingsView />
    </Suspense>
  );
}
