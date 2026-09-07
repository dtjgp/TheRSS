# Refine native workflows and local beta reliability

Native notices shifted the reader, compact layouts lost useful reading space, and local search could not reopen the exact stored context. This change stabilizes feedback, preserves selection and scroll position, adds validated Saved/session/analysis navigation, and improves reading actions, settings recovery, source selection and numeric Analytics tables.

Source parsing, redirects, cancellation and complete-bundle installation checks are hardened. The existing OpenAI source now reads its official RSS endpoint. A real native Command-Q regression exposed a quit re-entry race: deferring the final quit until the original Cocoa event returns now terminates the main process and helpers while preserving the existing shutdown order.

Validation: 603 main tests and 87 AppKit tests passed with all four aggregate coverage thresholds above 80%; desktop E2E 8/8; installed native workflows 12/12. The locally installed 0.3.0 candidate matches the compiled artifacts, all 11 real user-data tables match the pre-install backup, actual quit/reopen and a fixed-message Codex connectivity test passed. No dependency vulnerabilities or credential-pattern findings were detected.

Version 0.3.0 remains an unsigned local candidate. Paid signing and formal distribution are deferred by the user. Dated source checks retain four unresolved mirror-source failures after the official OpenAI repair. Comprehensive human accessibility and other-platform sign-off are not claimed. See `LOCAL_ACCEPTANCE.md`, `REPORT.md` and `verification.json` for evidence and boundaries.
