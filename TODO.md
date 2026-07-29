# meisai-lab 残タスク・未確定事項まとめ

作成日: 2026-07-05
最終更新: 2026-07-05

---

## 1. すぐ着手できるもの（方針決め待ち）

- [ ] **フォントファイルの軽量化**（保留中・後回しでOKとのこと）
  M PLUS Rounded 1c をセルフホスト中（`src/app/fonts/*.ttf`）。4ウェイト合計約13MBあり初回読み込みが重い。
  対応案: ①文字サブセット化 ②WOFF2変換 ③ウェイト数を減らす（例: 400/700のみ）④このまま進める
- [x] ~~Item（カスタム項目）と給与登録フォームの連携~~ → 完了（オプションA: 既存の固定フィールドは維持しつつ、`/items` で登録したアクティブな項目を給与登録フォームに追加表示する形で実装）
- [x] ~~Deduction モデルが未使用~~ → 完了（`/api/deductions` とタックスリターン画面（`/tax-return`）から年次控除として利用）
- [x] ~~賞与の編集機能がない~~ → 完了（`/bonuses` に編集ダイアログを追加）
- [ ] **ローディング状態・エラーバウンダリ未実装**
  `loading.tsx` / `error.tsx` などのUI側の作り込みはまだ（APIの401/400やtoast通知のみ）。

## 2. 新機能の検討（元の計画には無かったもの）

- [ ] **給与明細の読み取り（OCR）機能**
  CODING_CONTEXT.md には記載なし＝Phase 1の対象外。紙・PDFの明細から自動入力したい場合はPhase 2として別途設計が必要（画像アップロード、OCR API選定、読み取り結果の確認・修正UIなど）。
- [ ] **既存スプレッドシートからの一括インポート**
  ユーザーが管理していた明細の表を取り込みたい場合、①CSV/Excelインポート機能を作る、②一度きりのデータ移行スクリプトを書く、のどちらが適切か要相談。表のフォーマット（列構成）を共有いただければ検討可能。

## 3. Git操作（指示待ち）

- [x] ~~develop ブランチが未コミット~~ → develop に16件のコミットあり
- [ ] リモート（`origin`）は `main` のみで、直近2コミットで止まっている（`develop` は未push）。`develop` の push、`main` へのPR作成・マージは指示待ち

## 4. 外部サービスの手動設定（私は実行不可）

- [ ] **1Password**: `apps/meisai-lab` アイテムに本番用 `target-dir` / `port` / `db-name` / `ci-webhook-url` を登録（Supabaseの `project-url` / `publishable-key` は共通の `apps/Supabase` アイテムを参照、issue #52）
- [x] ~~1Password: `login-webhook-url` 登録~~ → 完了
- [x] ~~GitHub: `OP_SERVICE_ACCOUNT_TOKEN` シークレット登録~~ → 完了
- [ ] **GitHub**: `develop` をデフォルトブランチ化、`main` の Branch protection 設定
- [ ] **VPS**: `/apps/meisai-lab` ディレクトリ作成、PM2登録、Apache vhost設置、certbot（DNSレコード `meisai.gucchii.com` は登録済み。`https://meisai.gucchii.com/` は 503 — バックエンド未起動と推測。GitHub Actions のワークフロー実行履歴もまだ無く、deploy が一度も走っていない）
- [ ] **Supabase（本番用）**: 共通Supabaseプロジェクト側でGoogle Providerを有効化し、Redirect URLsに `https://meisai.gucchii.com/auth/callback` を登録（Google CloudのOAuthクライアントは開発用と分離、issue #52）
- [ ] **Signaly**: アプリ用のCI通知チャンネル作成、webhook URLを1Passwordの `ci-webhook-url` に登録
- [x] ~~Signaly: ログイン通知チャンネル作成、webhook URLを1Passwordの `login-webhook-url` に登録~~ → 完了（`src/lib/signaly.ts` / `events.signIn` から通知）
- [ ] **m-guchi/docs**: ポート一覧表（`apps/_docs/README.md` プロジェクト別ポート一覧）に `meisai-lab: 3106` を追記登録

## 5. 未実施の動作確認（任意）

- [ ] 給与・賞与の新規登録／編集／削除、項目のドラッグ並び替え、税率設定の保存など一通りのCRUD実地確認（トップ・ログインは確認済み）
- [ ] モバイル実機での各ページ（`/bonuses` `/items` `/settings` など）の表示崩れチェック
