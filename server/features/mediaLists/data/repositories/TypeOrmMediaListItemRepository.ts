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
    const records = await getRepository(MediaListItemRecord).find({
      where: { list: { id: listId } },
      // The media row carries the library status the cards need, and it is a join on a
      // query that already runs rather than a lookup per title.
      relations: { addedBy: true, media: true },
      order: { position: 'ASC', id: 'ASC' },
    });
    return records.map((record) => toMediaListItem(record, listId));
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

  public async findListIdsContaining(
    listIds: number[],
    tmdbId: number,
    mediaType: MediaType
  ): Promise<number[]> {
    if (listIds.length === 0) {
      return [];
    }

    const rows = await getRepository(MediaListItemRecord)
      .createQueryBuilder('item')
      .select('DISTINCT item.listId', 'listId')
      .where('item.listId IN (:...listIds)', { listIds })
      .andWhere('item.tmdbId = :tmdbId', { tmdbId })
      .andWhere('item.mediaType = :mediaType', { mediaType })
      .getRawMany<{ listId: number }>();

    return rows.map((row) => row.listId);
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
