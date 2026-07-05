---
name: twelve-factor-app
description: >
  Code-review and scaffolding discipline based on 12factor.net. Applies to code
  Claude authors or reviews for the user: explicit pinned dependencies, config
  from environment (never hardcoded secrets), backing services as swappable
  attached resources, strict build/release/run separation, stateless processes,
  non-privileged port binding (never require root), horizontally-scalable
  concurrency over vertical/thread hacks, fast startup and graceful shutdown,
  dev/prod parity, and logs as stdout/stderr event streams. Use when writing,
  scaffolding, or reviewing service/application code, Dockerfiles, or config.
---

Code discipline for services and applications. Applies to code being written or reviewed, not to Claude Code's own session behavior.

## Dependencies

Declare all dependencies explicitly and pin versions. Flag code that assumes something is present system-wide (a global binary, an ambient env tool) instead of being declared in the project's own manifest.

## Config

Config and secrets come from the environment — env vars, secret managers — never hardcoded in source. Flag hardcoded API keys, passwords, connection strings, or a committed `.env` file that lacks a corresponding `.env.example`.

## Backing Services

Treat databases, caches, queues, and other backing services as swappable attached resources, addressed via config, not hardcoded. Flag code that assumes one specific service instance/location baked into the source rather than injected via config.

## Build, Release, Run

Keep build-time and run-time logic strictly separate. Flag scripts or code paths that mix compiling/bundling steps with runtime execution logic, or that make build-time assumptions at run time (e.g. re-reading source files instead of using build output).

## Processes

Processes are stateless; persistent state belongs in a backing service. Flag in-memory or local-disk state (a global variable holding session data, a local cache file assumed to survive) that breaks horizontal scaling or restarts.

## Port Binding (non-privileged)

Services must never require running as root. All runtime behavior — including binding a listening port — runs as a non-privileged user. By extension, bind only non-privileged ports (>=1024), never 80/443/etc. directly. If a low port is needed in production, that's a reverse-proxy or load-balancer's job, not the app's — flag code or Dockerfiles that assume the app itself needs root or a privileged port.

## Concurrency

Favor stateless, horizontally-scalable process design — scale out via more processes/instances — over vertical scaling or in-process threading hacks to squeeze more out of one instance. Flag designs that assume a single always-running process instance for correctness.

## Disposability

Processes should start fast and shut down gracefully. Flag long blocking initialization, and missing or ignored `SIGTERM` handling that would drop in-flight work or leave resources dangling on shutdown.

## Dev/Prod Parity

Keep development, staging, and production as similar as possible. Flag dependency or config divergence between environments — dev-only dependencies masking a prod issue, or "works in dev" patterns that assume a resource only present locally.

## Logs

Logs are an event stream — write to stdout/stderr and let the execution environment collect them. Flag code that manages its own log files, rotation, or shipping logic instead of writing to stdout/stderr.
