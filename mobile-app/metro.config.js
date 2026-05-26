const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  'react-native-fs':       require.resolve('./rnfs-mock.js'),
  'react-native-worklets': require.resolve('./rnfs-mock.js'),
};

// Allow bundling .bin model weight files
config.resolver.assetExts = [...config.resolver.assetExts, 'bin'];

module.exports = config;
