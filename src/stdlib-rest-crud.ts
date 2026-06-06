// FreeLang v11: REST CRUD Routing Macro
// Phase F-4: 1선언으로 CRUD 5 endpoint 자동 생성 (코드 80% 감소)
//
// 기존:
//   (route "GET"    "/users"     list-users-fn)
//   (route "GET"    "/users/:id" get-user-fn)
//   (route "POST"   "/users"     create-user-fn)
//   (route "PUT"    "/users/:id" update-user-fn)
//   (route "DELETE" "/users/:id" delete-user-fn)
//
// 신규:
//   (rest_crud "/users" {:list list-fn :get get-fn :create create-fn ...})

type RouteEntry = {
  method: string;
  pattern: string;
  handler: any;
  paramName?: string;
};

type RouterRegistrar = (method: string, pattern: string, handler: any) => void;

function buildRoutes(basePath: string, handlers: Map<string, any>): RouteEntry[] {
  const routes: RouteEntry[] = [];
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  // 마지막 경로 세그먼트로 파라미터 이름 추출: /users → user_id
  const segments = base.split("/").filter(Boolean);
  const lastSeg = segments[segments.length - 1] ?? "item";
  const paramName = lastSeg.endsWith("s") ? lastSeg.slice(0, -1) + "_id" : lastSeg + "_id";

  const list   = handlers.get("list");
  const get    = handlers.get("get");
  const create = handlers.get("create");
  const update = handlers.get("update");
  const del    = handlers.get("delete") ?? handlers.get("del");
  const patch  = handlers.get("patch");

  if (list)   routes.push({ method: "GET",    pattern: base,                 handler: list });
  if (create) routes.push({ method: "POST",   pattern: base,                 handler: create });
  if (get)    routes.push({ method: "GET",    pattern: `${base}/:${paramName}`, handler: get, paramName });
  if (update) routes.push({ method: "PUT",    pattern: `${base}/:${paramName}`, handler: update, paramName });
  if (patch)  routes.push({ method: "PATCH",  pattern: `${base}/:${paramName}`, handler: patch, paramName });
  if (del)    routes.push({ method: "DELETE", pattern: `${base}/:${paramName}`, handler: del, paramName });

  return routes;
}

export function createRestCrudModule() {
  return {
    // rest_crud basePath handlers -> [{method, pattern, handler}, ...]
    // handlers: Map {:list fn :get fn :create fn :update fn :delete fn :patch fn}
    // 반환값은 route_register로 등록하거나 직접 iterate 가능
    "rest_crud": (basePath: string, handlers: any): Map<string, any>[] => {
      const h = handlers instanceof Map ? handlers : new Map(Object.entries(handlers ?? {}));
      const routes = buildRoutes(basePath, h);
      return routes.map(r => {
        const m = new Map<string, any>();
        m.set("method", r.method);
        m.set("pattern", r.pattern);
        m.set("handler", r.handler);
        if (r.paramName) m.set("param", r.paramName);
        return m;
      });
    },

    // route_info basePath -> {base, param_name, supported_ops: [...]}
    "route_info": (basePath: string): Map<string, any> => {
      const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
      const segs = base.split("/").filter(Boolean);
      const last = segs[segs.length - 1] ?? "item";
      const param = last.endsWith("s") ? last.slice(0, -1) + "_id" : last + "_id";
      const m = new Map<string, any>();
      m.set("base", base);
      m.set("param_name", param);
      m.set("collection_path", base);
      m.set("item_path", `${base}/:${param}`);
      m.set("supported_ops", ["list", "get", "create", "update", "patch", "delete"]);
      return m;
    },

    // crud_handler_map list_fn get_fn create_fn update_fn delete_fn -> Map
    // 편의 함수: 순서대로 handler Map 생성
    "crud_handler_map": (
      list: any, get: any, create: any, update: any, del: any, patch?: any
    ): Map<string, any> => {
      const m = new Map<string, any>();
      if (list)   m.set("list",   list);
      if (get)    m.set("get",    get);
      if (create) m.set("create", create);
      if (update) m.set("update", update);
      if (del)    m.set("delete", del);
      if (patch)  m.set("patch",  patch);
      return m;
    },

    // path_param req paramName -> string or nil
    "path_param": (req: any, paramName: string): string | null => {
      const r = req instanceof Map ? req : new Map(Object.entries(req ?? {}));
      const params = r.get("params") ?? r.get("path_params");
      if (!params) return null;
      if (params instanceof Map) return params.get(paramName) ?? null;
      return params[paramName] ?? null;
    },

    // rest_response status body -> Map
    "rest_response": (status: number, body: any): Map<string, any> => {
      const m = new Map<string, any>();
      m.set("status", status);
      m.set("body", body);
      m.set("headers", new Map([["Content-Type", "application/json"]]));
      return m;
    },

    // rest_ok body -> Map (200)
    "rest_ok": (body: any): Map<string, any> => {
      const m = new Map<string, any>();
      m.set("status", 200);
      m.set("body", body);
      return m;
    },

    // rest_created body -> Map (201)
    "rest_created": (body: any): Map<string, any> => {
      const m = new Map<string, any>();
      m.set("status", 201);
      m.set("body", body);
      return m;
    },

    // rest_not_found msg -> Map (404)
    "rest_not_found": (msg?: string): Map<string, any> => {
      const m = new Map<string, any>();
      m.set("status", 404);
      m.set("body", { error: msg ?? "Not Found" });
      return m;
    },

    // rest_error status msg -> Map
    "rest_error": (status: number, msg: string): Map<string, any> => {
      const m = new Map<string, any>();
      m.set("status", status);
      m.set("body", { error: msg });
      return m;
    },
  };
}
