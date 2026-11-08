#!/bin/bash
# LT-17 + CO-07: set up, restart the sandbox (e2e/sandbox.sh restart), check. See e2e/restart.mjs.
exec node "$(dirname "$0")/restart.mjs" "$@"
