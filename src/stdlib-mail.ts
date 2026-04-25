// FreeLang v11: Mail outbox + SMTP (Phase I, dclub-auth)
//
// 두 발송 경로:
//   1. outbox: 디렉터리에 JSON 파일로 기록 (sendmail/postfix queue 호환)
//   2. SMTP TLS: 직접 RFC 5321 대화 (port 465 SMTPS, AUTH LOGIN)
//
// 외부 npm 0 — Node 표준 fs / net / tls 만 사용.

import * as fs from "fs";
import * as path from "path";
import * as net from "net";
import * as tls from "tls";
import { randomBytes } from "crypto";

export function createMailModule() {
  return {
    // mail_outbox_write dir to subject body -> string (파일 경로)
    "mail_outbox_write": (
      dir: string,
      to: string,
      subject: string,
      body: string,
    ): string => {
      try { fs.mkdirSync(dir, { recursive: true }); } catch {}
      const id = `${Date.now()}-${randomBytes(6).toString("hex")}.json`;
      const file = path.join(dir, id);
      const payload = {
        id,
        to,
        subject,
        body,
        ts: new Date().toISOString(),
        status: "queued",
      };
      fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
      return file;
    },

    // mail_outbox_list dir -> array (JSON 배열, 큐된 메시지)
    "mail_outbox_list": (dir: string): any[] => {
      try {
        const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
        return files.map((f) => {
          try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); }
          catch { return null; }
        }).filter((x) => x !== null);
      } catch { return []; }
    },

    // mail_outbox_count dir -> number
    "mail_outbox_count": (dir: string): number => {
      try {
        return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
      } catch { return 0; }
    },

    // ── SMTP TLS (port 465, SMTPS) ─────────────────────────
    // smtp_send_tls host port user pass from to subject body -> {ok, log}
    //
    // 동기적 비동기 — Node tls 콜백 기반이지만 Promise 인터페이스로 노출.
    // 호출 측은 await 또는 then. FL의 async_call 헬퍼로 호출 가능.

    "smtp_send_tls": (
      host: string,
      port: number,
      user: string,
      pass: string,
      from: string,
      to: string,
      subject: string,
      body: string,
    ): Promise<Record<string, any>> => {
      return new Promise((resolve) => {
        const log: string[] = [];
        const socket = tls.connect({ host, port, servername: host }, () => {
          // banner는 onData에서 처리
        });
        socket.setEncoding("utf8");

        let buf = "";
        let stage = 0;
        const send = (line: string) => {
          log.push(`> ${line.trim()}`);
          socket.write(line);
        };
        const fail = (msg: string) => {
          log.push(`! ${msg}`);
          try { socket.end(); } catch {}
          resolve({ ok: false, log: log.join("\n"), error: msg });
        };

        socket.on("data", (chunk: any) => {
          buf += chunk.toString();
          // SMTP는 줄 단위 응답. 마지막 응답 코드와 줄을 확인.
          const lines = buf.split(/\r?\n/);
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line) continue;
            log.push(`< ${line}`);
            const code = parseInt(line.slice(0, 3), 10);
            // 다음 단계 진행은 "공백 4번째 char"가 있는 마지막 줄에서만
            if (line[3] !== " " && line[3] !== undefined) continue;
            try {
              switch (stage) {
                case 0: // banner
                  if (code !== 220) return fail(`banner: ${line}`);
                  send(`EHLO ${host}\r\n`);
                  stage = 1; break;
                case 1: // EHLO
                  if (code !== 250) return fail(`ehlo: ${line}`);
                  send("AUTH LOGIN\r\n");
                  stage = 2; break;
                case 2: // 334 user prompt
                  if (code !== 334) return fail(`auth start: ${line}`);
                  send(Buffer.from(user).toString("base64") + "\r\n");
                  stage = 3; break;
                case 3: // 334 pass prompt
                  if (code !== 334) return fail(`auth user: ${line}`);
                  send(Buffer.from(pass).toString("base64") + "\r\n");
                  stage = 4; break;
                case 4: // 235 auth ok
                  if (code !== 235) return fail(`auth pass: ${line}`);
                  send(`MAIL FROM:<${from}>\r\n`);
                  stage = 5; break;
                case 5: // MAIL FROM
                  if (code !== 250) return fail(`mail from: ${line}`);
                  send(`RCPT TO:<${to}>\r\n`);
                  stage = 6; break;
                case 6: // RCPT TO
                  if (code !== 250) return fail(`rcpt to: ${line}`);
                  send("DATA\r\n");
                  stage = 7; break;
                case 7: // DATA prompt
                  if (code !== 354) return fail(`data: ${line}`);
                  const headers = [
                    `From: ${from}`,
                    `To: ${to}`,
                    `Subject: ${subject}`,
                    `MIME-Version: 1.0`,
                    `Content-Type: text/plain; charset=utf-8`,
                    "",
                  ].join("\r\n");
                  send(headers + "\r\n" + body + "\r\n.\r\n");
                  stage = 8; break;
                case 8: // accepted
                  if (code !== 250) return fail(`accept: ${line}`);
                  send("QUIT\r\n");
                  stage = 9; break;
                case 9: // QUIT
                  resolve({ ok: true, log: log.join("\n") });
                  try { socket.end(); } catch {}
                  return;
              }
            } catch (e: any) {
              return fail(`exception: ${e.message}`);
            }
          }
        });
        socket.on("error", (e) => fail(`socket: ${e.message}`));
        socket.setTimeout(15000, () => fail("timeout"));
      });
    },
  };
}
