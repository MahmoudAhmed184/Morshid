import type { ChatMessageDto } from './conversation-dto'
import type { ChatMessageRecord } from './conversation-records'

export abstract class ConversationMessagePresenter {
  abstract present(
    record: ChatMessageRecord,
    studentId: string,
  ): Promise<ChatMessageDto>

  abstract presentMany(
    records: readonly ChatMessageRecord[],
    studentId: string,
  ): Promise<ChatMessageDto[]>
}
