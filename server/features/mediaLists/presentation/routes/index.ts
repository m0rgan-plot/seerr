import mediaListItemRoutes from '@server/features/mediaLists/presentation/routes/mediaListItemRoutes';
import mediaListRoutes from '@server/features/mediaLists/presentation/routes/mediaListRoutes';
import mediaListWatchRoutes from '@server/features/mediaLists/presentation/routes/mediaListWatchRoutes';
import { Router } from 'express';

const router = Router();

// Watch routes are mounted first because they sit deeper under the same prefix. Express
// falls through to the item routes when nothing here matches.
router.use('/:mediaListId/items/:itemId', mediaListWatchRoutes);
router.use('/:mediaListId/items', mediaListItemRoutes);
router.use('/', mediaListRoutes);

export default router;
