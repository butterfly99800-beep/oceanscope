# OOCL desktop browser session

An explicitly enabled existing Chrome/Edge public OOCL desktop tab submits a new query through the official page controller. No cookies, passwords or CAPTCHA tokens are copied to the worker. Verification can still require the user; failed queries retain the existing mobile/HTTP/PDF fallback.

The current session connector uses the locations already selected in the official tab. Mismatched locations fail closed and use existing fallback. Los Angeles queries can return nearby Long Beach; each port remains separate. This is not a generic automatic-location selector.

The worker validates fresh timestamps, exact requested criteria, official URL and raw/processed counts. Departure and arrival use original official local date fields. Cargo-only duplicate variants merge only when itinerary details match. Transit duration and transfer ports use official fields.

Windows may opt in using `%LOCALAPPDATA%/OceanScope/worker-settings.json` with `OOCL_USE_BROWSER_SESSION: true` and an absolute `OOCL_SESSION_TOKEN_FILE` path to the local bridge `.client-token`. This settings file contains no worker token. The existing encrypted worker token and SSH tunnel remain unchanged. Keep the browser and local bridge running; enable the extension after browser restart/reload. No database migration is needed.
