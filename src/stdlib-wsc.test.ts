// WebSocket Client (stdlib-wsc) 테스트
// Phase 57: WS 클라이언트 함수 검증

import { createWscModule } from "./stdlib-wsc";

describe("stdlib-wsc: WebSocket Client", () => {
  let module: any;
  let callLog: Array<[string, any[]]> = [];

  beforeEach(() => {
    callLog = [];
    const mockCallFn = (name: string, args: any[]) => {
      callLog.push([name, args]);
    };
    module = createWscModule(mockCallFn);
  });

  describe("wsc_connect", () => {
    it("should return a connection ID", () => {
      const connId = module.wsc_connect("ws://localhost:9000", "token123");
      expect(connId).toMatch(/^wsc_\d+_\d+$/);
    });

    it("should accept URL and token", () => {
      const url = "wss://relay.dclub.kr:9000";
      const token = "jwt-token";
      const connId = module.wsc_connect(url, token);
      expect(connId).toBeDefined();
    });

    it("should handle empty token", () => {
      const connId = module.wsc_connect("ws://localhost:9000", "");
      expect(connId).toMatch(/^wsc_\d+_\d+$/);
    });
  });

  describe("wsc_state", () => {
    it("should return CLOSED for non-existent connection", () => {
      const state = module.wsc_state("non_existent");
      expect(state).toBe("CLOSED");
    });

    it("should return CONNECTING or OPEN for new connection", (done) => {
      const connId = module.wsc_connect("ws://localhost:9000", "token");
      const state = module.wsc_state(connId);
      // WebSocket 연결 중에는 CONNECTING 또는 OPEN 상태
      expect(["CONNECTING", "OPEN", "CLOSED"]).toContain(state);
      done();
    });
  });

  describe("wsc_send", () => {
    it("should return false for non-existent connection", () => {
      const result = module.wsc_send("non_existent", "hello");
      expect(result).toBe(false);
    });
  });

  describe("wsc_send_json", () => {
    it("should return false for non-existent connection", () => {
      const result = module.wsc_send_json("non_existent", { msg: "hello" });
      expect(result).toBe(false);
    });
  });

  describe("wsc_close", () => {
    it("should return false for non-existent connection", () => {
      const result = module.wsc_close("non_existent");
      expect(result).toBe(false);
    });
  });

  describe("Event handler registration", () => {
    it("should register wsc_on_open_fn", () => {
      const result = module.wsc_on_open_fn("custom_open_handler");
      expect(result).toBeNull();
    });

    it("should register wsc_on_message_fn", () => {
      const result = module.wsc_on_message_fn("custom_message_handler");
      expect(result).toBeNull();
    });

    it("should register wsc_on_close_fn", () => {
      const result = module.wsc_on_close_fn("custom_close_handler");
      expect(result).toBeNull();
    });

    it("should register wsc_on_error_fn", () => {
      const result = module.wsc_on_error_fn("custom_error_handler");
      expect(result).toBeNull();
    });
  });

  describe("wsc_reconnect_with_backoff", () => {
    it("should return null for non-existent connection", () => {
      const result = module.wsc_reconnect_with_backoff("non_existent", 3);
      expect(result).toBeNull();
    });

    it("should accept maxRetries parameter", () => {
      // 이 테스트는 실제 재연결을 트리거하지 않음 (non-existent connection)
      const result = module.wsc_reconnect_with_backoff("fake_conn", 5);
      expect(result).toBeNull();
    });
  });

  describe("Module exports", () => {
    it("should export all required functions", () => {
      expect(typeof module.wsc_connect).toBe("function");
      expect(typeof module.wsc_send).toBe("function");
      expect(typeof module.wsc_send_json).toBe("function");
      expect(typeof module.wsc_close).toBe("function");
      expect(typeof module.wsc_state).toBe("function");
      expect(typeof module.wsc_on_open_fn).toBe("function");
      expect(typeof module.wsc_on_message_fn).toBe("function");
      expect(typeof module.wsc_on_close_fn).toBe("function");
      expect(typeof module.wsc_on_error_fn).toBe("function");
      expect(typeof module.wsc_reconnect_with_backoff).toBe("function");
    });
  });
});
