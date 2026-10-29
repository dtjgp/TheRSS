# Reviewed llm-wiki runtime fixture

`automation_runtime.py` is a test-only snapshot from llm-wiki commit `f5c32763`.
SHA-256: `bdbf13e28523f1ba9679fdd6230a44f85c21426cade6a3af5c05a29e41f7da61`.

The reviewed change requires a readable, valid terminal audit whose status matches
the requested lease outcome before release. TheRSS already writes that audit for
completed, partial and blocked transactions. Compatibility tests execute this
snapshot against disposable config/state/audits, never the actual vault.

Production still reads and verifies the live script against the pinned hash before
copying its bytes to temporary storage. This fixture is not the production runtime.
Future updates require diff review and these tests; do not regenerate it implicitly.
