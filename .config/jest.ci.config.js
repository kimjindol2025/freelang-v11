// CI runs need the complete Jest test inventory, but shards and targeted
// regressions must not be judged against a repository-wide coverage threshold.
const base = require('./jest.config');

module.exports = {
  ...base,
  collectCoverage: false,
  coverageThreshold: undefined,
  verbose: false,
  reporters: ['default'],
};
