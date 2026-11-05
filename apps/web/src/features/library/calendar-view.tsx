'use client';

import { CalendarMonth } from '@/components/calendar/calendar-month';
import { PageHeader } from '@/components/ui/misc';

export function CalendarView() {
  return (
    <div>
      <PageHeader
        title="Calendar"
        description="What you watched, planned movie nights, and releases from your watchlist."
      />
      <CalendarMonth />
    </div>
  );
}
