// Root-level shim so that `npx jest ...` (without --config) finds the config.
// Full config lives at .config/jest.config.js (with coverage + verbose).
// For fast runs without coverage, use: npm test or npm run test:fast.
module.exports = require('./.config/jest.fast.config.js');
