import { Film } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Movie poster (2:3) with a neutral placeholder when TMDB has no image. */
export function Poster({
  src,
  title,
  className,
  priority,
}: {
  src: string | null | undefined;
  title: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn('relative aspect-[2/3] overflow-hidden rounded-xl bg-muted', className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- TMDB (or mock) images are already sized; no optimizer needed
        <img
          src={src}
          alt={title}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-200 to-zinc-300 p-3 text-center dark:from-zinc-800 dark:to-zinc-900">
          <Film className="size-8 text-muted-foreground" aria-hidden />
          <span className="line-clamp-3 text-xs font-medium text-muted-foreground">{title}</span>
        </div>
      )}
    </div>
  );
}

export function Backdrop({
  src,
  className,
}: {
  src: string | null | undefined;
  className?: string;
}) {
  if (!src)
    return (
      <div
        className={cn('bg-gradient-to-br from-rose-900/40 via-zinc-900 to-zinc-950', className)}
      />
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- decorative backdrop from TMDB
    <img src={src} alt="" className={cn('object-cover', className)} />
  );
}
