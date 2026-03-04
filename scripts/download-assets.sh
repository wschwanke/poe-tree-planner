#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

SKILL_REPO="https://github.com/grindinggear/skilltree-export"
ATLAS_REPO="https://github.com/grindinggear/atlastree-export"

echo "==> Cloning skilltree-export (shallow)..."
git clone --depth 1 "$SKILL_REPO" "$TMPDIR/skilltree-export"

echo "==> Cloning atlastree-export (shallow)..."
git clone --depth 1 "$ATLAS_REPO" "$TMPDIR/atlastree-export"

# --- Data JSON files ---
echo "==> Copying data.json files..."
mkdir -p "$REPO_ROOT/data"
cp "$TMPDIR/skilltree-export/data.json" "$REPO_ROOT/data/skill-tree.json"
cp "$TMPDIR/atlastree-export/data.json" "$REPO_ROOT/data/atlas-tree.json"

# --- Skill tree assets ---
echo "==> Syncing skill tree assets to assets/skill-tree/..."
rm -rf "$REPO_ROOT/assets/skill-tree"
mkdir -p "$REPO_ROOT/assets/skill-tree"
cp -r "$TMPDIR/skilltree-export/assets/"* "$REPO_ROOT/assets/skill-tree/"

echo "==> Syncing skill tree assets to public/assets/ (flat)..."
rm -rf "$REPO_ROOT/public/assets"
mkdir -p "$REPO_ROOT/public/assets"
cp -r "$TMPDIR/skilltree-export/assets/"* "$REPO_ROOT/public/assets/"

# --- Atlas tree assets ---
echo "==> Syncing atlas tree assets to assets/atlas-tree/..."
rm -rf "$REPO_ROOT/assets/atlas-tree"
mkdir -p "$REPO_ROOT/assets/atlas-tree"
cp -r "$TMPDIR/atlastree-export/assets/"* "$REPO_ROOT/assets/atlas-tree/"

echo "==> Syncing atlas tree assets to public/assets/atlas-tree/..."
mkdir -p "$REPO_ROOT/public/assets/atlas-tree"
rm -rf "$REPO_ROOT/public/assets/atlas-tree/"*
cp -r "$TMPDIR/atlastree-export/assets/"* "$REPO_ROOT/public/assets/atlas-tree/"

echo "==> Cleanup..."
# trap handles temp dir removal

echo "Done! Assets and data files are up to date."
