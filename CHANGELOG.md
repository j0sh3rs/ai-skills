# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- `brag-doc`: entry metadata block now uses a fenced ` ```yaml ` code block instead of a bare `---`/`---` delimiter. A bare `---` immediately after a text line parses as a CommonMark setext-heading underline rather than a thematic break, which real `markdownlint` flags (MD022) — fencing the block avoids this and also means block-style YAML lists and bare URLs inside it are never interpreted as markdown.
- `brag-doc`: the Brag Doc's first line must now be a top-level `# Brag Doc` heading (MD041).

### Added

- `brag-doc`: `skills/brag-doc/markdownlint-check.js`, a dependency-free markdownlint-rule checker (MD007, MD009, MD010, MD012, MD022, MD031, MD032, MD034, MD041, MD047) run before every write the skill makes. MD013 (line-length) is intentionally exempted.
- `brag-doc`: `hooks/tests/brag-doc-markdownlint.test.js` covering the checker, cross-verified against the real `markdownlint` CLI.
