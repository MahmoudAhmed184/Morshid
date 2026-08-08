import { NotFoundException } from '@nestjs/common'

export function notificationNotFoundException() {
  return new NotFoundException({
    code: 'NOTIFICATION_NOT_FOUND',
    message: 'Notification was not found',
  })
}
