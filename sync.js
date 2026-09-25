// sync.js
// This is the small API adapter for local-first syncing.
// The included server.py is a development/demo sync server, not production authentication.

const REQUEST_TIMEOUT_MS = 6000;

export class SyncError extends Error {
  constructor(message, kind = 'network') {
    super(message);
    this.name = 'SyncError';
    this.kind = kind;
  }
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new SyncError(body.message || `Sync request failed (${response.status}).`, 'server');
    }
    return body;
  } catch (error) {
    if (error instanceof SyncError) throw error;
    if (error.name === 'AbortError') {
      throw new SyncError('The sync server took too long to answer.', 'timeout');
    }
    throw new SyncError('No sync server is available on this device yet.', 'network');
  } finally {
    clearTimeout(timeout);
  }
}

export async function getServerHealth() {
  return requestJson('/api/health', { method: 'GET' });
}

export async function syncWithServer({ companyId, deviceId, baseVersion, state }) {
  return requestJson('/api/sync', {
    method: 'POST',
    body: JSON.stringify({
      companyId,
      deviceId,
      baseVersion,
      state,
    }),
  });
}
