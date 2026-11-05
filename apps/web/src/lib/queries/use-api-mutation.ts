'use client';

import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api/client';

interface Options<TData, TVars> {
  /** Query key roots to refetch after success. */
  invalidate?: readonly QueryKey[];
  success?: string | ((data: TData, vars: TVars) => string | undefined);
  onSuccess?: (data: TData, vars: TVars) => void | Promise<void>;
  /** Show the error as a toast (default true). */
  toastError?: boolean;
}

/** `useMutation` with cache invalidation, success toasts and readable error toasts. */
export function useApiMutation<TVars = void, TData = unknown>(
  mutationFn: (vars: TVars) => Promise<TData>,
  options: Options<TData, TVars> = {},
) {
  const queryClient = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn,
    onSuccess: async (data, vars) => {
      await Promise.all(
        (options.invalidate ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      const message =
        typeof options.success === 'function' ? options.success(data, vars) : options.success;
      if (message) toast.success(message);
      await options.onSuccess?.(data, vars);
    },
    onError: (error) => {
      if (options.toastError !== false) toast.error(errorMessage(error));
    },
  });
}
