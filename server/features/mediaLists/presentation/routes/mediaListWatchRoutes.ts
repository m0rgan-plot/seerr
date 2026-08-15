import { getMediaListServices } from '@server/features/mediaLists/composition';
import { toHttpError } from '@server/features/mediaLists/presentation/routes/errorMapping';
import { listIdParam } from '@server/features/mediaLists/presentation/schemas/mediaListSchemas';
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

// Season and episode numbers can legitimately be zero, since season 0 holds specials.
const episodeNumberParam = z.coerce.number().int().min(0);

// Every route here writes the caller's own state, which is why read-only collaborators
// are allowed through: recording what you watched is not editing the list.
const router = Router({ mergeParams: true });

const listAndItem = (params: Record<string, string>) => ({
  listId: listIdParam.parse(params.mediaListId),
  itemId: listIdParam.parse(params.itemId),
});

const setMovieWatched =
  (watched: boolean) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { listId, itemId } = listAndItem(
        req.params as Record<string, string>
      );
      const { watches } = getMediaListServices();

      await watches.setMovieWatched(listId, itemId, req.user!.id, watched);

      return res.status(204).send();
    } catch (error) {
      return next(toHttpError(error));
    }
  };

const setSeasonWatched =
  (watched: boolean) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { listId, itemId } = listAndItem(
        req.params as Record<string, string>
      );
      const seasonNumber = episodeNumberParam.parse(req.params.seasonNumber);
      const { watches } = getMediaListServices();

      await watches.setSeasonWatched(
        listId,
        itemId,
        req.user!.id,
        seasonNumber,
        watched
      );

      return res.status(204).send();
    } catch (error) {
      return next(toHttpError(error));
    }
  };

const setEpisodeWatched =
  (watched: boolean) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { listId, itemId } = listAndItem(
        req.params as Record<string, string>
      );
      const seasonNumber = episodeNumberParam.parse(req.params.seasonNumber);
      const episodeNumber = episodeNumberParam.parse(req.params.episodeNumber);
      const { watches } = getMediaListServices();

      await watches.setEpisodeWatched(
        listId,
        itemId,
        req.user!.id,
        seasonNumber,
        episodeNumber,
        watched
      );

      return res.status(204).send();
    } catch (error) {
      return next(toHttpError(error));
    }
  };

router.get('/progress', async (req, res, next) => {
  try {
    const { listId, itemId } = listAndItem(
      req.params as Record<string, string>
    );
    const { watches } = getMediaListServices();

    const progress = await watches.progressFor(listId, itemId, req.user!.id);

    return res.status(200).json(progress);
  } catch (error) {
    return next(toHttpError(error));
  }
});

router.post('/watched', setMovieWatched(true));
router.delete('/watched', setMovieWatched(false));

router.post('/seasons/:seasonNumber/watched', setSeasonWatched(true));
router.delete('/seasons/:seasonNumber/watched', setSeasonWatched(false));

router.post(
  '/seasons/:seasonNumber/episodes/:episodeNumber/watched',
  setEpisodeWatched(true)
);
router.delete(
  '/seasons/:seasonNumber/episodes/:episodeNumber/watched',
  setEpisodeWatched(false)
);

export default router;
