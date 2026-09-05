// Transient failure handling for the long running maintenance scripts.
//
// A rebuild can run for a long time, and any blip - a mongod restart, a
// dropped TCP connection, a brief ElasticSearch outage - kills the operation
// that happened to be in flight. The MongoDB driver reconnects underneath and
// retries reads once, but a single retry is not enough to ride out a restart,
// so each batch gets its own bounded retry with exponential backoff.

const TRANSIENT = [
  "MongoNetworkError",
  "MongoNotConnectedError",
  "MongoTopologyClosedError",
  "connection closed",
  "connection establishment was cancelled",
  "socket hang up",
  "Topology is closed",
  "server selection",
  "buffering timed out",
  "cursor id",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ConnectionError",
  "TimeoutError",
];

const isTransient = (err) => {
  const text = `${err?.name || ""} ${err?.message || ""} ${err?.code || ""}`;
  return TRANSIENT.some((needle) =>
    text.toLowerCase().includes(needle.toLowerCase()),
  );
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs fn, retrying transient failures with exponential backoff. Anything that
 * is not a recognised connectivity failure is rethrown immediately - a genuine
 * bug should surface, not be retried five times.
 *
 * @param {string} label shown in the retry message
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
const withRetry = async (
  label,
  fn,
  { attempts = 6, baseDelayMs = 1000 } = {},
) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= attempts || !isTransient(err)) throw err;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `  ${label} failed (${err.message}); retrying in ${delay}ms ` +
          `[attempt ${attempt}/${attempts - 1}]`,
      );
      await sleep(delay);
    }
  }
};

module.exports = { withRetry, isTransient };
