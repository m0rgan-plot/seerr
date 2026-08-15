import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { toUserRef } from '@server/features/mediaLists/data/mappers/userRefMapper';
import type { UserDirectory } from '@server/features/mediaLists/domain/ports/UserDirectory';
import type { UserRef } from '@server/features/mediaLists/domain/valueObjects/UserRef';

export class TypeOrmUserDirectory implements UserDirectory {
  public async findById(userId: number): Promise<UserRef | null> {
    const user = await getRepository(User).findOne({ where: { id: userId } });
    return user ? toUserRef(user) : null;
  }
}
