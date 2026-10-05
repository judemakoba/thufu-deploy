const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = path.resolve(__dirname);
const workspaceRoot = path.resolve(projectRoot, '..');

console.log('[Metro] projectRoot:', projectRoot);
console.log('[Metro] workspaceRoot:', workspaceRoot);

const config = getDefaultConfig(projectRoot);

// expo/metro-config auto-detects projectRoot via app.json at projectRoot.
// CRITICAL: Metro defaults override assetRegistryPath to 'missing-asset-registry-path'.
// We MUST override this here so Metro can find the actual asset registry.
config.transformer = config.transformer || {};
config.transformer.assetRegistryPath = '@react-native/assets-registry/registry';

// Override nodeModulesPaths to include both workspace root and mobile node_modules.
// This allows Metro to find expo (in workspace root) and react-native (in mobile).
config.resolver = config.resolver || {};
config.resolver.nodeModulesPaths = [
  path.join(workspaceRoot, 'node_modules'),       // thufu-deploy/node_modules (expo, @expo/*)
  path.join(projectRoot, 'node_modules'),         // thufu-deploy/mobile/node_modules (@react-native-*, react-native)
];

console.log('[Metro] assetRegistryPath:', config.transformer.assetRegistryPath);
console.log('[Metro] nodeModulesPaths:', config.resolver.nodeModulesPaths);
