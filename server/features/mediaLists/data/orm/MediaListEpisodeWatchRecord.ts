import { User } from '@server/entity/User';
import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import MediaListItemRecord from './MediaListItemRecord';

// One row per (show item, user, season, episode) means that user has seen that episode.
// Season and show completion are derived by counting these against the episode totals
// TMDB reports, so nothing here goes stale when a season later gains an episode.
// Only numbers are stored, never titles, matching Season/SeasonRequest.
@Entity('media_list_episode_watch')
@Unique('UNIQUE_MEDIA_LIST_EPISODE_WATCH', [
  'listItem',
  'user',
  'seasonNumber',
  'episodeNumber',
])
export class MediaListEpisodeWatchRecord {
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

  @Column()
  public seasonNumber: number;

  @Column()
  public episodeNumber: number;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public watchedAt: Date;

  constructor(init?: Partial<MediaListEpisodeWatchRecord>) {
    Object.assign(this, init);
  }
}

export default MediaListEpisodeWatchRecord;
