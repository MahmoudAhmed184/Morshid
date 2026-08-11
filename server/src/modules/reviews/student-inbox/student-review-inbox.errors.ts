import { NotFoundException } from '@nestjs/common'

export function reviewInboxItemNotFoundException() {
  return new NotFoundException({
    code: 'REVIEW_INBOX_ITEM_NOT_FOUND',
    message: 'Review Inbox item was not found',
  })
}
