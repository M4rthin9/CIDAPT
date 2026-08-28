import IORedis from 'ioredis';

let client: IORedis | undefined;

export function getValkey(): IORedis {
  if (client) return client;
  const url = (process.env.VALKEY_URL as string) ?? 'redis://:changeme@localhost:6379';
  client = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  return client;
}

export async function closeValkey(): Promise<void> {
  if (client) {
    await client.quit().catch(() => client?.disconnect());
    client = undefined;
  }
}
