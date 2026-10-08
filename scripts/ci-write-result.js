#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const name = arg('--name');
const outputDir = arg('--output-dir', 'ci-results');
const sourceJson = arg('--source-json');
const exitCode = Number(arg('--exit-code', '1'));

if (!name) throw new Error('--name is required');
fs.mkdirSync(outputDir, { recursive: true });

let source = null;
let sourceError = null;
if (sourceJson) {
  try {
    source = JSON.parse(fs.readFileSync(sourceJson, 'utf8'));
  } catch (error) {
    sourceError = String(error.message || error);
  }
}

const timedOut = exitCode === 124 || exitCode === 137 || exitCode === 143;
const sourceValid = !sourceJson || (source && typeof source === 'object' && typeof source.success === 'boolean');
const sourcePassed = sourceValid && source && source.success === true && Number(source.numFailedTests || 0) === 0;
const passed = exitCode === 0 && sourceError === null && (sourceJson ? sourcePassed : true);
const result = {
  schema: 'freelang-ci-result/v1',
  name,
  status: passed ? 'success' : (timedOut ? 'timed_out' : 'failure'),
  success: passed,
  exitCode,
  sourceJson: sourceJson || null,
  sourceError,
  sourceValid,
  capturedAt: new Date().toISOString(),
};
if (source && typeof source === 'object') {
  for (const key of ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'startTime', 'endTime']) {
    if (Object.prototype.hasOwnProperty.call(source, key)) result[key] = source[key];
  }
}

const resultPath = path.join(outputDir, `${name}.json`);
const junitPath = path.join(outputDir, `${name}.junit.xml`);
fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);

const xml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');
const assertionResults = source && Array.isArray(source.testResults)
  ? source.testResults.flatMap((file) => (file.assertionResults || []).map((test) => ({ ...test, file: file.name })))
  : [];
const cases = assertionResults.length > 0
  ? assertionResults
  : [{ fullName: name, status: passed ? 'passed' : 'failed', duration: 0, failureMessages: [] }];
const failures = cases.filter((test) => test.status === 'failed').length || (passed ? 0 : 1);
const skipped = cases.filter((test) => test.status === 'pending' || test.status === 'todo').length;
const testCasesXml = cases.map((test) => {
  const failure = test.status === 'failed'
    ? `<failure message="${xml((test.failureMessages || []).join('\n') || 'check failed')}" />`
    : '';
  const skippedXml = (test.status === 'pending' || test.status === 'todo') ? '<skipped />' : '';
  return `<testcase classname="${xml(test.file || name)}" name="${xml(test.fullName || name)}" time="${Number(test.duration || 0) / 1000}">${failure}${skippedXml}</testcase>`;
}).join('');
const tests = cases.length;
fs.writeFileSync(
  junitPath,
  `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${xml(name)}" tests="${tests}" failures="${failures}" skipped="${skipped}">${testCasesXml}</testsuite>\n`,
);
