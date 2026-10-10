// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // Existing screens set state inside effects; they are rewritten in Phase 2.
      // Kept as warnings so new code still gets flagged in review.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    ignores: ['dist/*', 'android/*', 'ios/*'],
  },
]);
