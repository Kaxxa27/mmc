import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui/misc';
import { CalendarView } from '@/features/library/calendar-view';

export const metadata: Metadata = { title: 'Calendar' };

export default function CalendarPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CalendarView />
    </Suspense>
  );
}
