// Build only the generated HTTP host bridge. Do not regenerate bootstrap.js.
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
esbuild.buildSync({
  entryPoints: [path.join(root, 'src/generated-http-host.ts')],
  outfile: path.join(root, 'generated-http-host.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  logLevel: 'warning',
});
console.log('generated-http-host.cjs built');
