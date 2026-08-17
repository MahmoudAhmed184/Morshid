import { MessageGuidanceLabel, MessageRequestKind } from '../../tutoring-values'

export const CLASSIFIED_RESPONSE_POLICY_VERSION = 'socratic-classification.v1'

export const CLASSIFIED_RESPONSE_ERROR_CODE = {
  UNSAFE_REQUEST: 'SOCRATIC_UNSAFE_REQUEST',
  OFF_TOPIC_REQUEST: 'SOCRATIC_OFF_TOPIC_REQUEST',
} as const

export type ClassifiedResponseRequestKind = Extract<
  MessageRequestKind,
  'UNSAFE' | 'OFF_TOPIC'
>

export interface ClassifiedResponse {
  readonly requestKind: ClassifiedResponseRequestKind
  readonly content: string
  readonly guidanceLabel: MessageGuidanceLabel
  readonly errorCode: string
}

const classifiedResponses: Readonly<
  Record<ClassifiedResponseRequestKind, ClassifiedResponse>
> = {
  [MessageRequestKind.UNSAFE]: {
    requestKind: MessageRequestKind.UNSAFE,
    content:
      'I can’t help with unsafe requests. I can help you work through a safe, course-related question instead.',
    guidanceLabel: MessageGuidanceLabel.REFUSAL,
    errorCode: CLASSIFIED_RESPONSE_ERROR_CODE.UNSAFE_REQUEST,
  },
  [MessageRequestKind.OFF_TOPIC]: {
    requestKind: MessageRequestKind.OFF_TOPIC,
    content:
      'Let’s keep this focused on the course. Ask about a concept or problem from the course material.',
    guidanceLabel: MessageGuidanceLabel.GENERAL_NOT_FOUND,
    errorCode: CLASSIFIED_RESPONSE_ERROR_CODE.OFF_TOPIC_REQUEST,
  },
}

export function classifiedResponseFor(
  requestKind: MessageRequestKind,
): ClassifiedResponse | null {
  return requestKind === MessageRequestKind.UNSAFE ||
    requestKind === MessageRequestKind.OFF_TOPIC
    ? classifiedResponses[requestKind]
    : null
}
