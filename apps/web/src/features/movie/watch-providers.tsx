import { ExternalLink } from 'lucide-react';
import type { WatchAvailability, WatchProvider } from '@/lib/api/types';
import { formatDate } from '@/lib/utils';

const KINDS: { key: 'subscription' | 'free' | 'ads' | 'rent' | 'buy'; label: string }[] = [
  { key: 'subscription', label: 'Stream' },
  { key: 'free', label: 'Free' },
  { key: 'ads', label: 'With ads' },
  { key: 'rent', label: 'Rent' },
  { key: 'buy', label: 'Buy' },
];

function ProviderLogo({ provider }: { provider: WatchProvider }) {
  return (
    <span
      className="flex items-center gap-2 rounded-xl border bg-card py-1.5 pl-1.5 pr-3 text-sm"
      title={provider.name}
    >
      {provider.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- provider logo from TMDB
        <img
          src={provider.logoUrl}
          alt=""
          className="size-7 rounded-lg object-cover"
          loading="lazy"
        />
      ) : (
        <span className="size-7 rounded-lg bg-muted" />
      )}
      {provider.name}
    </span>
  );
}

export function WatchProviders({ availability }: { availability: WatchAvailability | null }) {
  const groups = availability ? KINDS.filter((kind) => availability[kind.key].length > 0) : [];
  if (!availability || groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No streaming, rental or purchase options are known for your country.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((kind) => (
        <div key={kind.key}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {kind.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {availability[kind.key].map((provider) => (
              <ProviderLogo key={provider.providerId} provider={provider} />
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        {availability.attribution} · Region {availability.region} · checked{' '}
        {formatDate(availability.checkedAt)}
        {availability.link ? (
          <>
            {' · '}
            <a
              href={availability.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 underline underline-offset-2"
            >
              All options
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}
