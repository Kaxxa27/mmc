'use client';

import { Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/misc';
import { LibraryBrowser } from './library-browser';

export function WatchlistView() {
  return (
    <div>
      <PageHeader
        title="Watchlist"
        description="Movies you want to watch. Can't choose? Let chance decide."
      />
      <LibraryBrowser
        fixedStatus={['want_to_watch']}
        randomTitle="What should I watch tonight?"
        emptyTitle="Your watchlist is empty"
        emptyDescription="Use “Want to watch” on any movie to save it for later."
        headerActions={(openRandom) => (
          <Button onClick={openRandom}>
            <Dices aria-hidden />
            Pick for me
          </Button>
        )}
      />
    </div>
  );
}
