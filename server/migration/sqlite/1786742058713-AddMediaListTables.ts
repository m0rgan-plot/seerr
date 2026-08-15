import type { MigrationInterface, QueryRunner } from 'typeorm';

// Only new tables are added here. The generated output also rebuilt user_push_subscription
// and created each table twice (once bare, once with its foreign keys) because sqlite cannot
// add constraints in place. Neither is needed for tables that do not exist yet, so the
// creates below carry their foreign keys inline. Constraint and index names match what
// TypeORM derives from the entities, so a later synchronize sees no drift.
export class AddMediaListTables1786742058713 implements MigrationInterface {
  name = 'AddMediaListTables1786742058713';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "media_list" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "name" varchar NOT NULL, "description" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "ownerId" integer, CONSTRAINT "FK_481041708fdf4cef2064093245a" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_481041708fdf4cef2064093245" ON "media_list" ("ownerId") `
    );

    await queryRunner.query(
      `CREATE TABLE "media_list_item" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL, "position" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "listId" integer, "mediaId" integer, "addedById" integer, CONSTRAINT "UNIQUE_MEDIA_LIST_ITEM" UNIQUE ("listId", "tmdbId", "mediaType"), CONSTRAINT "FK_cd92fc3092244bf068dd64edb42" FOREIGN KEY ("listId") REFERENCES "media_list" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_99d565b87305108df9fb1130266" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c82b82dba0efeed68416ca42753" FOREIGN KEY ("addedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cd92fc3092244bf068dd64edb4" ON "media_list_item" ("listId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_99d565b87305108df9fb113026" ON "media_list_item" ("mediaId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6b0c029895f842cbeb338b8221" ON "media_list_item" ("tmdbId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c82b82dba0efeed68416ca4275" ON "media_list_item" ("addedById") `
    );

    await queryRunner.query(
      `CREATE TABLE "media_list_collaborator" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "role" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "listId" integer, "userId" integer, "invitedById" integer, CONSTRAINT "UNIQUE_MEDIA_LIST_COLLABORATOR" UNIQUE ("listId", "userId"), CONSTRAINT "FK_be7c32166e3d418e30028cb106a" FOREIGN KEY ("listId") REFERENCES "media_list" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e9063af3a1d36a7613ebeb4931f" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e6e16686d8f23ebdae3993b1f82" FOREIGN KEY ("invitedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_be7c32166e3d418e30028cb106" ON "media_list_collaborator" ("listId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e9063af3a1d36a7613ebeb4931" ON "media_list_collaborator" ("userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e6e16686d8f23ebdae3993b1f8" ON "media_list_collaborator" ("invitedById") `
    );

    await queryRunner.query(
      `CREATE TABLE "media_list_item_watch" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "watchedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "listItemId" integer, "userId" integer, CONSTRAINT "UNIQUE_MEDIA_LIST_ITEM_WATCH" UNIQUE ("listItemId", "userId"), CONSTRAINT "FK_d5cffc7e12d0f6e6b93485bc3b9" FOREIGN KEY ("listItemId") REFERENCES "media_list_item" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1ce0a26360322b76d73430ac0dd" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d5cffc7e12d0f6e6b93485bc3b" ON "media_list_item_watch" ("listItemId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1ce0a26360322b76d73430ac0d" ON "media_list_item_watch" ("userId") `
    );

    await queryRunner.query(
      `CREATE TABLE "media_list_episode_watch" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "seasonNumber" integer NOT NULL, "episodeNumber" integer NOT NULL, "watchedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "listItemId" integer, "userId" integer, CONSTRAINT "UNIQUE_MEDIA_LIST_EPISODE_WATCH" UNIQUE ("listItemId", "userId", "seasonNumber", "episodeNumber"), CONSTRAINT "FK_0c4fee8ccdbefc65890d6bfd635" FOREIGN KEY ("listItemId") REFERENCES "media_list_item" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a30bae870c6cbb64a7e6fce827d" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0c4fee8ccdbefc65890d6bfd63" ON "media_list_episode_watch" ("listItemId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a30bae870c6cbb64a7e6fce827" ON "media_list_episode_watch" ("userId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_a30bae870c6cbb64a7e6fce827"`);
    await queryRunner.query(`DROP INDEX "IDX_0c4fee8ccdbefc65890d6bfd63"`);
    await queryRunner.query(`DROP TABLE "media_list_episode_watch"`);

    await queryRunner.query(`DROP INDEX "IDX_1ce0a26360322b76d73430ac0d"`);
    await queryRunner.query(`DROP INDEX "IDX_d5cffc7e12d0f6e6b93485bc3b"`);
    await queryRunner.query(`DROP TABLE "media_list_item_watch"`);

    await queryRunner.query(`DROP INDEX "IDX_e6e16686d8f23ebdae3993b1f8"`);
    await queryRunner.query(`DROP INDEX "IDX_e9063af3a1d36a7613ebeb4931"`);
    await queryRunner.query(`DROP INDEX "IDX_be7c32166e3d418e30028cb106"`);
    await queryRunner.query(`DROP TABLE "media_list_collaborator"`);

    await queryRunner.query(`DROP INDEX "IDX_c82b82dba0efeed68416ca4275"`);
    await queryRunner.query(`DROP INDEX "IDX_6b0c029895f842cbeb338b8221"`);
    await queryRunner.query(`DROP INDEX "IDX_99d565b87305108df9fb113026"`);
    await queryRunner.query(`DROP INDEX "IDX_cd92fc3092244bf068dd64edb4"`);
    await queryRunner.query(`DROP TABLE "media_list_item"`);

    await queryRunner.query(`DROP INDEX "IDX_481041708fdf4cef2064093245"`);
    await queryRunner.query(`DROP TABLE "media_list"`);
  }
}
