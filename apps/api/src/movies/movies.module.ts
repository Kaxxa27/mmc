import { Global, Module } from '@nestjs/common';
import { GenresService } from './genres.service.js';
import { LocalCatalogService } from './local-catalog.service.js';
import { LocaleService } from './locale.service.js';
import { MetaController } from './meta.controller.js';
import { MovieStore } from './movie-store.service.js';
import { MoviePresenter } from './movie.presenter.js';
import { MoviesController } from './movies.controller.js';
import { MoviesService } from './movies.service.js';
import { PeopleController } from './people.controller.js';
import { PeopleService } from './people.service.js';
import { SampleMoviesRefresher } from './sample-movies-refresher.service.js';
import { UserMovieStateService } from './user-movie-state.service.js';

@Global()
@Module({
  controllers: [MoviesController, PeopleController, MetaController],
  providers: [
    GenresService,
    MoviePresenter,
    MovieStore,
    LocalCatalogService,
    LocaleService,
    UserMovieStateService,
    MoviesService,
    PeopleService,
    SampleMoviesRefresher,
  ],
  exports: [
    GenresService,
    MoviePresenter,
    MovieStore,
    LocalCatalogService,
    LocaleService,
    UserMovieStateService,
    MoviesService,
  ],
})
export class MoviesModule {}
