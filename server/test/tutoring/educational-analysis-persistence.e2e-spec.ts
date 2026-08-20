import { randomUUID } from 'node:crypto'

import {
  EducationalAnalysisEvidenceKind,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  StudentState,
  TeachingStrategy,
  TeachingTechnique,
  TopicType,
} from '../../src/generated/prisma/client'
import {
  PrismaEducationalAnalysisRepository,
  type PersistEducationalAnalysisInput,
} from '../../src/modules/tutoring/socratic-workflow/analysis/educational-analysis.repository'
import { EDUCATIONAL_ANALYSIS_PROMPT_VERSION } from '../../src/modules/tutoring/socratic-workflow/analysis/educational-analysis.prompt'
import {
  EDUCATIONAL_ANALYSIS_FALLBACK_REASON,
  EDUCATIONAL_ANALYSIS_SOURCE,
  EDUCATIONAL_ANALYSIS_SCHEMA_VERSION,
  EFFORT_QUALITY,
  EFFORT_TYPE,
  LEARNING_EVIDENCE_STRENGTH,
  type EducationalAnalysisResult,
} from '../../src/modules/tutoring/socratic-workflow/analysis/educational-analysis.types'
import { TOPIC_RESOLUTION_OUTCOME } from '../../src/modules/tutoring/socratic-workflow/topic/topic.types'
import type { PrismaService } from '../../src/platform/database/prisma.service'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from '../support/disposable-database'

interface Fixture {
  courseId: string
  studentId: string
  sessionId: string
  topicId: string
  attemptId: string
  studentMessageId: string
}

describe('EducationalAnalysisRepository (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let repository: PrismaEducationalAnalysisRepository

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_analysis')
    prisma = database.prisma
    repository = new PrismaEducationalAnalysisRepository(prisma)
  })

  afterAll(async () => {
    await database?.dispose()
  })

  it('persists accepted analysis metadata, evidence links, and misconceptions', async () => {
    const fixture = await createFixture(prisma)

    const stored = await repository.storeAccepted(
      persistInput(fixture, analysisResult(fixture.studentMessageId)),
    )

    expect(stored.kind).toBe('created')
    expect(stored.analysis).toMatchObject({
      attemptId: fixture.attemptId,
      topicId: fixture.topicId,
      studentMessageId: fixture.studentMessageId,
      attempt: 1,
      provider: 'openai-compatible',
      model: 'Qwen/Qwen2.5-14B-Instruct',
      modelVersion: 'vllm-test',
      promptVersion: EDUCATIONAL_ANALYSIS_PROMPT_VERSION,
      schemaVersion: EDUCATIONAL_ANALYSIS_SCHEMA_VERSION,
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 12,
      analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
      fallbackReason: null,
      confidencePolicyVersion: 'educational-analysis-confidence-policy.v1',
      infrastructureRetryCount: 0,
      result: {
        requestKind: MessageRequestKind.CODE_DIAGNOSIS,
        studentState: StudentState.DEBUGGING_ISSUE,
        evidenceReferences: [fixture.studentMessageId],
      },
    })

    const persisted = await prisma.educationalAnalysis.findUniqueOrThrow({
      where: { id: stored.analysis.id },
      include: {
        evidenceLinks: true,
        misconceptions: true,
      },
    })
    expect(persisted.evidenceLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messageId: fixture.studentMessageId,
          kind: EducationalAnalysisEvidenceKind.TOP_LEVEL,
          ordinal: 0,
        }),
        expect.objectContaining({
          messageId: fixture.studentMessageId,
          kind: EducationalAnalysisEvidenceKind.EFFORT,
          ordinal: 0,
        }),
      ]),
    )
    expect(persisted.misconceptions).toEqual([
      expect.objectContaining({
        code: 'NON_SHRINKING_SEARCH_INTERVAL',
        description: 'The checked midpoint is retained in the next interval.',
        evidenceMessageId: fixture.studentMessageId,
      }),
    ])
    expect(persisted).toMatchObject({
      analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
      fallbackReason: null,
      failureCategory: null,
      confidencePolicyVersion: 'educational-analysis-confidence-policy.v1',
      infrastructureRetryCount: 0,
    })
    // EducationalAnalysisRepository owns only the analysis aggregate. The
    // workflow records the authoritative request kind through Tutoring's
    // Attempt transition and Conversations' terminal message finalization.
    await expect(
      prisma.message.findUniqueOrThrow({
        where: { id: fixture.studentMessageId },
        select: { requestKind: true },
      }),
    ).resolves.toEqual({ requestKind: null })
  })

  it('persists fallback metadata and reuses it idempotently', async () => {
    const fixture = await createFixture(prisma)
    const input = persistInput(
      fixture,
      fallbackResult(fixture.studentMessageId),
      {
        analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK,
        fallbackReason: EDUCATIONAL_ANALYSIS_FALLBACK_REASON.PROVIDER_TIMEOUT,
        failureCategory: 'ANALYSIS_MODEL_TIMEOUT',
        confidencePolicyVersion: 'educational-analysis-confidence-policy.v1',
        infrastructureRetryCount: 1,
      },
    )

    const first = await repository.storeAccepted(input)
    const second = await repository.storeAccepted(input)

    expect(first.kind).toBe('created')
    expect(second.kind).toBe('reused')
    expect(second.analysis).toMatchObject({
      id: first.analysis.id,
      analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.FALLBACK,
      fallbackReason: EDUCATIONAL_ANALYSIS_FALLBACK_REASON.PROVIDER_TIMEOUT,
      failureCategory: 'ANALYSIS_MODEL_TIMEOUT',
      confidencePolicyVersion: 'educational-analysis-confidence-policy.v1',
      infrastructureRetryCount: 1,
      result: {
        studentState: StudentState.UNKNOWN,
        misconceptions: [],
        recommendedGuidanceLevel: 1,
      },
    })
    await expect(
      prisma.educationalAnalysis.count({
        where: { attemptId: fixture.attemptId },
      }),
    ).resolves.toBe(1)
  })

  it('reuses accepted analysis for normal idempotent retry', async () => {
    const fixture = await createFixture(prisma)
    const input = persistInput(
      fixture,
      analysisResult(fixture.studentMessageId),
    )

    const first = await repository.storeAccepted(input)
    const second = await repository.storeAccepted(input)

    expect(first.kind).toBe('created')
    expect(second.kind).toBe('reused')
    expect(second.analysis.id).toBe(first.analysis.id)
    await expect(
      prisma.educationalAnalysis.count({
        where: { attemptId: fixture.attemptId },
      }),
    ).resolves.toBe(1)
  })

  it('creates a new immutable attempt for intentional re-analysis', async () => {
    const fixture = await createFixture(prisma)
    const input = persistInput(
      fixture,
      analysisResult(fixture.studentMessageId),
    )

    const first = await repository.storeAccepted(input)
    const second = await repository.storeAccepted({
      ...input,
      forceReanalysis: true,
    })

    expect(first.kind).toBe('created')
    expect(second.kind).toBe('created')
    expect(second.analysis.attempt).toBe(2)
    expect(second.analysis.id).not.toBe(first.analysis.id)
  })
})

async function createFixture(prisma: PrismaService): Promise<Fixture> {
  const suffix = randomUUID()
  const university = await prisma.university.upsert({
    where: { code: 'TEST-EDUCATIONAL-ANALYSIS-UNIV' },
    update: {},
    create: {
      name: 'Test Educational Analysis University',
      code: 'TEST-EDUCATIONAL-ANALYSIS-UNIV',
      status: 'ACTIVE',
    },
  })
  const student = await prisma.user.create({
    data: {
      email: `analysis-${suffix}@morshid.test`,
      displayName: 'Analysis Student',
      role: 'STUDENT',
      universityId: university.id,
      passwordHash: 'test-password-hash',
    },
  })
  const course = await prisma.course.create({
    data: {
      code: `analysis-${suffix.slice(0, 8)}`,
      title: 'Analysis Course',
      universityId: university.id,
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
      title: 'Analysis Session',
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
  const turn = await prisma.tutoringAttempt.create({
    data: {
      sessionId: session.id,
      topicId: topic.id,
      clientMessageId: `analysis-${suffix}`,
    },
  })
  const studentMessage = await prisma.message.create({
    data: {
      sessionId: session.id,
      attemptId: turn.id,
      topicId: topic.id,
      sequence: 1,
      role: MessageRole.STUDENT,
      authorUserId: student.id,
      content: 'My binary search keeps low = mid and loops forever.',
      status: MessageStatus.COMPLETED,
      completedAt: new Date('2026-08-05T00:00:00.000Z'),
    },
  })
  await prisma.tutoringAttempt.update({
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
    attemptId: turn.id,
    studentMessageId: studentMessage.id,
  }
}

function persistInput(
  fixture: Fixture,
  result: EducationalAnalysisResult,
  metadata: PersistEducationalAnalysisInput['metadata'] = {
    analysisSource: EDUCATIONAL_ANALYSIS_SOURCE.MODEL,
    fallbackReason: null,
    failureCategory: null,
    confidencePolicyVersion: 'educational-analysis-confidence-policy.v1',
    infrastructureRetryCount: 0,
  },
): PersistEducationalAnalysisInput {
  return {
    attemptId: fixture.attemptId,
    topicId: fixture.topicId,
    studentMessageId: fixture.studentMessageId,
    result,
    modelResponse: {
      rawOutput: result,
      provider: 'openai-compatible',
      model: 'Qwen/Qwen2.5-14B-Instruct',
      modelVersion: 'vllm-test',
      promptVersion: EDUCATIONAL_ANALYSIS_PROMPT_VERSION,
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 12,
    },
    forceReanalysis: false,
    metadata,
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
    misconceptions: [
      {
        code: 'NON_SHRINKING_SEARCH_INTERVAL',
        description: 'The checked midpoint is retained in the next interval.',
        confidence: 0.88,
        evidenceMessageId: studentMessageId,
      },
    ],
    topicRelation: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
    recommendedStrategy: TeachingStrategy.DEBUGGING_GUIDANCE,
    recommendedTechnique: TeachingTechnique.TRACE_EXECUTION,
    recommendedGuidanceLevel: 2,
    confidence: 0.9,
    evidenceReferences: [studentMessageId],
  }
}

function fallbackResult(studentMessageId: string): EducationalAnalysisResult {
  return {
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
    learningEvidence: {
      present: false,
      strength: LEARNING_EVIDENCE_STRENGTH.NONE,
      evidenceMessageIds: [],
    },
    misconceptions: [],
    topicRelation: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
    recommendedStrategy: TeachingStrategy.SOCRATIC_QUESTIONING,
    recommendedTechnique: TeachingTechnique.ORIENTATION_QUESTION,
    recommendedGuidanceLevel: 1,
    confidence: 0.1,
    evidenceReferences: [studentMessageId],
  }
}
