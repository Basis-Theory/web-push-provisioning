import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat();

export default compat.config({
  root: true,
  env: {
    browser: false,
    es6: true,
    node: true,
    jest: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'get-off-my-lawn', 'prettier'],
  extends: [
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-floating-promises': 'warn',
    '@typescript-eslint/prefer-promise-reject-errors': 'warn',
  },
  ignorePatterns: [
    '**/*.cjs',
    '**/*.mjs',
    '**/*.js',
    'dist',
    '**/*.test.ts',
    'jest.config.js',
  ],
});
