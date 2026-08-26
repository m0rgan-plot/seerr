import type { MediaType } from '@server/constants/media';
import Media from '@server/entity/Media';
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

@Entity('media_list_item')
@Unique('UNIQUE_MEDIA_LIST_ITEM', ['list', 'tmdbId', 'mediaType'])
export class MediaListItemRecord {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => MediaListRecord, {
    onDelete: 'CASCADE',
  })
  @Index()
  public list: MediaListRecord;

  // Media is shared with requests and issues and is deleted by routine admin actions
  // such as blocklisting. Cascading from there would take the list entry with it, and
  // with it every member's episode history, so the link is dropped instead.
  @ManyToOne(() => Media, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @Index()
  public media?: Media | null;

  @Column()
  @Index()
  public tmdbId: number;

  @Column({ type: 'varchar' })
  public mediaType: MediaType;

  // Manual ordering within the list. Resequenced as a block by the reorder endpoint.
  @Column({ type: 'int', default: 0 })
  public position: number;

  // Null unless pinned. Non-null sorts a title to the top of the list ahead of
  // `position`, and its value is the tie-breaker between more than one pinned item.
  @DbAwareColumn({ type: 'datetime', nullable: true })
  public pinnedAt: Date | null;

  // Null once the adding user is deleted. The item itself stays in the list.
  @ManyToOne(() => User, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @Index()
  public addedBy?: User | null;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<MediaListItemRecord>) {
    Object.assign(this, init);
  }
}

export default MediaListItemRecord;
