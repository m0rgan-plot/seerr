import type { MigrationInterface, QueryRunner } from 'typeorm';

// Pinning a title stamps this column instead of storing a boolean, so the same value
// doubles as the tie-breaker when more than one item on a list is pinned.
export class AddMediaListItemPinnedAt1786930000100 implements MigrationInterface {
  name = 'AddMediaListItemPinnedAt1786930000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_list_item" ADD "pinnedAt" TIMESTAMP WITH TIME ZONE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_list_item" DROP COLUMN "pinnedAt"`
    );
  }
}
