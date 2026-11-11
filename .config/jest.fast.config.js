// Fast test config — edit-time core regression checks only.
// Integration, external-service, performance, and self-hosting suites belong
// to `npm run test:full`; including them here made `test:fast` unbounded.
const path = require('path');
const base = require('./jest.config');

module.exports = {
  ...base,
  collectCoverage: false,
  coverageThreshold: undefined,
  verbose: false,
  reporters: ['default'],
  // ts-jest's project-wide type program dominates short test runs. Fast tests
  // only need transpilation; `test:full` retains the stricter base profile.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: path.join(__dirname, 'tsconfig.fast.json'),
      diagnostics: false,
    }],
  },
  globals: {},
  testMatch: [
    '<rootDir>/src/**/__tests__/{lexer,parser}.test.ts',
  ],
  maxWorkers: 1,
  detectOpenHandles: false,
  forceExit: false,
};
