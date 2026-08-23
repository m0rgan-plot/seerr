import type { MigrationInterface, QueryRunner } from 'typeorm';

// Constraint and index names here are the ones TypeORM derives from the entities, so a
// later synchronize sees no drift. They match the sqlite migration of the same name.
export class AddMediaListTables1786742098713 implements MigrationInterface {
  name = 'AddMediaListTables1786742098713';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "media_list" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerId" integer, CONSTRAINT "PK_2e180cc7c37aafcad088e189c8f" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_481041708fdf4cef2064093245" ON "media_list" ("ownerId")`
    );

    await queryRunner.query(
      `CREATE TABLE "media_list_item" ("id" SERIAL NOT NULL, "tmdbId" integer NOT NULL, "mediaType" character varying NOT NULL, "position" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "listId" integer, "mediaId" integer, "addedById" integer, CONSTRAINT "UNIQUE_MEDIA_LIST_ITEM" UNIQUE ("listId", "tmdbId", "mediaType"), CONSTRAINT "PK_ff5fd258bf261d96d34a2246495" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cd92fc3092244bf068dd64edb4" ON "media_list_item" ("listId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_99d565b87305108df9fb113026" ON "media_list_item" ("mediaId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6b0c029895f842cbeb338b8221" ON "media_list_item" ("tmdbId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c82b82dba0efeed68416ca4275" ON "media_list_item" ("addedById")`
    );

    await queryRunner.query(
      `CREATE TABLE "media_list_collaborator" ("id" SERIAL NOT NULL, "role" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "listId" integer, "userId" integer, "invitedById" integer, CONSTRAINT "UNIQUE_MEDIA_LIST_COLLABORATOR" UNIQUE ("listId", "userId"), CONSTRAINT "PK_bf74b9fe9b5c4832ea6d2672d24" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_be7c32166e3d418e30028cb106" ON "media_list_collaborator" ("listId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e9063af3a1d36a7613ebeb4931" ON "media_list_collaborator" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e6e16686d8f23ebdae3993b1f8" ON "media_list_collaborator" ("invitedById")`
    );

    await queryRunner.query(
      `CREATE TABLE "media_list_item_watch" ("id" SERIAL NOT NULL, "watchedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "listItemId" integer, "userId" integer, CONSTRAINT "UNIQUE_MEDIA_LIST_ITEM_WATCH" UNIQUE ("listItemId", "userId"), CONSTRAINT "PK_b959f95216b05e5bd0c3f2ea071" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d5cffc7e12d0f6e6b93485bc3b" ON "media_list_item_watch" ("listItemId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1ce0a26360322b76d73430ac0d" ON "media_list_item_watch" ("userId")`
    );

    await queryRunner.query(
      `CREATE TABLE "media_list_episode_watch" ("id" SERIAL NOT NULL, "seasonNumber" integer NOT NULL, "episodeNumber" integer NOT NULL, "watchedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "listItemId" integer, "userId" integer, CONSTRAINT "UNIQUE_MEDIA_LIST_EPISODE_WATCH" UNIQUE ("listItemId", "userId", "seasonNumber", "episodeNumber"), CONSTRAINT "PK_24f8bbd734a56932e0ac44eff76" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0c4fee8ccdbefc65890d6bfd63" ON "media_list_episode_watch" ("listItemId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a30bae870c6cbb64a7e6fce827" ON "media_list_episode_watch" ("userId")`
    );

    await queryRunner.query(
      `ALTER TABLE "media_list" ADD CONSTRAINT "FK_481041708fdf4cef2064093245a" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_item" ADD CONSTRAINT "FK_cd92fc3092244bf068dd64edb42" FOREIGN KEY ("listId") REFERENCES "media_list"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_item" ADD CONSTRAINT "FK_99d565b87305108df9fb1130266" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_item" ADD CONSTRAINT "FK_c82b82dba0efeed68416ca42753" FOREIGN KEY ("addedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_collaborator" ADD CONSTRAINT "FK_be7c32166e3d418e30028cb106a" FOREIGN KEY ("listId") REFERENCES "media_list"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_collaborator" ADD CONSTRAINT "FK_e9063af3a1d36a7613ebeb4931f" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_collaborator" ADD CONSTRAINT "FK_e6e16686d8f23ebdae3993b1f82" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_item_watch" ADD CONSTRAINT "FK_d5cffc7e12d0f6e6b93485bc3b9" FOREIGN KEY ("listItemId") REFERENCES "media_list_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_item_watch" ADD CONSTRAINT "FK_1ce0a26360322b76d73430ac0dd" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_episode_watch" ADD CONSTRAINT "FK_0c4fee8ccdbefc65890d6bfd635" FOREIGN KEY ("listItemId") REFERENCES "media_list_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_episode_watch" ADD CONSTRAINT "FK_a30bae870c6cbb64a7e6fce827d" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_list_episode_watch" DROP CONSTRAINT "FK_a30bae870c6cbb64a7e6fce827d"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_episode_watch" DROP CONSTRAINT "FK_0c4fee8ccdbefc65890d6bfd635"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_item_watch" DROP CONSTRAINT "FK_1ce0a26360322b76d73430ac0dd"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_item_watch" DROP CONSTRAINT "FK_d5cffc7e12d0f6e6b93485bc3b9"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_collaborator" DROP CONSTRAINT "FK_e6e16686d8f23ebdae3993b1f82"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_collaborator" DROP CONSTRAINT "FK_e9063af3a1d36a7613ebeb4931f"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_collaborator" DROP CONSTRAINT "FK_be7c32166e3d418e30028cb106a"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_item" DROP CONSTRAINT "FK_c82b82dba0efeed68416ca42753"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_item" DROP CONSTRAINT "FK_99d565b87305108df9fb1130266"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_item" DROP CONSTRAINT "FK_cd92fc3092244bf068dd64edb42"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list" DROP CONSTRAINT "FK_481041708fdf4cef2064093245a"`
    );

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
