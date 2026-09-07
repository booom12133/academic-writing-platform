# Standalone filesystem storage baseline

Standalone document storage uses `DOCUMENT_STORAGE_ROOT` as a private persistent volume. The root must be absolute and outside the public web root. The application does not expose a public URL or static-file route for stored documents.

The adapter keeps the existing ownership and integrity contract:

- generated canonical keys are scoped by a hash of the authenticated user ID;
- path traversal, encoded separators, backslashes, and forged filenames are rejected;
- a temporary file is fully written and synced before an exclusive hard-link publishes the final key;
- an existing key is never overwritten;
- document reads verify both the declared size and SHA-256 hash.

At startup/readiness time, the deployment should verify that the root exists, is readable, writable, executable, and has no group or world permission bits (`0700` or an equivalent owner-only directory mode). The readiness helper returns stable reason codes and does not expose operating-system errors to clients. Published files use owner-only mode (`0600` or an equivalent); Linux permission checks in CI and production-like environments are authoritative because Windows does not expose the same permission semantics.

Temporary `.tmp` and `.partial` files are available as best-effort cleanup candidates through a bounded helper, but P1 does not run automatic cleanup. If an operator invokes it, cleanup is bounded by age and maximum entries scanned; it must not block request handling or become a recursive unbounded delete. The persistent volume should also be covered by the database backup policy. Multiple application nodes with independent local disks are unsupported in P1; use one shared persistent volume or keep the deployment single-node.
