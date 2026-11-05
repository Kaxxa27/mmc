import { Heart, Star } from 'lucide-react';
import { Badge } from '@/components/ui/misc';
import type { MovieStatus } from '@/lib/api/types';
import { MOVIE_STATUS_META } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function StatusBadge({ status, className }: { status: MovieStatus; className?: string }) {
  const meta = MOVIE_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge className={cn(meta.badge, className)}>
      <Icon aria-hidden />
      {meta.label}
    </Badge>
  );
}

export function TmdbRating({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (!value) return null;
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-xs font-medium', className)}
      title="TMDB rating"
    >
      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
      {value.toFixed(1)}
    </span>
  );
}

export function FavoriteMark({ className }: { className?: string }) {
  return (
    <Heart className={cn('size-4 fill-rose-500 text-rose-500', className)} aria-label="Favorite" />
  );
}
