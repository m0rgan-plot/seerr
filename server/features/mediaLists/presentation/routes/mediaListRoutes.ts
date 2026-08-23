import { getMediaListServices } from '@server/features/mediaLists/composition';
import { toUserRef } from '@server/features/mediaLists/data/mappers/userRefMapper';
import {
  toCollaboratorDto,
  toMediaListDto,
  toMediaListInviteDto,
  toMediaListSummaryDto,
} from '@server/features/mediaLists/presentation/mappers/toResponseDto';
import { toHttpError } from '@server/features/mediaLists/presentation/routes/errorMapping';
import {
  createMediaListSchema,
  listIdParam,
  shareMediaListSchema,
  updateCollaboratorRoleSchema,
  updateMediaListSchema,
} from '@server/features/mediaLists/presentation/schemas/mediaListSchemas';
import { Router } from 'express';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { views } = getMediaListServices();
    const summaries = await views.summariesFor(req.user!.id);

    return res.status(200).json(summaries.map(toMediaListSummaryDto));
  } catch (error) {
    return next(toHttpError(error));
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = createMediaListSchema.parse(req.body);
    const { lists } = getMediaListServices();

    const list = await lists.create({
      name: body.name,
      description: body.description ?? null,
      ownerId: req.user!.id,
    });

    return res.status(201).json(toMediaListDto(list, { kind: 'owner' }));
  } catch (error) {
    return next(toHttpError(error));
  }
});

// Declared before "/:mediaListId" so "invites" is never read as a list id, the same
// reason "reorder" precedes ":itemId" in mediaListItemRoutes.ts.
router.get('/invites', async (req, res, next) => {
  try {
    const { views } = getMediaListServices();
    const invites = await views.invitesFor(req.user!.id);

    return res.status(200).json(invites.map(toMediaListInviteDto));
  } catch (error) {
    return next(toHttpError(error));
  }
});

router.get('/:mediaListId', async (req, res, next) => {
  try {
    const listId = listIdParam.parse(req.params.mediaListId);
    const { lists } = getMediaListServices();

    const list = await lists.view(listId, req.user!.id);
    const membership = await lists.membershipFor(list, req.user!.id);

    return res.status(200).json(toMediaListDto(list, membership));
  } catch (error) {
    return next(toHttpError(error));
  }
});

router.put('/:mediaListId', async (req, res, next) => {
  try {
    const listId = listIdParam.parse(req.params.mediaListId);
    const body = updateMediaListSchema.parse(req.body);
    const { lists } = getMediaListServices();

    const list = await lists.update(listId, req.user!.id, body);
    const membership = await lists.membershipFor(list, req.user!.id);

    return res.status(200).json(toMediaListDto(list, membership));
  } catch (error) {
    return next(toHttpError(error));
  }
});

router.delete('/:mediaListId', async (req, res, next) => {
  try {
    const listId = listIdParam.parse(req.params.mediaListId);
    const { lists } = getMediaListServices();

    await lists.delete(listId, req.user!.id);

    return res.status(204).send();
  } catch (error) {
    return next(toHttpError(error));
  }
});

router.get('/:mediaListId/collaborators', async (req, res, next) => {
  try {
    const listId = listIdParam.parse(req.params.mediaListId);
    const { collaborators } = getMediaListServices();

    const members = await collaborators.listFor(listId, req.user!.id);

    return res.status(200).json(members.map(toCollaboratorDto));
  } catch (error) {
    return next(toHttpError(error));
  }
});

router.post('/:mediaListId/collaborators', async (req, res, next) => {
  try {
    const listId = listIdParam.parse(req.params.mediaListId);
    const body = shareMediaListSchema.parse(req.body);
    const { collaborators } = getMediaListServices();

    const collaborator = await collaborators.share({
      listId,
      recipientId: body.userId,
      role: body.role,
      actor: toUserRef(req.user!),
    });

    return res.status(201).json(toCollaboratorDto(collaborator));
  } catch (error) {
    return next(toHttpError(error));
  }
});

router.put('/:mediaListId/collaborators/:userId', async (req, res, next) => {
  try {
    const listId = listIdParam.parse(req.params.mediaListId);
    const userId = listIdParam.parse(req.params.userId);
    const body = updateCollaboratorRoleSchema.parse(req.body);
    const { collaborators } = getMediaListServices();

    const collaborator = await collaborators.changeRole({
      listId,
      userId,
      role: body.role,
      actorId: req.user!.id,
    });

    return res.status(200).json(toCollaboratorDto(collaborator));
  } catch (error) {
    return next(toHttpError(error));
  }
});

router.post('/:mediaListId/invite/accept', async (req, res, next) => {
  try {
    const listId = listIdParam.parse(req.params.mediaListId);
    const { collaborators } = getMediaListServices();

    const collaborator = await collaborators.acceptInvite({
      listId,
      userId: req.user!.id,
    });

    return res.status(200).json(toCollaboratorDto(collaborator));
  } catch (error) {
    return next(toHttpError(error));
  }
});

router.post('/:mediaListId/invite/reject', async (req, res, next) => {
  try {
    const listId = listIdParam.parse(req.params.mediaListId);
    const { collaborators } = getMediaListServices();

    await collaborators.rejectInvite({
      listId,
      userId: req.user!.id,
    });

    return res.status(204).send();
  } catch (error) {
    return next(toHttpError(error));
  }
});

router.delete('/:mediaListId/collaborators/:userId', async (req, res, next) => {
  try {
    const listId = listIdParam.parse(req.params.mediaListId);
    const userId = listIdParam.parse(req.params.userId);
    const { collaborators } = getMediaListServices();

    await collaborators.remove({
      listId,
      userId,
      actorId: req.user!.id,
    });

    return res.status(204).send();
  } catch (error) {
    return next(toHttpError(error));
  }
});

export default router;
