// FreeLang v11: Audit Log Standard Library
// audit_log — 서비스 감사 로그를 중앙 서버로 전송
// 실패해도 본 작업을 막지 않음 (fire-and-forget)

import { spawnSync } from "child_process";

function postJson(url: string, body: string, apiKey: string): { ok: boolean; status: number } {
  const args = [
    "-s", "-o", "/dev/null", "-w", "%{http_code}",
    "-X", "POST",
    "-H", "Content-Type: application/json",
    ...(apiKey ? ["-H", `X-Service-Key: ${apiKey}`] : []),
    "-d", body,
    url,
  ];
  try {
    const result = spawnSync("curl", args, { timeout: 3000 });
    const code = parseInt(result.stdout?.toString().trim() ?? "0", 10);
    return { ok: code >= 200 && code < 300, status: code };
  } catch {
    return { ok: false, status: 0 };
  }
}

export function createAuditModule() {
  return {
    // audit_log serviceId actorId action resource detail
    //   → {:ok true :status 200} | {:ok false :status N}
    // actorId가 nil이면 serviceId로 자동 대체
    // 실패해도 nil 반환 (본 작업 차단 없음)
    "audit_log": (
      serviceId: string,
      actorId: string | null,
      action: string,
      resource: string,
      detail: string
    ): any => {
      const url = process.env.AUDIT_URL ?? "";
      const key = process.env.AUDIT_SERVICE_KEY ?? "";
      if (!url) return null;

      const payload = JSON.stringify({
        service_id: serviceId,
        actor_id:   actorId ?? serviceId,
        action,
        resource,
        detail,
        timestamp:  new Date().toISOString(),
      });

      try {
        return postJson(url, payload, key);
      } catch {
        return null;
      }
    },

    // audit_log_custom serviceId actorId action resource detail extraMap
    //   → extraMap을 페이로드에 병합
    "audit_log_custom": (
      serviceId: string,
      actorId: string | null,
      action: string,
      resource: string,
      detail: string,
      extra: Record<string, any>
    ): any => {
      const url = process.env.AUDIT_URL ?? "";
      const key = process.env.AUDIT_SERVICE_KEY ?? "";
      if (!url) return null;

      const payload = JSON.stringify({
        service_id: serviceId,
        actor_id:   actorId ?? serviceId,
        action,
        resource,
        detail,
        timestamp:  new Date().toISOString(),
        ...(extra && typeof extra === "object" ? extra : {}),
      });

      try {
        return postJson(url, payload, key);
      } catch {
        return null;
      }
    },

    // audit_log_ok? result → true/false (결과 확인용)
    "audit_log_ok?": (result: any): boolean => {
      return result !== null && result !== undefined && result.ok === true;
    },
  };
}
