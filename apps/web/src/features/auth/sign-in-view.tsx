'use client';

import { ArrowLeft, FlaskConical, Mail, Sparkles, Users } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Card } from '@/components/ui/misc';
import { api, ApiError, errorMessage } from '@/lib/api/client';
import type { OtpRequestResult } from '@/lib/api/types';
import { devDemo, devSignIn, requestOtp, verifyOtp } from '@/lib/queries/account';
import { useAppConfig } from '@/lib/queries/core';
import { useFinishSignIn } from './use-finish-sign-in';

const DEMO_USERS = [
  { name: 'Anna', email: 'anna.demo@example.com' },
  { name: 'Ben', email: 'ben.demo@example.com' },
  { name: 'Chloe', email: 'chloe.demo@example.com' },
];

/** "Resend" link that unlocks after the API's cooldown (remounted for every new code). */
function ResendButton({ seconds, onResend }: { seconds: number; onResend: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return (
    <p className="text-center text-sm text-muted-foreground">
      {left > 0 ? (
        <>Resend available in {left}s</>
      ) : (
        <button
          type="button"
          className="font-medium text-primary hover:underline"
          onClick={onResend}
        >
          Send a new code
        </button>
      )}
    </p>
  );
}

function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    const wait = error.retryAfterSeconds;
    switch (error.code) {
      case 'OTP_INVALID':
        return 'That code is not right. Check the latest email and try again.';
      case 'OTP_EXPIRED':
        return 'This code has expired. Request a new one.';
      case 'OTP_ATTEMPTS_EXCEEDED':
        return 'Too many wrong attempts. Request a new code.';
      case 'OTP_RATE_LIMITED':
      case 'OTP_VERIFY_RATE_LIMITED':
      case 'AUTH_RATE_LIMITED':
      case 'OTP_RESEND_TOO_SOON':
        return wait ? `Too many attempts. Try again in ${Math.ceil(wait)} seconds.` : error.message;
      case 'API_UNAVAILABLE':
        return 'The API is not reachable. Is it running on port 3001?';
    }
  }
  return errorMessage(error);
}

interface MailboxMessage {
  code: string | null;
}

function DevTools({
  email,
  onSignedIn,
  onCode,
  showCodeHelper,
}: {
  email: string;
  onSignedIn: (session: { needsOnboarding: boolean }, target?: string) => void;
  onCode: (code: string) => void;
  showCodeHelper: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="mt-4 border-dashed bg-transparent p-4 shadow-none">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <FlaskConical className="size-4 text-amber-500" aria-hidden />
        Development shortcuts
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Only available while the API runs in development mode.
      </p>

      {showCodeHelper ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          loading={busy === 'mailbox'}
          onClick={() =>
            run('mailbox', async () => {
              const mailbox = await api.get<{ messages: MailboxMessage[] }>('/dev/mailbox', {
                email,
                limit: 1,
              });
              const code = mailbox.messages[0]?.code;
              if (code) onCode(code);
              else setMessage('No code found in Mailpit yet. Wait a second and try again.');
            })
          }
        >
          <Mail aria-hidden />
          Fill in the code from Mailpit
        </Button>
      ) : (
        <>
          <p className="mt-4 text-xs font-medium text-muted-foreground">
            Sign in instantly as a demo user
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {DEMO_USERS.map((user) => (
              <Button
                key={user.email}
                variant="outline"
                size="sm"
                loading={busy === user.email}
                disabled={busy !== null}
                onClick={() => run(user.email, async () => onSignedIn(await devSignIn(user.email)))}
              >
                {user.name}
              </Button>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2 w-full"
            loading={busy === 'demo'}
            disabled={busy !== null}
            onClick={() =>
              run('demo', async () => {
                const world = await devDemo();
                onSignedIn({ needsOnboarding: false }, `/groups/${world.groupId}`);
              })
            }
          >
            <Users aria-hidden />
            Create a demo family (group, movies, movie night)
          </Button>
          {email ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 w-full"
              disabled={busy !== null}
              loading={busy === 'email'}
              onClick={() => run('email', async () => onSignedIn(await devSignIn(email)))}
            >
              <Sparkles aria-hidden />
              Skip the code for {email}
            </Button>
          ) : null}
        </>
      )}
      {message ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{message}</p> : null}
    </Card>
  );
}

export function SignInView() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const finish = useFinishSignIn(next);
  const { data: config } = useAppConfig();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState<OtpRequestResult | null>(null);
  const [requestedAt, setRequestedAt] = useState(0);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const devTools = config?.features.devTools ?? false;

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await requestOtp(email.trim());
      setOtp(result);
      setRequestedAt(Date.now());
      setCode('');
      setTimeout(() => codeInput.current?.focus(), 50);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setPending(false);
    }
  }

  async function verify(value = code) {
    if (!otp || value.length !== otp.codeLength) return;
    setError(null);
    setPending(true);
    try {
      finish(await verifyOtp(otp.email, value));
    } catch (err) {
      setError(friendlyError(err));
      setPending(false);
    }
  }

  function changeCode(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, otp?.codeLength ?? 6);
    setCode(digits);
    if (otp && digits.length === otp.codeLength) void verify(digits);
  }

  return (
    <div className="w-full max-w-sm">
      <Card className="p-6 sm:p-8">
        {!otp ? (
          <form onSubmit={sendCode} className="flex flex-col gap-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                We will email you a 6-digit code. New here? An account is created automatically.
              </p>
            </div>
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg" loading={pending} disabled={!email.trim()}>
              Email me a code
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void verify();
            }}
            className="flex flex-col gap-5"
          >
            <div>
              <button
                type="button"
                className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setOtp(null);
                  setError(null);
                }}
              >
                <ArrowLeft className="size-4" aria-hidden />
                Use a different email
              </button>
              <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the code we sent to{' '}
                <span className="font-medium text-foreground">{otp.email}</span>. You can also open
                the sign-in link from the same email.
              </p>
            </div>
            <Field
              label="Sign-in code"
              htmlFor="code"
              hint={`The code expires ${new Date(requestedAt + otp.expiresInSeconds * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`}
            >
              <Input
                id="code"
                ref={codeInput}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d*"
                value={code}
                onChange={(event) => changeCode(event.target.value)}
                placeholder={'•'.repeat(otp.codeLength)}
                className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
                aria-invalid={Boolean(error)}
              />
            </Field>
            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              size="lg"
              loading={pending}
              disabled={code.length !== otp.codeLength}
            >
              Sign in
            </Button>
            <ResendButton
              key={requestedAt}
              seconds={otp.resendAvailableInSeconds}
              onResend={() => void sendCode()}
            />
          </form>
        )}
      </Card>
      {devTools ? (
        <DevTools
          email={otp?.email ?? email.trim()}
          showCodeHelper={Boolean(otp)}
          onSignedIn={finish}
          onCode={changeCode}
        />
      ) : null}
    </div>
  );
}
