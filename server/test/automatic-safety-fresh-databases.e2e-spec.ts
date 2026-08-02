import { AuditService } from '../src/modules/audit/audit.service'
import { ReviewCaseCreator } from '../src/modules/reviews/review-case.creator'
import { PrismaReviewCaseRepository } from '../src/modules/reviews/review-case.repository'
import { seedP0DemoData } from '../src/seeds/p0-demo.seed'
import {
  P0_REVIEW_READINESS_FIXTURE,
  seedP0ReviewReadinessData,
} from '../src/seeds/p0-review-readiness.seed'
import {
  setUpDisposableDatabase,
  type DisposableDatabase,
} from './support/disposable-database'

const EVIDENCE = {
  summary: 'A fixed automatic safety policy summary.',
  sources: [],
  facts: [
    { code: 'policy_version', value: 'output-policy-v1' },
    { code: 'reason_count', value: 1 },
  ],
} as const

interface DatabaseProof {
  readonly caseCount: number
  readonly triggerCount: number
  readonly actionCount: number
  readonly auditCount: number
  readonly replayedCount: number
}

describe('automatic review proof on independent fresh databases (e2e)', () => {
  it('repeats sequential, simultaneous, and concurrent trigger delivery deterministically', async () => {
    const proofs: DatabaseProof[] = []
    for (const suffix of ['a', 'b']) {
      proofs.push(await proveFreshDatabase(suffix))
    }

    expect(proofs).toEqual([
      {
        caseCount: 2,
        triggerCount: 3,
        actionCount: 3,
        auditCount: 3,
        replayedCount: 2,
      },
      {
        caseCount: 2,
        triggerCount: 3,
        actionCount: 3,
        auditCount: 3,
        replayedCount: 2,
      },
    ])
  }, 120_000)
})

async function proveFreshDatabase(suffix: string): Promise<DatabaseProof> {
  let database: DisposableDatabase | undefined
  try {
    database = await setUpDisposableDatabase(
      `morshid_issue145_automatic_safety_${suffix}`,
    )
    await seedP0DemoData(database.prisma)
    await seedP0ReviewReadinessData(database.prisma)
    const creator = new ReviewCaseCreator(
      new PrismaReviewCaseRepository(
        database.prisma,
        new AuditService(database.prisma),
      ),
    )

    const sequentialRequest = {
      messageId: P0_REVIEW_READINESS_FIXTURE.owned.assistantMessageId,
      trigger: 'GENERAL_NOT_FOUND' as const,
      sourceEventKey: 'issue145:sequential:general-not-found',
      evidence: EVIDENCE,
    }
    const sequentialFirst = await creator.createAutomatic(sequentialRequest)
    const sequentialReplay = await creator.createAutomatic(sequentialRequest)
    expect(sequentialReplay).toMatchObject({
      caseId: sequentialFirst.caseId,
      replayed: true,
    })

    const simultaneousRequest = {
      messageId: P0_REVIEW_READINESS_FIXTURE.foreign.assistantMessageId,
      trigger: 'POLICY_CHECK_FAILED' as const,
      sourceEventKey: 'issue145:simultaneous:policy-check',
      evidence: EVIDENCE,
    }
    const simultaneous = await Promise.all([
      creator.createAutomatic(simultaneousRequest),
      creator.createAutomatic(simultaneousRequest),
    ])
    expect(new Set(simultaneous.map(({ caseId }) => caseId)).size).toBe(1)
    expect(simultaneous.filter(({ replayed }) => replayed)).toHaveLength(1)

    const concurrentTrigger = await creator.createAutomatic({
      ...simultaneousRequest,
      trigger: 'FINAL_ANSWER_RISK',
      sourceEventKey: 'issue145:concurrent:final-answer',
    })
    expect(concurrentTrigger.caseId).toBe(simultaneous[0].caseId)
    expect(concurrentTrigger.replayed).toBe(true)

    return {
      caseCount: await database.prisma.reviewCase.count(),
      triggerCount: await database.prisma.reviewTrigger.count(),
      actionCount: await database.prisma.reviewAction.count(),
      auditCount: await database.prisma.auditLog.count({
        where: {
          action: { in: ['review.case_created', 'review.trigger_added'] },
        },
      }),
      replayedCount:
        Number(sequentialReplay.replayed) +
        simultaneous.filter(({ replayed }) => replayed).length,
    }
  } finally {
    await database?.dispose()
  }
}
