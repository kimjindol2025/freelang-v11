#!/usr/bin/env node
// MongoDB Wire Protocol Helper (TCP synchronous execution)
// v11이 JSON으로 요청을 전달 → TCP 통신 → JSON으로 응답 반환

const net = require("net");
const { argv } = process;

// 인자: node _mongodb_helper.js '{"method":"connect","host":"localhost","port":27017}'
const request = argv[2] ? JSON.parse(argv[2]) : {};

async function handleRequest(req) {
  const { method, host = "localhost", port = 27017, data, timeout = 10000 } =
    req;

  switch (method) {
    case "connect": {
      // TCP 연결 테스트
      return new Promise((resolve) => {
        const socket = net.createConnection(
          { host, port, timeout },
          () => {
            socket.destroy();
            resolve({ ok: true, message: `Connected to ${host}:${port}` });
          }
        );

        socket.on("error", (err) => {
          resolve({ ok: false, error: err.message });
        });

        socket.setTimeout(timeout, () => {
          socket.destroy();
          resolve({ ok: false, error: "connection timeout" });
        });
      });
    }

    case "send": {
      // 바이너리 데이터 전송 & 응답 수신
      return new Promise((resolve) => {
        const socket = net.createConnection(
          { host, port, timeout },
          () => {
            // data는 hex string으로 전달됨
            const buf = Buffer.from(data, "hex");
            socket.write(buf);

            let responseBuffer = Buffer.alloc(0);
            const dataHandler = (chunk) => {
              responseBuffer = Buffer.concat([responseBuffer, chunk]);
            };

            socket.on("data", dataHandler);

            socket.on("end", () => {
              resolve({
                ok: true,
                data: responseBuffer.toString("hex"),
              });
            });

            socket.on("error", (err) => {
              resolve({ ok: false, error: err.message });
            });

            socket.setTimeout(timeout, () => {
              socket.destroy();
              // timeout 발생 시 현재까지의 응답 반환
              resolve({
                ok: true,
                data: responseBuffer.toString("hex"),
              });
            });
          }
        );

        socket.on("error", (err) => {
          resolve({ ok: false, error: err.message });
        });

        socket.setTimeout(timeout, () => {
          socket.destroy();
          resolve({ ok: false, error: "connection timeout" });
        });
      });
    }

    case "sendrecv": {
      // 데이터 전송 & 응답 수신 (더 간단한 버전)
      return new Promise((resolve) => {
        const socket = net.createConnection({ host, port, timeout });

        socket.on("connect", () => {
          const buf = Buffer.from(data, "hex");
          socket.write(buf);
        });

        let responseBuffer = Buffer.alloc(0);

        socket.on("data", (chunk) => {
          responseBuffer = Buffer.concat([responseBuffer, chunk]);
        });

        socket.on("end", () => {
          resolve({
            ok: true,
            data: responseBuffer.toString("hex"),
          });
        });

        socket.on("error", (err) => {
          resolve({ ok: false, error: err.message });
        });

        socket.setTimeout(timeout, () => {
          socket.destroy();
        });
      });
    }

    default:
      return { ok: false, error: `Unknown method: ${method}` };
  }
}

// 요청 처리 & 결과 출력
(async () => {
  const result = await handleRequest(request);
  console.log(JSON.stringify(result));
})();
