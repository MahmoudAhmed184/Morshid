import { randomUUID } from 'node:crypto'

import {
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  ReflectionMode,
  RevealPolicy,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
  TopicType,
} from '../src/generated/prisma/client'
import {
  PrismaEducationalAnalysisRepository,
  type PersistedEducationalAnalysisRecord,
} from '../src/modules/socratic-tutor/educational-analysis.repository'
import { EDUCATIONAL_ANALYSIS_PROMPT_VERSION } from '../src/modules/socratic-tutor/educational-analysis.prompt'
import {
  EDUCATIONAL_ANALYSIS_SOURCE,
  EFFORT_QUALITY,
  EFFORT_TYPE,
  LEARNING_EVIDENCE_STRENGTH,
  type EducationalAnalysisResult,
} from '../src/modules/socratic-tutor/educational-analysis.types'
import {
  PrismaTeachingDecisionRepository,
  type PersistedTeachingDecisionRecord,
} from '../src/modules/socratic-tutor/teaching-decision.repository'
import { TeachingPolicyEngine } from '../src/modules/socratic-tutor/teaching-policy.engine'
import {
  fixedTeachingGuardPolicy,
  teachingPolicyDefaults,
} from '../src/modules/socratic-tutor/teaching-policy.selector'
import { TEACHING_POLICY_VERSION } from '../src/modules/socratic-tutor/teaching-policy.types'
import type { TopicStateSnapshot } from '../src/modules/socratic-tutor/topic-state.types'
import { TOPIC_RESOLUTION_OUTCOME } from '../src/modules/socratic-tutor/topic.types'
import type { PrismaService } from '../src/modules/prisma/prisma.service'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

interface Fixture {
  courseId: string
  studentId: string
  sessionId: string
  topicId: string
  turnId: string
  studentMessageId: string
}

describe('TeachingDecisionRepository (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let analysisRepository: PrismaEducationalAnalysisRepository
  let decisionRepository: PrismaTeachingDecisionRepository
  let engine: TeachingPolicyEngine

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_teaching_decision')
    prisma = database.prisma
    analysisRepository = new PrismaEducationalAnalysisRepository(prisma)
    decisionRepository = new PrismaTeachingDecisionRepository(prisma)
    engine = new TeachingPolicyEngine(decisionRepository)
  })

  afterAll(async () => {
    await database?.dispose()
  })

  it('persists a complete authoritative TeachingDecision for accepted analysis', async () => {
    const fixture = await createFixture(prisma)
    const analysis = await storeAnalysis(fixture)

    const result = await engine.selectDecision({
      analysis,
      topicState: topicState(fixture.topicId, { guidanceLevel: 2 }),
      previousTeachingDecision: previousDecision(fixture.topicId, {
        guidanceLevel: 2,
      }),
      courseTutorConfiguration: teachingPolicyDefaults(),
    })

    expect(result).toMatchObject({
      success: true,
      reused: false,
      decision: {
        turnId: fixture.turnId,
        topicId: fixture.topicId,
        analysisId: analysis.id,
        strategy: TeachingStrategy.DEBUGGING_GUIDANCE,
        primaryTechnique: TeachingTechnique.TRACE_EXECUTION,
        supportingTechnique: null,
        guidanceLevel: 3,
        revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
        reflectionMode: ReflectionMode.NONE,
        requireStudentAction: true,
        guardPolicy: fixedTeachingGuardPolicy(),
        policyVersion: TEACHING_POLICY_VERSION,
      },
    })

    const persisted = await prisma.teachingDecision.findUniqueOrThrow({
      where: { turnId: fixture.turnId },
    })
    expect(persisted.decisionReason.length).toBeLessThanOrEqual(240)
    expect(persisted.analysisId).toBe(analysis.id)
  })

  it('creates conservative decisions for accepted fallback analysis', async () => {
    const fixture = await createFixture(prisma)
    const analysis = await storeAnalysis(
      fixture,
      fallbackResult(fixture.studentMessageId),
      EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK,
    )

    const result = await engine.selectDecision({
      analysis,
      topicState: topicState(fixture.topicId, { guidanceLevel: 4 }),
      previousTeachingDecision: previousDecision(fixture.topicId, {
        guidanceLevel: 4,
      }),
    })

    expect(result).toMatchObject({
      success: true,
      decision: {
        strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
        primaryTechnique: TeachingTechnique.FOCUSED_QUESTION,
        guidanceLevel: 1,
        revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
        reflectionMode: ReflectionMode.NONE,
      },
    })
  })

  it('reuses the existing decision for repeated processing and concurrent duplicates', async () => {
    const fixture = await createFixture(prisma)
    const analysis = await storeAnalysis(fixture)
    const input = {
      analysis,
      topicState: topicState(fixture.topicId, { guidanceLevel: 2 }),
      previousTeachingDecision: previousDecision(fixture.topicId, {
        guidanceLevel: 2,
      }),
    }

    const [first, second] = await Promise.all([
      engine.selectDecision(input),
      engine.selectDecision(input),
    ])

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    await expect(
      prisma.teachingDecision.count({ where: { turnId: fixture.turnId } }),
    ).resolves.toBe(1)

    const third = await engine.selectDecision(input)
    expect(third).toMatchObject({ success: true, reused: true })
  })

  it('creates another decision for another turn', async () => {
    const firstFixture = await createFixture(prisma)
    const secondFixture = await createFixture(prisma)
    const firstAnalysis = await storeAnalysis(firstFixture)
    const secondAnalysis = await storeAnalysis(secondFixture)

    await engine.selectDecision({
      analysis: firstAnalysis,
      topicState: topicState(firstFixture.topicId),
    })
    await engine.selectDecision({
      analysis: secondAnalysis,
      topicState: topicState(secondFixture.topicId),
    })

    await expect(
      prisma.teachingDecision.count(),
    ).resolves.toBeGreaterThanOrEqual(2)
  })

  it('loads only the latest completed same-topic decision before the current turn', async () => {
    const first = await createFixture(prisma)
    const firstAnalysis = await storeAnalysis(first)
    const firstDecision = await engine.selectDecision({
      analysis: firstAnalysis,
      topicState: topicState(first.topicId),
    })
    expect(firstDecision.success).toBe(true)

    const assistant = await prisma.message.create({
      data: {
        sessionId: first.sessionId,
        turnId: first.turnId,
        topicId: first.topicId,
        sequence: 2,
        role: MessageRole.ASSISTANT,
        responseToMessageId: first.studentMessageId,
        content: 'What boundary changes after this comparison?',
        status: MessageStatus.COMPLETED,
        completedAt: new Date('2026-08-05T00:01:00.000Z'),
      },
    })
    await prisma.tutorTurn.update({
      where: { id: first.turnId },
      data: {
        status: 'COMPLETED',
        approvedTutorMessageId: assistant.id,
        completedAt: new Date('2026-08-05T00:01:00.000Z'),
      },
    })

    const current = await createFollowingTurn(prisma, first)
    await expect(
      decisionRepository.findLatestCompletedForSameTopicBeforeTurn({
        turnId: current.turnId,
        topicId: current.topicId,
      }),
    ).resolves.toMatchObject({
      id: firstDecision.success ? firstDecision.decision.id : '',
      turnId: first.turnId,
      topicId: first.topicId,
    })
  })

  it('fails safely for missing or unrelated analysis records', async () => {
    const fixture = await createFixture(prisma)
    const analysis = await storeAnalysis(fixture)

    await expect(
      engine.selectDecision({
        analysis: { ...analysis, id: randomUUID() },
        topicState: topicState(fixture.topicId),
      }),
    ).resolves.toMatchObject({
      success: false,
      errorCode: 'TEACHING_DECISION_ANALYSIS_NOT_ACCEPTED',
    })

    await expect(
      engine.selectDecision({
        analysis: { ...analysis, topicId: randomUUID() },
        topicState: topicState(fixture.topicId),
      }),
    ).resolves.toMatchObject({
      success: false,
      errorCode: 'TEACHING_DECISION_RELATIONSHIP_MISMATCH',
    })
  })

  async function storeAnalysis(
    fixture: Fixture,
    result: EducationalAnalysisResult = analysisResult(
      fixture.studentMessageId,
    ),
    source: PersistedEducationalAnalysisRecord['analysisSource'] = EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
  ): Promise<PersistedEducationalAnalysisRecord> {
    const stored = await analysisRepository.storeAccepted({
      turnId: fixture.turnId,
      topicId: fixture.topicId,
      studentMessageId: fixture.studentMessageId,
      result,
      modelResponse: {
        rawOutput: result,
        provider:
          source === EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK ? 'fallback' : 'test',
        model:
          source === EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK ? 'fallback' : 'test',
        promptVersion: EDUCATIONAL_ANALYSIS_PROMPT_VERSION,
      },
      forceReanalysis: false,
      metadata: {
        analysisSource: source,
        fallbackReason: null,
        failureCategory: null,
        confidencePolicyVersion: null,
        infrastructureRetryCount: 0,
      },
    })

    expect(stored.kind).toBe('created')
    return stored.analysis
  }
})

async function createFixture(prisma: PrismaService): Promise<Fixture> {
  const suffix = randomUUID()
  const student = await prisma.user.create({
    data: {
      email: `decision-${suffix}@morshid.test`,
      displayName: 'Decision Student',
      role: 'STUDENT',
      passwordHash: 'test-password-hash',
    },
  })
  const course = await prisma.course.create({
    data: {
      code: `decision-${suffix.slice(0, 8)}`,
      title: 'Decision Course',
    },
  })
  await prisma.courseMembership.create({
    data: {
      courseId: course.id,
      userId: student.id,
      role: 'STUDENT',
    },
  })
  const session = await prisma.chatSession.create({
    data: {
      courseId: course.id,
      studentId: student.id,
      title: 'Decision Session',
    },
  })
  const topic = await prisma.topic.create({
    data: {
      sessionId: session.id,
      courseId: course.id,
      title: 'Binary search',
      topicType: TopicType.DEBUGGING_TASK,
    },
  })
  const turn = await prisma.tutorTurn.create({
    data: {
      sessionId: session.id,
      topicId: topic.id,
      idempotencyKey: `decision-${suffix}`,
    },
  })
  const studentMessage = await prisma.message.create({
    data: {
      sessionId: session.id,
      turnId: turn.id,
      topicId: topic.id,
      sequence: 1,
      role: MessageRole.STUDENT,
      authorUserId: student.id,
      content: 'My binary search keeps low = mid and loops forever.',
      status: MessageStatus.COMPLETED,
      completedAt: new Date('2026-08-05T00:00:00.000Z'),
    },
  })
  await prisma.tutorTurn.update({
    where: { id: turn.id },
    data: {
      studentMessageId: studentMessage.id,
    },
  })

  return {
    courseId: course.id,
    studentId: student.id,
    sessionId: session.id,
    topicId: topic.id,
    turnId: turn.id,
    studentMessageId: studentMessage.id,
  }
}

async function createFollowingTurn(
  prisma: PrismaService,
  first: Fixture,
): Promise<Fixture> {
  const turn = await prisma.tutorTurn.create({
    data: {
      sessionId: first.sessionId,
      topicId: first.topicId,
      idempotencyKey: `decision-following-${randomUUID()}`,
    },
  })
  const studentMessage = await prisma.message.create({
    data: {
      sessionId: first.sessionId,
      turnId: turn.id,
      topicId: first.topicId,
      sequence: 3,
      role: MessageRole.STUDENT,
      authorUserId: first.studentId,
      content: 'I changed low to mid plus one; what should I trace next?',
      status: MessageStatus.COMPLETED,
      completedAt: new Date('2026-08-05T00:02:00.000Z'),
    },
  })
  await prisma.tutorTurn.update({
    where: { id: turn.id },
    data: { studentMessageId: studentMessage.id },
  })

  return {
    ...first,
    turnId: turn.id,
    studentMessageId: studentMessage.id,
  }
}

function analysisResult(studentMessageId: string): EducationalAnalysisResult {
  return {
    requestKind: MessageRequestKind.CODE_DIAGNOSIS,
    studentState: StudentState.DEBUGGING_ISSUE,
    effortEvidence: {
      present: true,
      quality: EFFORT_QUALITY.MEANINGFUL,
      type: EFFORT_TYPE.CODE_ATTEMPT,
      addressesPreviousTutorAction: true,
      isRepeated: false,
      evidenceMessageIds: [studentMessageId],
    },
    learningEvidence: {
      present: false,
      strength: LEARNING_EVIDENCE_STRENGTH.NONE,
      evidenceMessageIds: [],
    },
    misconceptions: [],
    topicRelation: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
    recommendedStrategy: TeachingStrategy.GUIDED_EXPLANATION,
    recommendedTechnique: TeachingTechnique.ORIENTATION_QUESTION,
    recommendedGuidanceLevel: 4,
    confidence: 0.9,
    evidenceReferences: [studentMessageId],
  }
}

function fallbackResult(studentMessageId: string): EducationalAnalysisResult {
  return {
    ...analysisResult(studentMessageId),
    requestKind: MessageRequestKind.AMBIGUOUS,
    studentState: StudentState.UNKNOWN,
    effortEvidence: {
      present: false,
      quality: EFFORT_QUALITY.NONE,
      type: null,
      addressesPreviousTutorAction: false,
      isRepeated: false,
      evidenceMessageIds: [],
    },
    recommendedStrategy: TeachingStrategy.SOCRATIC_QUESTIONING,
    recommendedTechnique: TeachingTechnique.FOCUSED_QUESTION,
    recommendedGuidanceLevel: 1,
  }
}

function topicState(
  topicId: string,
  input: Partial<TopicStateSnapshot> = {},
): TopicStateSnapshot {
  return {
    id: 'topic-state-1',
    topicId,
    version: 1,
    requestKind: null,
    studentState: StudentState.UNKNOWN,
    activeStrategy: null,
    primaryTechnique: null,
    supportingTechnique: null,
    guidanceLevel: 1,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    attemptCount: 0,
    meaningfulAttemptCount: 0,
    misconceptionStatus: null,
    learningStatus: 'UNKNOWN',
    resolutionEvidenceStrength: 'NONE',
    summary: null,
    lastTutorQuestion: null,
    lastStudentAction: null,
    resolved: false,
    updatedAt: new Date('2026-08-05T00:00:00.000Z'),
    ...input,
  }
}

function previousDecision(
  topicId: string,
  input: Partial<PersistedTeachingDecisionRecord> = {},
): PersistedTeachingDecisionRecord {
  return {
    id: 'decision-previous',
    turnId: 'turn-previous',
    topicId,
    analysisId: 'analysis-previous',
    strategy: TeachingStrategy.SOCRATIC_QUESTIONING,
    primaryTechnique: TeachingTechnique.FOCUSED_QUESTION,
    supportingTechnique: null,
    guidanceLevel: 1,
    revealPolicy: RevealPolicy.NO_FINAL_ANSWER,
    reflectionMode: ReflectionMode.NONE,
    requireStudentAction: true,
    guardPolicy: fixedTeachingGuardPolicy(),
    decisionReason: 'Selected Socratic questioning.',
    policyVersion: TEACHING_POLICY_VERSION,
    createdAt: new Date('2026-08-05T00:00:00.000Z'),
    ...input,
  }
}
