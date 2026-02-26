import type { Config } from 'jest';

const config: Config = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',

  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },

  // 🔥 clave: que jest levante los types del entorno
  setupFilesAfterEnv: [],

  moduleFileExtensions: ['ts', 'js', 'json'],
  passWithNoTests: true,
};

export default config;