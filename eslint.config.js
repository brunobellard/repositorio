// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Functions rodam em Deno (fora do app): têm checagem própria
    ignores: ['dist/*', 'supabase/functions/*'],
  },
]);
