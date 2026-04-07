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
    cpu_load: number[];
    mem_total_mb: number;
    mem_used_mb: number;
    mem_free_mb: number;
    swap_total_mb: number;
    swap_used_mb: number;
    disk: DiskInfo[];
    top_procs: ProcessInfo[];
    ports_listening: PortInfo[];
}
export declare function createResourceModule(): {
    res_cpu_load: () => number[];
    res_cpu_count: () => number;
    res_cpu_model: () => string;
    res_cpu_pct: () => number;
    res_mem: () => Record<string, number>;
    res_mem_pct: () => number;
    res_disk: () => DiskInfo[];
    res_disk_usage: (path: string) => Record<string, number>;
    res_procs: () => ProcessInfo[];
    res_find_proc: (name: string) => ProcessInfo[];
    res_proc_exists: (name: string) => boolean;
    res_proc_pid: (name: string) => number | null;
    res_proc_count: (name: string) => number;
    res_ports: () => PortInfo[];
    res_port_used: (port: number) => boolean;
    res_port_info: (port: number) => PortInfo | null;
    res_find_free_port: (start: number, end: number) => number | null;
    res_net: () => NetInterface[];
    res_hostname: () => string;
    res_uptime_s: () => number;
    res_pm2_list: () => ServiceInfo[];
    res_pm2_find: (name: string) => ServiceInfo | null;
    res_systemd_status: (name: string) => ServiceInfo;
    res_kimdb_project: (name: string) => Record<string, any> | null;
    res_kimdb_projects: () => Record<string, any>[];
    res_kimdb_health: () => boolean;
    res_snapshot: () => ResourceSnapshot;
    res_snapshot_report: (snap: ResourceSnapshot) => string;
    res_health_check: () => Record<string, any>;
};
//# sourceMappingURL=stdlib-resource.d.ts.map