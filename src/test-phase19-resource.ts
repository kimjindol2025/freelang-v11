// FreeLang v9 Phase 19: Server Resource Search — 테스트
// AI가 서버 자원을 검색/분석하는 라이브러리 검증

import { createResourceModule } from "./stdlib-resource";

const R = createResourceModule();

let passed = 0;
let failed = 0;

function check(name: string, fn: () => boolean): void {
  try {
    const ok = fn();
    if (ok) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name} — returned false`);
      failed++;
    }
  } catch (e: any) {
    console.log(`  ❌ ${name} — ${e.message}`);
    failed++;
  }
}

console.log("\n🔍 FreeLang v9 Phase 19: Server Resource Search\n");

// ──────────────────────────────────────────
console.log("[ CPU ]");
// ──────────────────────────────────────────

check("res_cpu_count: 양수", () => {
  const count = R["res_cpu_count"]();
  console.log(`     CPUs: ${count}`);
  return count > 0;
});

check("res_cpu_model: 문자열 반환", () => {
  const model = R["res_cpu_model"]();
  console.log(`     Model: ${model}`);
  return typeof model === "string" && model.length > 0;
});

check("res_cpu_load: 배열 3개", () => {
  const load = R["res_cpu_load"]();
  console.log(`     Load: [${load.map((n: number) => n.toFixed(2)).join(", ")}]`);
  return Array.isArray(load) && load.length === 3;
});

// ──────────────────────────────────────────
console.log("\n[ Memory ]");
// ──────────────────────────────────────────

check("res_mem: 필드 존재", () => {
  const mem = R["res_mem"]();
  console.log(`     Total: ${mem.total_mb}MB  Used: ${mem.used_mb}MB  Free: ${mem.free_mb}MB`);
  return mem.total_mb > 0 && mem.used_mb >= 0 && mem.free_mb >= 0;
});

check("res_mem_pct: 0~100", () => {
  const pct = R["res_mem_pct"]();
  console.log(`     Used: ${pct}%`);
  return pct >= 0 && pct <= 100;
});

// ──────────────────────────────────────────
console.log("\n[ Disk ]");
// ──────────────────────────────────────────

check("res_disk: 배열 반환", () => {
  const disks = R["res_disk"]();
  disks.slice(0, 3).forEach((d: any) => {
    console.log(`     ${d.mount}: ${d.used_gb}G/${d.total_gb}G (${d.use_pct}%)`);
  });
  return Array.isArray(disks) && disks.length > 0;
});

check("res_disk_usage /: use_pct 존재", () => {
  const usage = R["res_disk_usage"]("/");
  console.log(`     /: ${usage.used_gb}G/${usage.total_gb}G (${usage.use_pct}%)`);
  return usage.total_gb > 0;
});

// ──────────────────────────────────────────
console.log("\n[ Processes ]");
// ──────────────────────────────────────────

check("res_procs: 배열 반환", () => {
  const procs = R["res_procs"]();
  console.log(`     Top: ${procs.slice(0, 3).map((p: any) => p.name).join(", ")}`);
  return Array.isArray(procs) && procs.length > 0;
});

check("res_find_proc node: 배열 반환", () => {
  const procs = R["res_find_proc"]("node");
  console.log(`     node processes: ${procs.length}개`);
  return Array.isArray(procs);
});

check("res_proc_exists sh: true", () => {
  const exists = R["res_proc_exists"]("sh");
  console.log(`     sh exists: ${exists}`);
  return typeof exists === "boolean";
});

check("res_proc_count sh: 0 이상", () => {
  const count = R["res_proc_count"]("sh");
  console.log(`     sh count: ${count}`);
  return count >= 0;
});

// ──────────────────────────────────────────
console.log("\n[ Ports ]");
// ──────────────────────────────────────────

check("res_ports: 배열 반환", () => {
  const ports = R["res_ports"]();
  console.log(`     Listening ports: ${ports.slice(0, 5).map((p: any) => p.port).join(", ")}...`);
  return Array.isArray(ports);
});

check("res_port_used 22: boolean", () => {
  const used = R["res_port_used"](22);
  console.log(`     Port 22 used: ${used}`);
  return typeof used === "boolean";
});

check("res_find_free_port 30000-31000: number", () => {
  const port = R["res_find_free_port"](30000, 31000);
  console.log(`     Free port in 30000-31000: ${port}`);
  return port === null || (typeof port === "number" && port >= 30000 && port <= 31000);
});

// ──────────────────────────────────────────
console.log("\n[ Network ]");
// ──────────────────────────────────────────

check("res_net: 배열 반환", () => {
  const ifaces = R["res_net"]();
  ifaces.forEach((i: any) => console.log(`     ${i.name}: ${i.addr}`));
  return Array.isArray(ifaces);
});

check("res_hostname: 문자열", () => {
  const host = R["res_hostname"]();
  console.log(`     Hostname: ${host}`);
  return typeof host === "string" && host.length > 0;
});

check("res_uptime_s: 양수", () => {
  const uptime = R["res_uptime_s"]();
  console.log(`     Uptime: ${Math.round(uptime / 3600)}h`);
  return uptime > 0;
});

// ──────────────────────────────────────────
console.log("\n[ Services ]");
// ──────────────────────────────────────────

check("res_pm2_list: 배열 반환", () => {
  const svcs = R["res_pm2_list"]();
  if (svcs.length > 0) {
    console.log(`     PM2 services: ${svcs.slice(0, 3).map((s: any) => `${s.name}(${s.status})`).join(", ")}`);
  } else {
    console.log(`     PM2: no services (or pm2 not running)`);
  }
  return Array.isArray(svcs);
});

// ──────────────────────────────────────────
console.log("\n[ kimdb ]");
// ──────────────────────────────────────────

check("res_kimdb_health: boolean", () => {
  const ok = R["res_kimdb_health"]();
  console.log(`     kimdb health: ${ok}`);
  return typeof ok === "boolean";
});

if (R["res_kimdb_health"]()) {
  check("res_kimdb_projects: 배열", () => {
    const projects = R["res_kimdb_projects"]();
    console.log(`     Projects count: ${projects.length}`);
    return Array.isArray(projects);
  });
}

// ──────────────────────────────────────────
console.log("\n[ Health Check + Snapshot ]");
// ──────────────────────────────────────────

check("res_health_check: ok/warnings/errors", () => {
  const health = R["res_health_check"]();
  console.log(`     OK: ${health.ok}  Warnings: ${health.warnings.length}  Errors: ${health.errors.length}`);
  if (health.warnings.length > 0) console.log(`     ⚠️  ${health.warnings[0]}`);
  if (health.errors.length > 0) console.log(`     🔴 ${health.errors[0]}`);
  return typeof health.ok === "boolean";
});

check("res_snapshot: 필드 완전성", () => {
  console.log(`     (스냅샷 수집 중...)`);
  const snap = R["res_snapshot"]();
  const ok = snap.ts > 0 && snap.hostname.length > 0 && snap.cpu_load.length === 3;
  if (ok) console.log(R["res_snapshot_report"](snap));
  return ok;
});

// ──────────────────────────────────────────
console.log("\n══════════════════════════════════════════");
console.log(`결과: ${passed}/${passed + failed} PASS`);
console.log("══════════════════════════════════════════\n");

if (failed > 0) process.exit(1);
