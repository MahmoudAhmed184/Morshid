import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common'

import { PrismaService } from '../prisma/prisma.service'
import {
  MATERIAL_PROCESSING_DRAIN_BATCH_SIZE,
  MATERIAL_PROCESSING_POLL_MS,
  MATERIAL_PROCESSING_SHUTDOWN_TIMEOUT_MS,
} from './material-processing.constants'
import { MaterialProcessingService } from './material-processing.service'

export abstract class MaterialProcessingScheduler {
  abstract scheduleMaterialProcessing(materialId: string): Promise<void>
}

@Injectable()
export class DurableMaterialProcessingScheduler
  extends MaterialProcessingScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DurableMaterialProcessingScheduler.name)
  private pollTimer: NodeJS.Timeout | undefined
  private drainImmediate: NodeJS.Immediate | undefined
  private drainRunning = false
  private drainRequested = false
  private activeDrain: Promise<void> | undefined
  private stopped = false

  constructor(
    private readonly prismaService: PrismaService,
    private readonly materialProcessingService: MaterialProcessingService,
  ) {
    super()
  }

  onModuleInit(): void {
    this.stopped = false
    this.pollTimer = setInterval(() => {
      this.requestDrain()
    }, MATERIAL_PROCESSING_POLL_MS)
    this.pollTimer.unref()
    this.requestDrain()
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true
    if (this.pollTimer !== undefined) {
      clearInterval(this.pollTimer)
      this.pollTimer = undefined
    }
    if (this.drainImmediate !== undefined) {
      clearImmediate(this.drainImmediate)
      this.drainImmediate = undefined
    }

    const activeDrain = this.activeDrain
    if (activeDrain === undefined) {
      return
    }

    const completed = await waitForPromise(
      activeDrain,
      MATERIAL_PROCESSING_SHUTDOWN_TIMEOUT_MS,
    )
    if (!completed) {
      this.logger.warn(
        'Material processing drain exceeded the graceful shutdown timeout',
      )
    }
  }

  async scheduleMaterialProcessing(materialId: string): Promise<void> {
    await this.prismaService.materialProcessingCommand.upsert({
      where: { materialId },
      create: { materialId },
      update: {},
    })
    this.requestDrain()
  }

  private requestDrain(): void {
    if (this.stopped) {
      return
    }

    this.drainRequested = true
    if (this.drainRunning || this.drainImmediate !== undefined) {
      return
    }

    this.drainImmediate = setImmediate(() => {
      this.drainImmediate = undefined
      const activeDrain = this.drainOnce().catch(() => {
        this.logger.error('Material processing command drain failed')
      })
      this.activeDrain = activeDrain
      void activeDrain.finally(() => {
        if (this.activeDrain === activeDrain) {
          this.activeDrain = undefined
        }
        if (this.drainRequested) {
          this.requestDrain()
        }
      })
    })
  }

  private async drainOnce(): Promise<void> {
    if (this.drainRunning || this.stopped) {
      return
    }

    this.drainRunning = true
    this.drainRequested = false
    try {
      const commands =
        await this.prismaService.materialProcessingCommand.findMany({
          where: {
            OR: [
              { processingAttemptId: null },
              { leaseExpiresAt: { lte: new Date() } },
            ],
          },
          select: { materialId: true },
          orderBy: { createdAt: 'asc' },
          take: MATERIAL_PROCESSING_DRAIN_BATCH_SIZE,
        })

      for (const command of commands) {
        if (this.isStopped()) {
          return
        }

        try {
          await this.materialProcessingService.processMaterial(
            command.materialId,
          )
        } catch {
          this.logger.error(
            `Material processing task failed materialId=${command.materialId}`,
          )
        }
      }
    } finally {
      this.drainRunning = false
    }
  }

  private isStopped(): boolean {
    return this.stopped
  }
}

async function waitForPromise(
  promise: Promise<void>,
  timeoutMs: number,
): Promise<boolean> {
  let timeout: NodeJS.Timeout | undefined
  const timeoutReached = new Promise<boolean>((resolve) => {
    timeout = setTimeout(() => {
      resolve(false)
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise.then(() => true), timeoutReached])
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout)
    }
  }
}
