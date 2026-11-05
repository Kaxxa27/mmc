import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { HomeView } from '@/features/home/home-view';

export default function HomePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <HomeView />
    </Suspense>
  );
}
