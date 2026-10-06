// Metro config for Thufu Deploy monorepo
// expo at thufu-deploy/node_modules, react-native at thufu-deploy/mobile/node_modules
const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const projectRoot = path.resolve(__dirname);           // thufu-deploy/mobile/
const monorepoRoot = path.resolve(projectRoot, '..'); // thufu-deploy/

const config = getDefaultConfig(projectRoot);

// Override assetRegistryPath so Metro finds the real asset registry
config.transformer = config.transformer || {};
config.transformer.assetRegistryPath = require.resolve(
  '@react-native/assets-registry/registry',
  { paths: [path.join(projectRoot, 'node_modules')] }
);

// Override nodeModulesPaths to include BOTH roots so Metro finds all packages
config.resolver = config.resolver || {};
config.resolver.nodeModulesPaths = [
  monorepoRoot + '/node_modules',   // thufu-deploy/node_modules
  projectRoot + '/node_modules',   // thufu-deploy/mobile/node_modules
];

module.exports = config;
