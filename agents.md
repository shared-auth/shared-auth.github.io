# Shared Auth agent instructions

These instructions apply to this repository. When work starts below the
repository root, run `python3 scripts/resolve-agent-instructions.py` from that
directory and apply every reported lowercase `agents.md` from root to leaf.
Instructions closer to the working directory take precedence.

## Working agreement

- Read `README.md`, `.cli-flags.toml`, and the relevant tests before editing.
- Preserve repository independence. Do not introduce a runtime dependency on a
  sibling checkout unless the existing repository contract explicitly requires
  it.
- Treat authentication and synchronization as fail-closed security boundaries.
  Preserve the distinction between invalid credentials and unavailable
  authorities.
- Keep product authorization separate from authentication. Never infer roles,
  tenants, or ownership from an unverified identity attribute.
- Inject provider keys, database URLs, cache URLs, and service credentials
  through environment variables. Fiducia or the runtime secret manager owns
  secret delivery; committed files contain names and fixtures only.
- Never log raw tokens, cookies, email addresses, provider subjects, API keys,
  or URLs containing secrets. OpenTelemetry attributes and Prometheus labels
  must be bounded and low-cardinality.
- Use `flags2env` with the root `.cli-flags.toml` for CLI-to-environment
  translation. Do not create a second flag convention.
- Use `nix develop ./.nix` when the repository provides the pinned environment.

## Validation and delivery

- Run `scripts/check-repository-policy.sh`.
- Run the language- and service-specific checks documented in `README.md`.
- Keep generated artifacts synchronized with their canonical schema.
- Use focused commits and preserve unrelated work. Do not rewrite shared
  history, expose secrets, or bypass required checks.

## Repository-local Git worktrees

- Create or use a Git worktree only when the human operator explicitly authorizes it for the current task. Concurrency or a dirty checkout is not permission by itself.
- Put every authorized worktree at `<repository-root>/tmp/worktrees/<name>`; from the repository root, use `./tmp/worktrees/<name>`. Never place worktrees beside repositories or organization directories.
- Keep `tmp`, `temp`, `tmp/worktrees`, and `temp/worktrees` ignored in the repository-root `.gitignore`. Do not commit files from those directories.
- Relocate or remove a worktree only when the operator explicitly requests it. Before removal, preserve and publish intended changes, verify its commit is represented on the target branch, and confirm there are no tracked, untracked, ignored-sensitive, or in-use files that must survive. Remove it with `git worktree remove <path>` without `--force`; never delete a worktree directory with `rm`.
