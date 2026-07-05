# twelve-factor-app

Code-review and scaffolding discipline for Claude Code, based on [12factor.net](https://12factor.net/).

## What it does

Applies to code Claude authors or reviews — services, applications, Dockerfiles, config. Ten rules drawn from the classic 12-factor methodology: explicit pinned dependencies, config from environment (never hardcoded secrets), backing services as swappable attached resources, strict build/release/run separation, stateless processes, non-privileged port binding (services must never require root), horizontally-scalable concurrency over vertical/thread hacks, fast startup and graceful shutdown, dev/prod parity, and logs as stdout/stderr event streams rather than custom log-file management.

## What problem it solves

The classic 12-factor methodology is still the baseline for production-grade services, but it isn't automatically applied just because an AI wrote the code. This skill gives Claude a concrete checklist to flag violations while scaffolding new services or reviewing existing ones — hardcoded secrets, in-memory state that breaks horizontal scaling, a service that assumes root to bind its port, log files instead of stdout — instead of relying on the model to remember 12-factor principles unprompted.

## Who should use it

Anyone asking Claude to write, scaffold, or review service/application code intended to run in more than a single fixed environment — meaning most backend services, APIs, and anything headed toward a container or cloud deployment. Pairs with [`twelve-factor-agent`](../twelve-factor-agent/README.md), which covers the coding session's own conduct rather than the code it produces.

## Notable inclusion: modified Port Binding

The classic Port Binding factor is scoped down here to a security-relevant rule: services must never require running as root, and by extension must bind only non-privileged ports (>=1024). A low port in production is a reverse-proxy/load-balancer's job, not the application's.

## Non-goals

Two factors — Codebase (org-level git/repo-topology practice) and Admin Processes (niche, rarely surfaces in review) — are deliberately excluded as outside a code-review-time check. See [the design doc](../../docs/superpowers/specs/2026-07-05-twelve-factor-skills-design.md) for the full inclusion/exclusion rationale.

See [`SKILL.md`](./SKILL.md) for the full rule set.
