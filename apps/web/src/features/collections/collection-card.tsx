import { Globe, Library, Lock, Users } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/misc';
import type { CollectionSummary } from '@/lib/api/types';
import { VISIBILITY_META } from '@/lib/constants';
import { plural } from '@/lib/utils';

export function VisibilityBadge({ visibility }: { visibility: CollectionSummary['visibility'] }) {
  const Icon = visibility === 'public' ? Globe : visibility === 'shared' ? Users : Lock;
  return (
    <Badge>
      <Icon aria-hidden />
      {VISIBILITY_META[visibility].label}
    </Badge>
  );
}

export function CollectionCard({
  collection,
  showOwner,
}: {
  collection: CollectionSummary;
  showOwner?: boolean;
}) {
  return (
    <Link
      href={`/collections/${collection.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/9] bg-gradient-to-br from-rose-500/15 via-orange-400/10 to-sky-500/15">
        {collection.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded cover from Supabase Storage
          <img
            src={collection.coverImageUrl}
            alt=""
            className="size-full object-cover transition-transform group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <Library
            className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/60"
            aria-hidden
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="line-clamp-1 font-semibold">{collection.name}</p>
        {collection.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{collection.description}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
          <span>{plural(collection.itemCount, 'movie')}</span>
          <VisibilityBadge visibility={collection.visibility} />
          {collection.group ? <Badge>{collection.group.name}</Badge> : null}
          {showOwner ? <span>by {collection.owner.displayName}</span> : null}
        </div>
      </div>
    </Link>
  );
}
