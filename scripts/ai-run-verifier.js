#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizePrintedOutput(value) {
  return value.endsWith("\r\n") ? value.slice(0, -2)
    : value.endsWith("\n") ? value.slice(0, -1) : value;
}

function emit(result) {
  fs.writeSync(1, JSON.stringify(result) + "\n");
  process.exit(result.result === "PASS" ? 0 : 1);
}

function containedPath(root, candidate) {
  const realRoot = fs.realpathSync(root);
  const realCandidate = fs.realpathSync(candidate);
  const relative = path.relative(realRoot, realCandidate);
  if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    throw new Error("evidence path escapes the run directory");
  }
  return realCandidate;
}

function runtimeEnv(runDir) {
  const env = { FL_FILE_BASE: runDir, FL_STRICT: "1" };
  for (const key of ["PATH", "NODE_PATH", "TMPDIR", "LANG", "LC_ALL"]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    emit({ result: "BLOCKED", code: "E_AI_VERIFIER_INPUT", message: "verifier input path is required" });
  }

  let input;
  try {
    input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  } catch (error) {
    emit({ result: "BLOCKED", code: "E_AI_VERIFIER_INPUT", message: "verifier input could not be read" });
  }

  const runDir = path.resolve(String(input.run_dir || ""));
  let sourcePath, generationPath, executionPath;
  try {
    sourcePath = containedPath(runDir, input.source_path);
    generationPath = containedPath(runDir, input.generation_evidence_path);
    executionPath = containedPath(runDir, input.execution_evidence_path);
  } catch (error) {
    emit({ result: "BLOCKED", code: "E_AI_VERIFIER_EVIDENCE", message: String(error.message || error) });
  }

  let source, generation, execution;
  try {
    source = fs.readFileSync(sourcePath);
    generation = JSON.parse(fs.readFileSync(generationPath, "utf8"));
    execution = JSON.parse(fs.readFileSync(executionPath, "utf8"));
  } catch (error) {
    emit({ result: "BLOCKED", code: "E_AI_VERIFIER_EVIDENCE", message: "source or evidence could not be read" });
  }

  const sourceHash = sha256(source);
  const executionEvidenceHash = sha256(fs.readFileSync(executionPath));
  const checks = {
    source_hash_matches_generation: generation.source_sha256 === sourceHash,
    source_hash_matches_execution: execution.source_sha256 === sourceHash,
    recorded_execution_succeeded: execution.exit_code === 0 && execution.timed_out !== true,
    execution_command_targets_source: Array.isArray(execution.command)
      && path.resolve(execution.command[1] || "") === path.resolve(input.bootstrap_path || "")
      && execution.command[2] === "run"
      && path.resolve(execution.command[3] || "") === sourcePath,
  };

  const replayCommand = [process.execPath, path.resolve(input.bootstrap_path), "run", sourcePath];
  const replay = spawnSync(replayCommand[0], replayCommand.slice(1), {
    cwd: runDir,
    env: runtimeEnv(runDir),
    encoding: "utf8",
    timeout: Number(input.timeout_ms) || 30000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const replayExit = replay.status == null ? 1 : replay.status;
  const replayStdout = replay.stdout || "";
  checks.independent_replay_succeeded = replay.error == null && replayExit === 0;
  checks.replay_matches_recorded_execution = replayExit === execution.exit_code
    && replayStdout === execution.stdout;

  const base = {
    verifier: "freelang-ai-run-independent-v1",
    result: "FAIL",
    source_path: sourcePath,
    source_sha256: sourceHash,
    generation_evidence_path: generationPath,
    execution_evidence_path: executionPath,
    execution_evidence_sha256: executionEvidenceHash,
    recorded_stdout: execution.stdout,
    replay_command: replayCommand,
    replay_exit_code: replayExit,
    replay_stdout: replayStdout,
    checks,
  };

  if (Object.values(checks).some((value) => value !== true)) {
    emit({ ...base, code: "E_AI_VERIFIER_EVIDENCE_MISMATCH", message: "source, evidence, or independent replay did not match" });
  }
  if (typeof input.expected_stdout !== "string") {
    emit({ ...base, result: "BLOCKED", code: "E_AI_EXPECTATION_REQUIRED", message: "an independent expected_stdout oracle is required" });
  }

  const expectedMatches = normalizePrintedOutput(execution.stdout) === input.expected_stdout;
  checks.expected_stdout_matches = expectedMatches;
  if (!expectedMatches) {
    emit({ ...base, checks, code: "E_AI_VERIFIER_MISMATCH", expected_stdout: input.expected_stdout, message: "actual stdout did not match the caller-supplied expectation" });
  }

  emit({ ...base, result: "PASS", checks, expected_stdout: input.expected_stdout, message: "source hash, execution evidence, independent replay, and expected stdout matched" });
}

main();
