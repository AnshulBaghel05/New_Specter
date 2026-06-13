import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { basicAuth } from './bull-board-auth'
import {
  probeQueue,
  httpQueue,
  playwrightQueue,
  captchaSolveQueue,
  deadLetterQueue,
  validationErrorsQueue,
  aiErrorsQueue,
} from './queue'

/**
 * Bull Board ops dashboard. Runs as its own small Railway service (an Express
 * server, NOT a queue worker) so ops can inspect every queue — pending, active,
 * failed, and the no-worker dead-letter / validation / AI-error queues — without
 * shelling into Redis.
 *
 * Mounted at /ops/queues behind HTTP Basic Auth (BULL_BOARD_USER / BULL_BOARD_PASS).
 * Auth is implemented inline (no extra dep): constant-time credential compare,
 * and a hard 500 if the env vars aren't set so the board can never come up open.
 */
const BASE_PATH = '/ops/queues'

export function createBullBoardApp(): express.Express {
  const serverAdapter = new ExpressAdapter()
  serverAdapter.setBasePath(BASE_PATH)

  createBullBoard({
    // The 6 queues from the spec, plus captcha:solve (a real active queue ops
    // also needs to watch). dead-letter / validation-errors / ai-errors have no
    // workers — they exist purely for inspection here.
    queues: [
      new BullMQAdapter(probeQueue),
      new BullMQAdapter(httpQueue),
      new BullMQAdapter(playwrightQueue),
      new BullMQAdapter(captchaSolveQueue),
      new BullMQAdapter(deadLetterQueue),
      new BullMQAdapter(validationErrorsQueue),
      new BullMQAdapter(aiErrorsQueue),
    ],
    serverAdapter,
  })

  const app = express()
  // Liveness for Railway — unauthenticated, no queue data exposed.
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' })
  })
  app.use(BASE_PATH, basicAuth, serverAdapter.getRouter())
  return app
}

// Entrypoint: `node bull-board.js` (or ts-node bull-board.ts) on its own service.
// Guarded so importing this module in tests doesn't bind a port.
if (require.main === module) {
  const app = createBullBoardApp()
  const port = Number(process.env.BULL_BOARD_PORT ?? process.env.PORT ?? 3001)
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[bull-board] listening on :${port}${BASE_PATH}`)
  })
}
