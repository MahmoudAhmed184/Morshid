import { randomUUID } from 'node:crypto'

import {
  LearningStatus,
  MessageRequestKind,
  MessageRole,
  MessageStatus,
  ResolutionEvidenceStrength,
  StudentState,
  TopicStatus,
  TopicType,
} from '../src/generated/prisma/client'
import type { PrismaService } from '../src/modules/prisma/prisma.service'
import { PrismaStudentChatMessageRepository } from '../src/modules/student-chat/student-chat-message.repository'
import { TOPIC_STATE_ERROR_CODES } from '../src/modules/socratic-tutor/topic-state.errors'
import { PrismaTopicStateRepository } from '../src/modules/socratic-tutor/topic-state.repository'
import { TopicStateService } from '../src/modules/socratic-tutor/topic-state.service'
import type {
  TopicStatePatch,
  TopicStateSnapshot,
} from '../src/modules/socratic-tutor/topic-state.types'
import { PrismaTopicRepository } from '../src/modules/socratic-tutor/topic.repository'
import { TopicService } from '../src/modules/socratic-tutor/topic.service'
import {
  TOPIC_RESOLUTION_EVIDENCE_TYPE,
  TOPIC_RESOLUTION_OUTCOME,
  TOPIC_STABLE_IDENTITY_SOURCE,
  type TopicResolution,
} from '../src/modules/socratic-tutor/topic.types'
import { TURN_ERROR_CODES } from '../src/modules/socratic-tutor/turn.errors'
import { PrismaTurnRepository } from '../src/modules/socratic-tutor/turn.repository'
import { TurnService } from '../src/modules/socratic-tutor/turn.service'
import {
  TURN_ACQUISITION_OUTCOME,
  type TurnAcquisitionResult,
  type TutorTurnSnapshot,
} from '../src/modules/socratic-tutor/turn.types'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

interface ChatFixture {
  courseId: string
  studentId: string
  sessionId: string
}

interface PersistedGraph {
  message: {
    id: string
    sessionId: string
    turnId: string | null
    topicId: string | null
    role: MessageRole
    content: string
    status: MessageStatus
    requestKind: MessageRequestKind | null
    hintLevel: number | null
  }
  turn: TutorTurnSnapshot
  topic: {
    id: string
    sessionId: string
    courseId: string
    problemId: string | null
    conceptId: string | null
    title: string
    topicType: TopicType
    status: TopicStatus
    resolvedAt: Date | null
  }
  state: TopicStateSnapshot
  stateCount: number
  chatSession: {
    id: string
    courseId: string
  }
}

type Phase1WorkflowResult =
  | {
      kind: 'created_graph'
      acquisition: TurnAcquisitionResult
      topicResolution: TopicResolution
      graph: PersistedGraph
    }
  | {
      kind: 'reused_graph'
      acquisition: TurnAcquisitionResult
      graph: PersistedGraph
    }
  | {
      kind: 'already_processing'
      acquisition: TurnAcquisitionResult
    }

interface SubmitStudentTurnInput {
  fixture: ChatFixture
  idempotencyKey: string
  content: string
  problemId?: string | null
  conceptId?: string | null
  title?: string | null
  statePatch?: TopicStatePatch
}

class Phase1TestWorkflow {
  constructor(
    private readonly prisma: PrismaService,
    private readonly turnService: TurnService,
    private readonly topicService: TopicService,
    private readonly topicStateService: TopicStateService,
    private readonly messageRepository: PrismaStudentChatMessageRepository,
  ) {}

  async submit(input: SubmitStudentTurnInput): Promise<Phase1WorkflowResult> {
    const acquisition = await this.turnService.getOrCreate(
      input.fixture.sessionId,
      input.idempotencyKey,
    )

    if (acquisition.outcome !== TURN_ACQUISITION_OUTCOME.CREATED) {
      const existingGraph = await this.readGraphForTurnIfLinked(
        acquisition.turn.id,
      )

      return existingGraph === null
        ? { kind: 'already_processing', acquisition }
        : { kind: 'reused_graph', acquisition, graph: existingGraph }
    }

    const topicResolution = await this.topicService.resolveTopic({
      sessionId: input.fixture.sessionId,
      courseId: input.fixture.courseId,
      problemId: input.problemId,
      conceptId: input.conceptId,
      title: input.title,
    })

    if (topicResolution.topicId === null) {
      throw new Error(`Topic resolution failed: ${topicResolution.outcome}`)
    }

    let state = await this.topicStateService.getOrCreate(
      topicResolution.topicId,
    )

    const messageResult = await this.messageRepository.appendStudentMessage({
      courseId: input.fixture.courseId,
      sessionId: input.fixture.sessionId,
      studentId: input.fixture.studentId,
      content: input.content,
      turnId: acquisition.turn.id,
      topicId: topicResolution.topicId,
    })

    if (messageResult.kind !== 'ok') {
      throw new Error(
        `Student message persistence failed: ${messageResult.kind}`,
      )
    }

    await this.turnService.attachResolvedTopic(
      acquisition.turn.id,
      messageResult.message.id,
      topicResolution.topicId,
    )

    if (input.statePatch !== undefined) {
      state = await this.topicStateService.applyTransition(
        topicResolution.topicId,
        state.version,
        input.statePatch,
      )
    }

    const graph = await readGraphForMessage(
      this.prisma,
      messageResult.message.id,
    )
    expect(graph.state).toEqual(state)

    return {
      kind: 'created_graph',
      acquisition,
      topicResolution,
      graph,
    }
  }

  private async readGraphForTurnIfLinked(
    turnId: string,
  ): Promise<PersistedGraph | null> {
    const turn = await this.prisma.tutorTurn.findUniqueOrThrow({
      where: { id: turnId },
      select: {
        studentMessageId: true,
      },
    })

    if (turn.studentMessageId === null) {
      return null
    }

    return readGraphForMessage(this.prisma, turn.studentMessageId)
  }
}

describe('Phase 1 Socratic persistence flow (e2e)', () => {
  let database: DisposableDatabase | undefined
  let prisma: PrismaService
  let turnService: TurnService
  let topicService: TopicService
  let topicStateService: TopicStateService
  let workflow: Phase1TestWorkflow

  beforeAll(async () => {
    database = await setUpDisposableDatabase('morshid_issue169_phase1')
    prisma = database.prisma
    turnService = new TurnService(new PrismaTurnRepository(prisma))
    topicService = new TopicService(new PrismaTopicRepository(prisma))
    topicStateService = new TopicStateService(
      new PrismaTopicStateRepository(prisma),
    )
    workflow = new Phase1TestWorkflow(
      prisma,
      turnService,
      topicService,
      topicStateService,
      new PrismaStudentChatMessageRepository(prisma),
    )
  })

  afterAll(async () => {
    await database?.dispose()
  })

  it('reuses one stable turn, message, topic, and state for duplicate requests', async () => {
    const fixture = await createChatFixture(prisma)
    const idempotencyKey = phase1Key('duplicate')
    const problemId = randomUUID()
    const content = phase1Content('duplicate logical request')

    const first = await expectCreatedGraphResult(
      workflow.submit({
        fixture,
        idempotencyKey,
        problemId,
        title: 'Duplicate request problem',
        content,
      }),
    )
    const second = await expectGraphResult(
      workflow.submit({
        fixture,
        idempotencyKey,
        problemId,
        title: 'Duplicate request problem',
        content,
      }),
    )

    expect(first.kind).toBe('created_graph')
    expect(second.kind).toBe('reused_graph')
    expect(second.acquisition).toMatchObject({
      outcome: TURN_ACQUISITION_OUTCOME.ALREADY_PROCESSING,
      code: TURN_ERROR_CODES.ALREADY_PROCESSING,
    })
    expect(second.graph.turn.id).toBe(first.graph.turn.id)
    expect(second.graph.message.id).toBe(first.graph.message.id)
    expect(second.graph.topic.id).toBe(first.graph.topic.id)
    expect(second.graph.state.id).toBe(first.graph.state.id)

    await expectGraphInvariants(prisma, fixture, first.graph)
    await expectGraphInvariants(prisma, fixture, second.graph)
    await expect(
      prisma.tutorTurn.count({
        where: { sessionId: fixture.sessionId, idempotencyKey },
      }),
    ).resolves.toBe(1)
    await expect(
      prisma.message.count({
        where: { sessionId: fixture.sessionId, content },
      }),
    ).resolves.toBe(1)
    await expect(
      prisma.topic.count({
        where: { sessionId: fixture.sessionId, problemId },
      }),
    ).resolves.toBe(1)
    await expect(
      prisma.topicState.count({ where: { topicId: first.graph.topic.id } }),
    ).resolves.toBe(1)
    await expectNoPartialPhase1Rows(prisma, fixture)
  })

  it('handles concurrent same-key requests and keeps different keys distinct', async () => {
    const fixture = await createChatFixture(prisma)
    const idempotencyKey = phase1Key('concurrent-same')
    const problemId = randomUUID()

    const sameKeyResults = await Promise.allSettled([
      workflow.submit({
        fixture,
        idempotencyKey,
        problemId,
        title: 'Concurrent ownership',
        content: phase1Content('concurrent owner'),
      }),
      workflow.submit({
        fixture,
        idempotencyKey,
        problemId,
        title: 'Concurrent ownership',
        content: phase1Content('concurrent duplicate'),
      }),
    ])

    expect(sameKeyResults.every(isFulfilled)).toBe(true)
    const sameKeyValues = sameKeyResults
      .filter(isFulfilled)
      .map(({ value }) => value)
    expect(
      sameKeyValues.map(({ acquisition }) => acquisition.outcome).sort(),
    ).toEqual([
      TURN_ACQUISITION_OUTCOME.ALREADY_PROCESSING,
      TURN_ACQUISITION_OUTCOME.CREATED,
    ])
    expect(
      new Set(sameKeyValues.map(({ acquisition }) => acquisition.turn.id)).size,
    ).toBe(1)
    expect(
      sameKeyValues.find(
        ({ acquisition }) =>
          acquisition.outcome === TURN_ACQUISITION_OUTCOME.ALREADY_PROCESSING,
      )?.acquisition,
    ).toMatchObject({
      code: TURN_ERROR_CODES.ALREADY_PROCESSING,
    })
    await expect(
      prisma.tutorTurn.count({
        where: { sessionId: fixture.sessionId, idempotencyKey },
      }),
    ).resolves.toBe(1)
    await expect(
      prisma.message.count({
        where: {
          sessionId: fixture.sessionId,
          turnId: sameKeyValues[0].acquisition.turn.id,
          role: MessageRole.STUDENT,
        },
      }),
    ).resolves.toBe(1)
    await expect(
      prisma.topic.count({
        where: { sessionId: fixture.sessionId, problemId },
      }),
    ).resolves.toBe(1)
    await expect(
      prisma.topicState.count({
        where: {
          topic: {
            sessionId: fixture.sessionId,
            problemId,
          },
        },
      }),
    ).resolves.toBe(1)

    const distinctKeyResults = await Promise.all([
      workflow.submit({
        fixture,
        idempotencyKey: phase1Key('concurrent-distinct-a'),
        content: phase1Content('concurrent distinct a'),
      }),
      workflow.submit({
        fixture,
        idempotencyKey: phase1Key('concurrent-distinct-b'),
        content: phase1Content('concurrent distinct b'),
      }),
    ])
    const distinctGraphs = await Promise.all(
      distinctKeyResults.map((result) =>
        expectCreatedGraphResult(Promise.resolve(result)),
      ),
    )

    expect(new Set(distinctGraphs.map(({ graph }) => graph.turn.id)).size).toBe(
      2,
    )
    expect(
      new Set(distinctGraphs.map(({ graph }) => graph.message.id)).size,
    ).toBe(2)
    for (const result of distinctGraphs) {
      expect(result.kind).toBe('created_graph')
      await expectGraphInvariants(prisma, fixture, result.graph)
      expect(result.graph.turn.studentMessageId).toBe(result.graph.message.id)
    }
    await expectNoPartialPhase1Rows(prisma, fixture)
  })

  it('continues the same topic and state for a matching stable identifier', async () => {
    const fixture = await createChatFixture(prisma)
    const problemId = randomUUID()
    const first = await expectCreatedGraphResult(
      workflow.submit({
        fixture,
        idempotencyKey: phase1Key('continuation-first'),
        problemId,
        title: 'Loop invariant continuation',
        content: phase1Content('first continuation turn'),
        statePatch: {
          attemptCount: 2,
          studentState: StudentState.PARTIAL_UNDERSTANDING,
          summary: 'student identified the invariant',
        },
      }),
    )
    const second = await expectCreatedGraphResult(
      workflow.submit({
        fixture,
        idempotencyKey: phase1Key('continuation-second'),
        problemId,
        title: 'Loop invariant continuation',
        content: phase1Content('second continuation turn'),
      }),
    )

    expect(second.topicResolution).toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      topicId: first.graph.topic.id,
      stableIdentitySource: TOPIC_STABLE_IDENTITY_SOURCE.PROBLEM_ID,
    })
    expect(second.graph.topic.id).toBe(first.graph.topic.id)
    expect(second.graph.state).toMatchObject({
      id: first.graph.state.id,
      version: 2,
      attemptCount: 2,
      studentState: StudentState.PARTIAL_UNDERSTANDING,
      summary: 'student identified the invariant',
    })
    expect(first.graph.turn.id).not.toBe(second.graph.turn.id)
    expect(first.graph.message.id).not.toBe(second.graph.message.id)
    await expectGraphInvariants(prisma, fixture, first.graph)
    await expectGraphInvariants(prisma, fixture, second.graph)
    await expect(
      prisma.topic.count({
        where: { sessionId: fixture.sessionId, problemId },
      }),
    ).resolves.toBe(1)
    await expectNoPartialPhase1Rows(prisma, fixture)
  })

  it('switches to a different topic while preserving the previous state', async () => {
    const fixture = await createChatFixture(prisma)
    const topicAProblemId = randomUUID()
    const topicBProblemId = randomUUID()
    const first = await expectCreatedGraphResult(
      workflow.submit({
        fixture,
        idempotencyKey: phase1Key('switch-a'),
        problemId: topicAProblemId,
        title: 'Topic A',
        content: phase1Content('topic switch a'),
        statePatch: {
          attemptCount: 3,
          summary: 'topic a progress remains',
        },
      }),
    )
    const topicABeforeSwitch = await readTopicAndState(
      prisma,
      first.graph.topic.id,
    )

    const second = await expectCreatedGraphResult(
      workflow.submit({
        fixture,
        idempotencyKey: phase1Key('switch-b'),
        problemId: topicBProblemId,
        title: 'Topic B',
        content: phase1Content('topic switch b'),
      }),
    )
    const topicAAfterSwitch = await readTopicAndState(
      prisma,
      first.graph.topic.id,
    )

    expect(second.topicResolution).toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
      previousTopicId: first.graph.topic.id,
      topicId: second.graph.topic.id,
    })
    expect(second.graph.topic.problemId).toBe(topicBProblemId)
    expect(second.graph.topic.status).toBe(TopicStatus.ACTIVE)
    expect(topicAAfterSwitch.topic.status).toBe(TopicStatus.PAUSED)
    expect(topicAAfterSwitch.state).toEqual(topicABeforeSwitch.state)
    expect(second.graph.state).toMatchObject(
      defaultTopicState(second.graph.topic.id),
    )
    await expectActiveTopicCount(prisma, fixture, 1)
    await expectGraphInvariants(prisma, fixture, second.graph)
    await expectNoPartialPhase1Rows(prisma, fixture)
  })

  it('resumes a paused topic without replacing or resetting its state', async () => {
    const fixture = await createChatFixture(prisma)
    const topicAProblemId = randomUUID()
    const topicBProblemId = randomUUID()
    const topicA = await expectCreatedGraphResult(
      workflow.submit({
        fixture,
        idempotencyKey: phase1Key('resume-a'),
        problemId: topicAProblemId,
        title: 'Resume Topic A',
        content: phase1Content('resume topic a first'),
        statePatch: {
          guidanceLevel: 2,
          learningStatus: LearningStatus.IN_PROGRESS,
          summary: 'topic a prior reasoning',
        },
      }),
    )
    const topicB = await expectCreatedGraphResult(
      workflow.submit({
        fixture,
        idempotencyKey: phase1Key('resume-b'),
        problemId: topicBProblemId,
        title: 'Resume Topic B',
        content: phase1Content('resume topic b'),
      }),
    )

    expect(await readTopicStatus(prisma, topicA.graph.topic.id)).toBe(
      TopicStatus.PAUSED,
    )
    expect(await readTopicStatus(prisma, topicB.graph.topic.id)).toBe(
      TopicStatus.ACTIVE,
    )

    const resumed = await expectCreatedGraphResult(
      workflow.submit({
        fixture,
        idempotencyKey: phase1Key('resume-a-again'),
        problemId: topicAProblemId,
        title: 'Resume Topic A',
        content: phase1Content('resume topic a again'),
      }),
    )

    expect(resumed.topicResolution).toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.RESUME_PREVIOUS_TOPIC,
      topicId: topicA.graph.topic.id,
      previousTopicId: topicB.graph.topic.id,
    })
    expect(resumed.graph.topic.status).toBe(TopicStatus.ACTIVE)
    expect(await readTopicStatus(prisma, topicB.graph.topic.id)).toBe(
      TopicStatus.PAUSED,
    )
    expect(resumed.graph.state).toMatchObject({
      id: topicA.graph.state.id,
      version: 2,
      guidanceLevel: 2,
      learningStatus: LearningStatus.IN_PROGRESS,
      summary: 'topic a prior reasoning',
    })
    await expectGraphInvariants(prisma, fixture, resumed.graph)
    await expect(
      prisma.topic.count({
        where: { sessionId: fixture.sessionId, problemId: topicAProblemId },
      }),
    ).resolves.toBe(1)
    await expectNoPartialPhase1Rows(prisma, fixture)
  })

  it('reopens a resolved topic and retains its current state', async () => {
    const fixture = await createChatFixture(prisma)
    const conceptId = randomUUID()
    const first = await expectCreatedGraphResult(
      workflow.submit({
        fixture,
        idempotencyKey: phase1Key('reopen-first'),
        conceptId,
        title: 'Resolved concept',
        content: phase1Content('reopen initial evidence'),
        statePatch: {
          resolutionEvidenceStrength: ResolutionEvidenceStrength.STRONG,
          resolved: true,
          summary: 'student completed the concept',
        },
      }),
    )
    const resolved = await topicService.resolveAsResolved({
      sessionId: fixture.sessionId,
      courseId: fixture.courseId,
      topicId: first.graph.topic.id,
      evidence: {
        type: TOPIC_RESOLUTION_EVIDENCE_TYPE.VERIFIED_CORRECT_SOLUTION,
        evidenceMessageIds: [first.graph.message.id],
        reason: 'verified by student work',
      },
    })

    expect(resolved.status).toBe(TopicStatus.RESOLVED)
    expect(resolved.resolvedAt).not.toBeNull()

    const reopened = await expectCreatedGraphResult(
      workflow.submit({
        fixture,
        idempotencyKey: phase1Key('reopen-second'),
        conceptId,
        title: 'Resolved concept',
        content: phase1Content('reopen follow-up'),
      }),
    )

    expect(reopened.topicResolution).toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.REOPEN_EXISTING_TOPIC,
      topicId: first.graph.topic.id,
    })
    expect(reopened.graph.topic.status).toBe(TopicStatus.ACTIVE)
    expect(reopened.graph.topic.resolvedAt).toBeNull()
    expect(reopened.graph.state).toMatchObject({
      id: first.graph.state.id,
      version: 2,
      resolutionEvidenceStrength: ResolutionEvidenceStrength.STRONG,
      resolved: true,
      summary: 'student completed the concept',
    })
    await expectGraphInvariants(prisma, fixture, reopened.graph)
    await expect(
      prisma.topic.count({
        where: { sessionId: fixture.sessionId, conceptId },
      }),
    ).resolves.toBe(1)
    await expectNoPartialPhase1Rows(prisma, fixture)
  })

  it('rejects a stale TopicState transition without overwriting the winner', async () => {
    const fixture = await createChatFixture(prisma)
    const graphResult = await expectCreatedGraphResult(
      workflow.submit({
        fixture,
        idempotencyKey: phase1Key('stale-state'),
        problemId: randomUUID(),
        title: 'Stale state',
        content: phase1Content('stale state request'),
      }),
    )
    const initial = graphResult.graph.state
    await delay(10)

    const firstPatch = {
      guidanceLevel: 2,
      requestKind: MessageRequestKind.ATTEMPT_DIAGNOSIS,
      summary: 'first stale race update',
    }
    const secondPatch = {
      attemptCount: 4,
      studentState: StudentState.MISCONCEPTION,
      summary: 'second stale race update',
    }
    const results = await Promise.allSettled([
      topicStateService.applyTransition(
        graphResult.graph.topic.id,
        initial.version,
        firstPatch,
      ),
      topicStateService.applyTransition(
        graphResult.graph.topic.id,
        initial.version,
        secondPatch,
      ),
    ])
    const fulfilled = results.filter(isFulfilled)
    const rejected = results.filter(isRejected)

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason).toHaveProperty(
      'response.code',
      TOPIC_STATE_ERROR_CODES.STALE_VERSION,
    )
    expect(fulfilled[0].value.version).toBe(initial.version + 1)
    expect(fulfilled[0].value.updatedAt.getTime()).toBeGreaterThan(
      initial.updatedAt.getTime(),
    )

    const persisted = await prisma.topicState.findUniqueOrThrow({
      where: { topicId: graphResult.graph.topic.id },
      select: {
        version: true,
        updatedAt: true,
        guidanceLevel: true,
        requestKind: true,
        attemptCount: true,
        studentState: true,
        summary: true,
      },
    })

    expect(persisted.version).toBe(initial.version + 1)
    expect(persisted.updatedAt).toEqual(fulfilled[0].value.updatedAt)
    expect(persisted.summary).toBe(fulfilled[0].value.summary)
    if (persisted.summary === firstPatch.summary) {
      expect(persisted).toMatchObject({
        guidanceLevel: firstPatch.guidanceLevel,
        requestKind: firstPatch.requestKind,
        attemptCount: 0,
        studentState: StudentState.UNKNOWN,
      })
    } else {
      expect(persisted).toMatchObject({
        guidanceLevel: 1,
        requestKind: null,
        attemptCount: secondPatch.attemptCount,
        studentState: secondPatch.studentState,
      })
    }
    await expect(
      prisma.topicState.count({
        where: { topicId: graphResult.graph.topic.id },
      }),
    ).resolves.toBe(1)
    await expectGraphInvariants(
      prisma,
      fixture,
      await readGraphForMessage(prisma, graphResult.graph.message.id),
    )
    await expectNoPartialPhase1Rows(prisma, fixture)
  })

  it('creates one fallback topic and continues it for related identifier-free requests', async () => {
    const fixture = await createChatFixture(prisma)
    const first = await expectCreatedGraphResult(
      workflow.submit({
        fixture,
        idempotencyKey: phase1Key('fallback-first'),
        content: phase1Content('fallback first'),
      }),
    )

    expect(first.topicResolution).toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.CREATE_NEW_TOPIC,
      stableIdentitySource: TOPIC_STABLE_IDENTITY_SOURCE.DETERMINISTIC_FALLBACK,
      reason: 'created deterministic fallback topic',
    })
    expect(first.graph.topic).toMatchObject({
      status: TopicStatus.ACTIVE,
      title: 'General tutoring topic',
      topicType: TopicType.UNCLASSIFIED,
      problemId: null,
      conceptId: null,
    })
    expect(first.graph.message.topicId).toBe(first.graph.topic.id)
    expect(first.graph.turn.topicId).toBe(first.graph.topic.id)
    expect(first.graph.state).toMatchObject(
      defaultTopicState(first.graph.topic.id),
    )

    const second = await expectCreatedGraphResult(
      workflow.submit({
        fixture,
        idempotencyKey: phase1Key('fallback-second'),
        content: phase1Content('fallback second'),
      }),
    )

    expect(second.topicResolution).toMatchObject({
      outcome: TOPIC_RESOLUTION_OUTCOME.CONTINUE_CURRENT_TOPIC,
      topicId: first.graph.topic.id,
      stableIdentitySource: TOPIC_STABLE_IDENTITY_SOURCE.ACTIVE_TOPIC,
    })
    expect(second.graph.topic.id).toBe(first.graph.topic.id)
    expect(second.graph.state.id).toBe(first.graph.state.id)
    expect(second.graph.turn.id).not.toBe(first.graph.turn.id)
    expect(second.graph.message.id).not.toBe(first.graph.message.id)
    await expectGraphInvariants(prisma, fixture, first.graph)
    await expectGraphInvariants(prisma, fixture, second.graph)
    await expect(
      prisma.topic.count({
        where: {
          sessionId: fixture.sessionId,
          problemId: null,
          conceptId: null,
          title: 'General tutoring topic',
          topicType: TopicType.UNCLASSIFIED,
        },
      }),
    ).resolves.toBe(1)
    await expectNoPartialPhase1Rows(prisma, fixture)
  })
})

async function createChatFixture(prisma: PrismaService): Promise<ChatFixture> {
  const student = await prisma.user.create({
    data: {
      email: `issue169-${randomUUID()}@morshid.test`,
      displayName: 'Issue 169 student',
      role: 'STUDENT',
      passwordHash: 'test-password-hash',
    },
  })
  const course = await prisma.course.create({
    data: {
      code: `I169-${randomUUID().slice(0, 24)}`,
      title: 'Issue 169 Phase 1 integration course',
      createdById: student.id,
    },
  })
  await prisma.courseMembership.create({
    data: {
      courseId: course.id,
      userId: student.id,
      role: 'STUDENT',
      createdById: student.id,
    },
  })
  const session = await prisma.chatSession.create({
    data: {
      courseId: course.id,
      studentId: student.id,
      title: 'Phase 1 integration',
    },
  })

  return {
    courseId: course.id,
    studentId: student.id,
    sessionId: session.id,
  }
}

async function readGraphForMessage(
  prisma: PrismaService,
  messageId: string,
): Promise<PersistedGraph> {
  const message = await prisma.message.findUniqueOrThrow({
    where: { id: messageId },
    select: {
      id: true,
      sessionId: true,
      turnId: true,
      topicId: true,
      role: true,
      content: true,
      status: true,
      requestKind: true,
      hintLevel: true,
      turn: {
        select: {
          id: true,
          sessionId: true,
          topicId: true,
          studentMessageId: true,
          approvedTutorMessageId: true,
          idempotencyKey: true,
          status: true,
          failureCode: true,
          safeFallbackUsed: true,
          createdAt: true,
          completedAt: true,
        },
      },
      topic: {
        select: {
          id: true,
          sessionId: true,
          courseId: true,
          problemId: true,
          conceptId: true,
          title: true,
          topicType: true,
          status: true,
          resolvedAt: true,
          state: {
            select: {
              id: true,
              topicId: true,
              version: true,
              requestKind: true,
              studentState: true,
              activeStrategy: true,
              primaryTechnique: true,
              supportingTechnique: true,
              guidanceLevel: true,
              revealPolicy: true,
              attemptCount: true,
              meaningfulAttemptCount: true,
              misconceptionStatus: true,
              learningStatus: true,
              resolutionEvidenceStrength: true,
              summary: true,
              lastTutorQuestion: true,
              lastStudentAction: true,
              resolved: true,
              updatedAt: true,
            },
          },
        },
      },
      session: {
        select: {
          id: true,
          courseId: true,
        },
      },
    },
  })

  if (message.turn === null || message.topic === null) {
    throw new Error(`Message ${message.id} is missing Phase 1 linkage`)
  }
  if (message.topic.state === null) {
    throw new Error(`Topic ${message.topic.id} is missing TopicState`)
  }

  const stateCount = await prisma.topicState.count({
    where: { topicId: message.topic.id },
  })

  return {
    message: {
      id: message.id,
      sessionId: message.sessionId,
      turnId: message.turnId,
      topicId: message.topicId,
      role: message.role,
      content: message.content,
      status: message.status,
      requestKind: message.requestKind,
      hintLevel: message.hintLevel,
    },
    turn: message.turn,
    topic: {
      id: message.topic.id,
      sessionId: message.topic.sessionId,
      courseId: message.topic.courseId,
      problemId: message.topic.problemId,
      conceptId: message.topic.conceptId,
      title: message.topic.title,
      topicType: message.topic.topicType,
      status: message.topic.status,
      resolvedAt: message.topic.resolvedAt,
    },
    state: message.topic.state,
    stateCount,
    chatSession: message.session,
  }
}

async function expectGraphInvariants(
  prisma: PrismaService,
  fixture: ChatFixture,
  graph: PersistedGraph,
): Promise<void> {
  expect(graph.message).toMatchObject({
    role: MessageRole.STUDENT,
    status: MessageStatus.COMPLETED,
    requestKind: null,
    hintLevel: null,
  })
  expect(graph.message.turnId).toBe(graph.turn.id)
  expect(graph.message.topicId).toBe(graph.topic.id)
  expect(graph.turn.studentMessageId).toBe(graph.message.id)
  expect(graph.turn.topicId).toBe(graph.topic.id)
  expect(graph.message.sessionId).toBe(graph.turn.sessionId)
  expect(graph.topic.sessionId).toBe(graph.turn.sessionId)
  expect(graph.message.sessionId).toBe(fixture.sessionId)
  expect(graph.topic.courseId).toBe(graph.chatSession.courseId)
  expect(graph.topic.courseId).toBe(fixture.courseId)
  expect(graph.state.topicId).toBe(graph.topic.id)
  expect(graph.stateCount).toBe(1)
  expect(graph.turn.status).not.toBe('COMPLETED')
  expect(graph.turn.completedAt).toBeNull()
  expect(graph.turn.approvedTutorMessageId).toBeNull()
  expect(graph.turn).not.toHaveProperty('content')
  expect(graph.state.summary).not.toBe(graph.message.content)
  expect(graph.state.lastStudentAction).not.toBe(graph.message.content)
  expect(graph.state.lastTutorQuestion).not.toBe(graph.message.content)

  await expect(
    prisma.tutorTurn.count({
      where: {
        id: graph.turn.id,
        sessionId: { not: graph.message.sessionId },
      },
    }),
  ).resolves.toBe(0)
  await expect(
    prisma.topic.count({
      where: {
        id: graph.topic.id,
        OR: [
          { sessionId: { not: graph.turn.sessionId } },
          { courseId: { not: fixture.courseId } },
        ],
      },
    }),
  ).resolves.toBe(0)
}

async function expectNoPartialPhase1Rows(
  prisma: PrismaService,
  fixture: ChatFixture,
): Promise<void> {
  await expect(
    prisma.message.count({
      where: {
        sessionId: fixture.sessionId,
        role: MessageRole.STUDENT,
        content: { startsWith: '[phase1-flow]' },
        OR: [{ turnId: null }, { topicId: null }],
      },
    }),
  ).resolves.toBe(0)
  await expect(
    prisma.tutorTurn.count({
      where: {
        sessionId: fixture.sessionId,
        idempotencyKey: { startsWith: 'p1-' },
        OR: [{ studentMessageId: null }, { topicId: null }],
      },
    }),
  ).resolves.toBe(0)
}

async function expectGraphResult(
  resultPromise: Promise<Phase1WorkflowResult>,
): Promise<Extract<Phase1WorkflowResult, { graph: PersistedGraph }>> {
  const result = await resultPromise

  if (result.kind === 'already_processing') {
    throw new Error('Expected a persisted Phase 1 graph')
  }

  return result
}

async function expectCreatedGraphResult(
  resultPromise: Promise<Phase1WorkflowResult>,
): Promise<Extract<Phase1WorkflowResult, { kind: 'created_graph' }>> {
  const result = await resultPromise

  if (result.kind !== 'created_graph') {
    throw new Error(`Expected a created Phase 1 graph, got ${result.kind}`)
  }

  return result
}

async function readTopicAndState(
  prisma: PrismaService,
  topicId: string,
): Promise<{
  topic: { status: TopicStatus }
  state: TopicStateSnapshot
}> {
  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    select: {
      status: true,
      state: {
        select: {
          id: true,
          topicId: true,
          version: true,
          requestKind: true,
          studentState: true,
          activeStrategy: true,
          primaryTechnique: true,
          supportingTechnique: true,
          guidanceLevel: true,
          revealPolicy: true,
          attemptCount: true,
          meaningfulAttemptCount: true,
          misconceptionStatus: true,
          learningStatus: true,
          resolutionEvidenceStrength: true,
          summary: true,
          lastTutorQuestion: true,
          lastStudentAction: true,
          resolved: true,
          updatedAt: true,
        },
      },
    },
  })

  if (topic.state === null) {
    throw new Error(`Topic ${topicId} is missing TopicState`)
  }

  return {
    topic: { status: topic.status },
    state: topic.state,
  }
}

async function readTopicStatus(
  prisma: PrismaService,
  topicId: string,
): Promise<TopicStatus> {
  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    select: { status: true },
  })

  return topic.status
}

async function expectActiveTopicCount(
  prisma: PrismaService,
  fixture: ChatFixture,
  count: number,
): Promise<void> {
  await expect(
    prisma.topic.count({
      where: {
        sessionId: fixture.sessionId,
        courseId: fixture.courseId,
        status: TopicStatus.ACTIVE,
      },
    }),
  ).resolves.toBe(count)
}

function defaultTopicState(topicId: string): Partial<TopicStateSnapshot> {
  return {
    topicId,
    version: 1,
    requestKind: null,
    studentState: StudentState.UNKNOWN,
    activeStrategy: null,
    primaryTechnique: null,
    supportingTechnique: null,
    guidanceLevel: 1,
    attemptCount: 0,
    meaningfulAttemptCount: 0,
    learningStatus: LearningStatus.UNKNOWN,
    resolutionEvidenceStrength: ResolutionEvidenceStrength.NONE,
    summary: null,
    lastTutorQuestion: null,
    lastStudentAction: null,
    resolved: false,
  }
}

function phase1Key(label: string): string {
  return `p1-${label}-${randomUUID()}`
}

function phase1Content(label: string): string {
  return `[phase1-flow] ${label} ${randomUUID()}`
}

function isFulfilled<T>(
  result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled'
}

function isRejected(
  result: PromiseSettledResult<unknown>,
): result is PromiseRejectedResult {
  return result.status === 'rejected'
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}
