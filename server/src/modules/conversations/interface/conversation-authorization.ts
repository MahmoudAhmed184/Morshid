export interface ConversationAuthorizationInput {
  readonly courseId: string
  readonly sessionId: string
  readonly studentId: string
}

export interface LockedConversationSession {
  readonly id: string
  readonly courseId: string
  readonly studentId: string
  readonly lastSequence: number
  readonly deletedAt: Date | null
}

export type ConversationAuthorizationResult =
  | { readonly kind: 'ok'; readonly session: LockedConversationSession }
  | { readonly kind: 'membership_missing' }
  | { readonly kind: 'session_not_found' }
