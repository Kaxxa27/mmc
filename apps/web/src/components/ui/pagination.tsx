import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft aria-hidden />
        Previous
      </Button>
      <span className="text-sm tabular-nums text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
