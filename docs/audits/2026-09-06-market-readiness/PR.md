# Refine native research workflows and harden release verification

Native notices shifted the reading viewport, narrow layouts lost useful reading space, and local search could not reopen its exact stored context. This change stabilizes feedback, preserves selection and scroll position across compact navigation, reopens Saved/session/analysis records through validated APIs, and improves reading actions, settings recovery, source selection and numeric Analytics tables.

It also hardens source parsing and redirect/cancellation boundaries, cleans up local-agent process groups even when their leader exits first, verifies complete installation bundles, and adds fail-closed signing/notarization/update checks. Version 0.3.0 is an unsigned candidate; the audit report preserves the remaining market-release gates.

Validation: `npm run check` passed 602 main tests and 87 AppKit tests with all four aggregate coverage thresholds above 80%; compatibility E2E passed 6/6, native workflows 12/12 and controls 8/8. Packaged startup, MCP, safeStorage and isolated 0.2.0→0.3.0→0.2.0 data-preserving upgrade/rollback passed. No dependency vulnerabilities or credential-pattern findings were detected. The exact final package matches compiled main/preload/MCP and native modules.

Live arXiv/GitHub checks passed. Of 20 configured sources, 15 fetched and 5 timed out; one fetched source rejected 7 records. Real account calls, user installation, private security reporting, signed distribution, human acceptance and remote CI remain open. See `REPORT.md`, `verification.json` and the source/package evidence in this directory.
