import {
  CannotCollaborateAsOwnerError,
  CollaboratorNotFoundError,
  DuplicateCollaboratorError,
  DuplicateMediaListItemError,
  InvalidReorderError,
  InvalidWatchTargetError,
  ItemNotFoundInListError,
  MediaListAccessDeniedError,
  MediaListNotFoundError,
  UserNotFoundError,
} from '@server/features/mediaLists/domain/errors/MediaListErrors';
import logger from '@server/logger';
import { ZodError } from 'zod';

export interface HttpError {
  status: number;
  message: string;
  errors?: string[];
}

// Domain errors carry no transport concerns, so the translation lives here in one place
// rather than being repeated per handler.
export const toHttpError = (error: unknown): HttpError => {
  if (error instanceof ZodError) {
    return {
      status: 400,
      message: 'Invalid request',
      errors: error.issues.map((issue) => issue.message),
    };
  }

  const message = error instanceof Error ? error.message : 'Unexpected error';

  switch ((error as Error)?.constructor) {
    case MediaListNotFoundError:
    case ItemNotFoundInListError:
    case CollaboratorNotFoundError:
    case UserNotFoundError:
      return { status: 404, message };
    case MediaListAccessDeniedError:
      return { status: 403, message };
    case DuplicateMediaListItemError:
    case DuplicateCollaboratorError:
      return { status: 409, message };
    case CannotCollaborateAsOwnerError:
    case InvalidWatchTargetError:
    case InvalidReorderError:
      return { status: 400, message };
    default:
      // Nothing above claimed it, so this is a defect or an infrastructure failure rather
      // than a rejected request. The other routers log before handing back a 500, and
      // without that these fail silently.
      logger.error('Unhandled error in a watchlist route', {
        label: 'Media Lists',
        errorMessage: message,
      });
      return { status: 500, message };
  }
};
