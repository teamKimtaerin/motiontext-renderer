import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig(({ command, mode }) => {
  // Demo development mode
  if (command === 'serve' && mode === 'development') {
    return {
      root: 'demo',
      server: {
        host: true,
        port: 3000,
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src'),
        },
      },
    };
  }

  // Library build mode
  return {
    plugins: [
      dts({
        insertTypesEntry: true,
        include: ['src/**/*'],
        exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
      }),
    ],
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'MotionTextRenderer',
        formats: ['es', 'cjs'],
        fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
      },
      rollupOptions: {
        external: ['gsap'],
        output: {
          globals: {
            gsap: 'gsap',
          },
        },
      },
      sourcemap: true,
      minify: 'terser',
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
  };
});