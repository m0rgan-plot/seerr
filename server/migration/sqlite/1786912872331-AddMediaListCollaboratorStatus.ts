import type { MigrationInterface, QueryRunner } from 'typeorm';

// Every pre-existing row was granted access instantly under the old sharing semantics, so
// it is backfilled as already accepted. Only rows created after this migration start out
// pending and require the invited user to accept.
export class AddMediaListCollaboratorStatus1786912872331 implements MigrationInterface {
  name = 'AddMediaListCollaboratorStatus1786912872331';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_list_collaborator" ADD COLUMN "status" varchar NOT NULL DEFAULT ('pending')`
    );
    await queryRunner.query(
      `UPDATE "media_list_collaborator" SET "status" = 'accepted'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_list_collaborator" DROP COLUMN "status"`
    );
  }
}
