import type { MigrationInterface, QueryRunner } from 'typeorm';

// Deleting a list is a soft delete: the row is kept and this column is stamped instead,
// so every existing find()/findOne() on MediaListRecord already excludes it automatically.
export class AddMediaListDeletedAt1786920000100 implements MigrationInterface {
  name = 'AddMediaListDeletedAt1786920000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_list" ADD "deletedAt" TIMESTAMP`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media_list" DROP COLUMN "deletedAt"`);
  }
}
