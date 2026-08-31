import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';
import { reconciliationQueue, notifyQueue, enquiryQueue } from './queues.js';

const PORT = Number(process.env.BOARD_PORT ?? 3001);

const adapter = new HonoAdapter(serveStatic);

createBullBoard({
  queues: [
    new BullMQAdapter(reconciliationQueue),
    new BullMQAdapter(notifyQueue),
    new BullMQAdapter(enquiryQueue),
  ],
  serverAdapter: adapter,
});

adapter.setBasePath('/admin/queues');

const app = adapter.registerPlugin();

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Bull Board running at http://localhost:${PORT}/admin/queues`);
});
