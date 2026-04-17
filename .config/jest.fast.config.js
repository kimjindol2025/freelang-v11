// Fast test config — coverage 없이 2~3초 실행
const base = require('./jest.config');
module.exports = {
  ...base,
  collectCoverage: false,
  coverageThreshold: undefined,
  verbose: false,
  reporters: ['default'],
};
