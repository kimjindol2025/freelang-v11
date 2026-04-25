export const randomUUID = () => crypto.randomUUID();
export const randomBytes = (n: number) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return { toString: (enc: string) => Array.from(b).map(x => x.toString(16).padStart(2,"0")).join("") }; };
export const createHash = (alg: string) => ({ update: (d: string) => ({ digest: (enc: string) => btoa(d) }) });
export const createHmac = (alg: string, key: string) => ({ update: (d: string) => ({ digest: (enc: string) => btoa(key + d) }) });
export const timingSafeEqual = (a: any, b: any) => String(a) === String(b);
// RSA — 브라우저 stub (실제 RS256은 Node 환경 한정. 브라우저에서 호출 시 throw)
const rsaUnsupported = () => { throw new Error("RSA primitives unavailable in browser stub"); };
export const generateKeyPairSync: any = rsaUnsupported;
export const createSign: any = rsaUnsupported;
export const createVerify: any = rsaUnsupported;
export const createPublicKey: any = rsaUnsupported;
export const scryptSync: any = () => { throw new Error("scryptSync unavailable in browser stub"); };
export type KeyObject = any;
export default { randomUUID, randomBytes, createHash, createHmac, timingSafeEqual,
  generateKeyPairSync, createSign, createVerify, createPublicKey, scryptSync };
