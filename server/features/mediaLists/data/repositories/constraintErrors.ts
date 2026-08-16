import logger from '@server/logger';
import { QueryFailedError } from 'typeorm';

// The services look for a duplicate before they write, so a unique constraint only fires
// when two requests race between the check and the insert. The caller deserves the same
// answer either way, so the driver error is turned into the domain error the checked path
// raises. The original stays in the log rather than travelling to the client, since it
// carries the SQL that produced it.
export function rethrowAsDomainError(error: unknown, duplicate: Error): never {
  if (!(error instanceof QueryFailedError)) {
    throw error;
  }

  logger.warn('Watchlist write hit a database constraint', {
    label: 'Media Lists',
    errorMessage: error.message,
  });

  throw duplicate;
}
