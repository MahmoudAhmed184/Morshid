/*
  Warnings:

  - A unique constraint covering the columns `[response_to_message_id]` on the table `messages` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "idx_messages_response_to";

-- CreateIndex
CREATE UNIQUE INDEX "messages_response_to_message_id_key" ON "messages"("response_to_message_id");
