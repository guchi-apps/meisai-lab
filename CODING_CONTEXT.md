# 📋 meisai-lab コーディングコンテキスト

> 実装済みの現行アプリの仕様まとめ。新しい機能を追加・変更するときはこのドキュメントを起点に、
> 実際のコード（Prisma スキーマ・各 route.ts・lib 配下）を必ず確認すること。

---

## 🎯 プロジェクト概要

**プロジェクト名:** meisai-lab（給与・賞与管理アプリケーション）
**ターゲット:** 個人ユーザーの給与・賞与の記録・可視化・確定申告データ準備
**認証:** Google OAuth（Supabase Auth、複数アプリ共通のSupabaseプロジェクトを利用。issue #52）
**デプロイ先:** VPS（PM2、Apache リバースプロキシ、本番ポートは `deploy/` 参照）

---

## 🏗️ 技術スタック

```
Frontend:      Next.js 16.x (App Router) + React 19.x + TypeScript 5.x
UI:            Tailwind CSS v4 + shadcn/ui (Radix UI)
ORM:           Prisma 6.x
Database:      MariaDB / MySQL
Auth:          Supabase Auth (@supabase/ssr + @supabase/supabase-js)
Charts:        Recharts
Form:          React Hook Form + Zod
Date:          date-fns
D&D:           @dnd-kit（項目の並び替え）
Process:       PM2（本番）
通知:          Signaly（Webhook。CI/デプロイ通知・ログイン通知）
```

> Next.js 16 は破壊的変更を含む。実装前に `AGENTS.md` の指示に従い
> `node_modules/next/dist/docs/` の該当ガイドを確認すること
> （例: `middleware.ts` は廃止され `src/proxy.ts` を使う）。

---

## 📊 Prisma データモデル

スキーマ本体は [prisma/schema.prisma](./prisma/schema.prisma) を正とする。以下は概要。

### 認証まわり（Auth.js 標準）
`Account` / `Session` / `VerificationToken` — `@auth/prisma-adapter` が要求する標準テーブル。

### User
`Salary` / `Bonus` / `Item` / `TaxSetting` / `Deduction` / `TaxCalculationOverride` の親。

### Salary（給与明細）
- `salaryDate`（支給日、`@@unique([userId, salaryDate])`）
- `grossSalary`（支給額）/ `netSalary`（手取額）
- `data`（Json）: 基本給・残業・社会保険料・カスタム項目の値などを保持
- `deletedAt` による soft delete

### Bonus（賞与明細）
- `bonusDate`（`@@unique([userId, bonusDate])`。旧 `bonusType` フィールドは撤廃済み — 種別は自由記述せず日付のみで区別）
- `amount` / `data` / soft delete は Salary と同様
- 支給額は「賞与支給(勤怠減額後)」「将来設計準備金基準額」「(-) 確定拠出年金掛金」から自動計算可能（[BonusForm.tsx](./src/components/BonusForm.tsx)）

### Item（ユーザーカスタム項目）
給与・賞与フォームに表示する追加項目を、種別・適用範囲込みでユーザーごとに管理する。

| フィールド | 内容 |
|---|---|
| `itemType` | `earning`（支給）/ `otherEarning`（その他支給）/ `otherTaxable`（その他・課税処理のみ）/ `statutoryDeduction`（法定控除）/ `deduction`（控除） |
| `scope` | `salary` / `bonus` / `both` — どちらのフォームに表示するか |
| `isTaxable` | 支給系項目が課税対象か（通勤手当など非課税支給の区別に使用） |
| `displayOrder` | ドラッグ＆ドロップ（`@dnd-kit`）で並び替え可能 |

### TaxSetting（保険料率）
`effectiveFrom`（適用開始年月の1日）ごとに履歴管理する（旧: 年単位 → 現在は年月単位）。
給与・賞与の入力時点で有効な最新の料率が自動的に参照される。`healthInsuranceRate` / `pensionRate` / `employmentInsuranceRate` を保持し、`/settings` から改定履歴の追加・編集・削除ができる。

### Deduction（年次控除）
確定申告・住民税計算で使う年単位の控除額。`deductionType` は `lifeInsuranceGeneral` / `lifeInsuranceCareMedical` / `lifeInsurancePension` / `furusatoNozei`。

### TaxCalculationOverride
住民税・所得税の計算過程（[annualTax.ts](./src/lib/annualTax.ts) の各ステップ）を、実際の課税決定通知書等の金額で手動上書きするためのテーブル。`field` に計算過程のキー（例: `annualGrossIncome`）を持ち、上書きした値は下流のステップにも反映される。

---

## 🌐 Route Handlers（API エンドポイント）

すべて `auth()` によるセッションチェック（401 JSON 応答）を各ハンドラ自身が行う（`src/proxy.ts` は `/api/*` を素通りさせる設計）。

```
GET/POST     /api/salaries
GET/PUT/DELETE /api/salaries/[id]

GET/POST     /api/bonuses
PUT/DELETE   /api/bonuses/[id]

GET/POST     /api/items
PUT/DELETE   /api/items/[id]

GET/POST     /api/tax-settings
PUT/DELETE   /api/tax-settings/[id]

GET/POST     /api/deductions
DELETE       /api/deductions/[id]

GET/POST     /api/tax-calculation-overrides
DELETE       /api/tax-calculation-overrides/[id]

GET          /auth/callback               Supabase OAuthコールバック（route.ts）
```

バリデーションスキーマは [src/lib/validators.ts](./src/lib/validators.ts)（Zod）に集約。

---

## 📱 ページ構成

### 保護されたルート（`src/proxy.ts` が未認証を `/auth/signin` へリダイレクト）
```
/salaries                  給与一覧
/salaries/new              給与新規登録
/salaries/[id]/edit        給与編集
/bonuses                   賞与一覧・新規・編集
/items                     項目管理（種別・適用範囲・並び順）
/settings                  保険料率の改定履歴、プロフィール
/tax-return                確定申告データ（年ごとに開閉できるセクション）
                             - ふるさと納税シミュレーション（見込み控除上限額）
                             - 所得税・住民税の計算過程の詳細と手動上書き
```

### 保護なしルート
```
/                          ランディングページ（ログインボタン）
/auth/signin, /auth/error  サインイン・エラーページ
/auth/callback             Supabase OAuthコールバック
/manifest.webmanifest      PWA マニフェスト（src/app/manifest.ts）
```

---

## 🔐 認証フロー

- プロバイダーは Google のみ、Supabase Auth（複数アプリ共通のSupabaseプロジェクト）経由。セッションは Supabase が Cookie で管理する（[src/lib/supabase/server.ts](./src/lib/supabase/server.ts)、[src/lib/supabase/proxy.ts](./src/lib/supabase/proxy.ts)）。
- ログインは Server Action（[src/app/actions/auth.ts](./src/app/actions/auth.ts)）が `supabase.auth.signInWithOAuth()` を呼び、返ってきた Supabase の認可URLへ redirect する。
- コールバック（[src/app/auth/callback/route.ts](./src/app/auth/callback/route.ts)）で `exchangeCodeForSession()` した後、Supabaseユーザー（email）とPrisma `User`（`supabaseUserId`）を紐付ける。既存の `User` 行が無ければ新規作成する（許可ユーザー制限なし、issue #52）。
- `requireUserId()`（[src/lib/auth-user.ts](./src/lib/auth-user.ts)）が `supabase.auth.getUser()` でSupabase側に問い合わせて検証し、対応する Prisma `User.id` を返す共通の認証チョークポイント。API・ページの双方から利用する。
- **ログイン通知（Signaly）**: コールバックルートから [src/lib/signaly.ts](./src/lib/signaly.ts) の `notifySignalyLogin` を呼び、`SIGNALY_LOGIN_WEBHOOK_URL` が設定されていればメールアドレス・接続元 IP・時刻を Signaly の Webhook（Discord embed 互換 JSON）に通知する。未設定時は何もしない。

### Route Handler での認証確認（各 API 共通パターン）
```typescript
import { requireUserId } from "@/lib/auth-user";

export async function GET(request: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // userId でスコープしたデータ取得
}
```

---

## 🧮 計算ロジック

### 月次（給与・賞与）— [src/lib/calculations.ts](./src/lib/calculations.ts)
- `calculateOvertime`: 基本給 ÷ 所定労働時間（デフォルト160h）で時給を出し、残業時間を掛けて残業代を算出
- `calculateStatutoryInsurance`: 標準報酬月額（賞与は標準賞与額）を基に健康保険・厚生年金を、算定基礎額を基に雇用保険を計算（料率は `TaxSetting` の適用開始年月から自動参照）
- `calculateStandardBonusAmount`: 賞与の標準賞与額（1000円未満切り捨て）
- `calculateWithholdingIncomeTax`: 国税庁の給与所得の源泉徴収税額の電算機計算の特例を実装（甲欄・扶養親族等の数=0人のみ対応）
- `calculateBonusWithholdingTax` / `calculatePreviousMonthTaxableSalary`: 賞与の源泉徴収税額を、直近の給与データと非課税支給項目から自動算出

### 年次（確定申告・住民税見積り）— [src/lib/annualTax.ts](./src/lib/annualTax.ts) / [annualTaxData.ts](./src/lib/annualTaxData.ts)
- 前年の給与・賞与合計、生命保険料、ふるさと納税額から、所得税の確定申告額・住民税の月割額を推定
- 実装はユーザーのExcel（資産管理.xlsx「税金計算」シート）の数式を再現した簡略版。前提・非対応項目はファイル冒頭のコメントに明記（扶養親族等の数=0人固定、生命保険料控除の3種合計上限は非対応、均等割・森林環境税は全国標準額のみ、税制は令和7年分以降で固定 等）
- 計算過程の各ステップは `TaxCalculationOverride` で実際の金額に上書き可能（上書きは下流のステップにも反映される）
- ふるさと納税の控除上限額シミュレーションは当年の給与・賞与見込みから概算する（[furusato-nozei-estimate.tsx](<./src/app/(app)/tax-return/furusato-nozei-estimate.tsx>)）

---

## 🎨 主要コンポーネント

| コンポーネント | 用途 |
|---|---|
| `SalaryForm` / `BonusForm` | 給与・賞与の入力フォーム（React Hook Form + Zod、区分ごとの小計表示、自動計算のヒント表示） |
| `SalaryList` | 給与一覧（PC: テーブル、モバイル: カード） |
| `ItemManager` | カスタム項目の追加・編集・削除・並び替え（`@dnd-kit`） |
| `Charts/SalaryEarningChart` `SalaryDeductionChart` `BonusEarningChart` `BonusDeductionChart` | 支給・控除内訳のグラフ（`ChartFrame` / `ChartLegend` / `chartColors` で共通化） |
| `tax-return/tax-calculation-detail.tsx` | 所得税・住民税の計算過程を項目ごとに表示し、手動上書きを保存する UI |
| `tax-return/furusato-nozei-estimate.tsx` | ふるさと納税控除上限額の見込み表示 |
| `AutoCalcHint` | 自動計算されたフィールドであることを示すヒント |
| `ChangelogDialog` | アプリ内更新履歴ダイアログ（`src/lib/changelog.ts` の `APP_CHANGELOG` を表示。バージョンごとに変更点と、あれば「使い方」（`usage`）を表示） |
| `Navigation` | 下部ナビゲーション |

---

## 🗂️ ディレクトリ構造（抜粋）

```
meisai-lab/
├── src/
│   ├── app/
│   │   ├── (app)/                     認証必須ページ（salaries, bonuses, items, settings, tax-return）
│   │   ├── auth/                      signin, error, callback（Supabase OAuthコールバック）
│   │   ├── api/                       Route Handlers
│   │   ├── layout.tsx / manifest.ts   共通レイアウト・PWAマニフェスト
│   │   └── actions/auth.ts            サインイン・サインアウトの Server Action
│   ├── components/                    UI コンポーネント（Charts/, ui/ 含む）
│   ├── lib/
│   │   ├── auth-user.ts               requireUserId()（認証チョークポイント）
│   │   ├── supabase/                  Supabaseクライアント（server.ts / proxy.ts）
│   │   └── ...                        DB クライアント、計算ロジック、バリデーション、Signaly通知、changelog 等
│   ├── proxy.ts                       旧 middleware.ts 相当（認証ガード、Supabaseセッションのリフレッシュ）
│   └── types/                         型定義
├── prisma/                            スキーマ・マイグレーション
├── scripts/                          開発・DBセットアップ・changelog自動追記等
├── deploy/                           PM2 / Apache VirtualHost 設定
└── .github/                          CI・デプロイ・Signaly通知ワークフロー
```

---

## 🔔 通知（Signaly）

CI・デプロイ・ログインの3種類の通知を、自前の通知ハブ Signaly の Webhook（Discord互換 embed JSON）に送る。

| 種類 | 発火場所 | 環境変数 | 設定ファイル |
|---|---|---|---|
| CI / デプロイ / リリース | GitHub Actions | `SIGNALY_WEBHOOK_URL` | `.github/secrets-manifest.tsv`、`.github/scripts/signaly-notify.sh` |
| ログイン | アプリ実行時（`/auth/callback`） | `SIGNALY_LOGIN_WEBHOOK_URL` | `src/lib/signaly.ts`、`.github/secrets-manifest.tsv` |

両方ともGitHubのrepository secretとして登録済み（値の正は 1Password の `apps/meisai-lab` アイテム。#96）。未設定でもアプリ・CIは通常どおり動作し、通知だけが送られない。

---

## 📚 参考資料

- [Next.js 16 App Router](https://nextjs.org/docs/app)（**このリポジトリでは破壊的変更あり。`node_modules/next/dist/docs/` を優先すること**）
- [Supabase Auth (SSR)](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Prisma ORM](https://www.prisma.io/docs/)
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)
- [Recharts](https://recharts.org/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [dnd-kit](https://dndkit.com/)

未着手の機能・検討事項は [TODO.md](./TODO.md) を参照。

---

**最終更新日:** 2026-07-05
