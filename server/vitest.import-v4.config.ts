import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'node',include:['prisma/import-v4/**/*.test.ts'],setupFiles:['src/test.setup.ts'],fileParallelism:false}});
