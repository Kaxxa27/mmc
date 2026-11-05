'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/** `false` during server rendering and hydration, `true` afterwards (for values like "today"). */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
