import { rmSync } from 'node:fs';

rmSync('tsconfig.build.tsbuildinfo', { force: true });
