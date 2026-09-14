import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

const MAX_INCOMING_ID_LENGTH = 200;

/**
 * Correlates every log line, metric, and error report produced while handling a
 * request with a single id.
 *
 * An inbound `x-request-id` is honoured (so a gateway, the indexer, or a partner
 * SDK can seed it) but is length-bounded and never trusted for anything other
 * than logging. When absent, the API mints a UUIDv4 and echoes it on the response
 * so a client can quote it in a bug report.
 */
const requestIdStorage = new AsyncLocalStorage<string>();

/** The request id for the currently executing request, if any. */
export function currentRequestId(): string | undefined {
  return requestIdStorage.getStore();
}

/** Choose the id to use: a sane inbound one, or a fresh UUID. */
export function resolveRequestId(incoming: string | string[] | undefined): string {
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  if (candidate && candidate.length > 0 && candidate.length <= MAX_INCOMING_ID_LENGTH) {
    return candidate;
  }
  return randomUUID();
}

interface FastifyRequestLike {
  headers?: Record<string, string | string[] | undefined>;
}

interface FastifyReplyLike {
  header: (name: string, value: string) => unknown;
}

interface FastifyHookRegistry {
  addHook: (
    name: 'onRequest',
    handler: (request: FastifyRequestLike, reply: FastifyReplyLike, done: () => void) => void,
  ) => void;
}

/**
 * Wires request-id correlation into Fastify directly.
 *
 * This is an `onRequest` hook rather than a Nest `MiddlewareConsumer` because
 * Nest 11 changed wildcard route syntax, and a hook on the adapter we actually
 * use cannot be broken by that. The hook runs before routing, so even a 404 is
 * correlated.
 */
export function attachRequestContext(fastify: FastifyHookRegistry): void {
  fastify.addHook('onRequest', (request, reply, done) => {
    const requestId = resolveRequestId(request.headers?.[REQUEST_ID_HEADER]);
    reply.header(REQUEST_ID_HEADER, requestId);
    // Async continuations started inside this callback inherit the store.
    requestIdStorage.run(requestId, () => {
      done();
    });
  });
}
