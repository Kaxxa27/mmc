'use client';

import { useDefaultLists } from '@/lib/queries/library';
import { PageHeader, Skeleton } from '@/components/ui/misc';
import { Poster } from '@/components/movies/poster';
import { useUrlState } from '@/hooks/use-url-state';
import type { DefaultList } from '@/lib/api/types';
import { cn, plural } from '@/lib/utils';
import { LibraryBrowser } from './library-browser';

const LIST_PARAMS: Record<DefaultList['key'], Record<string, string | null>> = {
  watchlist: { status: 'want_to_watch', favorite: null, sort: null },
  watching: { status: 'watching', favorite: null, sort: null },
  watched: { status: 'watched', favorite: null, sort: 'watched_desc' },
  favorites: { status: null, favorite: 'true', sort: null },
  highest_rated: { status: null, favorite: null, sort: 'rating_desc' },
  recently_added: { status: null, favorite: null, sort: null },
};

function DefaultLists() {
  const { data: lists, isPending } = useDefaultLists();
  const url = useUrlState();
  if (isPending) {
    return (
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {(lists ?? []).map((list) => {
        const params = LIST_PARAMS[list.key];
        const active = Object.entries(params).every(
          ([key, value]) => (url.get(key) ?? null) === value,
        );
        return (
          <button
            key={list.key}
            type="button"
            onClick={() => url.set({ ...params, q: null, genre: null })}
            className={cn(
              'group flex flex-col justify-between rounded-2xl border bg-card p-3 text-left transition-colors hover:border-foreground/30',
              active && 'border-primary ring-1 ring-primary',
            )}
          >
            <div className="flex h-12 -space-x-3">
              {list.preview.slice(0, 4).map((movie) => (
                <Poster
                  key={movie.tmdbId}
                  src={movie.posterUrl}
                  title={movie.title}
                  className="w-8 rounded-md ring-2 ring-card"
                />
              ))}
            </div>
            <div className="mt-3">
              <p className="text-sm font-semibold">{list.name}</p>
              <p className="text-xs text-muted-foreground">{plural(list.count, 'movie')}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function MyMoviesView() {
  return (
    <div>
      <PageHeader
        title="My movies"
        description="Everything in your personal catalog — watched, planned and favorites."
      />
      <DefaultLists />
      <LibraryBrowser
        emptyTitle="Your catalog is empty"
        emptyDescription="Mark movies as “Want to watch” or “Watched” from any movie card to start your catalog."
      />
    </div>
  );
}
