// FreeLang v9: Server Resource Search Standard Library
// Phase 19: 서버 자원검색 — AI가 실행 중인 서버 상태를 네이티브 블록으로 조회/분석
//
// AI가 서버 자원을 "검색"하는 것은 추론의 출발점이다.
// 어떤 프로세스가 어떤 포트를 쓰는지, 메모리가 얼마나 남았는지를
// 코드 한 줄로 파악하고 다음 행동을 결정한다.

import { execSync, spawnSync } from "child_process";
import * as os from "os";

// ─────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────

function run(cmd: string, timeout = 10000): string {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout, stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function runLines(cmd: string): string[] {
  const out = run(cmd);
  return out ? out.split("\n").map(l => l.trim()).filter(Boolean) : [];
}

function parseKv(lines: string[], sep = ":"): Record<string, string> {
  const obj: Record<string, string> = {};
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
// types
// ─────────────────────────────────────────────

export interface ProcessInfo {
  pid: number;
  name: string;
  user: string;
  cpu: number;
  mem: number;
  cmd: string;
  state: string;
}

export interface PortInfo {
  port: number;
  protocol: string;
  state: string;
  pid: number | null;
  name: string;
  addr: string;
}

export interface DiskInfo {
  device: string;
  mount: string;
  total_gb: number;
  used_gb: number;
  avail_gb: number;
  use_pct: number;
}

export interface NetInterface {
  name: string;
  addr: string;
  mac: string;
  up: boolean;
}

export interface ServiceInfo {
  name: string;
  status: string;
  pid: number | null;
  uptime: string;
  manager: "pm2" | "systemd" | "unknown";
}

export interface ResourceSnapshot {
  ts: number;
  hostname: string;
  uptime_s: number;
  cpu_load: number[];    // [1m, 5m, 15m]
  mem_total_mb: number;
  mem_used_mb: number;
  mem_free_mb: number;
  swap_total_mb: number;
  swap_used_mb: number;
  disk: DiskInfo[];
  top_procs: ProcessInfo[];
  ports_listening: PortInfo[];
}

// ─────────────────────────────────────────────
// module
// ─────────────────────────────────────────────

export function createResourceModule() {
  return {

    // ── CPU ─────────────────────────────────────────────────────

    // res_cpu_load -> [1m, 5m, 15m]
    "res_cpu_load": (): number[] => {
      return os.loadavg();
    },

    // res_cpu_count -> number
    "res_cpu_count": (): number => {
      return os.cpus().length;
    },

    // res_cpu_model -> string
    "res_cpu_model": (): string => {
      const cpus = os.cpus();
      return cpus.length > 0 ? cpus[0].model : "unknown";
    },

    // res_cpu_pct -> number (1-min loadavg based, avoids busy wait)
    "res_cpu_pct": (): number => {
      const load = os.loadavg()[0];
      const cpus = os.cpus().length;
      return Math.min(100, Math.round((load / cpus) * 100));
    },

    // ── Memory ──────────────────────────────────────────────────

    // res_mem -> {total_mb, used_mb, free_mb, buffers_mb, cached_mb, available_mb}
    "res_mem": (): Record<string, number> => {
      const total = Math.round(os.totalmem() / 1024 / 1024);
      const free = Math.round(os.freemem() / 1024 / 1024);
      const used = total - free;

      // Try to get more detail from /proc/meminfo
      const lines = runLines("cat /proc/meminfo");
      const kv = parseKv(lines);
      const parseKb = (k: string) => Math.round(parseInt((kv[k] || "0 kB").split(" ")[0]) / 1024);

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
    "res_mem_pct": (): number => {
      const total = os.totalmem();
      const free = os.freemem();
      return total > 0 ? Math.round((1 - free / total) * 100) : 0;
    },

    // ── Disk ────────────────────────────────────────────────────

    // res_disk -> DiskInfo[]
    "res_disk": (): DiskInfo[] => {
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
    "res_disk_usage": (path: string): Record<string, number> => {
      const line = run(`df -BG --output=size,used,avail,pcent "${path}" 2>/dev/null | tail -1`);
      if (!line) return { total_gb: 0, used_gb: 0, avail_gb: 0, use_pct: 0 };
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
    "res_procs": (): ProcessInfo[] => {
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
    "res_find_proc": (name: string): ProcessInfo[] => {
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
    "res_proc_exists": (name: string): boolean => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
      const result = spawnSync("sh", ["-c", `pgrep -f "${safeName}" > /dev/null 2>&1`]);
      return (result.status ?? 1) === 0;
    },

    // res_proc_pid name -> number | null
    "res_proc_pid": (name: string): number | null => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
      const out = run(`pgrep -f "${safeName}" | head -1`);
      const pid = parseInt(out);
      return isNaN(pid) ? null : pid;
    },

    // res_proc_count name -> number  (how many instances running)
    "res_proc_count": (name: string): number => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
      const out = run(`pgrep -fc "${safeName}" 2>/dev/null || echo 0`);
      return parseInt(out) || 0;
    },

    // ── Ports ───────────────────────────────────────────────────

    // res_ports -> PortInfo[]  (all listening ports)
    "res_ports": (): PortInfo[] => {
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
    "res_port_used": (port: number): boolean => {
      const result = spawnSync("sh", ["-c", `ss -tlnp 2>/dev/null | grep -q ":${port} "`]);
      return (result.status ?? 1) === 0;
    },

    // res_port_info port -> PortInfo | null
    "res_port_info": (port: number): PortInfo | null => {
      const line = run(`ss -tlnp 2>/dev/null | grep ":${port} "`);
      if (!line) return null;
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
    "res_find_free_port": (start: number, end: number): number | null => {
      const usedLine = run(`ss -tlnp 2>/dev/null | awk '{print $4}' | grep -oP ':\\d+' | tr -d ':'`);
      const used = new Set(usedLine.split("\n").map(s => parseInt(s)).filter(n => !isNaN(n)));
      for (let p = start; p <= end; p++) {
        if (!used.has(p)) return p;
      }
      return null;
    },

    // ── Network ─────────────────────────────────────────────────

    // res_net -> NetInterface[]
    "res_net": (): NetInterface[] => {
      const ifaces = os.networkInterfaces();
      const result: NetInterface[] = [];
      for (const [name, addrs] of Object.entries(ifaces)) {
        if (!addrs) continue;
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
    "res_hostname": (): string => os.hostname(),

    // res_uptime_s -> number  (system uptime in seconds)
    "res_uptime_s": (): number => os.uptime(),

    // ── Services ────────────────────────────────────────────────

    // res_pm2_list -> ServiceInfo[]
    "res_pm2_list": (): ServiceInfo[] => {
      const out = run("pm2 jlist 2>/dev/null");
      if (!out) return [];
      try {
        const list = JSON.parse(out);
        return list.map((svc: any) => ({
          name: svc.name,
          status: svc.pm2_env?.status || "unknown",
          pid: svc.pid || null,
          uptime: svc.pm2_env?.pm_uptime
            ? `${Math.round((Date.now() - svc.pm2_env.pm_uptime) / 1000)}s`
            : "0s",
          manager: "pm2" as const,
        }));
      } catch {
        return [];
      }
    },

    // res_pm2_find name -> ServiceInfo | null
    "res_pm2_find": (name: string): ServiceInfo | null => {
      const out = run("pm2 jlist 2>/dev/null");
      if (!out) return null;
      try {
        const list = JSON.parse(out);
        const svc = list.find((s: any) => s.name === name);
        if (!svc) return null;
        return {
          name: svc.name,
          status: svc.pm2_env?.status || "unknown",
          pid: svc.pid || null,
          uptime: svc.pm2_env?.pm_uptime
            ? `${Math.round((Date.now() - svc.pm2_env.pm_uptime) / 1000)}s`
            : "0s",
          manager: "pm2",
        };
      } catch {
        return null;
      }
    },

    // res_systemd_status name -> ServiceInfo
    "res_systemd_status": (name: string): ServiceInfo => {
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
    "res_kimdb_project": (name: string): Record<string, any> | null => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-]/g, "");
      try {
        const out = run(`curl -sf "http://localhost:40000/api/c/projects/${safeName}" 2>/dev/null`, 3000);
        if (!out) return null;
        const parsed = JSON.parse(out);
        return parsed.data ?? parsed ?? null;
      } catch {
        return null;
      }
    },

    // res_kimdb_projects -> Record[]  (all projects)
    "res_kimdb_projects": (): Record<string, any>[] => {
      try {
        const out = run(`curl -sf "http://localhost:40000/api/c/projects" 2>/dev/null`, 5000);
        if (!out) return [];
        const parsed = JSON.parse(out);
        return Array.isArray(parsed) ? parsed : (parsed.data ?? []);
      } catch {
        return [];
      }
    },

    // res_kimdb_health -> boolean
    "res_kimdb_health": (): boolean => {
      const out = run(`curl -sf "http://localhost:40000/health" 2>/dev/null`, 2000);
      return out.includes("ok") || out.includes("healthy") || out.length > 0;
    },

    // ── Full Snapshot ────────────────────────────────────────────

    // res_snapshot -> ResourceSnapshot  (complete server state, ~1s)
    "res_snapshot": (): ResourceSnapshot => {
      const memInfo = (() => {
        const total = Math.round(os.totalmem() / 1024 / 1024);
        const free = Math.round(os.freemem() / 1024 / 1024);
        const lines = runLines("cat /proc/meminfo");
        const kv = parseKv(lines);
        const parseKb = (k: string) => Math.round(parseInt((kv[k] || "0 kB").split(" ")[0]) / 1024);
        return { total, free, used: total - free, swapTotal: parseKb("SwapTotal"), swapFree: parseKb("SwapFree") };
      })();

      const diskLines = runLines("df -BG --output=source,target,size,used,avail,pcent 2>/dev/null | tail -n +2");
      const disk: DiskInfo[] = diskLines
        .filter(l => l.startsWith("/"))
        .map(line => {
          const [device, mount, total, used, avail, pct] = line.split(/\s+/);
          return { device, mount, total_gb: parseInt(total) || 0, used_gb: parseInt(used) || 0, avail_gb: parseInt(avail) || 0, use_pct: parseInt(pct) || 0 };
        });

      const procLines = runLines("ps axo pid,user,pcpu,pmem,stat,comm,args --sort=-pcpu 2>/dev/null | head -6 | tail -5");
      const top_procs: ProcessInfo[] = procLines.map(line => {
        const p = line.split(/\s+/);
        return { pid: parseInt(p[0]) || 0, user: p[1] || "", cpu: parseFloat(p[2]) || 0, mem: parseFloat(p[3]) || 0, state: p[4] || "", name: p[5] || "", cmd: p.slice(6).join(" ") };
      });

      const portLines = runLines("ss -tlnp 2>/dev/null | tail -n +2");
      const ports_listening: PortInfo[] = portLines.map(line => {
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
    "res_snapshot_report": (snap: ResourceSnapshot): string => {
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
    "res_health_check": (): Record<string, any> => {
      const warnings: string[] = [];
      const errors: string[] = [];

      const mem_pct = Math.round((1 - os.freemem() / os.totalmem()) * 100);
      if (mem_pct > 95) errors.push(`Memory critical: ${mem_pct}%`);
      else if (mem_pct > 80) warnings.push(`Memory high: ${mem_pct}%`);

      const load = os.loadavg();
      const cpus = os.cpus().length;
      if (load[0] > cpus * 2) errors.push(`CPU load critical: ${load[0].toFixed(2)} (${cpus} cores)`);
      else if (load[0] > cpus * 0.8) warnings.push(`CPU load high: ${load[0].toFixed(2)} (${cpus} cores)`);

      const diskLines = runLines("df -BG --output=target,pcent 2>/dev/null | tail -n +2");
      for (const line of diskLines) {
        const [mount, pct] = line.split(/\s+/);
        const pctNum = parseInt(pct);
        if (pctNum > 95) errors.push(`Disk ${mount} critical: ${pct}`);
        else if (pctNum > 85) warnings.push(`Disk ${mount} high: ${pct}`);
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
