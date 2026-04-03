#!/bin/bash
set -e
export PATH="/home/runner/.nix-profile/bin:/nix/var/nix/profiles/default/bin:$PATH"
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push
