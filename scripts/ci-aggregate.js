#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const root = arg('--root', '.');
const expected = (arg('--expected', '') || '').split(',').map((x) => x.trim()).filter(Boolean);

function find(rootDir, fileName) {
  const found = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === fileName) found.push(full);
    }
  }
  walk(rootDir);
  return found;
}

let failed = false;
for (const name of expected) {
  const resultFiles = find(root, `${name}.json`);
  const junitFiles = find(root, `${name}.junit.xml`);
  if (resultFiles.length !== 1 || junitFiles.length !== 1) {
    failed = true;
    console.error(`CI_RESULT_MISSING name=${name} result_files=${resultFiles.length} junit_files=${junitFiles.length}`);
    continue;
  }
  let result;
  try {
    result = JSON.parse(fs.readFileSync(resultFiles[0], 'utf8'));
  } catch (error) {
    failed = true;
    console.error(`CI_RESULT_INVALID_JSON name=${name} error=${error.message}`);
    continue;
  }
  const junit = fs.readFileSync(junitFiles[0], 'utf8');
  const valid = result.schema === 'freelang-ci-result/v1'
    && result.name === name
    && result.status === 'success'
    && result.success === true
    && result.exitCode === 0
    && /^\s*<\?xml[\s\S]*<testsuite[\s>]/.test(junit);
  console.log(`${valid ? 'PASS' : 'FAIL'} ${name} status=${result.status} exit_code=${result.exitCode}`);
  if (!valid) failed = true;
}

if (expected.length === 0) {
  console.error('CI_RESULT_INVALID no expected checks supplied');
  process.exitCode = 2;
} else if (failed) {
  console.error('CI_RESULT_SUMMARY=FAIL');
  process.exitCode = 1;
} else {
  console.log('CI_RESULT_SUMMARY=PASS');
}

