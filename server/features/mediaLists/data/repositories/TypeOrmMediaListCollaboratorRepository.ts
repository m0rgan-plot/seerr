import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import {
  toCollaborator,
  toCollaboratorRole,
} from '@server/features/mediaLists/data/mappers/collaboratorMapper';
import MediaListCollaboratorRecord from '@server/features/mediaLists/data/orm/MediaListCollaboratorRecord';
import MediaListRecord from '@server/features/mediaLists/data/orm/MediaListRecord';
import { rethrowAsDomainError } from '@server/features/mediaLists/data/repositories/constraintErrors';
import type { Collaborator } from '@server/features/mediaLists/domain/entities/Collaborator';
import { DuplicateCollaboratorError } from '@server/features/mediaLists/domain/errors/MediaListErrors';
import type { MediaListCollaboratorRepository } from '@server/features/mediaLists/domain/repositories/MediaListCollaboratorRepository';
import type { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import { In } from 'typeorm';

export class TypeOrmMediaListCollaboratorRepository implements MediaListCollaboratorRepository {
  public async findByList(listId: number): Promise<Collaborator[]> {
    const records = await getRepository(MediaListCollaboratorRecord).find({
      where: { list: { id: listId } },
      relations: { user: true, invitedBy: true },
      order: { createdAt: 'ASC' },
    });
    return records.map(toCollaborator);
  }

  // One query for every list the caller can see, rather than one per list, which is
  // what the index summary needs to avoid deepening its documented N+1.
  public async findByLists(
    listIds: number[]
  ): Promise<Map<number, Collaborator[]>> {
    const byList = new Map<number, Collaborator[]>();
    if (listIds.length === 0) {
      return byList;
    }

    const records = await getRepository(MediaListCollaboratorRecord).find({
      where: { list: { id: In(listIds) } },
      relations: { user: true, invitedBy: true, list: true },
      order: { createdAt: 'ASC' },
    });

    records.forEach((record) => {
      const collaborators = byList.get(record.list.id) ?? [];
      collaborators.push(toCollaborator(record));
      byList.set(record.list.id, collaborators);
    });

    return byList;
  }

  public async findRole(
    listId: number,
    userId: number
  ): Promise<CollaboratorRole | null> {
    const record = await getRepository(MediaListCollaboratorRecord).findOne({
      where: { list: { id: listId }, user: { id: userId } },
      select: { id: true, role: true },
    });
    return record ? toCollaboratorRole(record.role) : null;
  }

  public async add(input: {
    listId: number;
    userId: number;
    role: CollaboratorRole;
    invitedById: number;
  }): Promise<Collaborator> {
    const userRepository = getRepository(User);
    const [list, user, invitedBy] = await Promise.all([
      getRepository(MediaListRecord).findOneOrFail({
        where: { id: input.listId },
      }),
      userRepository.findOneOrFail({ where: { id: input.userId } }),
      userRepository.findOneOrFail({ where: { id: input.invitedById } }),
    ]);

    try {
      const saved = await getRepository(MediaListCollaboratorRecord).save(
        new MediaListCollaboratorRecord({
          list,
          user,
          role: input.role,
          invitedBy,
        })
      );

      return toCollaborator(saved);
    } catch (error) {
      rethrowAsDomainError(error, new DuplicateCollaboratorError());
    }
  }

  public async updateRole(
    listId: number,
    userId: number,
    role: CollaboratorRole
  ): Promise<Collaborator> {
    const repository = getRepository(MediaListCollaboratorRecord);
    const record = await repository.findOneOrFail({
      where: { list: { id: listId }, user: { id: userId } },
      relations: { user: true, invitedBy: true },
    });

    record.role = role;
    return toCollaborator(await repository.save(record));
  }

  public async remove(listId: number, userId: number): Promise<void> {
    await getRepository(MediaListCollaboratorRecord).delete({
      list: { id: listId },
      user: { id: userId },
    });
  }
}
