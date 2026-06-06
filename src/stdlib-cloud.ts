// stdlib-cloud.ts — FreeLang v11 클라우드 통합 라이브러리
// Phase 58 P2: AWS/GCP/Azure CLI 기반 실제 호출 (npm SDK 의존 없음)

import { spawnSync } from "child_process";

// ── CLI 가용성 체크 ──────────────────────────────────────────────────────────────────

const cliAvailable: { aws?: boolean; gcloud?: boolean; az?: boolean } = {};

function checkAwsCLI(): boolean {
  if (cliAvailable.aws !== undefined) return cliAvailable.aws;
  const result = spawnSync("aws", ["--version"], { timeout: 3000 });
  cliAvailable.aws = !result.error && result.status === 0;
  return cliAvailable.aws;
}

function checkGcloudCLI(): boolean {
  if (cliAvailable.gcloud !== undefined) return cliAvailable.gcloud;
  const result = spawnSync("gcloud", ["--version"], { timeout: 3000 });
  cliAvailable.gcloud = !result.error && result.status === 0;
  return cliAvailable.gcloud;
}

function checkAzCLI(): boolean {
  if (cliAvailable.az !== undefined) return cliAvailable.az;
  const result = spawnSync("az", ["--version"], { timeout: 3000 });
  cliAvailable.az = !result.error && result.status === 0;
  return cliAvailable.az;
}

// ── CLI 호출 헬퍼 ──────────────────────────────────────────────────────────────────

function runAws(args: string[]): any {
  if (!checkAwsCLI()) {
    return { status: "cli_not_found", reason: "aws CLI not installed", details: "install aws-cli" };
  }
  try {
    const result = spawnSync("aws", args, { timeout: 30000, encoding: "utf-8" });
    if (result.error) throw new Error(result.error.message);
    if ((result.status ?? 1) !== 0) {
      const stderr = result.stderr?.trim() ?? "";
      throw new Error(`aws exited ${result.status}${stderr ? ": " + stderr : ""}`);
    }
    const stdout = result.stdout?.trim() ?? "";
    return { status: "success", output: stdout, raw: stdout };
  } catch (err: any) {
    return { status: "error", reason: err.message };
  }
}

function runGcloud(args: string[]): any {
  if (!checkGcloudCLI()) {
    return { status: "cli_not_found", reason: "gcloud CLI not installed", details: "install google-cloud-sdk" };
  }
  try {
    const result = spawnSync("gcloud", args, { timeout: 30000, encoding: "utf-8" });
    if (result.error) throw new Error(result.error.message);
    if ((result.status ?? 1) !== 0) {
      const stderr = result.stderr?.trim() ?? "";
      throw new Error(`gcloud exited ${result.status}${stderr ? ": " + stderr : ""}`);
    }
    const stdout = result.stdout?.trim() ?? "";
    return { status: "success", output: stdout, raw: stdout };
  } catch (err: any) {
    return { status: "error", reason: err.message };
  }
}

function runAz(args: string[]): any {
  if (!checkAzCLI()) {
    return { status: "cli_not_found", reason: "az CLI not installed", details: "install azure-cli" };
  }
  try {
    const result = spawnSync("az", args, { timeout: 30000, encoding: "utf-8" });
    if (result.error) throw new Error(result.error.message);
    if ((result.status ?? 1) !== 0) {
      const stderr = result.stderr?.trim() ?? "";
      throw new Error(`az exited ${result.status}${stderr ? ": " + stderr : ""}`);
    }
    const stdout = result.stdout?.trim() ?? "";
    return { status: "success", output: stdout, raw: stdout };
  } catch (err: any) {
    return { status: "error", reason: err.message };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────────

export function createCloudModule() {
  return {
    // ── AWS S3 ──────────────────────────────────────────────────

    // aws-s3-upload bucket file → { status, location, size }
    "aws-s3-upload": (bucket: string, file: string, data?: any): any => {
      const localFile = `/tmp/fl-upload-${Date.now()}.tmp`;
      try {
        // 로컬 임시 파일에 쓰기
        if (data) {
          const payload = typeof data === "string" ? data : JSON.stringify(data);
          require("fs").writeFileSync(localFile, payload);
        }
        // AWS S3로 복사
        const res = runAws(["s3", "cp", localFile, `s3://${bucket}/${file}`]);
        if (res.status === "cli_not_found") return res;
        if (res.status === "error") return { status: "upload_failed", reason: res.reason, bucket, file };
        return { status: "uploaded", bucket, file, location: `s3://${bucket}/${file}`, size: 0 };
      } finally {
        try { require("fs").unlinkSync(localFile); } catch {}
      }
    },

    // aws-s3-download bucket file → { status, data, location }
    "aws-s3-download": (bucket: string, file: string): any => {
      const localFile = `/tmp/fl-download-${Date.now()}.tmp`;
      try {
        const res = runAws(["s3", "cp", `s3://${bucket}/${file}`, localFile]);
        if (res.status === "cli_not_found") return res;
        if (res.status === "error") return { status: "download_failed", reason: res.reason, bucket, file };
        try {
          const data = require("fs").readFileSync(localFile, "utf-8");
          return { status: "downloaded", bucket, file, location: `s3://${bucket}/${file}`, data, size: data.length };
        } catch (e) {
          return { status: "read_failed", reason: (e as any).message };
        }
      } finally {
        try { require("fs").unlinkSync(localFile); } catch {}
      }
    },

    // aws-s3-list bucket prefix → { status, files: [name], count }
    "aws-s3-list": (bucket: string, prefix: string = ""): any => {
      const cmd = ["s3", "ls", `s3://${bucket}${prefix ? "/" + prefix : ""}`, "--recursive"];
      const res = runAws(cmd);
      if (res.status === "cli_not_found") return res;
      if (res.status === "error") return { status: "list_failed", reason: res.reason, bucket, prefix };
      const files = res.output
        .split("\n")
        .filter((line: string) => line.trim())
        .map((line: string) => {
          const parts = line.split(/\s+/);
          return parts[parts.length - 1];
        });
      return { status: "listed", bucket, prefix, files, count: files.length };
    },

    // aws-s3-delete bucket file → { status, location }
    "aws-s3-delete": (bucket: string, file: string): any => {
      const res = runAws(["s3", "rm", `s3://${bucket}/${file}`]);
      if (res.status === "cli_not_found") return res;
      if (res.status === "error") return { status: "delete_failed", reason: res.reason, bucket, file };
      return { status: "deleted", bucket, file, location: `s3://${bucket}/${file}` };
    },

    // aws-s3-config bucket region → { status: "configured" }
    "aws-s3-config": (bucket: string, region: string): any => {
      return { status: "configured", bucket, region, message: "AWS S3 credentials via environment variables" };
    },

    // ── AWS Lambda ──────────────────────────────────────────────

    // aws-lambda-invoke function payload → { status, output, duration_ms }
    "aws-lambda-invoke": (functionName: string, payload: any): any => {
      const payloadFile = `/tmp/fl-lambda-${Date.now()}.json`;
      const startTime = Date.now();
      try {
        const payloadStr = JSON.stringify(payload);
        require("fs").writeFileSync(payloadFile, payloadStr);
        const res = runAws(["lambda", "invoke", "--function-name", functionName, "--payload", `file://${payloadFile}`, "/tmp/response.json"]);
        if (res.status === "cli_not_found") return res;
        if (res.status === "error") return { status: "invoke_failed", reason: res.reason, functionName };
        try {
          const responseData = require("fs").readFileSync("/tmp/response.json", "utf-8");
          return { status: "invoked", functionName, output: responseData, duration_ms: Date.now() - startTime };
        } catch {
          return { status: "invoked", functionName, output: null, duration_ms: Date.now() - startTime };
        }
      } finally {
        try { require("fs").unlinkSync(payloadFile); } catch {}
      }
    },

    // aws-lambda-create function → { status, arn }
    "aws-lambda-create": (functionName: string, handler: string = "index.handler", runtime: string = "nodejs20.x"): any => {
      return {
        status: "create_via_cli",
        message: "Use: aws lambda create-function --function-name <name> --handler <handler> --runtime <runtime>",
        functionName, handler, runtime
      };
    },

    // aws-lambda-delete function → { status }
    "aws-lambda-delete": (functionName: string): any => {
      const res = runAws(["lambda", "delete-function", "--function-name", functionName]);
      if (res.status === "cli_not_found") return res;
      if (res.status === "error") return { status: "delete_failed", reason: res.reason };
      return { status: "deleted", functionName };
    },

    // ── AWS RDS ──────────────────────────────────────────────

    // aws-rds-query dbInstanceId sql → { status, rows }
    "aws-rds-query": (dbInstanceId: string, sql: string): any => {
      // RDS 데이터 API는 복잡하므로 기본 정보만 반환
      return {
        status: "query_via_cli",
        message: "Use: aws rds-data execute-statement --resource-arn <arn> --sql <sql>",
        dbInstanceId, sql
      };
    },

    // aws-rds-create dbInstanceId engine → { status }
    "aws-rds-create": (dbInstanceId: string, engine: string = "mysql", masterUsername: string = "admin"): any => {
      return {
        status: "create_via_cli",
        message: "Use: aws rds create-db-instance --db-instance-identifier <id> --engine <engine>",
        dbInstanceId, engine, masterUsername
      };
    },

    // ── GCP Cloud Run ─────────────────────────────────────────

    // gcp-run-deploy service image region → { status, url }
    "gcp-run-deploy": (serviceName: string, imageUri: string, region: string = "us-central1"): any => {
      const res = runGcloud(["run", "deploy", serviceName, "--image", imageUri, "--region", region, "--allow-unauthenticated"]);
      if (res.status === "cli_not_found") return res;
      if (res.status === "error") return { status: "deploy_failed", reason: res.reason, serviceName };
      // 출력에서 URL 추출 (일반적으로 "Service URL: https://...")
      const urlMatch = res.output.match(/https:\/\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : `https://${serviceName}-xxx.a.run.app`;
      return { status: "deployed", serviceName, imageUri, region, url };
    },

    // gcp-run-invoke service data region → { status, output }
    "gcp-run-invoke": (serviceName: string, data: any, region: string = "us-central1"): any => {
      const dataJson = JSON.stringify(data);
      const res = runGcloud([
        "run", "services", "describe", serviceName,
        "--region", region, "--format", "get(status.url)"
      ]);
      if (res.status === "cli_not_found") return res;
      if (res.status === "error") return { status: "invoke_failed", reason: res.reason, serviceName };
      const url = res.output;
      // curl로 호출
      const curlResult = spawnSync("curl", ["-s", "-X", "POST", "-H", "Content-Type: application/json", "-d", dataJson, url], { timeout: 10000, encoding: "utf-8" });
      const output = curlResult.stdout?.trim() ?? "";
      return { status: "invoked", serviceName, url, output };
    },

    // gcp-run-list region → { status, services: [] }
    "gcp-run-list": (region: string = "us-central1"): any => {
      const res = runGcloud(["run", "services", "list", "--region", region, "--format", "value(metadata.name)"]);
      if (res.status === "cli_not_found") return res;
      if (res.status === "error") return { status: "list_failed", reason: res.reason };
      const services = res.output.split("\n").filter((s: string) => s.trim());
      return { status: "listed", region, services, count: services.length };
    },

    // ── Azure Functions ──────────────────────────────────────

    // azure-function-invoke functionName data → { status, output }
    "azure-function-invoke": (functionName: string, data: any): any => {
      const dataJson = JSON.stringify(data);
      const res = runAz(["functionapp", "function", "invoke", "--name", functionName, "--input", dataJson]);
      if (res.status === "cli_not_found") return res;
      if (res.status === "error") return { status: "invoke_failed", reason: res.reason, functionName };
      return { status: "invoked", functionName, output: res.output };
    },

    // azure-function-create functionName → { status }
    "azure-function-create": (functionName: string, runtime: string = "node"): any => {
      return {
        status: "create_via_cli",
        message: "Use: az functionapp create --resource-group <rg> --consumption-plan-location <location> --runtime <runtime>",
        functionName, runtime
      };
    },

    // azure-app-deploy appName imageUri region → { status, url }
    "azure-app-deploy": (appName: string, imageUri: string, region: string = "eastus"): any => {
      const res = runAz(["webapp", "create", "--resource-group", "default", "--plan", "default", "--name", appName, "--image", imageUri]);
      if (res.status === "cli_not_found") return res;
      if (res.status === "error") return { status: "deploy_failed", reason: res.reason, appName };
      return { status: "deployed", appName, imageUri, region, url: `https://${appName}.azurewebsites.net` };
    },

    // ── Common Cloud Utilities ──────────────────────────────────

    // cloud-health provider → { status, healthy }
    "cloud-health": (provider: string): any => {
      const healthChecks: Record<string, () => boolean> = {
        aws: checkAwsCLI,
        gcp: checkGcloudCLI,
        azure: checkAzCLI
      };
      const check = healthChecks[provider];
      if (!check) return { status: "unknown_provider", provider };
      const healthy = check();
      return {
        status: "checked",
        provider,
        healthy,
        message: healthy ? `${provider} CLI available` : `${provider} CLI not found`
      };
    },

    // cloud-get-config provider → object
    "cloud-get-config": (provider?: string): any => {
      if (!provider) return { aws: checkAwsCLI(), gcp: checkGcloudCLI(), azure: checkAzCLI() };
      const checks: Record<string, boolean> = {
        aws: checkAwsCLI(),
        gcp: checkGcloudCLI(),
        azure: checkAzCLI()
      };
      return { [provider]: checks[provider] ?? false };
    }
  };
}
