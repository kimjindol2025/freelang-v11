// eval-infra-blocks.ts — FreeLang v11 인프라 블록 처리
// 선언형 블록 → 파일 자동 생성 (Docker, K8s, CI/CD, 클라우드)

import { Interpreter } from "./interpreter";
import { SExpr, Keyword } from "./ast";
import * as fs from "fs";
import * as path from "path";

const cwd = process.cwd();

export function evalInfraBlock(interp: Interpreter, op: string, expr: SExpr): any {
  const ev = (node: any) => (interp as any).eval(node);

  // ── Dockerfile ──────────────────────────────────────────────
  if (op === "DOCKERFILE" || op === "dockerfile") {
    let from = "node:20-slim";
    let workdir = "/app";
    let expose: string[] = [];
    let copy: string[] = [];
    let run: string[] = [];
    let cmd = ["node", "server.js"];
    let env: Record<string, string> = {};

    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      if ((arg as any).kind === "keyword") {
        const key = (arg as Keyword).name;
        if (i + 1 < expr.args.length) {
          const val = ev(expr.args[i + 1]);
          switch (key) {
            case "from": from = String(val); break;
            case "workdir": workdir = String(val); break;
            case "expose": expose.push(String(val)); break;
            case "copy": copy.push(String(val)); break;
            case "run": run.push(String(val)); break;
            case "cmd": cmd = Array.isArray(val) ? val : [String(val)]; break;
            case "env":
              if (typeof val === "object") Object.assign(env, val);
              break;
          }
          i++;
        }
      }
    }

    let dockerfile = `FROM ${from}\nWORKDIR ${workdir}\n`;

    Object.entries(env).forEach(([k, v]) => {
      dockerfile += `ENV ${k}=${v}\n`;
    });

    copy.forEach(c => {
      dockerfile += `COPY ${c}\n`;
    });

    run.forEach(r => {
      dockerfile += `RUN ${r}\n`;
    });

    expose.forEach(p => {
      dockerfile += `EXPOSE ${p}\n`;
    });

    dockerfile += `CMD [${cmd.map(c => `"${c}"`).join(", ")}]\n`;

    const outfile = path.join(cwd, "Dockerfile");
    fs.writeFileSync(outfile, dockerfile, "utf-8");
    return { generated: "Dockerfile", bytes: dockerfile.length };
  }

  // ── K8S-DEPLOYMENT ──────────────────────────────────────────────
  if (op === "K8S-DEPLOYMENT" || op === "deployment") {
    let name = "my-app";
    let namespace = "default";
    let image = "my-app:latest";
    let replicas = 1;
    let port = 8080;
    let containerPort = port;
    let env: Record<string, string> = {};

    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      if ((arg as any).kind === "keyword") {
        const key = (arg as Keyword).name;
        if (i + 1 < expr.args.length) {
          const val = ev(expr.args[i + 1]);
          switch (key) {
            case "name": name = String(val); break;
            case "namespace": namespace = String(val); break;
            case "image": image = String(val); break;
            case "replicas": replicas = Number(val) || 1; break;
            case "port": port = Number(val) || 8080; break;
            case "containerPort": containerPort = Number(val) || port; break;
            case "env":
              if (typeof val === "object") Object.assign(env, val);
              break;
          }
          i++;
        }
      }
    }

    const yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
      - name: ${name}
        image: ${image}
        ports:
        - containerPort: ${containerPort}
${Object.entries(env).length > 0 ? `        env:\n${Object.entries(env).map(([k, v]) => `        - name: ${k}\n          value: "${v}"`).join("\n")}\n` : ""}`;

    const outfile = path.join(cwd, `${name}-deployment.yaml`);
    fs.writeFileSync(outfile, yaml, "utf-8");
    return { generated: `${name}-deployment.yaml`, bytes: yaml.length };
  }

  // ── K8S-SERVICE ──────────────────────────────────────────────
  if (op === "K8S-SERVICE" || op === "service") {
    let name = "my-app";
    let namespace = "default";
    let port = 8080;
    let targetPort = port;
    let type = "ClusterIP";

    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      if ((arg as any).kind === "keyword") {
        const key = (arg as Keyword).name;
        if (i + 1 < expr.args.length) {
          const val = ev(expr.args[i + 1]);
          switch (key) {
            case "name": name = String(val); break;
            case "namespace": namespace = String(val); break;
            case "port": port = Number(val) || 8080; break;
            case "targetPort": targetPort = Number(val) || port; break;
            case "type": type = String(val); break;
          }
          i++;
        }
      }
    }

    const yaml = `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  type: ${type}
  ports:
  - port: ${port}
    targetPort: ${targetPort}
    protocol: TCP
  selector:
    app: ${name}
`;

    const outfile = path.join(cwd, `${name}-service.yaml`);
    fs.writeFileSync(outfile, yaml, "utf-8");
    return { generated: `${name}-service.yaml`, bytes: yaml.length };
  }

  // ── K8S-INGRESS ──────────────────────────────────────────────
  if (op === "K8S-INGRESS" || op === "ingress") {
    let name = "my-app";
    let namespace = "default";
    let host = "app.example.com";
    let serviceName = "my-app";
    let servicePort = 8080;
    let path_ = "/";

    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      if ((arg as any).kind === "keyword") {
        const key = (arg as Keyword).name;
        if (i + 1 < expr.args.length) {
          const val = ev(expr.args[i + 1]);
          switch (key) {
            case "name": name = String(val); break;
            case "namespace": namespace = String(val); break;
            case "host": host = String(val); break;
            case "serviceName": serviceName = String(val); break;
            case "servicePort": servicePort = Number(val) || 8080; break;
            case "path": path_ = String(val); break;
          }
          i++;
        }
      }
    }

    const yaml = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  rules:
  - host: ${host}
    http:
      paths:
      - path: ${path_}
        pathType: Prefix
        backend:
          service:
            name: ${serviceName}
            port:
              number: ${servicePort}
`;

    const outfile = path.join(cwd, `${name}-ingress.yaml`);
    fs.writeFileSync(outfile, yaml, "utf-8");
    return { generated: `${name}-ingress.yaml`, bytes: yaml.length };
  }

  // ── DOCKER-COMPOSE ──────────────────────────────────────────────
  if (op === "DOCKER-COMPOSE" || op === "docker-compose") {
    let version = "3.8";
    let services: Record<string, any> = {};

    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      if ((arg as any).kind === "keyword") {
        const key = (arg as Keyword).name;
        if (i + 1 < expr.args.length) {
          const val = ev(expr.args[i + 1]);
          switch (key) {
            case "version": version = String(val); break;
            case "services": services = val || {}; break;
          }
          i++;
        }
      }
    }

    const serviceLines = Object.entries(services).map(([name, config]: [string, any]) => {
      return `  ${name}:\n    image: ${config.image || name}\n    ports:\n      - "${config.port || 8080}:${config.containerPort || 8080}"`;
    }).join("\n");

    const yaml = `version: '${version}'
services:
${serviceLines}
`;

    const outfile = path.join(cwd, "docker-compose.yml");
    fs.writeFileSync(outfile, yaml, "utf-8");
    return { generated: "docker-compose.yml", bytes: yaml.length };
  }

  // ── GITHUB-ACTIONS ──────────────────────────────────────────────
  if (op === "GITHUB-ACTIONS" || op === "github-actions" || op === "ci") {
    let name = "CI";
    let onEvents = ["push", "pull_request"];
    let steps: any[] = [];

    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      if ((arg as any).kind === "keyword") {
        const key = (arg as Keyword).name;
        if (i + 1 < expr.args.length) {
          const val = ev(expr.args[i + 1]);
          switch (key) {
            case "name": name = String(val); break;
            case "on": onEvents = Array.isArray(val) ? val : [String(val)]; break;
            case "test":
              steps.push({ uses: "actions/checkout@v3" });
              steps.push({ uses: "actions/setup-node@v3", with: { "node-version": "20" } });
              steps.push({ run: String(val) });
              break;
            case "steps": steps = Array.isArray(val) ? val : [val]; break;
          }
          i++;
        }
      }
    }

    const onStr = onEvents.map(e => `    - ${e}`).join("\n");
    const stepsStr = steps.map(s => {
      if (typeof s === "string") return `      - run: ${s}`;
      if (s.uses) return `      - uses: ${s.uses}${s.with ? `\n        with:\n${Object.entries(s.with).map(([k, v]) => `          ${k}: "${v}"`).join("\n")}` : ""}`;
      if (s.run) return `      - run: ${s.run}`;
      return `      - ${JSON.stringify(s)}`;
    }).join("\n");

    const yaml = `name: ${name}

on:
${onStr}

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
${stepsStr}
`;

    const workflowDir = path.join(cwd, ".github", "workflows");
    fs.mkdirSync(workflowDir, { recursive: true });
    const outfile = path.join(workflowDir, `${name.toLowerCase().replace(/\\s+/g, "-")}.yml`);
    fs.writeFileSync(outfile, yaml, "utf-8");
    return { generated: outfile, bytes: yaml.length };
  }

  // ── AWS / GCP / AZURE — 실제 CLI 호출 ──────────────────────────────────────────────
  if (op === "AWS-S3" || op === "aws-s3") {
    let bucket = "my-bucket";
    let action = "list";
    let file = "";
    let data: any = null;
    let region = "us-east-1";

    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      if ((arg as any).kind === "keyword") {
        const key = (arg as Keyword).name;
        if (i + 1 < expr.args.length) {
          const val = ev(expr.args[i + 1]);
          switch (key) {
            case "bucket": bucket = String(val); break;
            case "action": action = String(val); break;
            case "file": file = String(val); break;
            case "data": data = val; break;
            case "region": region = String(val); break;
          }
          i++;
        }
      }
    }

    // 실제 stdlib-cloud 함수 호출
    try {
      switch (action.toLowerCase()) {
        case "list":
          return (interp as any).callUserFunction("aws-s3-list", [bucket, file]);
        case "upload":
          return (interp as any).callUserFunction("aws-s3-upload", [bucket, file, data]);
        case "download":
          return (interp as any).callUserFunction("aws-s3-download", [bucket, file]);
        case "delete":
          return (interp as any).callUserFunction("aws-s3-delete", [bucket, file]);
        case "config":
          return (interp as any).callUserFunction("aws-s3-config", [bucket, region]);
        default:
          return { status: "unknown_action", action, bucket };
      }
    } catch (err: any) {
      return { status: "error", action, bucket, reason: err.message };
    }
  }

  if (op === "GCP-RUN" || op === "gcp-run") {
    let service = "my-service";
    let image = "gcr.io/my-project/my-service:latest";
    let region = "us-central1";
    let action = "deploy";
    let data: any = null;

    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      if ((arg as any).kind === "keyword") {
        const key = (arg as Keyword).name;
        if (i + 1 < expr.args.length) {
          const val = ev(expr.args[i + 1]);
          switch (key) {
            case "service": service = String(val); break;
            case "image": image = String(val); break;
            case "region": region = String(val); break;
            case "action": action = String(val); break;
            case "data": data = val; break;
          }
          i++;
        }
      }
    }

    // 실제 stdlib-cloud 함수 호출
    try {
      switch (action.toLowerCase()) {
        case "deploy":
          return (interp as any).callUserFunction("gcp-run-deploy", [service, image, region]);
        case "invoke":
          return (interp as any).callUserFunction("gcp-run-invoke", [service, data, region]);
        case "list":
          return (interp as any).callUserFunction("gcp-run-list", [region]);
        default:
          return { status: "unknown_action", action, service };
      }
    } catch (err: any) {
      return { status: "error", action, service, reason: err.message };
    }
  }

  if (op === "AZURE-FUNCTION" || op === "azure-function") {
    let name = "my-function";
    let runtime = "node";
    let region = "eastus";
    let action = "invoke";
    let data: any = null;
    let image = "";

    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      if ((arg as any).kind === "keyword") {
        const key = (arg as Keyword).name;
        if (i + 1 < expr.args.length) {
          const val = ev(expr.args[i + 1]);
          switch (key) {
            case "name": name = String(val); break;
            case "runtime": runtime = String(val); break;
            case "region": region = String(val); break;
            case "action": action = String(val); break;
            case "data": data = val; break;
            case "image": image = String(val); break;
          }
          i++;
        }
      }
    }

    // 실제 stdlib-cloud 함수 호출
    try {
      switch (action.toLowerCase()) {
        case "invoke":
          return (interp as any).callUserFunction("azure-function-invoke", [name, data]);
        case "create":
          return (interp as any).callUserFunction("azure-function-create", [name, runtime]);
        case "deploy":
          return (interp as any).callUserFunction("azure-app-deploy", [name, image, region]);
        default:
          return { status: "unknown_action", action, name };
      }
    } catch (err: any) {
      return { status: "error", action, name, reason: err.message };
    }
  }

  throw new Error(`Unknown infra block: ${op}`);
}
