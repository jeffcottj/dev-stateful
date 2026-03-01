import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/.next/**', '**/dist/**', '**/node_modules/**', '**/next-env.d.ts'],
  },
  ...tseslint.configs.recommended,
  prettierConfig
);
