# pdf-cmaps

給与明細PDFの取り込み（`/api/salaries/import-pdf`、#256）で、日本語の文字コード（`90ms-RKSJ-H` など）を
Unicode へ戻すために pdf.js が読む CMap ファイル。`unpdf` は CMap を同梱していないため、
`pdfjs-dist@5.7.284` の `cmaps/` から日本語（Adobe-Japan1）用のものだけを複製している。
ライセンスは同ディレクトリの `LICENSE`（Adobe、BSD-3-Clause）。

本番のデプロイ資材（`.github/workflows/deploy.yml`）は `src/` を含まず `public/` を含むため、ここに置いている。
