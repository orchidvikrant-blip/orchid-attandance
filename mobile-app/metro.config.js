const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Mock native-only packages that aren't available in Expo Go
config.resolver.extraNodeModules = {
  'react-native-fs':        require.resolve('./rnfs-mock.js'),
  'react-native-worklets':  require.resolve('./rnfs-mock.js'),
};

module.exports = config;
