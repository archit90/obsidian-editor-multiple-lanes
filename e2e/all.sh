#!/bin/bash
cd "$(dirname "$0")"
for g in "$@"; do node run.mjs $g.mjs; done 2>&1 | tee -a all.log
