/** @type {import('jest').Config} */
const path = require('node:path');

const expoPackagePath = path.dirname(require.resolve('expo/package.json'));
const expoModulesCorePath = path.dirname(
  require.resolve('expo-modules-core/package.json', {
    paths: [expoPackagePath],
  }),
);

module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/__tests__'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // npm keeps this optional-peer dependency nested under Expo in the workspace.
    '^expo-modules-core$': expoModulesCorePath,
    '^expo-modules-core/(.*)$': `${expoModulesCorePath}/$1`,
  },
};
