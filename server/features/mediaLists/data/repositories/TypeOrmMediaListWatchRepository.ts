import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import MediaListEpisodeWatchRecord from '@server/features/mediaLists/data/orm/MediaListEpisodeWatchRecord';
import MediaListItemRecord from '@server/features/mediaLists/data/orm/MediaListItemRecord';
import MediaListItemWatchRecord from '@server/features/mediaLists/data/orm/MediaListItemWatchRecord';
import type { MediaListWatchRepository } from '@server/features/mediaLists/domain/repositories/MediaListWatchRepository';
import type { EpisodeRef } from '@server/features/mediaLists/domain/valueObjects/WatchProgress';
import { In } from 'typeorm';

export class TypeOrmMediaListWatchRepository implements MediaListWatchRepository {
  public async isMovieWatched(
    itemId: number,
    userId: number
  ): Promise<boolean> {
    const count = await getRepository(MediaListItemWatchRecord).count({
      where: { listItem: { id: itemId }, user: { id: userId } },
    });
    return count > 0;
  }

  public async setMovieWatched(itemId: number, userId: number): Promise<void> {
    const repository = getRepository(MediaListItemWatchRecord);
    const existing = await repository.findOne({
      where: { listItem: { id: itemId }, user: { id: userId } },
    });
    if (existing) {
      return;
    }

    const [listItem, user] = await Promise.all([
      getRepository(MediaListItemRecord).findOneOrFail({
        where: { id: itemId },
      }),
      getRepository(User).findOneOrFail({ where: { id: userId } }),
    ]);

    await repository.save(new MediaListItemWatchRecord({ listItem, user }));
  }

  public async clearMovieWatched(
    itemId: number,
    userId: number
  ): Promise<void> {
    await getRepository(MediaListItemWatchRecord).delete({
      listItem: { id: itemId },
      user: { id: userId },
    });
  }

  public async findWatchedEpisodes(
    itemId: number,
    userId: number
  ): Promise<EpisodeRef[]> {
    const records = await getRepository(MediaListEpisodeWatchRecord).find({
      where: { listItem: { id: itemId }, user: { id: userId } },
      order: { seasonNumber: 'ASC', episodeNumber: 'ASC' },
    });

    return records.map((record) => ({
      seasonNumber: record.seasonNumber,
      episodeNumber: record.episodeNumber,
    }));
  }

  public async setEpisodesWatched(
    itemId: number,
    userId: number,
    episodes: EpisodeRef[]
  ): Promise<void> {
    if (episodes.length === 0) {
      return;
    }

    const repository = getRepository(MediaListEpisodeWatchRecord);
    const already = await this.findWatchedEpisodes(itemId, userId);
    const seen = new Set(
      already.map(
        (episode) => `${episode.seasonNumber}:${episode.episodeNumber}`
      )
    );

    const missing = episodes.filter(
      (episode) => !seen.has(`${episode.seasonNumber}:${episode.episodeNumber}`)
    );
    if (missing.length === 0) {
      return;
    }

    const [listItem, user] = await Promise.all([
      getRepository(MediaListItemRecord).findOneOrFail({
        where: { id: itemId },
      }),
      getRepository(User).findOneOrFail({ where: { id: userId } }),
    ]);

    await repository.save(
      missing.map(
        (episode) =>
          new MediaListEpisodeWatchRecord({
            listItem,
            user,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber,
          })
      )
    );
  }

  public async clearEpisodesWatched(
    itemId: number,
    userId: number,
    episodes: EpisodeRef[]
  ): Promise<void> {
    if (episodes.length === 0) {
      return;
    }

    // Grouped by season so a whole season clears in one statement instead of one per
    // episode, which matters for the mark-all-unseen action on a long run.
    const bySeason = new Map<number, number[]>();
    episodes.forEach((episode) => {
      const current = bySeason.get(episode.seasonNumber) ?? [];
      current.push(episode.episodeNumber);
      bySeason.set(episode.seasonNumber, current);
    });

    const repository = getRepository(MediaListEpisodeWatchRecord);
    for (const [seasonNumber, episodeNumbers] of bySeason) {
      await repository.delete({
        listItem: { id: itemId },
        user: { id: userId },
        seasonNumber,
        episodeNumber: In(episodeNumbers),
      });
    }
  }

  public async clearSeasonWatched(
    itemId: number,
    userId: number,
    seasonNumber: number
  ): Promise<void> {
    await getRepository(MediaListEpisodeWatchRecord).delete({
      listItem: { id: itemId },
      user: { id: userId },
      seasonNumber,
    });
  }

  public async findUsersWhoWatchedMovie(itemId: number): Promise<number[]> {
    const records = await getRepository(MediaListItemWatchRecord).find({
      where: { listItem: { id: itemId } },
      relations: { user: true },
    });
    return records.map((record) => record.user.id);
  }

  public async findWatchedEpisodeCountsByUser(
    itemId: number
  ): Promise<{ userId: number; episodes: EpisodeRef[] }[]> {
    const records = await getRepository(MediaListEpisodeWatchRecord).find({
      where: { listItem: { id: itemId } },
      relations: { user: true },
    });

    const byUser = new Map<number, EpisodeRef[]>();
    records.forEach((record) => {
      const episodes = byUser.get(record.user.id) ?? [];
      episodes.push({
        seasonNumber: record.seasonNumber,
        episodeNumber: record.episodeNumber,
      });
      byUser.set(record.user.id, episodes);
    });

    return [...byUser.entries()].map(([userId, episodes]) => ({
      userId,
      episodes,
    }));
  }
}
