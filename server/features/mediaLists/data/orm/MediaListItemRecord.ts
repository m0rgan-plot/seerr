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

  @ManyToOne(() => Media, {
    onDelete: 'CASCADE',
  })
  @Index()
  public media: Media;

  @Column()
  @Index()
  public tmdbId: number;

  @Column({ type: 'varchar' })
  public mediaType: MediaType;

  // Manual ordering within the list. Resequenced as a block by the reorder endpoint.
  @Column({ type: 'int', default: 0 })
  public position: number;

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
