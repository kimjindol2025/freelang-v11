export const execSync = () => "";
export const execFileSync = () => "";
export const spawnSync = () => ({ stdout: { toString: () => "" }, stderr: { toString: () => "" }, status: 0 });
export const spawn = () => ({ on: () => {}, stdout: { on: () => {} }, stderr: { on: () => {} } });
export const exec = (_: any, cb: any) => cb(null, "", "");
export default { execSync, execFileSync, spawnSync, spawn, exec };
