import { notFound } from 'next/navigation';

/** TMDB ids in URLs: positive integers, anything else is a 404. */
export function parsePositiveId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return id;
}
