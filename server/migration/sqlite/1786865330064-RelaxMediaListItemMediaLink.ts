import type { MigrationInterface, QueryRunner } from 'typeorm';

// Media rows are removed by routine admin actions such as blocklisting a title, and the
// cascade took the list entry and every member's watch history with them. The link is
// dropped instead, so a list keeps its entry when the shared media row goes away.
export class RelaxMediaListItemMediaLink1786865330064 implements MigrationInterface {
  name = 'RelaxMediaListItemMediaLink1786865330064';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_cd92fc3092244bf068dd64edb4"`);
    await queryRunner.query(`DROP INDEX "IDX_99d565b87305108df9fb113026"`);
    await queryRunner.query(`DROP INDEX "IDX_6b0c029895f842cbeb338b8221"`);
    await queryRunner.query(`DROP INDEX "IDX_c82b82dba0efeed68416ca4275"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_media_list_item" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL, "position" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "listId" integer, "mediaId" integer, "addedById" integer, CONSTRAINT "UNIQUE_MEDIA_LIST_ITEM" UNIQUE ("listId", "tmdbId", "mediaType"), CONSTRAINT "FK_cd92fc3092244bf068dd64edb42" FOREIGN KEY ("listId") REFERENCES "media_list" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_99d565b87305108df9fb1130266" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_c82b82dba0efeed68416ca42753" FOREIGN KEY ("addedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_media_list_item"("id", "tmdbId", "mediaType", "position", "createdAt", "updatedAt", "listId", "mediaId", "addedById") SELECT "id", "tmdbId", "mediaType", "position", "createdAt", "updatedAt", "listId", "mediaId", "addedById" FROM "media_list_item"`
    );
    await queryRunner.query(`DROP TABLE "media_list_item"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_media_list_item" RENAME TO "media_list_item"`
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rows orphaned while the link was relaxed would fail the restored constraint, so
    // they go before it is put back.
    await queryRunner.query(
      `DELETE FROM "media_list_item" WHERE "mediaId" IS NULL`
    );
    await queryRunner.query(`DROP INDEX "IDX_c82b82dba0efeed68416ca4275"`);
    await queryRunner.query(`DROP INDEX "IDX_6b0c029895f842cbeb338b8221"`);
    await queryRunner.query(`DROP INDEX "IDX_99d565b87305108df9fb113026"`);
    await queryRunner.query(`DROP INDEX "IDX_cd92fc3092244bf068dd64edb4"`);
    await queryRunner.query(
      `ALTER TABLE "media_list_item" RENAME TO "temporary_media_list_item"`
    );
    await queryRunner.query(
      `CREATE TABLE "media_list_item" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "tmdbId" integer NOT NULL, "mediaType" varchar NOT NULL, "position" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "listId" integer, "mediaId" integer, "addedById" integer, CONSTRAINT "UNIQUE_MEDIA_LIST_ITEM" UNIQUE ("listId", "tmdbId", "mediaType"), CONSTRAINT "FK_cd92fc3092244bf068dd64edb42" FOREIGN KEY ("listId") REFERENCES "media_list" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_99d565b87305108df9fb1130266" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c82b82dba0efeed68416ca42753" FOREIGN KEY ("addedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "media_list_item"("id", "tmdbId", "mediaType", "position", "createdAt", "updatedAt", "listId", "mediaId", "addedById") SELECT "id", "tmdbId", "mediaType", "position", "createdAt", "updatedAt", "listId", "mediaId", "addedById" FROM "temporary_media_list_item"`
    );
    await queryRunner.query(`DROP TABLE "temporary_media_list_item"`);
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
  }
}
