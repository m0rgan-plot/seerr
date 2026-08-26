import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import {
  toCollaborator,
  toCollaboratorRole,
} from '@server/features/mediaLists/data/mappers/collaboratorMapper';
import { toMediaList } from '@server/features/mediaLists/data/mappers/mediaListMapper';
import { toOptionalUserRef } from '@server/features/mediaLists/data/mappers/userRefMapper';
import MediaListCollaboratorRecord from '@server/features/mediaLists/data/orm/MediaListCollaboratorRecord';
import MediaListRecord from '@server/features/mediaLists/data/orm/MediaListRecord';
import { rethrowAsDomainError } from '@server/features/mediaLists/data/repositories/constraintErrors';
import type { Collaborator } from '@server/features/mediaLists/domain/entities/Collaborator';
import type { MediaListInvite } from '@server/features/mediaLists/domain/entities/MediaListInvite';
import { DuplicateCollaboratorError } from '@server/features/mediaLists/domain/errors/MediaListErrors';
import type { MediaListCollaboratorRepository } from '@server/features/mediaLists/domain/repositories/MediaListCollaboratorRepository';
import type { CollaboratorRole } from '@server/features/mediaLists/domain/valueObjects/CollaboratorRole';
import { InviteStatus } from '@server/features/mediaLists/domain/valueObjects/InviteStatus';
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
  // what the index summary needs to avoid deepening its documented N+1. Accepted only:
  // this feeds the "shared with" avatars, and a pending invitee hasn't joined the list
  // yet, so showing their avatar there would say more than is true.
  public async findByLists(
    listIds: number[]
  ): Promise<Map<number, Collaborator[]>> {
    const byList = new Map<number, Collaborator[]>();
    if (listIds.length === 0) {
      return byList;
    }

    const records = await getRepository(MediaListCollaboratorRecord).find({
      where: { list: { id: In(listIds) }, status: InviteStatus.ACCEPTED },
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

  public async findAcceptedRole(
    listId: number,
    userId: number
  ): Promise<CollaboratorRole | null> {
    const record = await getRepository(MediaListCollaboratorRecord).findOne({
      where: {
        list: { id: listId },
        user: { id: userId },
        status: InviteStatus.ACCEPTED,
      },
      select: { id: true, role: true },
    });
    return record ? toCollaboratorRole(record.role) : null;
  }

  public async findPendingInvite(
    listId: number,
    userId: number
  ): Promise<Collaborator | null> {
    const record = await getRepository(MediaListCollaboratorRecord).findOne({
      where: {
        list: { id: listId },
        user: { id: userId },
        status: InviteStatus.PENDING,
      },
      relations: { user: true, invitedBy: true },
    });
    return record ? toCollaborator(record) : null;
  }

  public async findPendingInvitesFor(
    userId: number
  ): Promise<MediaListInvite[]> {
    const records = await getRepository(MediaListCollaboratorRecord).find({
      where: { user: { id: userId }, status: InviteStatus.PENDING },
      relations: { list: { owner: true }, invitedBy: true },
      order: { createdAt: 'DESC' },
    });

    return records.map((record) => ({
      list: toMediaList(record.list),
      role: toCollaboratorRole(record.role),
      invitedBy: toOptionalUserRef(record.invitedBy),
      createdAt: record.createdAt,
    }));
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
          status: InviteStatus.PENDING,
          invitedBy,
        })
      );

      return toCollaborator(saved);
    } catch (error) {
      rethrowAsDomainError(error, new DuplicateCollaboratorError());
    }
  }

  public async accept(listId: number, userId: number): Promise<Collaborator> {
    const repository = getRepository(MediaListCollaboratorRecord);
    const record = await repository.findOneOrFail({
      where: { list: { id: listId }, user: { id: userId } },
      relations: { user: true, invitedBy: true },
    });

    record.status = InviteStatus.ACCEPTED;
    return toCollaborator(await repository.save(record));
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
