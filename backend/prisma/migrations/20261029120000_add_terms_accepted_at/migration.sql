-- AlterTable: when the user last accepted the Terms of Use (null = never; they see the agreement sheet on next sign-in)
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" TIMESTAMP(3);
