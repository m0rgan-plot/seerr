import { User } from '@server/entity/User';
import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import MediaListRecord from './MediaListRecord';

export type MediaListCollaboratorRoleValue = 'read' | 'write';

// The owner is never a row here. Ownership lives on MediaListRecord.owner, which is what
// keeps "only the author can delete" expressible without a role that outranks write.
@Entity('media_list_collaborator')
@Unique('UNIQUE_MEDIA_LIST_COLLABORATOR', ['list', 'user'])
export class MediaListCollaboratorRecord {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => MediaListRecord, {
    onDelete: 'CASCADE',
  })
  @Index()
  public list: MediaListRecord;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @Index()
  public user: User;

  @Column({ type: 'varchar' })
  public role: MediaListCollaboratorRoleValue;

  @ManyToOne(() => User, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @Index()
  public invitedBy?: User | null;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<MediaListCollaboratorRecord>) {
    Object.assign(this, init);
  }
}

export default MediaListCollaboratorRecord;
