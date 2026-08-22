# meisai-lab

給与・賞与管理アプリケーション。給与明細・賞与の記録、推移や控除内訳のグラフ表示、確定申告データ（住民税・所得税の見積り、ふるさと納税シミュレーション）の準備までを行う個人向けツール。

## 技術スタック

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui (Radix UI)
- Prisma + MariaDB/MySQL
- Supabase Auth (Google OAuth)
- Recharts / React Hook Form + Zod

## 開発環境

### 前提

- Node.js >= 20.19.0
- MySQL/MariaDB がインストール済みであること（起動していなくてもよい。`npm run dev` / `npm run db:setup` が未起動なら自動起動を試みる）

### 初回セットアップ

```bash
npm install

# .env.local を作成（DB/Supabase の値を編集する）
npm run env:init

# .env.local の DATABASE_URL に基づき DB・ユーザーを作成
npm run db:setup

# マイグレーション適用
npm run db:migrate:dev
```

ログインはSupabase Auth経由のGoogle OAuthを使う。以下の環境変数が必要（`.env.local.example` 参照）。

| 変数名 | 説明 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトのURL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabaseのpublishable key |

開発環境では1Passwordを使わず、上記2変数を `.env.local` に直接記載する。本番環境はGitHubのorganization variable（`SUPABASE_PROJECT_URL` / `SUPABASE_PUBLISHABLE_KEY`）から注入される。

Google OAuthのクライアントはSupabase側（共通プロジェクト）で設定する。開発用クライアントの承認済みリダイレクトURIには `http://localhost:3000/auth/callback` を登録する。

### 本番デプロイに必要なGitHubのsecret / variable

本番環境の値は、ワークフローの実行時にGitHubのsecret / variableから取得する。1Passwordを実行時に呼び出すことはない（サービスアカウントの日次レート制限を使い切ってデプロイが止まったため移行した。#96 / guchi-apps/issue-deck#1302）。開発環境では不要。

どの値をGitHubのどこから取るかの正は [.github/secrets-manifest.tsv](./.github/secrets-manifest.tsv)。マニフェストの`SOURCE`列に残る `op://...` は後述の同期スクリプトが読む参照先であり、**ワークフローの実行時には読まれない**（`op://` でgrepしてここがヒットしても移行漏れではない）。内訳は次のとおり。

| 置き場所 | GitHub側の名前 | 用途 |
| --- | --- | --- |
| organization secret | `SERVER_SSH_PRIVATE_KEY` / `SERVER_HOST` / `SERVER_USERNAME` / `SERVER_SSH_PORT` | デプロイ先VPSへのSSH接続 |
| organization secret | `SHARED_DB_HOST` / `SHARED_DB_PORT` / `SHARED_DB_USER` / `SHARED_DB_PASSWORD` / `SHARED_DB_MIGRATE_USER` / `SHARED_DB_MIGRATE_PASSWORD` | 共有MariaDBの接続情報 |
| organization variable | `SUPABASE_PROJECT_URL` / `SUPABASE_PUBLISHABLE_KEY` | Supabase Authの値（クライアントに埋め込む公開値のためvariable） |
| repository secret | `TARGET_DIR` / `DB_NAME` / `SIGNALY_WEBHOOK_URL` / `SIGNALY_LOGIN_WEBHOOK_URL` | meisai-lab固有の値 |

`PORT` はsecret / variableでは管理せず、`.github/workflows/deploy.yml` に平文で持つ（#113）。`OP_SERVICE_ACCOUNT_TOKEN` のrepository secretは登録したままだが、ワークフローからは参照していない。

### 値を変えたときの同期

値の正は引き続き1Password（vault: `apps`）にあり、**値を変えたときだけ** GitHubへ同期する。デプロイのたびに実行するものではない。

```bash
op signin
scripts/sync-github-secrets.sh --dry-run   # 差分の確認
scripts/sync-github-secrets.sh             # repository secretを同期
```

organization側の共通値（マニフェストの`SCOPE`が`inherit`の行）はこのリポジトリからは同期しない。全アプリ共通のため、共通側のマニフェストで管理する。

### 日々の起動

```bash
npm run dev
```

MySQL/MariaDB が未起動の場合は `npm run dev` の中で自動起動を試みる（`sudo service mysql start`、WSL の場合は権限確認プロンプトが出ることがある）。自動起動に失敗した場合は `sudo service mysql start` を手動で実行する。

## 主なスクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー起動（MySQL 自動起動・WSL の LAN 経由アクセス設定込み） |
| `npm run build` | 本番ビルド（`prisma generate` を含む） |
| `npm run lint` | ESLint |
| `npm run typecheck` | 型チェック（`tsc --noEmit`） |
| `npm run db:setup` | `.env.local` の `DATABASE_URL` から DB・ユーザーを作成 |
| `npm run db:migrate:dev` | 開発用マイグレーション適用 |
| `npm run db:migrate:deploy` | 本番用マイグレーション適用 |
| `npm run db:studio` | Prisma Studio 起動 |

## ディレクトリ構成

```
src/
├── app/            # ルーティング（App Router）、API ルート、認証ページ
├── components/     # UI コンポーネント（Charts, ui/ 含む）
├── lib/            # DB クライアント、計算ロジック、バリデーション等
└── types/          # 型定義
prisma/             # スキーマ・マイグレーション
scripts/            # 開発・DBセットアップ用スクリプト
deploy/             # PM2 / Apache VirtualHost 設定
```

詳細な仕様・データモデルは [CODING_CONTEXT.md](./CODING_CONTEXT.md) を参照。
