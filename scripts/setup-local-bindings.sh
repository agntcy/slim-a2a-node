#!/usr/bin/env bash
# Copyright AGNTCY Contributors (https://github.com/agntcy)
# SPDX-License-Identifier: Apache-2.0
#
# Local-linking bootstrap for @agntcy/slim-bindings (TEMPORARY — until the
# named-export fix and matching platform packages are published to npm).
#
# Two upstream pieces are not yet on npm at the version this repo builds against
# (the local ../slim-bindings/node build, currently 0.7.0):
#   1. the ESM named-export barrel (index.js `export *`) — present in the local
#      build, so `file:`-linking it (see package.json) is enough for that.
#   2. the per-platform native addon package (@agntcy/slim-bindings-<platform>),
#      which the linked build's binding.js dynamic-imports at runtime. The npm
#      registry only has a mismatched major, so we build it from the local
#      checkout and install it where the symlinked binding.js resolves it: the
#      sibling build's own node_modules (Node resolves the symlink by realpath).
#
# Run this once after `npm install`, and again whenever the local
# ../slim-bindings/node build is regenerated.
set -euo pipefail

BINDINGS_DIR="${SLIM_BINDINGS_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../slim-bindings/node" && pwd)}"

# Map the current host to the Rust target triple pack-platform.ts expects.
uname_s="$(uname -s)"; uname_m="$(uname -m)"
case "$uname_s/$uname_m" in
  Darwin/arm64)  RUST_TARGET="aarch64-apple-darwin" ;;
  Darwin/x86_64) RUST_TARGET="x86_64-apple-darwin" ;;
  Linux/aarch64) RUST_TARGET="aarch64-unknown-linux-gnu" ;;
  Linux/x86_64)  RUST_TARGET="x86_64-unknown-linux-gnu" ;;
  *) echo "Unsupported host $uname_s/$uname_m — set RUST_TARGET manually." >&2; exit 1 ;;
esac

echo "Building platform tarball ($RUST_TARGET) from $BINDINGS_DIR ..."
( cd "$BINDINGS_DIR" && npx tsx scripts/pack-platform.ts "$RUST_TARGET" )

TARBALL="$(ls -t "$BINDINGS_DIR"/dist/agntcy-slim-bindings-*.tgz | head -1)"
echo "Installing $TARBALL into the linked build's node_modules ..."
( cd "$BINDINGS_DIR" && npm install --no-save "$TARBALL" )

echo "Done. '@agntcy/slim-bindings' now loads its native addon locally."
