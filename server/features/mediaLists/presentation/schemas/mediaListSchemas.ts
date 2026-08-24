import { MediaType } from '@server/constants/media';
import { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import { z } from 'zod';

export const createMediaListSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullish(),
});

export const updateMediaListSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullish(),
  })
  // An empty body would otherwise be a silent no-op that still reports success.
  .refine(
    (value) => value.name !== undefined || value.description !== undefined,
    { message: 'Provide a name or a description to update' }
  );

export const addMediaListItemSchema = z.object({
  tmdbId: z.coerce.number().int().positive(),
  mediaType: z.nativeEnum(MediaType),
});

export const mediaMembershipQuerySchema = z.object({
  tmdbId: z.coerce.number().int().positive(),
  mediaType: z.nativeEnum(MediaType),
});

export const reorderMediaListSchema = z.object({
  orderedItemIds: z.array(z.coerce.number().int().positive()).min(1),
});

export const shareMediaListSchema = z.object({
  userId: z.coerce.number().int().positive(),
  role: z.nativeEnum(CollaboratorRole),
});

export const updateCollaboratorRoleSchema = z.object({
  role: z.nativeEnum(CollaboratorRole),
});

export const itemFilterSchema = z
  .enum(['all', 'unseen', 'inprogress', 'seen'])
  .default('all');

export const listIdParam = z.coerce.number().int().positive();
