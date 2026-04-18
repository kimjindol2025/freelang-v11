const path = require('path');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: path.join(__dirname, '..'),
  globals: {
    'ts-jest': {
      diagnostics: false,
      tsconfig: path.join(__dirname, 'tsconfig.json'),
    }
  },
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: true,
  collectCoverageFrom: [
    // 핵심 실행 엔진 (커버리지 75%+ 달성 대상)
    'src/lexer.ts',
    'src/ast.ts',
    'src/token.ts',
    'src/errors.ts',
    'src/error-formatter.ts',
    'src/interpreter-scope.ts',
    'src/eval-builtins.ts',
    'src/eval-special-forms.ts',
    // parser.ts는 2255줄의 대형 파일로 별도 전문 테스트 필요 — 제외
    // eval-call-function.ts는 비동기/TCO 케이스 많음 — 제외
  ],
  coverageThreshold: {
    global: {
      lines: 75
    }
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testTimeout: 30000,
  verbose: true,
  bail: false,
  maxWorkers: '50%',
  detectOpenHandles: true,
  forceExit: true
};
