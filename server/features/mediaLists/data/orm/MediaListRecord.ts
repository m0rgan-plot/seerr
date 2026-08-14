import { User } from '@server/entity/User';
import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Persistence model. The domain entity of the same concept lives in
// ../../domain/entities/MediaList.ts and never carries TypeORM metadata.
@Entity('media_list')
export class MediaListRecord {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'varchar' })
  public name: string;

  @Column({ type: 'varchar', nullable: true })
  public description?: string | null;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @Index()
  public owner: User;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<MediaListRecord>) {
    Object.assign(this, init);
  }
}

export default MediaListRecord;
