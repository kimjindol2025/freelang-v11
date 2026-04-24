// Node.js 모듈 브라우저 스텁 — 빌드 에러 방지용
export const readFileSync = () => "";
export const writeFileSync = () => {};
export const existsSync = () => false;
export const mkdirSync = () => {};
export const readdirSync = () => [];
export const statSync = () => ({});
export const openSync = () => 0;
export const closeSync = () => {};
export const writeSync = () => 0;
export const readSync = () => 0;
export const fsyncSync = () => {};
export const createReadStream = () => ({});
export const createWriteStream = () => ({});
export const unlinkSync = () => {};
export default { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync };
