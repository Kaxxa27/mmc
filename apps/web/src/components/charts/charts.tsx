'use client';

import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Small, dependency-free charts that follow the dataviz rules: thin marks with 4px rounded
 * data-ends, hairline solid gridlines, text in text colors (never the series color),
 * hover/focus tooltips that never gate a value, and a table view for every chart.
 */

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TableView({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: [string, string];
  rows: [string, string][];
}) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">
        View as table
      </summary>
      <table className="mt-2 w-full max-w-md text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="py-1.5 font-medium">{columns[0]}</th>
            <th className="py-1.5 text-right font-medium">{columns[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, value]) => (
            <tr key={name} className="border-b border-border/60">
              <td className="py-1.5">{name}</td>
              <td className="py-1.5 text-right tabular-nums">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Clean axis ticks (1/2/5 steps, integers only) from 0 to at least `max`. */
export function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(
    1,
    [1, 2, 5, 10].map((multiple) => multiple * power).find((value) => value >= rough) ?? power * 10,
  );
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top; value += step) ticks.push(Math.round(value));
  return ticks;
}

export interface ColumnDatum {
  key: string;
  /** Axis label (short). */
  label: string;
  /** Tooltip / table label (long). */
  fullLabel: string;
  value: number;
}

/** Single-series column chart (e.g. viewings per month). */
export function ColumnChart({
  data,
  unit,
  caption,
}: {
  data: ColumnDatum[];
  unit: [string, string];
  caption: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(0, ...data.map((datum) => datum.value)));
  const top = ticks.at(-1) ?? 1;
  const peak = data.reduce(
    (best, datum, index) => (datum.value > (data[best]?.value ?? 0) ? index : best),
    0,
  );
  const describe = (value: number) => `${value} ${value === 1 ? unit[0] : unit[1]}`;

  return (
    <figure>
      <div className="relative h-52">
        {/* Gridlines with tick labels in the left gutter. */}
        {ticks.map((tick) => (
          <div
            key={tick}
            className={cn(
              'absolute left-8 right-0 border-t',
              tick === 0 ? 'border-chart-axis' : 'border-chart-grid',
            )}
            style={{ bottom: `${(tick / top) * 100}%` }}
          >
            <span className="absolute -left-8 w-6 -translate-y-1/2 text-right text-[11px] tabular-nums text-muted-foreground">
              {tick}
            </span>
          </div>
        ))}
        <div className="absolute inset-y-0 left-8 right-0 flex items-end">
          {data.map((datum, index) => {
            const height = (datum.value / top) * 100;
            const isActive = active === index;
            return (
              <button
                key={datum.key}
                type="button"
                className="relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center outline-none"
                aria-label={`${datum.fullLabel}: ${describe(datum.value)}`}
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive((current) => (current === index ? null : current))}
                onFocus={() => setActive(index)}
                onBlur={() => setActive((current) => (current === index ? null : current))}
              >
                {datum.value > 0 ? (
                  <span
                    className={cn(
                      'w-[min(24px,70%)] rounded-t-[4px] bg-chart-1 transition-opacity',
                      active !== null && !isActive && 'opacity-60',
                    )}
                    style={{ height: `${height}%` }}
                  />
                ) : null}
                {/* Selective direct label: only the peak carries its value on the cap. */}
                {index === peak && datum.value > 0 && active === null ? (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 text-[11px] font-medium tabular-nums text-foreground"
                    style={{ bottom: `calc(${height}% + 4px)` }}
                  >
                    {datum.value}
                  </span>
                ) : null}
                {isActive ? (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border bg-card px-2.5 py-1.5 text-left shadow-lg"
                    style={{ bottom: `calc(${height}% + 8px)` }}
                  >
                    <span className="block text-sm font-semibold">{describe(datum.value)}</span>
                    <span className="block text-xs text-muted-foreground">{datum.fullLabel}</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="ml-8 mt-2 flex">
        {data.map((datum) => (
          <span
            key={datum.key}
            className="min-w-0 flex-1 truncate text-center text-[11px] text-muted-foreground"
          >
            {datum.label}
          </span>
        ))}
      </div>
      <TableView
        caption={caption}
        columns={['Month', unit[1][0]!.toUpperCase() + unit[1].slice(1)]}
        rows={data.map((datum) => [datum.fullLabel, String(datum.value)])}
      />
    </figure>
  );
}

/** Ranked horizontal bars, largest first, one hue, value at each bar's tip. */
export function RankedBars({
  items,
  caption,
  unit,
}: {
  items: { key: string; label: string; value: number }[];
  caption: string;
  unit: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <figure>
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const ratio = item.value / max;
          return (
            <li
              key={item.key}
              className="grid grid-cols-[6.5rem_1fr] items-center gap-3"
              title={`${item.label}: ${item.value} ${unit}`}
            >
              <span className="truncate text-sm">{item.label}</span>
              <span className="relative h-5">
                <span
                  className="absolute inset-y-0.5 left-0 rounded-r-[4px] bg-chart-1"
                  style={{ width: `calc((100% - 2.5rem) * ${ratio})` }}
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 pl-2 text-xs font-medium tabular-nums"
                  style={{ left: `calc((100% - 2.5rem) * ${ratio})` }}
                >
                  {item.value}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <TableView
        caption={caption}
        columns={['Genre', 'Movies']}
        rows={items.map((item) => [item.label, String(item.value)])}
      />
    </figure>
  );
}

export interface Segment {
  key: string;
  label: string;
  value: number;
  /** Fill class, e.g. `bg-chart-1`. */
  fill: string;
  /** Label color inside the fill (white or near-black, by the fill's luminance). */
  ink: string;
}

/** One whole split into a few parts, read at a glance (tall segmented bar). */
export function SegmentedBar({ segments, caption }: { segments: Segment[]; caption: string }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);
  const share = (value: number) => (total ? Math.round((value / total) * 100) : 0);
  return (
    <figure>
      <div
        className="flex h-7 gap-0.5"
        role="img"
        aria-label={`${caption}: ${segments.map((s) => `${s.label} ${s.value} (${share(s.value)}%)`).join(', ')}`}
      >
        {visible.map((segment) => {
          const percent = share(segment.value);
          return (
            <div
              key={segment.key}
              className={cn('flex min-w-1 items-center rounded-[4px] pl-2', segment.fill)}
              style={{ flexGrow: segment.value, flexBasis: 0 }}
              title={`${segment.label}: ${segment.value} (${percent}%)`}
            >
              {/* Printed only where it fits; otherwise the legend, tooltip and table carry it. */}
              {segment.value / total >= 0.12 ? (
                <span className={cn('text-xs font-semibold', segment.ink)}>{percent}%</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2">
            <span className={cn('size-3 rounded-[3px]', segment.fill)} aria-hidden />
            {segment.label}
          </li>
        ))}
      </ul>
      <TableView
        caption={caption}
        columns={['Status', 'Movies']}
        rows={segments.map((segment) => [
          segment.label,
          `${segment.value} (${share(segment.value)}%)`,
        ])}
      />
    </figure>
  );
}
