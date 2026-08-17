import type { RunTutoringTurnCommand } from './run-tutoring-turn-command'
import type { TutoringTurnReceipt } from './tutoring-turn-receipt'

export abstract class TutoringRuntime {
  abstract run(command: RunTutoringTurnCommand): Promise<TutoringTurnReceipt>
}
