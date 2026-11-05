'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

type ParamValue = string | number | boolean | null | undefined | readonly (string | number)[];

/**
 * Filters kept in the URL (shareable, survive reloads). Updates use the native History API,
 * which Next.js syncs with `useSearchParams` without a server round trip.
 * Callers must sit inside <Suspense> (Cache Components).
 */
export function useUrlState() {
  const searchParams = useSearchParams();

  const set = useCallback(
    (updates: Record<string, ParamValue>, { keepPage = false }: { keepPage?: boolean } = {}) => {
      const params = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        const text = Array.isArray(value)
          ? value.join(',')
          : value === null || value === undefined
            ? ''
            : String(value);
        if (text === '' || value === false) params.delete(key);
        else params.set(key, text);
      }
      // A new filter starts from the first page.
      if (!keepPage && !('page' in updates)) params.delete('page');
      const query = params.toString();
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
    },
    [],
  );

  const get = useCallback((key: string) => searchParams.get(key) ?? undefined, [searchParams]);
  const getNumber = useCallback(
    (key: string) => {
      const value = Number(searchParams.get(key));
      return searchParams.has(key) && Number.isFinite(value) ? value : undefined;
    },
    [searchParams],
  );
  const getList = useCallback(
    (key: string) =>
      (searchParams.get(key) ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    [searchParams],
  );
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  return { searchParams, get, getNumber, getList, page, set };
}
