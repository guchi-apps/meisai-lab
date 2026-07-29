# meisai-lab

給与・賞与管理アプリケーション。給与明細・賞与の記録、推移や控除内訳のグラフ表示、確定申告データ（住民税・所得税の見積り、ふるさと納税シミュレーション）の準備までを行う個人向けツール。

## 技術スタック

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui (Radix UI)
- Prisma + MariaDB/MySQL
- NextAuth.js v5 (Google OAuth)
- Recharts / React Hook Form + Zod

## 開発環境

### 前提

- Node.js >= 20.19.0
- MySQL/MariaDB がインストール済みであること（起動していなくてもよい。`npm run dev` / `npm run db:setup` が未起動なら自動起動を試みる）

### 初回セットアップ

```bash
npm install

# .env.local を作成（DB/Auth/Google の値を編集する）
npm run env:init

# .env.local の DATABASE_URL に基づき DB・ユーザーを作成
npm run db:setup

# マイグレーション適用
npm run db:migrate:dev
```

Google OAuth を使う場合は、開発用の Google Cloud クライアントを別途用意し、承認済みリダイレクト URI に `http://localhost:3000/api/auth/callback/google` を登録する。

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
