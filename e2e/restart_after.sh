#!/bin/bash
# The checks of e2e/restart.mjs only, after a restart made another way (e2e/restart.sh sets up first).
exec node "$(dirname "$0")/restart.mjs" --after
