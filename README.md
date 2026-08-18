# @stv/core

speech-to-visuals ファミリーのコア契約層 — 型契約 (`types/`)、共通純計算
ユーティリティ (`utils/`, `lib/`)、設定スキーマ (`config/`)。

責務の境界は [MISSION.md](MISSION.md) に定義し、`npm run boundary`
(scripts/check-boundaries.mjs) が CI で強制する。履歴は親リポジトリ
[speech-to-visuals](https://github.com/nobu007/speech-to-visuals) から
git filter-repo で分割継承した (2026-08-18)。

## 使い方 (git 依存 — npm registry には公開しない)

```sh
npm install github:nobu007/stv-core#v1.0.0
```

```ts
import { DIAGRAM_TYPES } from '@stv/core/types/diagram';
import { percentChange } from '@stv/core/lib/metrics-utils';
import { validateConfig } from '@stv/core/config/validate';
```

インストール時に `prepare` が `dist/` をビルドする (型は `dist/**/*.d.ts`)。

## 開発

```sh
npm run verify   # boundary → type-check → test → build
```

- build: `tsc --emitDeclarationOnly` + esbuild (bundle/splitting, ESM)
- test: jest (ts-jest ESM preset), テストは `src/**/__tests__` に colocation
