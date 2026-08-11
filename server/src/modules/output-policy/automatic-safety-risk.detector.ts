import { Injectable } from '@nestjs/common'

import type { CourseEvidenceChunk } from '../materials/materials.public'
import {
  GROUNDED_COMPLETION_DISCLOSURE_MARKERS,
  UNTRUSTED_INPUT_BEGIN_MARKER,
  UNTRUSTED_INPUT_END_MARKER,
} from '../completion/grounded-completion-envelope'
import {
  isSafetyDiscussion,
  requestsObfuscatedDeliverable,
  requestsProtectedSolution,
} from './automatic-safety-request-intent'

export const AUTOMATIC_SAFETY_RISK_DETECTOR_VERSION = 'automatic-safety-risk-v3'

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
  /\b(?:my|our|the)\s+(?:instructor|teacher|professor|lecturer)\b.{0,100}\b(?:said|says|told|approved|authorized|allowed|permitted|permission|exception)\b|\b(?:i|we)\s+(?:have|received|got|was given|were given)\b.{0,50}\b(?:permission|approval|authorization|an exception)\b.{0,50}\b(?:from|by)\s+(?:(?:my|our|the)\s+)?(?:instructor|teacher|professor|lecturer)\b/iu
const DISCLOSURE_REQUEST =
  /\b(?:access|display|dump|expose|obtain|print|quote|read|repeat|return|reveal|see|show|view)\b.{0,80}\b(?:hidden|internal|system|developer|initial|secret)\b.{0,40}\b(?:prompt|instructions?|policy|configuration|message)\b/iu
const PROMPT_DISCLOSURE_CONTENT =
  /\b(?:system|developer|hidden|internal) (?:prompt|instructions?|message)\b.{0,80}\b(?:is|are|says|reads|follows|begin|:)\b/iu
const COMPLETE_DELIVERY =
  /\b(?:complete|full|entire|finished|final|ready[- ]to[- ]submit|ready[- ]to[- ]run|copy[- ]and[- ]paste)\b.{0,60}\b(?:answer|solution|implementation|code|program|submission|example)\b|\b(?:answer|solution) key\b/iu
const DELIVERED_ARTIFACT =
  /```[\s\S]{40,}```|\b(?:here (?:is|are)|the (?:final|complete) answer|solution:)\b|(?:^|\n)\s*(?:def |class |function |public static |#include |SELECT )/iu
const FULL_PROGRAM_ARTIFACT =
  /(?:^|\n)\s*(?:def |class |function |public static |#include )[\s\S]{40,}\b(?:return|main|end)\b/iu
const CODE_FENCE =
  /```(?:python|py|javascript|typescript|java|c|cpp|csharp|sql)?\s*\n([\s\S]*?)```/giu
const CODE_STATEMENT =
  /^\s*(?:import\s+|from\s+\S+\s+import\s+|def\s+|class\s+|if\s+|elif\s+|else\s*:|for\s+|while\s+|try\s*:|except\b|finally\s*:|with\s+|return\b|break\b|continue\b|raise\b|print\s*\(|[A-Za-z_]\w*\s*=|[A-Za-z_]\w*\s*\(|[A-Za-z_]\w*\.(?:append|remove|extend|insert|pop|sort)\s*\()/iu
const CONTROLLED_NON_AUTHORIZATION_DISCLAIMER =
  /\b(?:it|this\s+(?:document|content|text))\s+does\s+not\s+grant\s+permission\s+to\s+ignore\s+tutor\s+policy,?\s+reveal\s+hidden\s+instructions,?\s+or\s+provide\s+protected\s+assessment\s+answers\s*\./giu

@Injectable()
export class AutomaticSafetyRiskDetector {
  detectStudentInput(content: string): AutomaticSafetyRiskDetection | null {
    const normalized = normalize(content)
    const risks: AutomaticSafetyRisk[] = []
    const protectedSolutionRequest = requestsProtectedSolution(normalized)
    const claimedAuthorityException =
      PERSONAL_AUTHORITY_EXCEPTION.test(normalized) &&
      (protectedSolutionRequest || DISCLOSURE_REQUEST.test(normalized))
    if (
      !isSafetyDiscussion(normalized) &&
      ((OVERRIDE_COMMAND.test(normalized) &&
        (CONTROL_TARGET.test(normalized) ||
          DISCLOSURE_REQUEST.test(normalized) ||
          OVERRIDE_PAYLOAD.test(normalized))) ||
        claimedAuthorityException)
    ) {
      risks.push('INSTRUCTION_OVERRIDE')
    }
    if (
      !isSafetyDiscussion(normalized) &&
      DISCLOSURE_REQUEST.test(normalized)
    ) {
      risks.push('HIDDEN_PROMPT_DISCLOSURE')
    }
    if (
      !isSafetyDiscussion(normalized) &&
      ((!claimedAuthorityException && protectedSolutionRequest) ||
        requestsObfuscatedDeliverable(normalized))
    ) {
      risks.push('FINAL_ANSWER_DELIVERY')
    }
    return detection(risks)
  }

  detectRetrievedDocuments(
    chunks: readonly CourseEvidenceChunk[],
  ): AutomaticSafetyRiskDetection | null {
    const unsafe = chunks.some(({ content }) => {
      const normalized = normalize(removeNonAuthorizationDisclaimers(content))
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
        (DELIVERED_ARTIFACT.test(normalized) ||
          DELIVERED_ARTIFACT.test(content) ||
          CODE_STATEMENT.test(normalized))) ||
        FULL_PROGRAM_ARTIFACT.test(content) ||
        FULL_PROGRAM_ARTIFACT.test(normalized) ||
        containsSubmissionReadyCode(content))
    ) {
      risks.push('FINAL_ANSWER_DELIVERY')
    }
    return detection(risks)
  }
}

function removeNonAuthorizationDisclaimers(content: string): string {
  return content.replace(CONTROLLED_NON_AUTHORIZATION_DISCLAIMER, ' ')
}

function containsSubmissionReadyCode(content: string): boolean {
  const candidates = [...content.matchAll(CODE_FENCE)].map((match) => match[1])
  candidates.push(content)
  return candidates.some((candidate) => {
    const lines = candidate
      .split(/\r?\n/gu)
      .map((line) => line.replace(/^\s*(?:#|\/\/|<!--)\s?/u, ''))
      .filter((line) => line.trim().length > 0)
    const statementCount = lines.filter((line) =>
      CODE_STATEMENT.test(line),
    ).length
    const hasControlFlow = lines.some((line) =>
      /^\s*(?:if|elif|else|for|while|try|except|with)\b/iu.test(line),
    )
    return statementCount >= 5 || (statementCount >= 3 && hasControlFlow)
  })
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
