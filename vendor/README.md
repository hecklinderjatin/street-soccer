# Patched picomatch forks

These private packages replace the affected registry picomatch dependencies while
there is no published fix for [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).
They contain the security change before installation; renaming alone is not the fix.

| Local package                 | Upstream baseline | Consumers                      |
| ----------------------------- | ----------------- | ------------------------------ |
| `@street-soccer/picomatch-v2` | picomatch 2.3.2   | anymatch, micromatch, readdirp |
| `@street-soccer/picomatch-v4` | picomatch 4.0.7   | Vite, tinyglobby/fdir          |

Each directory contains the original MIT license, all runtime sources,
`PATCH.diff` against the released baseline and `source-integrity.json` SHA-256
hashes of the reviewed runtime sources/license (normalized LF line endings).
Its `package.json` records the original registry archive's SHA-512 integrity and
the mitigation proposal's commit. Versions describe the baseline, not a claimed
upstream patched release. The original archives were integrity-verified before
copying and patching.

The local parser change adapts [upstream PR 246](https://github.com/micromatch/picomatch/pull/246),
commit `f03bec2c02e46f063fbfdc161aae1d0f854b2565`, which is an unmerged proposal.
It collapses repetition of a single literal/star branch, preventing the reported
nested unbounded quantifiers. Capture mode uses the parser's existing risky-pattern
literal fallback. Other branches retain upstream handling, including the explicit
`maxExtglobRecursion: false` opt-out. This is a locally maintained mitigation, not
an upstream security release or a claim about all possible regular expressions.

The root `picomatch` dependency provides the 4.x fork for peer resolution;
the `picomatch-v2` development dependency provides the 2.x fork. Parent-scoped
overrides reference these root specifications with npm's `$` syntax, preserving
each consumer's original API major without relying on its install directory.
Use `npm ci`; dependency updates must regenerate the lockfile and pass all checks.

- `scripts/verify-vendored-picomatch.mjs` verifies reviewed source hashes at
  installation and in the dependency security check.
- `checks/picomatch-security.mjs` rejects registry picomatch copies in the lockfile,
  verifies installed fork identities and exercises the attack in timeout-isolated
  child processes plus ordinary matching compatibility.
- `checks/matcher-consumers.mjs` verifies each consumer's original API major and
  exercises matching, filesystem filtering and actual watcher events.
- CI also runs `npm audit --audit-level=high` for registry dependencies. npm audit
  does not assess these local sources; the separate checks remain required.

When a reviewed upstream fix is published, replace the file dependencies and
overrides, regenerate the lockfile, then run a clean install, audit, dependency
checks, full project suite and production browser smoke before removing the forks.
