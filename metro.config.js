// getSentryExpoConfig = getDefaultConfig do Expo + ids de depuração nos bundles (para o Sentry ligar o erro ao código-fonte)
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css' });
