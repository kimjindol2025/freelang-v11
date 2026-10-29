# JSON parser regression inputs

These files reproduce malformed inputs accepted by the parser at the 9-37 starting revision. The fixed-seed baseline accepted 2,665 malformed byte strings in 100,000 JSON cases and accepted a 10,000-level document without enforcing a nesting limit. `task937/runtime-fuzz.c` replays every `json-*` fixture and requires a parse error.

The `.bin` files are exact byte inputs. `json-depth-10000.json` is a valid but deliberately over-deep document; the runtime now rejects it at the documented parser depth boundary instead of recursing without a bound. `compiler-first.fl` is the 10,000-unmatched-parenthesis input generated at iteration 17000 of the fixed-seed compiler fuzzer; the normal 100,000-case run replays it. The compiler must exit with a syntax error within the per-input timeout.
