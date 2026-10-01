import { createPublicKey, generateKeyPairSync, sign } from "crypto";
import { spawnSync } from "child_process";
import { lex } from "../lexer";
import { parse } from "../parser";
import { JSCodegen } from "../codegen-js";

test("generated FreeLang verifies RS256 JWK and PEM signatures", () => {
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const jwk = { ...createPublicKey(keys.publicKey).export({ format: "jwk" }),
    kid: "test-key", alg: "RS256", use: "sig" };
  const signature = sign("RSA-SHA256", Buffer.from("signed-data"), keys.privateKey).toString("base64url");
  const source = `
    (define key (json-parse ${JSON.stringify(JSON.stringify(jwk))}))
    (println (crypto_rsa_verify_jwk key "signed-data" ${JSON.stringify(signature)}))
    (println (crypto_rsa_verify_jwk key "altered-data" ${JSON.stringify(signature)}))
    (println (crypto_rsa_verify ${JSON.stringify(keys.publicKey)} "signed-data" ${JSON.stringify(signature)}))
  `;
  const generated = new JSCodegen().generate(parse(lex(source)));
  const result = spawnSync(process.execPath, ["-e", generated], { encoding: "utf8" });
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe("true\nfalse\ntrue\n");
});
