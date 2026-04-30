/**
 * Vercel serverless catch-all for /api/* routes.
 *
 * Vercel auto-detects `.ts` files in `api/` and serves them as
 * @vercel/node functions. The `[...path]` filename means this file
 * receives EVERY /api/* request that isn't matched by a more specific
 * file in api/. We delegate the request to the Express app defined in
 * `server.ts` so the existing route handlers (webhooks, syncs, imports)
 * keep working without duplication.
 *
 * The Express app is created once per cold-start and reused across
 * warm invocations of the same function instance.
 */
import { createApiApp } from '../server';

const app = createApiApp();

export default app;
