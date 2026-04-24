export const randomUUID = () => crypto.randomUUID();
export const randomBytes = (n: number) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return { toString: (enc: string) => Array.from(b).map(x => x.toString(16).padStart(2,"0")).join("") }; };
export const createHash = (alg: string) => ({ update: (d: string) => ({ digest: (enc: string) => btoa(d) }) });
export const createHmac = (alg: string, key: string) => ({ update: (d: string) => ({ digest: (enc: string) => btoa(key + d) }) });
export const timingSafeEqual = (a: any, b: any) => String(a) === String(b);
export default { randomUUID, randomBytes, createHash, createHmac, timingSafeEqual };
