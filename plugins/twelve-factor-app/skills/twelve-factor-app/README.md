# twelve-factor-app

Code-review and scaffolding discipline for Claude Code, based on [12factor.net](https://12factor.net/).

## What it does

Applies to code Claude authors or reviews — services, applications, Dockerfiles, config. Eleven rules drawn from the classic 12-factor methodology, each written as an explicit Do/Don't pair: isolated pinned dependencies, config from environment (never hardcoded, never environment-named code blocks), backing services as swappable attached resources, strict three-stage build/release/run separation, stateless share-nothing processes, self-contained non-privileged port binding, per-process-type concurrency, crash-only disposability, true dev/prod parity (same backing-service types, not just similar config), logs as stdout/stderr event streams, and admin processes that reuse the app's own codebase and config.

## What problem it solves

The classic 12-factor methodology is still the baseline for production-grade services, but it isn't automatically applied just because an AI wrote the code. This skill gives Claude a concrete checklist to flag violations while scaffolding new services or reviewing existing ones — hardcoded secrets, environment-named config blocks, in-memory state that breaks horizontal scaling, a service that assumes root to bind its port, SQLite-in-dev/Postgres-in-prod parity gaps, log files instead of stdout, standalone admin scripts that duplicate the app's own config logic — instead of relying on the model to remember 12-factor principles unprompted.

## Who should use it

Anyone asking Claude to write, scaffold, or review service/application code intended to run in more than a single fixed environment — meaning most backend services, APIs, and anything headed toward a container or cloud deployment. Pairs with [`twelve-factor-agent`](../twelve-factor-agent/README.md), which covers the coding session's own conduct rather than the code it produces.

## Notable inclusion: modified Port Binding

The classic Port Binding factor keeps its original intent — the app is self-contained and exports its service via its own bound port, not dependent on a runtime-injected external web server — and adds a security constraint on top: services must never require running as root, and by extension must bind only non-privileged ports (>=1024). A low port in production is a reverse-proxy/load-balancer's job, not the application's.

## Non-goals

One factor — Codebase (org-level git/repo-topology practice) — is deliberately excluded as outside a code-review-time check. See [the design doc](../../docs/superpowers/specs/2026-07-05-twelve-factor-skills-design.md) for the full inclusion/exclusion rationale, including a 2026-07-05 revision that closed several fidelity gaps against the source material and added Admin Processes back in.

See [`SKILL.md`](./SKILL.md) for the full rule set.
