// FreeLang v9 Package: fl-http-client
// FL 인터프리터에 등록 가능한 HTTP 클라이언트 함수들

export interface HttpResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

export interface MockRoute {
  method: string;
  url: string;
  response: Partial<HttpResponse>;
}

export class MockHttpClient {
  private routes: MockRoute[] = [];
  private defaultResponse: HttpResponse = {
    status: 200,
    body: '{"ok":true}',
    headers: { "content-type": "application/json" },
  };

  addRoute(method: string, url: string, response: Partial<HttpResponse>): void {
    this.routes.push({ method: method.toUpperCase(), url, response });
  }

  async request(method: string, url: string, _body?: string): Promise<HttpResponse> {
    const route = this.routes.find(
      (r) => r.method === method.toUpperCase() && r.url === url
    );
    if (route) {
      return {
        status: route.response.status ?? 200,
        body: route.response.body ?? "",
        headers: route.response.headers ?? {},
      };
    }
    return { ...this.defaultResponse };
  }

  async get(url: string): Promise<HttpResponse> {
    return this.request("GET", url);
  }

  async post(url: string, body: string): Promise<HttpResponse> {
    return this.request("POST", url, body);
  }

  async put(url: string, body: string): Promise<HttpResponse> {
    return this.request("PUT", url, body);
  }

  async delete(url: string): Promise<HttpResponse> {
    return this.request("DELETE", url);
  }

  async json(url: string): Promise<any> {
    const res = await this.get(url);
    return JSON.parse(res.body);
  }

  async withHeaders(
    url: string,
    headers: Record<string, string>,
    method: string
  ): Promise<HttpResponse> {
    return this.request(method, url);
  }
}

export function createMockHttpClient(): MockHttpClient {
  return new MockHttpClient();
}

// 실제 fetch 기반 HTTP 함수 (Node.js 18+ 또는 node-fetch 필요)
async function httpFetch(
  url: string,
  method: string,
  body?: string,
  headers?: Record<string, string>
): Promise<HttpResponse> {
  const fetchFn: typeof fetch =
    typeof fetch !== "undefined"
      ? fetch
      : (await import("node:https")).request as any;

  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body !== undefined) opts.body = body;

  const res = await (fetch as typeof globalThis.fetch)(url, opts);
  const resBody = await res.text();
  const resHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    resHeaders[k] = v;
  });
  return { status: res.status, body: resBody, headers: resHeaders };
}

export function registerFlHttpClient(registry: any): void {
  registry["http-get"] = async (url: string): Promise<HttpResponse> =>
    httpFetch(url, "GET");

  registry["http-post"] = async (
    url: string,
    body: string
  ): Promise<HttpResponse> => httpFetch(url, "POST", body);

  registry["http-put"] = async (
    url: string,
    body: string
  ): Promise<HttpResponse> => httpFetch(url, "PUT", body);

  registry["http-delete"] = async (url: string): Promise<HttpResponse> =>
    httpFetch(url, "DELETE");

  registry["http-json"] = async (url: string): Promise<any> => {
    const res = await httpFetch(url, "GET");
    return JSON.parse(res.body);
  };

  registry["http-headers"] = async (
    url: string,
    headers: Record<string, string>,
    method: string
  ): Promise<HttpResponse> => httpFetch(url, method, undefined, headers);
}
