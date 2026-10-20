# Execution evidence v0.1

Load `lib/evidence/evidence.fl` relative to the source module.

`evidence-run(command,args)` passes up to 253 string arguments directly, with
no implicit shell. It returns code, stdout, stderr, signal, duration-ms,
command and args. Duration uses the existing wall clock, clamped at zero.
Output is text; embedded NUL and binary capture are unsupported.
`evidence-hash(path)` returns `{ok:true,value:<64 lowercase hex digits>}` from
system sha256sum; missing files return HASH_FAILED.

`evidence-mask(value,sensitive)` recursively masks path/URL/email/IP tokens
and named path/account/user/host fields as `<가림>`, preserving numbers and hashes.
Plain account names in prose need explicit sensitive strings. Bare hostnames
need a host field or explicit string. Arbitrary map keys are not inspected;
this is not a complete personal-data detector.

`evidence-write(path,record)` masks the record and writes JSON
`{timestamp:<now-iso>,record:...}` through the 9-3 atomic file writer.
Use `evidence-mask(record,["sensitive account"])` first when needed.
Raw `evidence-run` results are unmasked until explicitly masked or written.
