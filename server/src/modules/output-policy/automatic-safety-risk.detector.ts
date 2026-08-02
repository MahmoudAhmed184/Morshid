import { Injectable } from '@nestjs/common'

import type { RetrievedChunk } from '../retrieval/retrieval.service'
import {
  GROUNDED_COMPLETION_DISCLOSURE_MARKERS,
  UNTRUSTED_INPUT_BEGIN_MARKER,
  UNTRUSTED_INPUT_END_MARKER,
} from '../completion/grounded-completion-envelope'

export const AUTOMATIC_SAFETY_RISK_DETECTOR_VERSION = 'automatic-safety-risk-v2'

export type AutomaticSafetyRisk =
  | 'INSTRUCTION_OVERRIDE'
  | 'RETRIEVED_DOCUMENT_INJECTION'
  | 'HIDDEN_PROMPT_DISCLOSURE'
  | 'FINAL_ANSWER_DELIVERY'

export interface AutomaticSafetyRiskDetection {
  readonly detectorVersion: typeof AUTOMATIC_SAFETY_RISK_DETECTOR_VERSION
  readonly risks: readonly AutomaticSafetyRisk[]
}

const RISK_ORDER = [
  'INSTRUCTION_OVERRIDE',
  'RETRIEVED_DOCUMENT_INJECTION',
  'HIDDEN_PROMPT_DISCLOSURE',
  'FINAL_ANSWER_DELIVERY',
] as const satisfies readonly AutomaticSafetyRisk[]

const OVERRIDE_COMMAND =
  /\b(?:ignore|disregard|forget|override|bypass|supersede)\b.{0,80}\b(?:previous|prior|above|system|developer|policy|policies|rule|rules|instruction|instructions|guardrail|guardrails)\b/iu
const CONTROL_TARGET =
  /\b(?:act as|instead|new instructions?|follow (?:only|these)|do not follow|must obey|change (?:your|the) (?:role|behavior)|jailbreak|unrestricted)\b/iu
const OVERRIDE_PAYLOAD =
  /\b(?:give|provide|produce|write|solve|complete|generate)\b.{0,80}\b(?:answer|solution|code|implementation|program|submission)\b|\b(?:answer|output|print|return|respond with|say)\b(?:.{0,40}\b(?:directly|instead|now|with)\b|.{1,80}$)/iu
const PERSONAL_AUTHORITY_EXCEPTION =
  /\b(?:my|our)\s+(?:instructor|teacher|professor|lecturer)\b.{0,100}\b(?:said|says|told|approved|authorized|allowed|permitted|permission|exception)\b|\b(?:i|we)\s+(?:have|received|got|was given|were given)\b.{0,50}\b(?:permission|approval|authorization|an exception)\b.{0,50}\b(?:from|by)\s+(?:(?:my|our|the)\s+)?(?:instructor|teacher|professor|lecturer)\b/iu
const ANSWER_KEY_DELIVERY_REQUEST =
  /\b(?:access|give|obtain|provide|reveal|see|send|share|show)\b.{0,60}\b(?:the\s+)?answer\s+key\b|\b(?:the\s+)?answer\s+key\b.{0,60}\b(?:access|give|obtain|provide|reveal|see|send|share|show)\b/iu
const DISCLOSURE_REQUEST =
  /\b(?:reveal|show|print|repeat|quote|disclose|expose|dump|return)\b.{0,80}\b(?:hidden|internal|system|developer|initial|secret)\b.{0,40}\b(?:prompt|instructions?|policy|configuration|message)\b/iu
const PROMPT_DISCLOSURE_CONTENT =
  /\b(?:system|developer|hidden|internal) (?:prompt|instructions?|message)\b.{0,80}\b(?:is|are|says|reads|follows|begin|:)\b/iu
const COMPLETE_DELIVERY =
  /\b(?:complete|full|entire|finished|final|ready[- ]to[- ]submit|copy[- ]and[- ]paste)\b.{0,60}\b(?:answer|solution|implementation|code|program|submission)\b|\b(?:answer|solution) key\b/iu
const DELIVERED_ARTIFACT =
  /```[\s\S]{40,}```|\b(?:here (?:is|are)|the (?:final|complete) answer|solution:)\b|(?:^|\n)\s*(?:def |class |function |public static |#include |SELECT )/iu
const FULL_PROGRAM_ARTIFACT =
  /(?:^|\n)\s*(?:def |class |function |public static |#include )[\s\S]{40,}\b(?:return|main|end)\b/iu

@Injectable()
export class AutomaticSafetyRiskDetector {
  detectStudentInput(content: string): AutomaticSafetyRiskDetection | null {
    const normalized = normalize(content)
    const risks: AutomaticSafetyRisk[] = []
    const claimedAnswerKeyException =
      PERSONAL_AUTHORITY_EXCEPTION.test(normalized) &&
      ANSWER_KEY_DELIVERY_REQUEST.test(normalized)
    if (
      (OVERRIDE_COMMAND.test(normalized) &&
        (CONTROL_TARGET.test(normalized) ||
          DISCLOSURE_REQUEST.test(normalized) ||
          OVERRIDE_PAYLOAD.test(normalized))) ||
      claimedAnswerKeyException
    ) {
      risks.push('INSTRUCTION_OVERRIDE')
    }
    if (DISCLOSURE_REQUEST.test(normalized)) {
      risks.push('HIDDEN_PROMPT_DISCLOSURE')
    }
    return detection(risks)
  }

  detectRetrievedDocuments(
    chunks: readonly RetrievedChunk[],
  ): AutomaticSafetyRiskDetection | null {
    const unsafe = chunks.some(({ content }) => {
      const normalized = normalize(content)
      return (
        OVERRIDE_COMMAND.test(normalized) &&
        (CONTROL_TARGET.test(normalized) ||
          DISCLOSURE_REQUEST.test(normalized) ||
          OVERRIDE_PAYLOAD.test(normalized))
      )
    })
    return detection(unsafe ? ['RETRIEVED_DOCUMENT_INJECTION'] : [])
  }

  detectOutput(
    content: string,
    correctnessSensitive: boolean,
  ): AutomaticSafetyRiskDetection | null {
    const normalized = normalize(content)
    const risks: AutomaticSafetyRisk[] = []
    if (
      PROMPT_DISCLOSURE_CONTENT.test(normalized) ||
      containsGroundedPromptMarker(normalized)
    ) {
      risks.push('HIDDEN_PROMPT_DISCLOSURE')
    }
    if (
      correctnessSensitive &&
      ((COMPLETE_DELIVERY.test(normalized) &&
        DELIVERED_ARTIFACT.test(content)) ||
        FULL_PROGRAM_ARTIFACT.test(content))
    ) {
      risks.push('FINAL_ANSWER_DELIVERY')
    }
    return detection(risks)
  }
}

function detection(
  detected: readonly AutomaticSafetyRisk[],
): AutomaticSafetyRiskDetection | null {
  if (detected.length === 0) return null
  const selected = new Set(detected)
  return Object.freeze({
    detectorVersion: AUTOMATIC_SAFETY_RISK_DETECTOR_VERSION,
    risks: Object.freeze(RISK_ORDER.filter((risk) => selected.has(risk))),
  })
}

function normalize(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}

function containsGroundedPromptMarker(normalized: string): boolean {
  const folded = normalized.toLocaleLowerCase('en-US')
  return [
    ...GROUNDED_COMPLETION_DISCLOSURE_MARKERS,
    UNTRUSTED_INPUT_BEGIN_MARKER,
    UNTRUSTED_INPUT_END_MARKER,
  ].some((marker) =>
    folded.includes(normalize(marker).toLocaleLowerCase('en-US')),
  )
}
