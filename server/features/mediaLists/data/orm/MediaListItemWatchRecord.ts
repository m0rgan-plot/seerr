import { User } from '@server/entity/User';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import MediaListItemRecord from './MediaListItemRecord';

// One row per (movie item, user) means that user has seen it. Absence means unseen,
// so unmarking deletes the row rather than flipping a flag. Shows track completion
// through MediaListEpisodeWatchRecord instead and never get a row here.
@Entity('media_list_item_watch')
@Unique('UNIQUE_MEDIA_LIST_ITEM_WATCH', ['listItem', 'user'])
export class MediaListItemWatchRecord {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => MediaListItemRecord, {
    onDelete: 'CASCADE',
  })
  @Index()
  public listItem: MediaListItemRecord;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @Index()
  public user: User;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public watchedAt: Date;

  constructor(init?: Partial<MediaListItemWatchRecord>) {
    Object.assign(this, init);
  }
}

export default MediaListItemWatchRecord;
