-- AlterTable
ALTER TABLE "messages"
  ADD COLUMN "turn_id" UUID,
  ADD COLUMN "topic_id" UUID;

-- CreateIndex
CREATE INDEX "idx_messages_turn" ON "messages"("turn_id");

-- CreateIndex
CREATE INDEX "idx_messages_topic" ON "messages"("topic_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_turn_id_fkey" FOREIGN KEY ("turn_id") REFERENCES "tutor_turns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
