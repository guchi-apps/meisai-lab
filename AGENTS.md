<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:multi-agent-rules -->
# マルチエージェント運用（GitHub Actions 無人実行）

`@claude` コメントを起点に、計画提示〜実装〜develop向けPR作成までを GitHub Actions 上で無人実行する。
ワークフローの実体は `guchi-apps/issue-deck` にあり、このリポジトリの `.github/workflows/` には
`uses:` で参照する薄い caller だけを置いている（`@workflows/v9`）。

**GitHub Actions 上での実行は、このリポジトリをチェックアウトしたワークツリーしか参照できない。**
したがって無人実行でも守られる必要があるルールは、このファイルに明文化しておく必要がある。

設計・運用の詳細は issue-deck 側を参照する。

- 進捗管理の設計: [progress-status-architecture.md](https://github.com/guchi-apps/issue-deck/blob/main/docs/progress-status-architecture.md)
- 無人実行の挙動: [multi-agent/dispatch.md](https://github.com/guchi-apps/issue-deck/blob/main/docs/multi-agent/dispatch.md)

## ブランチ運用

- `main` は本番と一致するリリース用ブランチ。直接pushは禁止し、`develop` → `main` のPRのみで進める
- `develop` が日常の開発ブランチ
- Issue専用ブランチは `develop` から作成し、ブランチ名は **`issue-<Issue番号>`** とする（例: `issue-69`）。
  ワークフローはブランチ名から対象Issueを特定するため、**この命名規約に従わないブランチはすべて対象外**になる

## Issueの進捗

**進捗は GitHub Projects の Status で管理する。進捗ラベルは存在しない**
（issue-deck#1010 / #991 Phase 5 で `01.planning`〜`09.main` を廃止した）。

1. `Ready` — 未着手
2. `Planning` — 計画検討中（`21.plan-required` 選択時のみ経由）
3. `Implementation` — 実装中
4. `Develop PR` — developへPR作成・マージ中
5. `Develop` — developへマージ完了（main未反映）
6. `Release` — mainへPR作成・マージ中
7. `Done` — mainへマージ完了。この時点でissueをcloseする

**`gh issue edit` で進捗を進めることはできない。** Status を書けるのは issue-deck だけで、
ワークフローは進捗報告API（`POST /api/progress`）へ報告する。ブランチのpush・PR作成・PRマージを
トリガーに自動で遷移するため、エージェントが自分で進捗を動かす必要はない。
人が動かす場合はカンバンのカードをドラッグするか、issue-deck の画面のボタンを使う。

## 条件を表すラベル（進捗とは別軸）

Status = 今どこにいるか、Label = どんな性質・条件があるか、という役割分担にしている。

| ラベル | 意味 |
|---|---|
| `00.check-user` | ユーザーの確認・指示が必要。どの段階でも併用する |
| `00.qa-answered` | 質問への回答のみ完了（`00.check-user` と常に併用） |
| `11.local` | ローカル（VSCode等）で対応中。付いている間は無人実行を起動しない |
| `21.plan-required` | 実装前に計画を提示し承認を得る |
| `22.merge-confirm-required` | 内容によらず、developへのマージ前に必ず `00.check-user` を付ける |
| `23.preview-required` | PR作成前に開発サーバーでの画面確認を必須にする |
| `24.screenshot-required` | PR作成前にスクリーンショット取得を必須にする |

## 自動マージ不可カテゴリ

以下に該当する変更は自動マージせず `00.check-user` を付与してユーザーの確認を待つ。

- 認証・認可
- DBスキーマ変更・マイグレーション（`prisma/migrations/**`）
- 本番環境の設定
- GitHub Actionsやデプロイ設定（`.github/workflows/**`）
- Secretsや環境変数（`.env*`）
- 課金・決済
- 大規模な依存関係の更新
- `develop` → `main` のマージ

## 実装エージェントの禁止事項

- `main` / `develop` への直接コミット・push
- 他Issueのブランチの編集
- 不要なforce push
- 自分が作成したPull Requestの自己マージ

## コミット・PR・コメントの書き方

- コミットメッセージ・PRタイトル・PR本文・issueコメントは**日本語**で書く
- コミットの author は `Claude Code <claude-code@example.com>` にする
- `develop` 宛のPR本文には、対応Issue・実装内容・テスト内容・確認方法・注意点を記載する。
  developマージ時点ではissueをcloseしない運用のため、`closes #番号` / `fixes #番号` は使わず
  `#番号` のみ記載する

## 依存関係の追加

新しい依存関係を追加する前には、必ずユーザーに確認を取る。無人実行では確認相手がいないため、
追加が必要だと判断した場合は追加せずに作業を止め、`00.check-user` を付与したうえで
なぜ必要かをIssueコメントで相談する。

## 検証コマンド

| 目的 | コマンド |
|---|---|
| Lint | `npm run lint` |
| 型チェック | `npm run typecheck` |
| まとめて（lint + typecheck） | `npm test` |
| ビルド | `npm run build:ci` |
| マイグレーション適用 | `npm run db:migrate:deploy` |
<!-- END:multi-agent-rules -->

## マイグレーション作成時の注意

`prisma.config.ts` の `loadEnv()` からは **`quiet: true` を外さない**。
dotenv v17 は案内文（`◇ injected env ...`）を **stdout** へ出すため、同じstdoutへSQLを書き出す
`prisma migrate dev` / `prisma migrate diff --script` の出力に混ざり、
`migration.sql` の1行目がSQLでなくなる。本番の `prisma migrate deploy` が構文エラー（1064 → P3018）で
失敗し、`_prisma_migrations` に失敗記録が残ってP3009で以後のデプロイが止まる（#136）。

新しいマイグレーションを作ったら、コミット前に1行目を確認する。

```bash
head -1 prisma/migrations/*/migration.sql
```
