# AFJ Stdlib Core V1

## Purpose

`stdlib/core-v1` is the minimum stable standard-library surface intended for AI-first AFJ work.

It does not replace the existing `stdlib/` tree. It narrows it.

Goals:

- small and predictable surface area
- stable names for common AI-generated code
- thin wrappers over existing runtime behavior where possible
- explicit representation for `result` and `option`

## Modules

1. `stdlib/core-v1/string.fl`
2. `stdlib/core-v1/list.fl`
3. `stdlib/core-v1/map-json.fl`
4. `stdlib/core-v1/result.fl`
5. `stdlib/core-v1/option.fl`
6. `stdlib/core-v1/validate-schema.fl`
7. `stdlib/core-v1/time-date.fl`
8. `stdlib/core-v1/io-contract.fl`
9. `stdlib/core-v1/config-env.fl`
10. `stdlib/core-v1/log-debug.fl`

## Design Rules

- prefer total functions with defaults over partial unwraps
- keep data shapes explicit
- use wrappers instead of exposing many overlapping helpers
- avoid broad framework behavior here
- keep modules standalone because current `load` resolution is caller-relative

## AI Usage Priority

When AI generates AFJ code for common application logic, prefer `stdlib/core-v1` first.

Priority order:

1. use `core-v1` names before broader `stdlib/` helpers
2. use `result` and `option` shapes instead of ad hoc `{:ok ...}` or `nil` conventions
3. use `io-contract` for request/response-shaped data
4. widen into the broader `stdlib/` tree only when `core-v1` does not cover the task

Recommended rule for prompts and agents:

- default to `stdlib/core-v1/*`
- treat wider `stdlib/*` helpers as opt-in extensions
- avoid inventing a second overlapping mini-stdlib in application code

## Data Shapes

### Result

```clojure
{:ok true :value any}
{:ok false :code "..." :message "..." :details {...}}
```

### Option

```clojure
{:present true :value any}
{:present false :value nil}
```

### IO Contract

Request:

```clojure
{:method "GET" :path "/v1/items" :headers {} :query {} :body nil}
```

Response:

```clojure
{:status 200 :headers {} :body {...}}
```

## Verification

Integration example:

```bash
node bootstrap.js run examples/test-stdlib-core-v1.fl
```

Truth contract:

```bash
node bootstrap.js run stdlib/core-v1-truth.fl
```

## Limits

- `map/object/json` now standardizes map/object helpers plus JSON encode/decode on top of the bootstrap runtime contract
- this is a stable minimum set, not the whole stdlib
