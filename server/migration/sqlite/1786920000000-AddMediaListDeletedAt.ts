import type { MigrationInterface, QueryRunner } from 'typeorm';

// Deleting a list is a soft delete: the row is kept and this column is stamped instead,
// so every existing find()/findOne() on MediaListRecord already excludes it automatically.
export class AddMediaListDeletedAt1786920000000 implements MigrationInterface {
  name = 'AddMediaListDeletedAt1786920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_list" ADD COLUMN "deletedAt" datetime`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media_list" DROP COLUMN "deletedAt"`);
  }
}
