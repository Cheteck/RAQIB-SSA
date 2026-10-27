import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

import { RaqibRuntime } from './RaqibRuntime';
import { createRuntimeServer } from './api/server';

async function main() {
  const runtime = new RaqibRuntime();
  await runtime.initialize();

  const app = createRuntimeServer(runtime);
  const port = process.env.PORT || 4000;

  const server = app.listen(port, () => {
    console.log(`RAQIB Autonomous Runtime Service running on port ${port}`);
  });

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down...');
    await runtime.stop();
    server.close();
  });
}

if (require.main === module) {
  main().catch(console.error);
}

export * from './RaqibRuntime';
export * from './api/server';
