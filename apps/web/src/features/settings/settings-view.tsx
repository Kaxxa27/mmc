'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  Download,
  ImagePlus,
  Laptop,
  LogOut,
  Monitor,
  Moon,
  Smartphone,
  Sun,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Avatar, Badge, Card, ErrorState, PageHeader, Spinner, Switch } from '@/components/ui/misc';
import { GenrePicker, useUsernameStatus } from '@/features/auth/onboarding-view';
import { api, ApiError, errorMessage } from '@/lib/api/client';
import type { ActiveSession, NotificationPreference, ProfileView } from '@/lib/api/types';
import { LANGUAGES, NOTIFICATION_LABEL, REGIONS } from '@/lib/constants';
import {
  requestOtp,
  useRemoveAvatar,
  useRevokeSession,
  useSessions,
  useUpdateProfile,
  useUploadAvatar,
} from '@/lib/queries/account';
import { useMe, useSignOut } from '@/lib/queries/core';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/lib/queries/notifications';
import { type ThemePreference, useTheme } from '@/lib/theme';
import { cn, formatDate, formatRelative } from '@/lib/utils';

function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        <div className="mt-5">{children}</div>
      </Card>
    </section>
  );
}

function ProfileSection({ me }: { me: ProfileView }) {
  const update = useUpdateProfile();
  const upload = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();
  const fileInput = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(me.firstName ?? '');
  const [lastName, setLastName] = useState(me.lastName ?? '');
  const [username, setUsername] = useState(me.username ?? '');
  const [bio, setBio] = useState(me.bio ?? '');
  const usernameStatus = useUsernameStatus(username, me.username);
  const blocked =
    usernameStatus.state === 'invalid' ||
    usernameStatus.state === 'taken' ||
    usernameStatus.state === 'checking';

  function save(event: FormEvent) {
    event.preventDefault();
    update.mutate({
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      username: username.trim() ? username.trim().toLowerCase() : null,
      bio: bio.trim() || null,
    });
  }

  return (
    <SettingsSection
      id="profile"
      title="Profile"
      description="How you appear to your groups and in shared collections."
    >
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={me.displayName} src={me.avatarUrl} size="xl" />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              loading={upload.isPending}
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus aria-hidden />
              Upload photo
            </Button>
            {me.avatarUrl ? (
              <Button
                variant="ghost"
                size="sm"
                loading={removeAvatar.isPending}
                onClick={() => removeAvatar.mutate()}
              >
                Remove
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPEG or WebP, up to 2 MB.</p>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
              event.target.value = '';
            }}
          />
        </div>
      </div>
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="s-first">
            <Input
              id="s-first"
              maxLength={60}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </Field>
          <Field label="Last name" htmlFor="s-last">
            <Input
              id="s-last"
              maxLength={60}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Username"
          htmlFor="s-username"
          hint={
            usernameStatus.message ??
            'Used for sharing collections and @mentions. Leave empty to remove it.'
          }
          error={
            usernameStatus.state === 'invalid' || usernameStatus.state === 'taken'
              ? usernameStatus.message
              : null
          }
        >
          <Input
            id="s-username"
            maxLength={30}
            autoCapitalize="none"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </Field>
        <Field label="Bio" htmlFor="s-bio">
          <Textarea
            id="s-bio"
            maxLength={500}
            rows={3}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
          />
        </Field>
        <p className="text-xs text-muted-foreground">Email: {me.email}</p>
        <div>
          <Button type="submit" loading={update.isPending} disabled={blocked}>
            Save profile
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function PreferencesSection({ me }: { me: ProfileView }) {
  const update = useUpdateProfile();
  const { preference, setPreference } = useTheme();
  const [language, setLanguage] = useState(me.language);
  const [region, setRegion] = useState(me.region);
  const [genres, setGenres] = useState(me.favoriteGenres.map((genre) => genre.id));

  return (
    <SettingsSection
      id="preferences"
      title="Preferences"
      description="Movie language and country, favorite genres and appearance."
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Movie language"
            htmlFor="p-language"
            hint="Titles, descriptions and trailers."
          >
            <Select
              id="p-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              {LANGUAGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Country"
            htmlFor="p-region"
            hint="Age ratings, release dates and where to watch."
          >
            <Select
              id="p-region"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
            >
              {REGIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Favorite genres" hint="Up to 10 — used for recommendations.">
          <GenrePicker value={genres} onChange={setGenres} />
        </Field>
        <div>
          <Button
            loading={update.isPending}
            onClick={() => update.mutate({ language, region, favoriteGenreIds: genres })}
          >
            Save preferences
          </Button>
        </div>
        <Field label="Appearance">
          <div className="flex gap-2">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={preference === value ? 'primary' : 'outline'}
                size="sm"
                aria-pressed={preference === value}
                onClick={() => setPreference(value)}
              >
                <Icon aria-hidden />
                {label}
              </Button>
            ))}
          </div>
        </Field>
      </div>
    </SettingsSection>
  );
}

function NotificationsSection() {
  const { data: preferences, isPending, error } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  function toggle(preference: NotificationPreference, channel: 'inApp' | 'email', value: boolean) {
    update.mutate([{ ...preference, [channel]: value }]);
  }

  return (
    <SettingsSection
      id="notifications"
      title="Notifications"
      description="Choose what reaches you in the app and by email."
    >
      {error ? (
        <ErrorState error={error} />
      ) : isPending ? (
        <Spinner />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Notification</th>
              <th className="w-20 pb-2 text-center font-medium">In app</th>
              <th className="w-20 pb-2 text-center font-medium">Email</th>
            </tr>
          </thead>
          <tbody>
            {preferences.map((preference) => (
              <tr key={preference.type} className="border-b border-border/60 last:border-0">
                <td className="py-2.5 pr-3">{NOTIFICATION_LABEL[preference.type]}</td>
                <td className="py-2.5 text-center">
                  <Switch
                    checked={preference.inApp}
                    onCheckedChange={(value) => toggle(preference, 'inApp', value)}
                    aria-label={`${NOTIFICATION_LABEL[preference.type]} in the app`}
                  />
                </td>
                <td className="py-2.5 text-center">
                  <Switch
                    checked={preference.email}
                    onCheckedChange={(value) => toggle(preference, 'email', value)}
                    aria-label={`${NOTIFICATION_LABEL[preference.type]} by email`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SettingsSection>
  );
}

function DeviceIcon({ session }: { session: ActiveSession }) {
  const Icon = /iphone|android|mobile/i.test(session.userAgent ?? session.device)
    ? Smartphone
    : Laptop;
  return <Icon className="size-5 text-muted-foreground" aria-hidden />;
}

function SessionsSection() {
  const { data: sessions, isPending, error } = useSessions();
  const revoke = useRevokeSession();
  const signOut = useSignOut();

  return (
    <SettingsSection
      id="sessions"
      title="Devices"
      description="Where your account is signed in. Sign out anything you do not recognise."
    >
      {error ? (
        <ErrorState error={error} />
      ) : isPending ? (
        <Spinner />
      ) : (
        <ul className="divide-y rounded-xl border">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center gap-3 px-4 py-3">
              <DeviceIcon session={session} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {session.device}
                  {session.current ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      This device
                    </Badge>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {session.ipAddress ? `${session.ipAddress} · ` : ''}signed in{' '}
                  {formatDate(session.createdAt)} · active {formatRelative(session.lastActiveAt)}
                </p>
              </div>
              {!session.current ? (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={revoke.isPending && revoke.variables === session.id}
                  onClick={() => revoke.mutate(session.id)}
                >
                  Sign out
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          loading={signOut.isPending && signOut.variables === 'others'}
          onClick={() =>
            signOut.mutate('others', {
              onSuccess: () => toast.success('Signed out on all other devices'),
            })
          }
        >
          <LogOut aria-hidden />
          Sign out other devices
        </Button>
        <Button
          variant="ghost"
          loading={signOut.isPending && signOut.variables === 'global'}
          onClick={() => signOut.mutate('global')}
        >
          Sign out everywhere
        </Button>
      </div>
    </SettingsSection>
  );
}

function DataSection({ me }: { me: ProfileView }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'idle' | 'code'>('idle');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setPending(true);
    setError(null);
    try {
      await requestOtp(me.email);
      setStep('code');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.delete('/me', { code });
      queryClient.clear();
      toast.success('Your account was deleted. Goodbye!');
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'OTP_INVALID'
          ? 'That code is not right.'
          : errorMessage(err),
      );
      setPending(false);
    }
  }

  return (
    <SettingsSection
      id="data"
      title="Your data"
      description="Download everything you saved, or delete your account."
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Export</p>
            <p className="text-xs text-muted-foreground">
              Profile, catalog, history, ratings, reviews, collections and group activity as JSON.
            </p>
          </div>
          <Button asChild variant="outline">
            {/* The BFF forwards the session cookie and the API's attachment headers. */}
            <a href="/bff/api/v1/me/export" download>
              <Download aria-hidden />
              Download JSON
            </a>
          </Button>
        </div>
        <div className="rounded-xl border border-red-500/30 p-4">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">Delete account</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Permanently removes your profile, catalog, history, reviews and collections. Groups you
            own pass to another member (admins first); groups where you are the only member are
            deleted.
          </p>
          {step === 'idle' ? (
            <Button
              variant="danger"
              size="sm"
              className="mt-3"
              loading={pending}
              onClick={() => void sendCode()}
            >
              <Trash2 aria-hidden />
              Delete my account…
            </Button>
          ) : (
            <form onSubmit={deleteAccount} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={`Code sent to ${me.email}`}
                aria-label="Confirmation code"
                className="sm:max-w-64"
              />
              <Button
                type="submit"
                variant="danger"
                size="md"
                loading={pending}
                disabled={code.length !== 6}
              >
                Delete forever
              </Button>
              <Button variant="ghost" onClick={() => setStep('idle')}>
                Cancel
              </Button>
            </form>
          )}
          {error ? (
            <p className={cn('mt-2 text-xs text-red-600 dark:text-red-400')}>{error}</p>
          ) : null}
        </div>
      </div>
    </SettingsSection>
  );
}

export function SettingsView() {
  const { data: me, isPending } = useMe();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        description="Profile, preferences, notifications, devices and your data."
      />
      {isPending || !me ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-6">
          <ProfileSection key={`profile-${me.updatedAt}`} me={me} />
          <PreferencesSection key={`prefs-${me.updatedAt}`} me={me} />
          <NotificationsSection />
          <SessionsSection />
          <DataSection me={me} />
        </div>
      )}
    </div>
  );
}
