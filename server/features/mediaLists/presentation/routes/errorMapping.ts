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
      return { status: 500, message };
  }
};
