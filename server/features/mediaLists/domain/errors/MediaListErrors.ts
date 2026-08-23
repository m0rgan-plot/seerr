// Routes translate these to status codes with a switch on the constructor, the same way
// the request and watchlist routes already do.

export class MediaListNotFoundError extends Error {
  constructor(message = 'Watchlist not found') {
    super(message);
    this.name = 'MediaListNotFoundError';
  }
}

export class MediaListAccessDeniedError extends Error {
  constructor(message = 'You do not have access to this watchlist') {
    super(message);
    this.name = 'MediaListAccessDeniedError';
  }
}

export class DuplicateMediaListItemError extends Error {
  constructor(message = 'This title is already on the watchlist') {
    super(message);
    this.name = 'DuplicateMediaListItemError';
  }
}

export class ItemNotFoundInListError extends Error {
  constructor(message = 'This title is not on the watchlist') {
    super(message);
    this.name = 'ItemNotFoundInListError';
  }
}

export class DuplicateCollaboratorError extends Error {
  constructor(message = 'This user already has access to the watchlist') {
    super(message);
    this.name = 'DuplicateCollaboratorError';
  }
}

export class CollaboratorNotFoundError extends Error {
  constructor(message = 'This user does not have access to the watchlist') {
    super(message);
    this.name = 'CollaboratorNotFoundError';
  }
}

export class UserNotFoundError extends Error {
  constructor(message = 'User not found') {
    super(message);
    this.name = 'UserNotFoundError';
  }
}

export class CannotCollaborateAsOwnerError extends Error {
  constructor(message = 'The owner of a watchlist cannot be added to it') {
    super(message);
    this.name = 'CannotCollaborateAsOwnerError';
  }
}

// Raised when a movie action is used on a show or the reverse. Shows track progress
// per episode, so they never carry a single watched flag.
export class InvalidWatchTargetError extends Error {
  constructor(message = 'This title does not support that watched action') {
    super(message);
    this.name = 'InvalidWatchTargetError';
  }
}

export class InvalidReorderError extends Error {
  constructor(message = 'The provided order does not match the watchlist') {
    super(message);
    this.name = 'InvalidReorderError';
  }
}
