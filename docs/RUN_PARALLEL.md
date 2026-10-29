# `run-parallel` contract

`(run-parallel jobs [workers])` runs each zero-argument FreeLang function in a
forked child. `workers` defaults to 8 and is clamped to 1–8. Each child has a
5-second wall-clock limit and may return at most 2 MiB of JSON. Jobs must be a
vector of functions.

Children encode results with the runtime's JSON serializer; the parent parses
those bytes with the runtime's JSON parser. Supported results are nil,
booleans, numbers, strings, vectors, and maps containing only those values.
Functions and any other unsupported value produce an error value for that job.
The returned vector keeps input order, regardless of completion order.

Fork gives each child a private copy of the process state. A mutation to a
captured outer variable in a child is not visible in the parent. A child that
exits, is signalled, exceeds its time limit, or returns an unsupported or
oversized value produces an error value in its slot; other jobs continue.
Every child is reaped with `waitpid` before `run-parallel` returns.
