import { getMediaListServices } from '@server/features/mediaLists/composition';
import { toUserRef } from '@server/features/mediaLists/data/mappers/userRefMapper';
import { toMediaListItemDto } from '@server/features/mediaLists/presentation/mappers/toResponseDto';
import { toHttpError } from '@server/features/mediaLists/presentation/routes/errorMapping';
import {
  addMediaListItemSchema,
  itemFilterSchema,
  listIdParam,
  reorderMediaListSchema,
} from '@server/features/mediaLists/presentation/schemas/mediaListSchemas';
import { Router } from 'express';

const router = Router({ mergeParams: true });

// mergeParams brings the parent :mediaListId in at runtime, but the Express types only
// know about the params declared on this router.
const params = (req: { params: unknown }) =>
  req.params as Record<string, string>;

router.get('/', async (req, res, next) => {
  try {
    const listId = listIdParam.parse(params(req).mediaListId);
    const filter = itemFilterSchema.parse(req.query.filter ?? 'all');
    const { views } = getMediaListServices();

    const items = await views.itemViewsFor(listId, req.user!.id, filter);
    const members = await views.membersFor(listId);

    // Resolving the seen-by ids once for the whole page rather than per item.
    const byId = new Map(members.map((member) => [member.id, member]));

    return res.status(200).json(
      items.map((view) =>
        toMediaListItemDto(
          view,
          view.seenByUserIds
            .map((userId) => byId.get(userId))
            .filter((member): member is NonNullable<typeof member> => !!member)
        )
      )
    );
  } catch (error) {
    return next(toHttpError(error));
  }
});

router.post('/', async (req, res, next) => {
  try {
    const listId = listIdParam.parse(params(req).mediaListId);
    const body = addMediaListItemSchema.parse(req.body);
    const { items } = getMediaListServices();

    const item = await items.add({
      listId,
      tmdbId: body.tmdbId,
      mediaType: body.mediaType,
      actor: toUserRef(req.user!),
    });

    return res.status(201).json(
      // A freshly added title has no watch state yet, and the client already knows
      // what it just added, so resolving the summary waits for the next list read.
      toMediaListItemDto(
        {
          item,
          summary: null,
          watched: false,
          progress: null,
          seenByUserIds: [],
        },
        []
      )
    );
  } catch (error) {
    return next(toHttpError(error));
  }
});

// Declared before the :itemId routes so "reorder" is not read as an item id.
router.post('/reorder', async (req, res, next) => {
  try {
    const listId = listIdParam.parse(params(req).mediaListId);
    const body = reorderMediaListSchema.parse(req.body);
    const { items } = getMediaListServices();

    await items.reorder(listId, req.user!.id, body.orderedItemIds);

    return res.status(204).send();
  } catch (error) {
    return next(toHttpError(error));
  }
});

// Pinning edits the shared list, unlike the per-member /watched routes, so it stays
// behind editListItems rather than the read-only-friendly track-progress check.
router.post('/:itemId/pinned', async (req, res, next) => {
  try {
    const listId = listIdParam.parse(params(req).mediaListId);
    const itemId = listIdParam.parse(params(req).itemId);
    const { items } = getMediaListServices();

    await items.setPinned(listId, itemId, req.user!.id, true);

    return res.status(204).send();
  } catch (error) {
    return next(toHttpError(error));
  }
});

router.delete('/:itemId/pinned', async (req, res, next) => {
  try {
    const listId = listIdParam.parse(params(req).mediaListId);
    const itemId = listIdParam.parse(params(req).itemId);
    const { items } = getMediaListServices();

    await items.setPinned(listId, itemId, req.user!.id, false);

    return res.status(204).send();
  } catch (error) {
    return next(toHttpError(error));
  }
});

router.delete('/:itemId', async (req, res, next) => {
  try {
    const listId = listIdParam.parse(params(req).mediaListId);
    const itemId = listIdParam.parse(params(req).itemId);
    const { items } = getMediaListServices();

    await items.remove(listId, itemId, req.user!.id);

    return res.status(204).send();
  } catch (error) {
    return next(toHttpError(error));
  }
});

export default router;
