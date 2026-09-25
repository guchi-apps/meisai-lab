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

### 認証まわり（Supabase Auth）
認証専用のテーブルは持たない（Auth.js 時代の `Account` / `Session` / `VerificationToken` は Supabase Auth 移行で廃止済み、issue #52）。
セッションは Supabase が Cookie で管理し、Supabase ユーザーとの対応は `User.supabaseUserId` で取る（詳細は「認証フロー」）。

### User
`Salary` / `Bonus` / `Item` / `TaxSetting` / `Deduction` / `TaxCalculationOverride` / `FurusatoDonation` の親。
`supabaseUserId`（Supabase Auth のユーザーID）で Supabase 側のユーザーと紐付く。

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

`furusatoNozei` だけは意味が変わっている。ふるさと納税の正本は `FurusatoDonation`（寄付明細）で、
この行は**明細に載せていない調整額**（移行前に年間合計だけを登録していた分）を保持する。

### FurusatoDonation（ふるさと納税の寄付明細）
寄付1件ごとの明細。ふるさと納税の実績はこのテーブルを唯一の正本として扱う。

- `year` は `donatedAt` から**サーバー側で導出**して保存する非正規化カラム（年ごとの集計・絞り込み用）。
  APIのリクエストでは受け取らない。寄付日を更新したときは `year` も追随させること
- `oneStopStatus`（ワンストップ特例）: `notApplied` / `applied` / `accepted` / `switchedToTaxReturn`
- `certificateStatus`（寄附金控除証明書）: `notReceived` / `received` / `notNeeded`
- `switchedToTaxReturn` かつ `notNeeded` の組み合わせだけは不正（確定申告するなら証明書が要る）。
  PATCH は送られてこなかった項目が保存済みの値のまま残るため、**更新後の組み合わせで**検証する
  （`isValidStatusCombination()`）
- 削除は `deletedAt` による論理削除（`Salary` / `Bonus` と同じ）

**年間のふるさと納税額は 明細合計 + 調整額 で求める**（`getFurusatoDonationSummary()`）。
移行前のデータは明細が0件なので `effectiveTotal === adjustment` となり、過去年の税計算結果は変わらない。
両方に金額がある年だけ、確定申告画面で二重計上の注意を表示する。

### TaxCalculationOverride
住民税・所得税の計算過程（[annualTax.ts](./src/lib/annualTax.ts) の各ステップ）を、実際の課税決定通知書等の金額で手動上書きするためのテーブル。`field` に計算過程のキー（例: `annualGrossIncome`）を持ち、上書きした値は下流のステップにも反映される。

---

## 🌐 Route Handlers（API エンドポイント）

すべて `requireUserId()`（[src/lib/auth-user.ts](./src/lib/auth-user.ts)）による認証チェック（未認証は 401 JSON 応答）を各ハンドラ自身が行う（`src/proxy.ts` は `/api/*` を素通りさせる設計）。

```
GET/POST     /api/salaries
GET/PUT/DELETE /api/salaries/[id]
POST         /api/salaries/import-pdf     給与明細PDF（multipart の file / password）から項目名と金額の行を読み取って返す。PDFは保存しない

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

GET/POST     /api/furusato-donations          GETは ?year= / ?oneStopStatus= / ?certificateStatus= で絞り込み
PATCH/DELETE /api/furusato-donations/[id]     DELETEは論理削除

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
/settings                  保険料率の改定履歴、プロフィール
/settings/items            項目管理（種別・適用範囲・並び順。設定画面から入る。issue #190）
/tax-return                確定申告データ（年ごとに開閉できるセクション）
                             - ふるさと納税 残り枠（見込み上限額・寄付済額・追加可能額）
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
- **ログアウトは `signOutThisApp()`（[src/lib/supabase/sign-out.ts](./src/lib/supabase/sign-out.ts)）を必ず経由する**。共通Supabaseプロジェクトでは `supabase.auth.signOut()` の既定 scope が `global` のため、引数なしで呼ぶと同じユーザーの他アプリ・他端末の refresh token まで失効する。`signOutThisApp()` は `scope: "local"` を固定してこのアプリのセッションだけを破棄する。直接 `.signOut(` を呼ぶと `npm run test:unit` が落ちる。このアプリにはアカウント削除の操作は無い（追加する場合のみ、全セッションを終了する意図を明示した別経路にする）。
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

### 年次（確定申告・住民税見積り）— [src/lib/annualTax.ts](./src/lib/annualTax.ts) / [annualTaxAggregate.ts](./src/lib/annualTaxAggregate.ts) / [annualTaxData.ts](./src/lib/annualTaxData.ts)
- 前年の給与・賞与合計、生命保険料、ふるさと納税額から、所得税の確定申告額・住民税の月割額を推定
- 実装はユーザーのExcel（資産管理.xlsx「税金計算」シート）の数式を再現した簡略版。前提・非対応項目はファイル冒頭のコメントに明記（扶養親族等の数=0人固定、生命保険料控除の3種合計上限は非対応、均等割・森林環境税は全国標準額のみ、税制は令和7年分以降で固定 等）
- 計算過程の各ステップは `TaxCalculationOverride` で実際の金額に上書き可能（上書きは下流のステップにも反映される）
- 明細行 → 年間集計・ふるさと納税見込みの計算は `annualTaxAggregate.ts`（`computeAnnualAggregate` / `computeFurusatoNozeiIncomeProjection`）に置き、`annualTaxData.ts` は DB から行を読んで渡すだけにしている。`db` に依存させないのは `node --test` で単体テストするため（`@/` エイリアスは使えないので、相対 import は拡張子 `.ts` 付きで書く）
- **税計算の閾値・数式を変えたら `npm run test:unit`（`annualTax.test.ts` / `annualTaxAggregate.test.ts`）の期待値も条文に合わせて直す。** 期待値は速算表・控除額表からの手計算で、コードの出力を写していない。`npm test` に含まれている。区間の上限ちょうどの値が条文（「以下」）とずれている箇所は `todo` テストとして残してある（#233）
- ふるさと納税の残り枠は当年の給与・賞与見込みから概算する（[furusato-quota-card.tsx](<./src/app/(app)/tax-return/furusato-quota-card.tsx>)）
  - `getFurusatoNozeiIncomeProjection` は見込み年収・見込み社会保険料に加えて、給与の未登録月・賞与の見込み回数・実績だけの合計を返す。カードはこれを使って「どこからが見込みか」を画面に出す
  - **寄付済額を取り出す唯一の入口は `getFurusatoDonationSummaries`**。寄付明細（`FurusatoDonation`）の合計 + 年次控除 `Deduction.furusatoNozei` の調整額を `effectiveTotal` として返す。画面・税計算はこの `effectiveTotal` を使い、**`Deduction.furusatoNozei` を単独で参照しないこと**（二重計上になる）
  - 上限額は確定値として扱わない。医療費控除・住宅ローン控除・扶養控除が未対応のため、源泉徴収票の値（`annualGrossIncome` / `socialInsuranceTotal` / `incomeTaxWithheldTotal`）を上書きしても「確定確認済み」までで、未対応の控除は画面に出し続ける
  - `TaxCalculationOverride` の上書きとは競合させない。`furusatoNozeiEffective` の上書きがあれば寄付済額はそちらを優先し、年収・社会保険料の上書きはカードの試算欄の初期値になる（試算のためこの2項目だけは `calculateAnnualResidentTax` へ渡す上書きから外す）

---

## 🎨 主要コンポーネント

| コンポーネント | 用途 |
|---|---|
| `SalaryForm` / `BonusForm` | 給与・賞与の入力フォーム（React Hook Form + Zod、区分ごとの小計表示、自動計算のヒント表示） |
| `PayslipPdfImport` | 給与の新規登録画面の「PDFから読み取る」カード。読み取った行の反映先を選び、PDFの総支給額・差引支給額と照合してから `SalaryForm` へ反映する（下記「給与明細PDFの取り込み」） |
| `SalaryList` | 給与一覧（PC: テーブル、モバイル: カード） |
| `ItemManager` | カスタム項目の追加・編集・削除・並び替え（`@dnd-kit`） |
| `Charts/SalaryEarningChart` `SalaryDeductionChart` `BonusEarningChart` `BonusDeductionChart` | 支給額・控除額の推移グラフ（`ChartFrame` / `ChartLegend` / `chartColors` で共通化） |
| `Charts/DetailBreakdownChart` | 明細1件（年別では1年分）の内訳。支給を上段・控除を下段に置いた積み上げ横棒と、全項目を常時表示する一覧表。横軸の最大値は支給総額で固定し、控除の棒の長さがそのまま負担割合になる。大分類をクリックするとその分類だけを100%とした内訳へ切り替わり、グラフと一覧表は選択状態を双方向に連動させる（#57） |
| `tax-return/tax-calculation-detail.tsx` | 所得税・住民税の計算過程を項目ごとに表示し、手動上書きを保存する UI |
| `tax-return/furusato-quota-card.tsx` | ふるさと納税の残り枠（見込み上限額・寄付済額・追加可能額、前提と未確定要素、年収・社会保険料の試算と差分、源泉徴収票の入力への導線） |
| `AutoCalcHint` | 自動計算されたフィールドであることを示すヒント |
| `ChangelogDialog` | アプリ内更新履歴ダイアログ（`src/lib/changelog.ts` の `APP_CHANGELOG` を表示。バージョンごとに変更点と、あれば「使い方」（`usage`）を表示） |
| `Navigation` | 下部ナビゲーション |

---

## 🗂️ ディレクトリ構造（抜粋）

```
meisai-lab/
├── src/
│   ├── app/
│   │   ├── (app)/                     認証必須ページ（salaries, bonuses, settings（項目管理 settings/items を含む）, tax-return）
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

## 🔍 クリック操作を伴うUIの動作確認

`npm run dev`（Turbopack）で起動したサーバーをヘッドレスブラウザで開くと、
**ハイドレーションが完了せずクリックが一切効かない**（DOM要素に React の
`__reactFiber$` が付かないままになる）。SSR済みのHTMLは返るため一見動いているように
見えるが、`button` を `click()` しても状態が変わらず、原因の切り分けに時間を取られる。

クリック・ドリルダウン・選択の連動などを確認するときは、**本番ビルドを使う**。

```bash
npm run build:ci && npx next start -p 11057
```

本番ビルドなら同じヘッドレス環境で 0.5 秒ほどでハイドレーションが完了する。
なお `next start` は `src/proxy.ts` が Supabase のURL・キーを必須にするため
`.env.local` が要る（画面確認だけならダミー値でよい。ログイン不要の公開パスは
`src/proxy.ts` の `publicPaths` を参照）。確認日 2026-08-23 / #57

---

## 📄 給与明細PDFの取り込み（#256）

- 抽出はサーバー（[payslipPdfServer.ts](./src/lib/payslipPdfServer.ts)、`unpdf` = pdf.js）、行の組み立て・割り当て・照合は
  [payslipPdf.ts](./src/lib/payslipPdf.ts)（`db` 非依存・`npm run test:unit` 対象）
- **日本語PDFは CMap が無いと項目名が1文字も取れない。** 見本の明細は `90ms-RKSJ-H`（Shift_JIS）で ToUnicode を
  持たないため、pdf.js の CMap（`public/pdf-cmaps/`、`pdfjs-dist` から日本語分だけ複製）を `cMapUrl` で渡している。
  本番のデプロイ資材は `src/` を含まず `public/` を含むため `public/` に置く
- 想定する配置は「項目名の列と金額の列が同じ y 座標で並ぶ表」。同じ高さ（±3pt）の文字列を1行とみなし、金額の直前の
  文字列を項目名にする。明細には年月しか無いので、支給日の日は前回登録した給与に揃える
- 反映時は PDF に無い金額欄を 0 にする（新規フォームは前回の明細を初期値に持ち、空欄の保険料・税は自動計算するため、
  残すと PDF と違う手取額で保存される）。手で選んだ割り当ては `localStorage` に項目名をキーとして記憶する
- 実際の明細PDF・金額はリポジトリに置かない（公開リポジトリ）。テストは同じ配置の架空データで書く

---

## ⚙️ props の変化に合わせて state を作り直すとき

`eslint.config.mjs` で有効にしている React Compiler の
`react-hooks/set-state-in-effect` は、**`useEffect` の中での `setState` をエラーにする**。
サーバーから渡ってきた初期値が変わったときに入力欄の state を追従させたい、という
よくある用途もここに引っかかる（`npm run lint` が
`Calling setState synchronously within an effect can trigger cascading renders` で落ちる）。

このときは effect ではなく、**直前の props を state に持ち、レンダー中に比較して更新する**。
React の "Adjusting state when a prop changes" のパターンで、追加のレンダーは発生するが
effect のような二重描画にはならない。

```tsx
const [prev, setPrev] = useState({ base });
if (prev.base !== base) {
  setPrev({ base });
  setValue(base);      // レンダー中の setState は許容される
}
```

実例: [furusato-quota-card.tsx](<./src/app/(app)/tax-return/furusato-quota-card.tsx>)（源泉徴収票の値を
保存した直後に試算欄の初期値を追従させる）。確認日 2026-09-01 / #176

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

**最終更新日:** 2026-09-25
