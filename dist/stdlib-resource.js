"use strict";
// FreeLang v9: Server Resource Search Standard Library
// Phase 19: 서버 자원검색 — AI가 실행 중인 서버 상태를 네이티브 블록으로 조회/분석
//
// AI가 서버 자원을 "검색"하는 것은 추론의 출발점이다.
// 어떤 프로세스가 어떤 포트를 쓰는지, 메모리가 얼마나 남았는지를
// 코드 한 줄로 파악하고 다음 행동을 결정한다.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResourceModule = createResourceModule;
const child_process_1 = require("child_process");
const os = __importStar(require("os"));
// ─────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────
function run(cmd, timeout = 10000) {
    try {
        return (0, child_process_1.execSync)(cmd, { encoding: "utf-8", timeout, stdio: ["pipe", "pipe", "pipe"] }).trim();
    }
    catch {
        return "";
    }
}
function runLines(cmd) {
    const out = run(cmd);
    return out ? out.split("\n").map(l => l.trim()).filter(Boolean) : [];
}
function parseKv(lines, sep = ":") {
    const obj = {};
    for (const line of lines) {
        const idx = line.indexOf(sep);
        if (idx > 0) {
            const k = line.slice(0, idx).trim();
            const v = line.slice(idx + 1).trim();
            obj[k] = v;
        }
    }
    return obj;
}
// ─────────────────────────────────────────────
// module
// ─────────────────────────────────────────────
function createResourceModule() {
    return {
        // ── CPU ─────────────────────────────────────────────────────
        // res_cpu_load -> [1m, 5m, 15m]
        "res_cpu_load": () => {
            return os.loadavg();
        },
        // res_cpu_count -> number
        "res_cpu_count": () => {
            return os.cpus().length;
        },
        // res_cpu_model -> string
        "res_cpu_model": () => {
            const cpus = os.cpus();
            return cpus.length > 0 ? cpus[0].model : "unknown";
        },
        // res_cpu_pct -> number (approximate 1s sample via /proc/stat)
        "res_cpu_pct": () => {
            try {
                const a = run("cat /proc/stat | head -1").split(/\s+/).slice(1).map(Number);
                // sleep ~200ms using busy wait (avoids async)
                const end = Date.now() + 200;
                while (Date.now() < end) { /* spin */ }
                const b = run("cat /proc/stat | head -1").split(/\s+/).slice(1).map(Number);
                const dIdle = b[3] - a[3];
                const dTotal = b.reduce((s, v) => s + v, 0) - a.reduce((s, v) => s + v, 0);
                return dTotal > 0 ? Math.round((1 - dIdle / dTotal) * 100) : 0;
            }
            catch {
                return -1;
            }
        },
        // ── Memory ──────────────────────────────────────────────────
        // res_mem -> {total_mb, used_mb, free_mb, buffers_mb, cached_mb, available_mb}
        "res_mem": () => {
            const total = Math.round(os.totalmem() / 1024 / 1024);
            const free = Math.round(os.freemem() / 1024 / 1024);
            const used = total - free;
            // Try to get more detail from /proc/meminfo
            const lines = runLines("cat /proc/meminfo");
            const kv = parseKv(lines);
            const parseKb = (k) => Math.round(parseInt((kv[k] || "0 kB").split(" ")[0]) / 1024);
            return {
                total_mb: total,
                used_mb: used,
                free_mb: free,
                available_mb: parseKb("MemAvailable"),
                buffers_mb: parseKb("Buffers"),
                cached_mb: parseKb("Cached"),
                swap_total_mb: parseKb("SwapTotal"),
                swap_used_mb: parseKb("SwapTotal") - parseKb("SwapFree"),
            };
        },
        // res_mem_pct -> number (used %)
        "res_mem_pct": () => {
            const total = os.totalmem();
            const free = os.freemem();
            return total > 0 ? Math.round((1 - free / total) * 100) : 0;
        },
        // ── Disk ────────────────────────────────────────────────────
        // res_disk -> DiskInfo[]
        "res_disk": () => {
            const lines = runLines("df -BG --output=source,target,size,used,avail,pcent 2>/dev/null | tail -n +2");
            return lines
                .filter(l => l.startsWith("/"))
                .map(line => {
                const [device, mount, total, used, avail, pct] = line.split(/\s+/);
                return {
                    device,
                    mount,
                    total_gb: parseInt(total) || 0,
                    used_gb: parseInt(used) || 0,
                    avail_gb: parseInt(avail) || 0,
                    use_pct: parseInt(pct) || 0,
                };
            });
        },
        // res_disk_usage path -> {total_gb, used_gb, avail_gb, use_pct}
        "res_disk_usage": (path) => {
            const line = run(`df -BG --output=size,used,avail,pcent "${path}" 2>/dev/null | tail -1`);
            if (!line)
                return { total_gb: 0, used_gb: 0, avail_gb: 0, use_pct: 0 };
            const [total, used, avail, pct] = line.trim().split(/\s+/);
            return {
                total_gb: parseInt(total) || 0,
                used_gb: parseInt(used) || 0,
                avail_gb: parseInt(avail) || 0,
                use_pct: parseInt(pct) || 0,
            };
        },
        // ── Processes ───────────────────────────────────────────────
        // res_procs -> ProcessInfo[]  (top 20 by CPU)
        "res_procs": () => {
            const lines = runLines("ps axo pid,user,pcpu,pmem,stat,comm,args --sort=-pcpu 2>/dev/null | head -21 | tail -20");
            return lines.map(line => {
                const parts = line.split(/\s+/);
                return {
                    pid: parseInt(parts[0]) || 0,
                    user: parts[1] || "",
                    cpu: parseFloat(parts[2]) || 0,
                    mem: parseFloat(parts[3]) || 0,
                    state: parts[4] || "",
                    name: parts[5] || "",
                    cmd: parts.slice(6).join(" "),
                };
            });
        },
        // res_find_proc name -> ProcessInfo[]  (search by name substring)
        "res_find_proc": (name) => {
            const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
            const lines = runLines(`ps axo pid,user,pcpu,pmem,stat,comm,args 2>/dev/null | grep -i "${safeName}" | grep -v grep`);
            return lines.map(line => {
                const parts = line.split(/\s+/);
                return {
                    pid: parseInt(parts[0]) || 0,
                    user: parts[1] || "",
                    cpu: parseFloat(parts[2]) || 0,
                    mem: parseFloat(parts[3]) || 0,
                    state: parts[4] || "",
                    name: parts[5] || "",
                    cmd: parts.slice(6).join(" "),
                };
            });
        },
        // res_proc_exists name -> boolean
        "res_proc_exists": (name) => {
            const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
            const result = (0, child_process_1.spawnSync)("sh", ["-c", `pgrep -f "${safeName}" > /dev/null 2>&1`]);
            return (result.status ?? 1) === 0;
        },
        // res_proc_pid name -> number | null
        "res_proc_pid": (name) => {
            const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
            const out = run(`pgrep -f "${safeName}" | head -1`);
            const pid = parseInt(out);
            return isNaN(pid) ? null : pid;
        },
        // res_proc_count name -> number  (how many instances running)
        "res_proc_count": (name) => {
            const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
            const out = run(`pgrep -fc "${safeName}" 2>/dev/null || echo 0`);
            return parseInt(out) || 0;
        },
        // ── Ports ───────────────────────────────────────────────────
        // res_ports -> PortInfo[]  (all listening ports)
        "res_ports": () => {
            const lines = runLines("ss -tlnp 2>/dev/null | tail -n +2");
            return lines.map(line => {
                const parts = line.split(/\s+/);
                const state = parts[0] || "";
                const local = parts[3] || "";
                const proc = line.match(/pid=(\d+)/)?.[1];
                const name = line.match(/\"([^\"]+)\"/)?.[1] || "";
                const colonIdx = local.lastIndexOf(":");
                const addr = local.slice(0, colonIdx);
                const port = parseInt(local.slice(colonIdx + 1)) || 0;
                return {
                    port,
                    protocol: "tcp",
                    state,
                    pid: proc ? parseInt(proc) : null,
                    name,
                    addr,
                };
            }).filter(p => p.port > 0);
        },
        // res_port_used port -> boolean
        "res_port_used": (port) => {
            const result = (0, child_process_1.spawnSync)("sh", ["-c", `ss -tlnp 2>/dev/null | grep -q ":${port} "`]);
            return (result.status ?? 1) === 0;
        },
        // res_port_info port -> PortInfo | null
        "res_port_info": (port) => {
            const line = run(`ss -tlnp 2>/dev/null | grep ":${port} "`);
            if (!line)
                return null;
            const parts = line.split(/\s+/);
            const proc = line.match(/pid=(\d+)/)?.[1];
            const name = line.match(/\"([^\"]+)\"/)?.[1] || "";
            return {
                port,
                protocol: "tcp",
                state: parts[0] || "LISTEN",
                pid: proc ? parseInt(proc) : null,
                name,
                addr: parts[3]?.split(":").slice(0, -1).join(":") || "",
            };
        },
        // res_find_free_port start end -> number | null  (first free port in range)
        "res_find_free_port": (start, end) => {
            const usedLine = run(`ss -tlnp 2>/dev/null | awk '{print $4}' | grep -oP ':\\d+' | tr -d ':'`);
            const used = new Set(usedLine.split("\n").map(s => parseInt(s)).filter(n => !isNaN(n)));
            for (let p = start; p <= end; p++) {
                if (!used.has(p))
                    return p;
            }
            return null;
        },
        // ── Network ─────────────────────────────────────────────────
        // res_net -> NetInterface[]
        "res_net": () => {
            const ifaces = os.networkInterfaces();
            const result = [];
            for (const [name, addrs] of Object.entries(ifaces)) {
                if (!addrs)
                    continue;
                for (const addr of addrs) {
                    if (addr.family === "IPv4") {
                        result.push({
                            name,
                            addr: addr.address,
                            mac: addr.mac,
                            up: true,
                        });
                    }
                }
            }
            return result;
        },
        // res_hostname -> string
        "res_hostname": () => os.hostname(),
        // res_uptime_s -> number  (system uptime in seconds)
        "res_uptime_s": () => os.uptime(),
        // ── Services ────────────────────────────────────────────────
        // res_pm2_list -> ServiceInfo[]
        "res_pm2_list": () => {
            const out = run("pm2 jlist 2>/dev/null");
            if (!out)
                return [];
            try {
                const list = JSON.parse(out);
                return list.map((svc) => ({
                    name: svc.name,
                    status: svc.pm2_env?.status || "unknown",
                    pid: svc.pid || null,
                    uptime: svc.pm2_env?.pm_uptime
                        ? `${Math.round((Date.now() - svc.pm2_env.pm_uptime) / 1000)}s`
                        : "0s",
                    manager: "pm2",
                }));
            }
            catch {
                return [];
            }
        },
        // res_pm2_find name -> ServiceInfo | null
        "res_pm2_find": (name) => {
            const out = run("pm2 jlist 2>/dev/null");
            if (!out)
                return null;
            try {
                const list = JSON.parse(out);
                const svc = list.find((s) => s.name === name);
                if (!svc)
                    return null;
                return {
                    name: svc.name,
                    status: svc.pm2_env?.status || "unknown",
                    pid: svc.pid || null,
                    uptime: svc.pm2_env?.pm_uptime
                        ? `${Math.round((Date.now() - svc.pm2_env.pm_uptime) / 1000)}s`
                        : "0s",
                    manager: "pm2",
                };
            }
            catch {
                return null;
            }
        },
        // res_systemd_status name -> ServiceInfo
        "res_systemd_status": (name) => {
            const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
            const active = run(`systemctl is-active "${safeName}" 2>/dev/null`);
            const pid = run(`systemctl show "${safeName}" -p MainPID --value 2>/dev/null`);
            return {
                name: safeName,
                status: active || "unknown",
                pid: parseInt(pid) || null,
                uptime: run(`systemctl show "${safeName}" -p ActiveEnterTimestamp --value 2>/dev/null`),
                manager: "systemd",
            };
        },
        // ── kimdb integration ────────────────────────────────────────
        // res_kimdb_project name -> Record | null  (query local kimdb)
        "res_kimdb_project": (name) => {
            const safeName = name.replace(/[^a-zA-Z0-9_\-]/g, "");
            try {
                const out = run(`curl -sf "http://localhost:40000/api/c/projects/${safeName}" 2>/dev/null`, 3000);
                if (!out)
                    return null;
                const parsed = JSON.parse(out);
                return parsed.data ?? parsed ?? null;
            }
            catch {
                return null;
            }
        },
        // res_kimdb_projects -> Record[]  (all projects)
        "res_kimdb_projects": () => {
            try {
                const out = run(`curl -sf "http://localhost:40000/api/c/projects" 2>/dev/null`, 5000);
                if (!out)
                    return [];
                const parsed = JSON.parse(out);
                return Array.isArray(parsed) ? parsed : (parsed.data ?? []);
            }
            catch {
                return [];
            }
        },
        // res_kimdb_health -> boolean
        "res_kimdb_health": () => {
            const out = run(`curl -sf "http://localhost:40000/health" 2>/dev/null`, 2000);
            return out.includes("ok") || out.includes("healthy") || out.length > 0;
        },
        // ── Full Snapshot ────────────────────────────────────────────
        // res_snapshot -> ResourceSnapshot  (complete server state, ~1s)
        "res_snapshot": () => {
            const memInfo = (() => {
                const total = Math.round(os.totalmem() / 1024 / 1024);
                const free = Math.round(os.freemem() / 1024 / 1024);
                const lines = runLines("cat /proc/meminfo");
                const kv = parseKv(lines);
                const parseKb = (k) => Math.round(parseInt((kv[k] || "0 kB").split(" ")[0]) / 1024);
                return { total, free, used: total - free, swapTotal: parseKb("SwapTotal"), swapFree: parseKb("SwapFree") };
            })();
            const diskLines = runLines("df -BG --output=source,target,size,used,avail,pcent 2>/dev/null | tail -n +2");
            const disk = diskLines
                .filter(l => l.startsWith("/"))
                .map(line => {
                const [device, mount, total, used, avail, pct] = line.split(/\s+/);
                return { device, mount, total_gb: parseInt(total) || 0, used_gb: parseInt(used) || 0, avail_gb: parseInt(avail) || 0, use_pct: parseInt(pct) || 0 };
            });
            const procLines = runLines("ps axo pid,user,pcpu,pmem,stat,comm,args --sort=-pcpu 2>/dev/null | head -6 | tail -5");
            const top_procs = procLines.map(line => {
                const p = line.split(/\s+/);
                return { pid: parseInt(p[0]) || 0, user: p[1] || "", cpu: parseFloat(p[2]) || 0, mem: parseFloat(p[3]) || 0, state: p[4] || "", name: p[5] || "", cmd: p.slice(6).join(" ") };
            });
            const portLines = runLines("ss -tlnp 2>/dev/null | tail -n +2");
            const ports_listening = portLines.map(line => {
                const parts = line.split(/\s+/);
                const local = parts[3] || "";
                const colonIdx = local.lastIndexOf(":");
                const port = parseInt(local.slice(colonIdx + 1)) || 0;
                const proc = line.match(/pid=(\d+)/)?.[1];
                return { port, protocol: "tcp", state: parts[0] || "", pid: proc ? parseInt(proc) : null, name: line.match(/\"([^\"]+)\"/)?.[1] || "", addr: local.slice(0, colonIdx) };
            }).filter(p => p.port > 0);
            return {
                ts: Date.now(),
                hostname: os.hostname(),
                uptime_s: os.uptime(),
                cpu_load: os.loadavg(),
                mem_total_mb: memInfo.total,
                mem_used_mb: memInfo.used,
                mem_free_mb: memInfo.free,
                swap_total_mb: memInfo.swapTotal,
                swap_used_mb: memInfo.swapTotal - memInfo.swapFree,
                disk,
                top_procs,
                ports_listening,
            };
        },
        // res_snapshot_report snapshot -> string  (human/AI readable)
        "res_snapshot_report": (snap) => {
            const mem_pct = snap.mem_total_mb > 0 ? Math.round(snap.mem_used_mb / snap.mem_total_mb * 100) : 0;
            const upd = new Date(snap.ts).toISOString();
            const lines = [
                `═══ Server Resource Snapshot ══════════════════════`,
                `Host:    ${snap.hostname}  |  Time: ${upd}`,
                `Uptime:  ${Math.round(snap.uptime_s / 3600)}h ${Math.round((snap.uptime_s % 3600) / 60)}m`,
                ``,
                `── CPU Load ────────────────────────────────────────`,
                `1m: ${snap.cpu_load[0].toFixed(2)}  5m: ${snap.cpu_load[1].toFixed(2)}  15m: ${snap.cpu_load[2].toFixed(2)}`,
                ``,
                `── Memory ──────────────────────────────────────────`,
                `Used: ${snap.mem_used_mb}MB / ${snap.mem_total_mb}MB  (${mem_pct}%)`,
                `Swap: ${snap.swap_used_mb}MB / ${snap.swap_total_mb}MB`,
                ``,
                `── Disk ────────────────────────────────────────────`,
                ...snap.disk.map(d => `${d.mount.padEnd(12)} ${d.used_gb}G/${d.total_gb}G (${d.use_pct}%)  [${d.device}]`),
                ``,
                `── Top Processes ───────────────────────────────────`,
                ...snap.top_procs.map(p => `PID ${String(p.pid).padEnd(7)} CPU:${String(p.cpu).padEnd(6)} MEM:${String(p.mem).padEnd(5)} ${p.name}`),
                ``,
                `── Listening Ports ─────────────────────────────────`,
                ...snap.ports_listening.slice(0, 15).map(p => `${String(p.port).padEnd(7)} ${p.name || "(unknown)"}`),
                ...(snap.ports_listening.length > 15 ? [`... ${snap.ports_listening.length - 15} more`] : []),
                `═══════════════════════════════════════════════════`,
            ];
            return lines.join("\n");
        },
        // res_health_check -> {ok, warnings, errors}
        "res_health_check": () => {
            const warnings = [];
            const errors = [];
            const mem_pct = Math.round((1 - os.freemem() / os.totalmem()) * 100);
            if (mem_pct > 95)
                errors.push(`Memory critical: ${mem_pct}%`);
            else if (mem_pct > 80)
                warnings.push(`Memory high: ${mem_pct}%`);
            const load = os.loadavg();
            const cpus = os.cpus().length;
            if (load[0] > cpus * 2)
                errors.push(`CPU load critical: ${load[0].toFixed(2)} (${cpus} cores)`);
            else if (load[0] > cpus * 0.8)
                warnings.push(`CPU load high: ${load[0].toFixed(2)} (${cpus} cores)`);
            const diskLines = runLines("df -BG --output=target,pcent 2>/dev/null | tail -n +2");
            for (const line of diskLines) {
                const [mount, pct] = line.split(/\s+/);
                const pctNum = parseInt(pct);
                if (pctNum > 95)
                    errors.push(`Disk ${mount} critical: ${pct}`);
                else if (pctNum > 85)
                    warnings.push(`Disk ${mount} high: ${pct}`);
            }
            return {
                ok: errors.length === 0,
                warnings,
                errors,
                mem_pct,
                cpu_load_1m: load[0],
                cpu_cores: cpus,
            };
        },
    };
}
//# sourceMappingURL=stdlib-resource.js.map