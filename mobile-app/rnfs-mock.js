// Mock for react-native-fs — needed by @tensorflow/tfjs-react-native
// We don't use bundle_resource_io so these are never actually called
module.exports = {
  readFile: () => Promise.resolve(''),
  writeFile: () => Promise.resolve(),
  exists: () => Promise.resolve(false),
  mkdir: () => Promise.resolve(),
  unlink: () => Promise.resolve(),
  DocumentDirectoryPath: '/tmp',
  CachesDirectoryPath: '/tmp',
  ExternalDirectoryPath: '/tmp',
};
