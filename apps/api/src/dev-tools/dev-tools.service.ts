import { Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { AuthService } from '../auth/auth.service.js';
import type { AuthUser, ClientContext } from '../auth/auth.types.js';
import type { AuthSessionDto } from '../auth/dto/auth.dto.js';
import { serviceUnavailable } from '../common/errors.js';
import { CollectionsService } from '../collections/collections.service.js';
import { AppConfig } from '../config/app-config.js';
import { InjectDb } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { collections, groups, movieNights } from '../database/schema/index.js';
import { GroupMoviesService } from '../groups/group-movies.service.js';
import { GroupsService } from '../groups/groups.service.js';
import { InvitationsService } from '../groups/invitations.service.js';
import { LibraryService } from '../library/library.service.js';
import { MovieNightsService } from '../movie-nights/movie-nights.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import type { DemoWorldDto, MailboxDto, MailboxMessageDto } from './dto/dev-tools.dto.js';

const DEMO_GROUP = 'Demo Family';
const DEMO_MEMBERS = [
  { name: 'Anna', genres: [16, 35, 10751] },
  { name: 'Ben', genres: [28, 878, 12] },
  { name: 'Chloe', genres: [18, 10749, 16] },
] as const;

// Sample movies (present offline, in mock mode and on TMDB).
const TOY_STORY = 862;
const COCO = 354912;
const UP = 14160;
const PADDINGTON_2 = 346648;
const KLAUS = 508965;
const ZOOTOPIA = 269149;
const INCEPTION = 27205;
const FINDING_NEMO = 12;
const ELF = 10719;
const HOME_ALONE = 771;

interface MailpitSummary {
  ID: string;
  Subject: string;
  Created: string;
  To: { Address: string }[] | null;
  Snippet: string;
}

/** Helpers that make the API easy to try from Swagger UI. Development only. */
@Injectable()
export class DevToolsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly config: AppConfig,
    private readonly auth: AuthService,
    private readonly profiles: ProfilesService,
    private readonly groups: GroupsService,
    private readonly invitations: InvitationsService,
    private readonly groupMovies: GroupMoviesService,
    private readonly library: LibraryService,
    private readonly collections: CollectionsService,
    private readonly movieNights: MovieNightsService,
  ) {}

  signIn(email: string, client: ClientContext): Promise<AuthSessionDto> {
    return this.auth.devSignIn(email, client);
  }

  /** Recent emails for an address, with sign-in codes, magic links and invitations extracted. */
  async mailbox(email: string, limit: number): Promise<MailboxDto> {
    const base = this.config.devTools.mailpitUrl;
    const query = encodeURIComponent(`to:"${email.trim().toLowerCase()}"`);
    let summaries: MailpitSummary[];
    try {
      const response = await fetch(`${base}/api/v1/search?query=${query}&limit=${limit}`, {
        signal: AbortSignal.timeout(5000),
      });
      summaries = ((await response.json()) as { messages?: MailpitSummary[] }).messages ?? [];
    } catch {
      throw serviceUnavailable(
        'MAILPIT_UNAVAILABLE',
        `Mailpit is not reachable at ${base}. Is the local Supabase stack running?`,
      );
    }

    const messages = await Promise.all(
      summaries.slice(0, limit).map(async (summary): Promise<MailboxMessageDto> => {
        const message = (await fetch(`${base}/api/v1/message/${summary.ID}`, {
          signal: AbortSignal.timeout(5000),
        }).then((r) => r.json())) as { Text?: string; HTML?: string };
        const html = message.HTML ?? '';
        const links = [
          ...new Set(
            [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replaceAll('&amp;', '&')),
          ),
        ];
        const invitation = links
          .map((link) => /\/invitations\/([^/?#]+)/.exec(link)?.[1])
          .find(Boolean);
        return {
          id: summary.ID,
          subject: summary.Subject,
          receivedAt: summary.Created,
          to: (summary.To ?? []).map((to) => to.Address),
          code: /\b(\d{6})\b/.exec(message.Text ?? '')?.[1] ?? null,
          magicLinkTokenHash: /token_hash=([A-Za-z0-9_-]+)/.exec(html)?.[1] ?? null,
          invitationToken: invitation ? decodeURIComponent(invitation) : null,
          links,
          preview: summary.Snippet,
        };
      }),
    );
    return { email, inboxUrl: base, messages };
  }

  /**
   * A ready-made family to explore: three members, a shared catalog with different personal
   * statuses and group ratings, a movie night in the voting phase and a shared collection.
   * Created once; later calls only sign the members in again.
   */
  async createDemo(client: ClientContext, namespace = 'demo'): Promise<DemoWorldDto> {
    const members = [];
    for (const member of DEMO_MEMBERS) {
      const email = `${member.name.toLowerCase()}.${namespace}@example.com`;
      const session = await this.auth.devSignIn(email, client);
      await this.profiles.update(
        session.user.id,
        { firstName: member.name, lastName: 'Demo', favoriteGenreIds: [...member.genres] },
        true,
      );
      members.push({ ...member, email, session, id: session.user.id });
    }
    const [anna, ben, chloe] = members as [
      (typeof members)[0],
      (typeof members)[0],
      (typeof members)[0],
    ];

    const [existing] = await this.db
      .select({ id: groups.id })
      .from(groups)
      .where(
        and(eq(groups.ownerId, anna.id), eq(groups.name, DEMO_GROUP), isNull(groups.archivedAt)),
      )
      .limit(1);
    const groupId = existing?.id ?? (await this.buildDemo(anna, ben, chloe));

    const [night] = await this.db
      .select({ id: movieNights.id })
      .from(movieNights)
      .where(eq(movieNights.groupId, groupId))
      .orderBy(desc(movieNights.createdAt))
      .limit(1);
    const [collection] = await this.db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.ownerId, anna.id), eq(collections.name, 'Christmas Movies')))
      .limit(1);

    return {
      users: members.map(({ name, email, session }) => ({
        name,
        email,
        userId: session.user.id,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
      })),
      groupId,
      movieNightId: night?.id ?? null,
      collectionId: collection?.id ?? null,
      tryNext: [
        `GET /api/v1/groups/${groupId}/movies (shared catalog with every member's status)`,
        ...(night ? [`GET /api/v1/movie-nights/${night.id} (vote as Chloe: PUT .../vote)`] : []),
        ...(night ? [`GET /api/v1/movie-nights/${night.id}/suggestions`] : []),
        ...(collection ? [`GET /api/v1/collections/${collection.id}`] : []),
        'GET /api/v1/home',
        'GET /api/v1/me/notifications',
      ],
    };
  }

  private async buildDemo(
    anna: { id: string; session: AuthSessionDto },
    ben: { id: string; session: AuthSessionDto },
    chloe: { id: string; session: AuthSessionDto },
  ): Promise<string> {
    const asUser = (member: { id: string; session: AuthSessionDto }): AuthUser => ({
      id: member.id,
      email: member.session.user.email,
      sessionId: '',
      accessToken: member.session.accessToken,
    });

    const group = await this.groups.create(anna.id, {
      name: DEMO_GROUP,
      kind: 'family',
      description: 'Created by POST /api/v1/dev/demo.',
    });
    const link = await this.invitations.createLink(group.id, anna.id, {});
    await this.invitations.acceptByToken(link.token, asUser(ben));
    await this.invitations.acceptByToken(link.token, asUser(chloe));

    const shared: [number, string][] = [
      [TOY_STORY, anna.id],
      [COCO, chloe.id],
      [UP, anna.id],
      [PADDINGTON_2, ben.id],
      [KLAUS, chloe.id],
      [ZOOTOPIA, ben.id],
      [INCEPTION, ben.id],
      [FINDING_NEMO, anna.id],
    ];
    for (const [tmdbId, addedBy] of shared) {
      await this.groupMovies.add(group.id, addedBy, { tmdbId });
    }

    // Every member keeps their own status for the same movies.
    await this.library.upsert(anna.id, TOY_STORY, {
      status: 'watched',
      rating: 9,
      isFavorite: true,
    });
    await this.library.upsert(ben.id, TOY_STORY, { status: 'watched', rating: 8 });
    await this.library.upsert(chloe.id, COCO, { status: 'want_to_watch' });
    await this.library.upsert(ben.id, COCO, { status: 'want_to_watch' });
    await this.library.upsert(anna.id, UP, { status: 'want_to_watch', notes: 'Bring tissues.' });
    await this.library.upsert(ben.id, INCEPTION, { status: 'watching' });
    await this.groupMovies.rate(group.id, anna.id, TOY_STORY, {
      rating: 9,
      review: 'Still the best!',
    });
    await this.groupMovies.rate(group.id, ben.id, TOY_STORY, { rating: 8 });

    const nextFriday = new Date();
    nextFriday.setUTCDate(nextFriday.getUTCDate() + ((5 - nextFriday.getUTCDay() + 7) % 7 || 7));
    nextFriday.setUTCHours(19, 0, 0, 0);
    const night = await this.movieNights.create(group.id, anna.id, {
      title: 'Friday Movie Night',
      scheduledAt: nextFriday.toISOString(),
      criteria: { genreIds: [16, 35, 10751], maxRuntime: 120, maxCertification: 'PG' },
    });
    const withCandidates = await this.movieNights.addSuggestedCandidates(night.id, anna.id, 3);
    if (withCandidates.candidates.length >= 2) {
      await this.movieNights.startVoting(night.id, anna.id);
      const [first, second] = withCandidates.candidates;
      await this.movieNights.vote(night.id, anna.id, first!.movie.tmdbId);
      await this.movieNights.vote(night.id, ben.id, second!.movie.tmdbId);
    }

    const collection = await this.collections.create(anna.id, {
      name: 'Christmas Movies',
      description: 'Our December favorites',
      visibility: 'private',
    });
    for (const tmdbId of [ELF, HOME_ALONE, KLAUS]) {
      await this.collections.addItem(collection.id, anna.id, { tmdbId });
    }
    await this.collections.share(collection.id, anna.id, { groupId: group.id });
    return group.id;
  }
}
