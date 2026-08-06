/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['../../.eslintrc.js'],
  ignorePatterns: ['**/*.spec.ts'],
  rules: {
    // NestJS modules are often empty classes used as containers
    '@typescript-eslint/no-extraneous-class': 'off',
    // Prisma client returns untyped results; explicit any is needed
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    // Express types are resolved at runtime via NestJS
    'import/no-unresolved': [
      'error',
      { ignore: ['^express$'] },
    ],
  },
};
