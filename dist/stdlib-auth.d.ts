export declare function createAuthModule(): {
    auth_jwt_sign: (payload: any, secret: string, expiry?: number) => string;
    auth_jwt_verify: (token: string, secret: string) => any;
    auth_jwt_decode: (token: string) => any;
    auth_jwt_expired: (token: string) => boolean;
    auth_bearer_extract: (req: any) => string | null;
    auth_apikey_valid: (req: any, validKeys: string[]) => boolean;
    auth_apikey_get: (req: any) => string;
    auth_hash_password: (password: string) => string;
    auth_verify_password: (password: string, stored: string) => boolean;
    auth_random_token: (bytes?: number) => string;
    auth_hmac: (data: string, secret: string) => string;
    auth_sha256: (data: string) => string;
    auth_base64: (data: string) => string;
    auth_base64_decode: (b64: string) => string;
};
//# sourceMappingURL=stdlib-auth.d.ts.map