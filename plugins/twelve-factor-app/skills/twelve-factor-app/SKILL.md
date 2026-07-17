---
name: twelve-factor-app
description: >
  Code-review and scaffolding discipline based on 12factor.net. Applies to code
  Claude authors or reviews for the user: isolated pinned dependencies, config
  from environment (never hardcoded, never env-named blocks), backing services
  as swappable attached resources, strict build/release/run separation,
  stateless share-nothing processes, self-contained non-privileged port
  binding, per-process-type concurrency, crash-only disposability, true
  dev/prod parity (same backing-service types), logs as stdout/stderr event
  streams, and one-off admin processes sharing the app's own codebase and
  config. Use when writing, scaffolding, or reviewing service/application
  code, Dockerfiles, or config.
---

Code discipline for services and applications. Applies to code being written or reviewed, not to Claude Code's own session behavior.

Applying these rules doesn't lower the bar on other review judgment — flag security-relevant issues (unsafe debug modes, injection, auth gaps, secrets exposure beyond just Config) you notice along the way even when they aren't a named factor below.

## Dependencies
**Do:** declare every dependency explicitly, pinned to an exact version, isolated per-project (lockfile, vendoring, venv/node_modules). **Don't:** assume a system-wide binary or library is available without declaring it; skip pinning/isolation "because it usually works."

## Config
**Do:** read anything that varies per-deploy — secrets, hostnames, region, feature flags — from the environment at runtime. **Don't:** hardcode secrets/config in source; group config into environment-named blocks in code (`if env == "production"`); commit `.env` without a matching `.env.example`.

## Backing Services
**Do:** treat every backing service (DB, cache, queue, SMTP, third-party API) as an attached resource addressed via config, swappable without a code change. **Don't:** hardcode a specific instance's location/credentials in source, or write code that only works against one particular service instance.

## Build, Release, Run
**Do:** keep three strictly separate stages — build (source → immutable artifact), release (artifact + environment config, uniquely identified), run (execute one release, doing no compiling and fetching no dependencies). **Don't:** compile, install dependencies, or fetch remote code at runtime; patch a release in place — a fix is a new build and release.

## Processes
**Do:** keep processes stateless and share-nothing; persist state only in a backing service. **Don't:** rely on in-memory state (a global var, a local cache) surviving between requests or restarts; use sticky sessions — session state belongs in a shared store, not pinned to one process.

## Port Binding
**Do:** make the app self-contained, exporting its service via its own bound port (e.g. an embedded HTTP server) rather than depending on a runtime-injected external web server; bind only non-privileged ports (>=1024) and run as a non-privileged user. **Don't:** require an externally configured web server to make the app reachable; require root or bind directly to a port <1024 — that's a reverse-proxy/load-balancer's job.

## Concurrency
**Do:** model distinct kinds of work as separate process types (web, worker, scheduler), each scaled independently by running more instances of that type. **Don't:** run background/cron/worker logic inside the same process as the request-handling server; scale by adding threads/vertical resources to one instance instead of adding stateless instances.

## Disposability
**Do:** start fast, shut down gracefully on `SIGTERM` (finish or cleanly abandon in-flight work), and design for crash-only recovery — safe to be killed abruptly (`kill -9`) at any time with no manual cleanup on restart. **Don't:** block on slow initialization before being ready to serve; ignore `SIGTERM`; assume a clean shutdown is guaranteed.

## Dev/Prod Parity
**Do:** use the same backing-service *type* in dev as in prod (same DB engine, same cache) and keep dependency versions/config shape aligned across environments. **Don't:** substitute a lightweight service in dev for convenience (SQLite locally, Postgres in prod) — that gap is exactly where "works in dev" bugs hide.

## Logs
**Do:** write logs as an unbuffered stream to stdout/stderr; let the execution environment route, store, and aggregate them. **Don't:** manage log files, rotation, or shipping logic inside the app.

## Admin Processes
**Do:** run one-off admin, migration, and backfill scripts using the exact same codebase, config-loading, and dependency environment as the running app. **Don't:** write a standalone script that duplicates config/connection logic instead of reusing the app's own, or let an admin script drift from the app's dependency versions.
