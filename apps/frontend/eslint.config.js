const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'dist/*',
      '.expo/*',
      'ios/*',
      'android/*',
      'index.html',
      'vite.config.ts',
      'src/App.tsx',
      'src/main.tsx',
      'src/vite-env.d.ts',
      'src/components/*',
      'src/features/*',
      'src/layouts/*',
      'src/lib/*',
      'src/pages/*',
      'src/styles/*',
      'src/test/*',
    ],
  },
];
