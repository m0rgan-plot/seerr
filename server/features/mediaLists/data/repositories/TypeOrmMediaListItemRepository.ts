import type { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import { toMediaListItem } from '@server/features/mediaLists/data/mappers/mediaListItemMapper';
import MediaListItemRecord from '@server/features/mediaLists/data/orm/MediaListItemRecord';
import MediaListRecord from '@server/features/mediaLists/data/orm/MediaListRecord';
import { rethrowAsDomainError } from '@server/features/mediaLists/data/repositories/constraintErrors';
import type { MediaListItem } from '@server/features/mediaLists/domain/entities/MediaListItem';
import { DuplicateMediaListItemError } from '@server/features/mediaLists/domain/errors/MediaListErrors';
import type {
  AddMediaListItemInput,
  FindPageInListOptions,
  MediaListItemPage,
  MediaListItemRepository,
} from '@server/features/mediaLists/domain/repositories/MediaListItemRepository';

export class TypeOrmMediaListItemRepository implements MediaListItemRepository {
  public async findById(itemId: number): Promise<MediaListItem | null> {
    const record = await getRepository(MediaListItemRecord).findOne({
      where: { id: itemId },
      relations: { list: true, addedBy: true, media: true },
    });
    return record ? toMediaListItem(record, record.list.id) : null;
  }

  public async findByList(listId: number): Promise<MediaListItem[]> {
    // Pinned items lead regardless of position, most recently pinned first; everything
    // else keeps the manual order. NULLS ordering isn't consistent across sqlite and
    // postgres, so the pinned/unpinned split is spelled out as a CASE instead of relying
    // on driver defaults for where a null pinnedAt sorts.
    const records = await getRepository(MediaListItemRecord)
      .createQueryBuilder('item')
      // The media row carries the library status the cards need, and it is a join on a
      // query that already runs rather than a lookup per title.
      .leftJoinAndSelect('item.addedBy', 'addedBy')
      .leftJoinAndSelect('item.media', 'media')
      .where('item.listId = :listId', { listId })
      .orderBy('CASE WHEN item.pinnedAt IS NULL THEN 1 ELSE 0 END', 'ASC')
      .addOrderBy('item.pinnedAt', 'DESC')
      .addOrderBy('item.position', 'ASC')
      .addOrderBy('item.id', 'ASC')
      .getMany();
    return records.map((record) => toMediaListItem(record, listId));
  }

  public async findPageInList(
    listId: number,
    { skip, take }: FindPageInListOptions
  ): Promise<MediaListItemPage> {
    // getManyAndCount() can't build its count subquery around the raw CASE expression
    // below (TypeORM fails to resolve its alias there), so the total is a separate,
    // order-free count query rather than one combined call.
    const base = () =>
      getRepository(MediaListItemRecord)
        .createQueryBuilder('item')
        .where('item.listId = :listId', { listId });

    const total = await base().getCount();

    // Same order as findByList: pinned leads, most recently pinned first, then the
    // unpinned tail by position ascending -- manual reorder's own order, which this
    // has to keep respecting since /reorder is a real, tested v1 feature (see
    // WATCHLISTS_STATUS.md), not something this pagination pass gets to redefine. The
    // CASE has to be a named, selected column (not an inline ORDER BY expression)
    // because skip/take combined with the joins below routes through TypeORM's
    // raw-query pagination path, which cannot resolve an inline expression's alias
    // there.
    const records = await base()
      .leftJoinAndSelect('item.addedBy', 'addedBy')
      .leftJoinAndSelect('item.media', 'media')
      .addSelect(
        'CASE WHEN item.pinnedAt IS NULL THEN 1 ELSE 0 END',
        'pinned_order'
      )
      .orderBy('pinned_order', 'ASC')
      .addOrderBy('item.pinnedAt', 'DESC')
      .addOrderBy('item.position', 'ASC')
      .addOrderBy('item.id', 'ASC')
      .skip(skip)
      .take(take)
      .getMany();

    return {
      items: records.map((record) => toMediaListItem(record, listId)),
      total,
    };
  }

  public async findInList(
    listId: number,
    tmdbId: number,
    mediaType: MediaType
  ): Promise<MediaListItem | null> {
    const record = await getRepository(MediaListItemRecord).findOne({
      where: { list: { id: listId }, tmdbId, mediaType },
      relations: { addedBy: true, media: true },
    });
    return record ? toMediaListItem(record, listId) : null;
  }

  public async add(input: AddMediaListItemInput): Promise<MediaListItem> {
    const itemRepository = getRepository(MediaListItemRecord);
    const mediaRepository = getRepository(Media);

    const [list, addedBy] = await Promise.all([
      getRepository(MediaListRecord).findOneOrFail({
        where: { id: input.listId },
      }),
      getRepository(User).findOneOrFail({ where: { id: input.addedById } }),
    ]);

    // Media is the shared record for a title across requests, issues and lists, so reuse
    // the existing row when there is one. Same find-or-create idiom as Watchlist.
    let media = await mediaRepository.findOne({
      where: { tmdbId: input.tmdbId, mediaType: input.mediaType },
    });
    if (!media) {
      media = await mediaRepository.save(
        new Media({ tmdbId: input.tmdbId, mediaType: input.mediaType })
      );
    }

    const highest = await itemRepository
      .createQueryBuilder('item')
      .select('MAX(item.position)', 'max')
      .where('item.listId = :listId', { listId: input.listId })
      .getRawOne<{ max: number | null }>();

    try {
      const saved = await itemRepository.save(
        new MediaListItemRecord({
          list,
          media,
          tmdbId: input.tmdbId,
          mediaType: input.mediaType,
          position: (highest?.max ?? -1) + 1,
          addedBy,
        })
      );

      return toMediaListItem(saved, input.listId);
    } catch (error) {
      rethrowAsDomainError(error, new DuplicateMediaListItemError());
    }
  }

  public async remove(itemId: number): Promise<void> {
    await getRepository(MediaListItemRecord).delete(itemId);
  }

  public async findItemsContaining(
    listIds: number[],
    tmdbId: number,
    mediaType: MediaType
  ): Promise<{ listId: number; itemId: number }[]> {
    if (listIds.length === 0) {
      return [];
    }

    // At most one row per list can match: (list, tmdbId, mediaType) is unique.
    const rows = await getRepository(MediaListItemRecord)
      .createQueryBuilder('item')
      .select('item.id', 'itemId')
      .addSelect('item.listId', 'listId')
      .where('item.listId IN (:...listIds)', { listIds })
      .andWhere('item.tmdbId = :tmdbId', { tmdbId })
      .andWhere('item.mediaType = :mediaType', { mediaType })
      .getRawMany<{ listId: number; itemId: number }>();

    return rows;
  }

  public async pin(itemId: number): Promise<void> {
    await getRepository(MediaListItemRecord).update(itemId, {
      pinnedAt: new Date(),
    });
  }

  public async unpin(itemId: number): Promise<void> {
    await getRepository(MediaListItemRecord).update(itemId, {
      pinnedAt: null,
    });
  }

  public async applyOrder(
    listId: number,
    orderedItemIds: number[]
  ): Promise<void> {
    // One transaction so a partial write cannot leave two items sharing a position.
    await getRepository(MediaListItemRecord).manager.transaction(
      async (manager) => {
        await Promise.all(
          orderedItemIds.map((itemId, index) =>
            manager.update(
              MediaListItemRecord,
              { id: itemId, list: { id: listId } },
              { position: index }
            )
          )
        );
      }
    );
  }
}
