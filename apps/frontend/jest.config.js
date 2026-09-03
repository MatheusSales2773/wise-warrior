/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/__tests__'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
    '^expo-modules-core$': '<rootDir>/node_modules/expo/node_modules/expo-modules-core',
    '^expo-modules-core/(.*)$': '<rootDir>/node_modules/expo/node_modules/expo-modules-core/$1',
  },
};
