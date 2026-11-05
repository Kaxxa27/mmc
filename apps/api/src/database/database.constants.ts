import { Inject } from '@nestjs/common';

export const DRIZZLE = Symbol('DRIZZLE');
export const PG_POOL = Symbol('PG_POOL');

/** Injects the Drizzle database (`import type { Database } from '.../database.types.js'`). */
export const InjectDb = (): ParameterDecorator => Inject(DRIZZLE);
