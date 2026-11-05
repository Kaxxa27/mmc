import { Injectable } from '@nestjs/common';
import { yearOf } from '../common/utils/dates.js';
import { AppConfig } from '../config/app-config.js';
import type {
  TmdbCrewMember,
  TmdbMovieDetails,
  TmdbMovieListItem,
  TmdbProvider,
  TmdbWatchProviders,
} from '../tmdb/tmdb.types.js';
import { extractCertifications } from './certifications.js';
import { GenresService } from './genres.service.js';
import type {
  CrewMember,
  MovieCrew,
  MovieDetails,
  MovieRow,
  MovieSummary,
  MovieVideo,
  WatchAvailability,
  WatchProvider,
} from './movie.types.js';

export type ImageSize = 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original';

const CREW_JOBS: Record<keyof MovieCrew, string[]> = {
  directors: ['Director'],
  writers: ['Screenplay', 'Writer', 'Story', 'Novel', 'Author'],
  producers: ['Producer'],
  cinematographers: ['Director of Photography'],
  composers: ['Original Music Composer', 'Music'],
  editors: ['Editor'],
};

const VIDEO_TYPES = ['Trailer', 'Teaser', 'Clip', 'Featurette', 'Behind the Scenes'];

const round1 = (value: number | null | undefined): number | null =>
  value === null || value === undefined ? null : Math.round(value * 10) / 10;

/** Turns TMDB payloads and database rows into the API's movie shapes. */
@Injectable()
export class MoviePresenter {
  constructor(
    private readonly config: AppConfig,
    private readonly genres: GenresService,
  ) {}

  image(path: string | null | undefined, size: ImageSize): string | null {
    return path ? `${this.config.tmdb.imageBaseUrl}/${size}${path}` : null;
  }

  fromTmdbItem(item: TmdbMovieListItem): MovieSummary {
    const releaseDate = item.release_date ? item.release_date : null;
    return {
      tmdbId: item.id,
      title: item.title,
      originalTitle: item.original_title ?? null,
      overview: item.overview ? item.overview : null,
      releaseDate,
      releaseYear: yearOf(releaseDate),
      genres: this.genres.refs(item.genre_ids ?? []),
      posterPath: item.poster_path,
      posterUrl: this.image(item.poster_path, 'w500'),
      backdropPath: item.backdrop_path,
      backdropUrl: this.image(item.backdrop_path, 'w1280'),
      voteAverage: round1(item.vote_average),
      voteCount: item.vote_count ?? null,
      popularity: round1(item.popularity),
    };
  }

  fromRow(row: MovieRow): MovieSummary {
    return {
      tmdbId: row.tmdbId,
      title: row.title,
      originalTitle: row.originalTitle,
      overview: row.overview,
      releaseDate: row.releaseDate,
      releaseYear: yearOf(row.releaseDate),
      genres: this.genres.refs(row.genreIds),
      posterPath: row.posterPath,
      posterUrl: this.image(row.posterPath, 'w500'),
      backdropPath: row.backdropPath,
      backdropUrl: this.image(row.backdropPath, 'w1280'),
      voteAverage: round1(row.voteAverage),
      voteCount: row.voteCount,
      popularity: round1(row.popularity),
    };
  }

  fromTmdbDetails(details: TmdbMovieDetails, region: string, fetchedAt: Date): MovieDetails {
    const certifications = extractCertifications(details.release_dates);
    const summary = this.fromTmdbItem({ ...details, genre_ids: details.genres.map((g) => g.id) });
    const alternativeTitles = [
      ...new Set((details.alternative_titles?.titles ?? []).map((t) => t.title)),
    ]
      .filter((title) => title !== details.title && title !== details.original_title)
      .slice(0, 10);

    return {
      ...summary,
      // Genre names from the details response are already in the requested language.
      genres: details.genres.map(({ id, name }) => ({ id, name })),
      imdbId: details.imdb_id,
      tagline: details.tagline ? details.tagline : null,
      runtime: details.runtime ? details.runtime : null,
      releaseStatus: details.status ?? null,
      originalLanguage: details.original_language ?? null,
      productionCountries: details.production_countries.map((c) => ({
        code: c.iso_3166_1,
        name: c.name,
      })),
      spokenLanguages: details.spoken_languages.map((l) => ({
        code: l.iso_639_1,
        name: l.english_name || l.name,
      })),
      certification: certifications[region] ?? null,
      certifications,
      alternativeTitles,
      cast: (details.credits?.cast ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .slice(0, 20)
        .map((c) => ({
          tmdbId: c.id,
          name: c.name,
          character: c.character ? c.character : null,
          order: c.order,
          profileUrl: this.image(c.profile_path, 'w185'),
        })),
      crew: this.groupCrew(details.credits?.crew ?? []),
      videos: this.videos(details),
      similar: (details.similar?.results ?? []).slice(0, 12).map((m) => this.fromTmdbItem(m)),
      recommendations: (details.recommendations?.results ?? [])
        .slice(0, 12)
        .map((m) => this.fromTmdbItem(m)),
      watchProviders: this.watchProviders(
        details['watch/providers']?.results[region],
        region,
        fetchedAt,
      ),
      source: 'tmdb',
    };
  }

  /** Details built from the local catalog when TMDB is unavailable (no credits or videos). */
  fromRowDetails(row: MovieRow, region: string, similar: MovieSummary[]): MovieDetails {
    return {
      ...this.fromRow(row),
      imdbId: row.imdbId,
      tagline: row.tagline,
      runtime: row.runtime,
      releaseStatus: row.releaseStatus,
      originalLanguage: row.originalLanguage,
      productionCountries: row.originCountries.map((code) => ({ code, name: code })),
      spokenLanguages: [],
      certification: row.certifications[region] ?? null,
      certifications: row.certifications,
      alternativeTitles: [],
      cast: [],
      crew: {
        directors: [],
        writers: [],
        producers: [],
        cinematographers: [],
        composers: [],
        editors: [],
      },
      videos: [],
      similar,
      recommendations: [],
      watchProviders: null,
      source: 'local',
    };
  }

  private groupCrew(crew: TmdbCrewMember[]): MovieCrew {
    const grouped = {} as MovieCrew;
    for (const [group, jobs] of Object.entries(CREW_JOBS) as [keyof MovieCrew, string[]][]) {
      const seen = new Set<number>();
      grouped[group] = crew
        .filter((member) => jobs.includes(member.job))
        .filter((member) => (seen.has(member.id) ? false : (seen.add(member.id), true)))
        .slice(0, 10)
        .map((member): CrewMember => ({
          tmdbId: member.id,
          name: member.name,
          job: member.job,
          profileUrl: this.image(member.profile_path, 'w185'),
        }));
    }
    return grouped;
  }

  /** Official YouTube trailers first; only embeddable sources are returned. */
  private videos(details: TmdbMovieDetails): MovieVideo[] {
    return (details.videos?.results ?? [])
      .filter((v) => v.site === 'YouTube' && VIDEO_TYPES.includes(v.type))
      .sort((a, b) => {
        const rank = (v: typeof a) => (v.type === 'Trailer' ? 0 : 1) + (v.official ? 0 : 2);
        return rank(a) - rank(b) || (b.published_at ?? '').localeCompare(a.published_at ?? '');
      })
      .slice(0, 12)
      .map((v) => ({
        key: v.key,
        name: v.name,
        type: v.type,
        site: 'YouTube' as const,
        official: v.official,
        url: `https://www.youtube.com/watch?v=${encodeURIComponent(v.key)}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.key)}`,
        publishedAt: v.published_at ?? null,
      }));
  }

  private watchProviders(
    providers: TmdbWatchProviders | undefined,
    region: string,
    fetchedAt: Date,
  ): WatchAvailability | null {
    if (!providers) return null;
    const map = (list: TmdbProvider[] | undefined): WatchProvider[] =>
      (list ?? [])
        .slice()
        .sort((a, b) => a.display_priority - b.display_priority)
        .map((p) => ({
          providerId: p.provider_id,
          name: p.provider_name,
          logoUrl: this.image(p.logo_path, 'w92'),
        }));
    return {
      region,
      link: providers.link ?? null,
      subscription: map(providers.flatrate),
      free: map(providers.free),
      ads: map(providers.ads),
      rent: map(providers.rent),
      buy: map(providers.buy),
      attribution: this.config.tmdb.mock
        ? 'Mock streaming data for local development (not real availability).'
        : 'Streaming availability by JustWatch, via TMDB.',
      checkedAt: fetchedAt.toISOString(),
    };
  }
}
