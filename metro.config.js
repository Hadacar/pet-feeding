const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.sourceExts.push('cjs');
defaultConfig.resolver.unstable_enablePackageExports = false;

// Add extraNodeModules to provide polyfills and mocks for Node.js core modules
defaultConfig.resolver.extraNodeModules = {
  url: require.resolve('react-native-url-polyfill'),
  stream: require.resolve('readable-stream'),
  dns: path.resolve(__dirname, 'mocks/dns.js'),
  util: require.resolve('util/'),
  assert: require.resolve('assert/'),
  net: path.resolve(__dirname, 'mocks/net.js'),
  ...defaultConfig.resolver.extraNodeModules,
};

module.exports = defaultConfig; 