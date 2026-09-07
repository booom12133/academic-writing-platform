# HTTP security operations

Production request and response body logging is fail-closed. `LOG_REQUEST_BODY` and `LOG_RESPONSE_BODY` must remain disabled; the application rejects startup when either setting is enabled with `NODE_ENV=production`, regardless of logger level.

The process-local rate limiter uses Express `request.ip`. `TRUST_PROXY_HOPS=0` is the default and ignores forwarded client-IP headers. Set a small explicit hop count only when the deployment has that exact reverse-proxy topology. The application rejects non-integer values and values above 10, and never enables unrestricted proxy trust. The reverse proxy must overwrite, rather than append to, forwarded headers at the trusted boundary.

The process-local limiter is not a distributed limiter. Multi-node deployments require a shared rate-limit design in a later phase.
