# Native `freelang-tools` setup for v11 checks

The v11 quick checks require the sibling repository `freelang-tools`. Use the credential-free clone URL below; authenticate through the machine's configured Git credential helper if needed. Do not put credentials in the URL.

```sh
git clone https://github.com/kimjindol2025/freelang-tools.git freelang-tools
git -C freelang-tools checkout --detach 5bbfb771e5f9c83f0b9664e306ff143a0a2b556c
test "$(git -C freelang-tools rev-parse HEAD)" = 5bbfb771e5f9c83f0b9664e306ff143a0a2b556c
test -x freelang-tools/scripts/cgc-native
test -x freelang-tools/scripts/fl-cgc-run
sha256sum freelang-tools/scripts/cgc-native freelang-tools/scripts/fl-cgc-run
```

Expected executable hashes at the pinned commit:

- `cgc-native`: `b9681984c7b92d581da56bf73af84053817efc5a618192ab5c9586a58c91e814`
- `fl-cgc-run`: `55321a11271135b3c27bc1a4e6cd393e6a812de5b208db47884afb7c0e5cd16c`

The repository's native scripts are already present at this commit. No package installation or generated JavaScript is part of preparation. From the v11 checkout, select the clone explicitly if it is not at the default sibling location:

```sh
export FL_TOOLS_ROOT="/path/to/freelang-tools"
```

The v11 quick-check entry point verifies that `FL_TOOLS_ROOT` (or the default sibling repository) is at the pinned commit before running the dependent checks. The setup was verified from a separate fresh clone: checkout `5bbfb771e5f9c83f0b9664e306ff143a0a2b556c`, both scripts executable, and both hashes matched the values above.
