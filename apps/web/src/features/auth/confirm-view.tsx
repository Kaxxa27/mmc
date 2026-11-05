'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/misc';
import { ApiError, errorMessage } from '@/lib/api/client';
import { verifyMagicLink } from '@/lib/queries/account';
import { useFinishSignIn } from './use-finish-sign-in';

/**
 * Magic-link landing page. Signing in needs a click, so email scanners that open links
 * cannot use up the one-time token.
 */
export function ConfirmView() {
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get('token_hash');
  const finish = useFinishSignIn(searchParams.get('next'));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!tokenHash) return;
    setPending(true);
    setError(null);
    try {
      finish(await verifyMagicLink(tokenHash));
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'MAGIC_LINK_INVALID'
          ? 'This sign-in link has expired or was already used. Request a new code.'
          : errorMessage(err),
      );
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm p-6 text-center sm:p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MailCheck className="size-6" aria-hidden />
      </span>
      {tokenHash ? (
        <>
          <h1 className="mt-4 text-xl font-bold tracking-tight">Finish signing in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You opened the sign-in link from your email.
          </p>
          {error ? (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            size="lg"
            className="mt-6 w-full"
            loading={pending}
            onClick={() => void confirm()}
          >
            Continue
          </Button>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-xl font-bold tracking-tight">This link is incomplete</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Open the link from the email again, or sign in with a code.
          </p>
        </>
      )}
      <Button asChild variant="link" className="mt-3">
        <Link href="/sign-in">Sign in with a code instead</Link>
      </Button>
    </Card>
  );
}
