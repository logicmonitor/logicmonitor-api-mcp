import { defineConfig } from 'orval';

export default defineConfig({
  logicmonitor: {
    input: './src/schemas/swagger.json',
    output: {
      target: './src/schemas/generated/logicmonitorSwaggerSchema.ts',
      client: 'zod',
      mode: 'single',
      clean: true,
    },
  },
});

