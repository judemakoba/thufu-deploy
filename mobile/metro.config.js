const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

// Paths
const projectRoot = __dirname;                           // thufu-deploy/mobile/
const monorepoRoot = path.resolve(projectRoot, '..');   // thufu-deploy/

const config = {
  projectRoot,
  watchFolders: [monorepoRoot],

  // Critical: resolve react-native from mobile/node_modules (RN 0.73.4), not root (RN 18.3.1)
  resolver: {
    nodeModulesPaths: [
      path.join(projectRoot, 'node_modules'),   // mobile/node_modules/
      path.join(monorepoRoot, 'node_modules'), // thufu-deploy/node_modules/
    ],
  },

  // Ensure react-native resolves from mobile/node_modules
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === 'react-native') {
      const rnPath = path.join(projectRoot, 'node_modules/react-native/package.json');
      return {
        filePath: rnPath,
        type: 'sourceFile',
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
