import type { MigrationInterface, QueryRunner } from 'typeorm';

// Media rows are removed by routine admin actions such as blocklisting a title, and the
// cascade took the list entry and every member's watch history with them. The link is
// dropped instead, so a list keeps its entry when the shared media row goes away.
export class RelaxMediaListItemMediaLink1786865390064 implements MigrationInterface {
  name = 'RelaxMediaListItemMediaLink1786865390064';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_list_item" DROP CONSTRAINT "FK_99d565b87305108df9fb1130266"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_item" ADD CONSTRAINT "FK_99d565b87305108df9fb1130266" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rows orphaned while the link was relaxed would fail the restored constraint, so
    // they go before it is put back.
    await queryRunner.query(
      `DELETE FROM "media_list_item" WHERE "mediaId" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_item" DROP CONSTRAINT "FK_99d565b87305108df9fb1130266"`
    );
    await queryRunner.query(
      `ALTER TABLE "media_list_item" ADD CONSTRAINT "FK_99d565b87305108df9fb1130266" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }
}
