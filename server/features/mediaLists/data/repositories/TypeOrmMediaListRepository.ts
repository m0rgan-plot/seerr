import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { toMediaList } from '@server/features/mediaLists/data/mappers/mediaListMapper';
import MediaListCollaboratorRecord from '@server/features/mediaLists/data/orm/MediaListCollaboratorRecord';
import MediaListRecord from '@server/features/mediaLists/data/orm/MediaListRecord';
import type { MediaList } from '@server/features/mediaLists/domain/entities/MediaList';
import type {
  CreateMediaListInput,
  MediaListRepository,
  UpdateMediaListInput,
} from '@server/features/mediaLists/domain/repositories/MediaListRepository';

export class TypeOrmMediaListRepository implements MediaListRepository {
  public async findById(id: number): Promise<MediaList | null> {
    const record = await getRepository(MediaListRecord).findOne({
      where: { id },
      relations: { owner: true },
    });
    return record ? toMediaList(record) : null;
  }

  public async findAccessibleTo(userId: number): Promise<MediaList[]> {
    // Owned lists and shared ones come back together so the index page is a single query.
    const records = await getRepository(MediaListRecord)
      .createQueryBuilder('list')
      .innerJoinAndSelect('list.owner', 'owner')
      .leftJoin(
        MediaListCollaboratorRecord,
        'collaborator',
        'collaborator.listId = list.id AND collaborator.userId = :userId',
        { userId }
      )
      .where('owner.id = :userId', { userId })
      .orWhere('collaborator.id IS NOT NULL')
      .orderBy('list.updatedAt', 'DESC')
      .getMany();

    return records.map(toMediaList);
  }

  public async create(input: CreateMediaListInput): Promise<MediaList> {
    const owner = await getRepository(User).findOneOrFail({
      where: { id: input.ownerId },
    });

    const saved = await getRepository(MediaListRecord).save(
      new MediaListRecord({
        name: input.name,
        description: input.description,
        owner,
      })
    );

    return toMediaList(saved);
  }

  public async update(
    id: number,
    changes: UpdateMediaListInput
  ): Promise<MediaList> {
    const repository = getRepository(MediaListRecord);
    const record = await repository.findOneOrFail({
      where: { id },
      relations: { owner: true },
    });

    if (changes.name !== undefined) {
      record.name = changes.name;
    }
    if (changes.description !== undefined) {
      record.description = changes.description;
    }

    return toMediaList(await repository.save(record));
  }

  public async delete(id: number): Promise<void> {
    await getRepository(MediaListRecord).delete(id);
  }
}
