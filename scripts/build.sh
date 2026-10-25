#!/bin/bash
# 构建：host 用 tsc（ESM 单文件，无运行时依赖），client 用 tsdown（打成 module loader 包）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d node_modules ]; then
  echo "=== npm install ==="
  npm install --no-audit --no-fund
fi

echo "=== Building host (tsc) ==="
npx tsc -p tsconfig.json

echo "=== Building client (tsdown) ==="
npx tsdown

echo "=== Build complete ==="
