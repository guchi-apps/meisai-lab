#!/usr/bin/env node
/**
 * npm version の lifecycle 用: APP_CHANGELOG 先頭に新バージョンのエントリを追加する。
 *
 * リリース自動化ワークフロー（release-develop-to-main.yml）は、developへ取り込まれた
 * 差分から利用者向けの文面を2種類生成し、環境変数で渡してくる。
 *
 * - RELEASE_CHANGELOG — 何が変わったか。設定されていれば changes へ反映する
 * - RELEASE_USAGE — どう使うか。`1. `で始まる番号付きの複数行（issue-deck#1729）。
 *   **画面で使える変化が無いリリースでは空**で渡るため、その場合は usage を書かない
 *
 * 未設定・空のとき（ローカルで `npm version` を叩いた場合など）は、従来どおり手で埋める
 * ための枠だけを作る。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const changelogPath = join(__dirname, "../src/lib/changelog.ts");

export const CHANGELOG_PLACEHOLDER = "（変更内容を追記してください）";

/**
 * RELEASE_CHANGELOG の文面を changes 配列へ整形する。
 * 生成される文面は箇条書き・段落のどちらもありうるため、行単位に分解し、
 * 箇条書き記号と番号を落として1行1項目にそろえる。
 */
export function parseReleaseChangelog(raw) {
  return (raw ?? "")
    .split("\n")
    .map((line) => line.trim().replace(/^(?:[-*・]|\d+[.)])\s*/, "").trim())
    .filter((line) => line !== "");
}

/**
 * RELEASE_USAGE の文面を usage 配列へ整形する。`1. `で始まる行が改行で並ぶ契約のため、
 * **番号は落とさず**行をそのまま残す（画面側は番号付きリストとして出す）。
 */
export function parseReleaseUsage(raw) {
  return (raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

// changes・usage は生成された文面をそのまま埋め込むため、TypeScriptの文字列リテラルを
// 壊さないようにエスケープする。
function escapeForTs(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function insertChangelogEntry(content, version, date, changes = [], usage = []) {
  if (content.includes(`version: "${version}"`)) {
    return { content, inserted: false };
  }

  const marker = "export const APP_CHANGELOG: ChangelogEntry[] = [";
  const index = content.indexOf(marker);
  if (index === -1) {
    throw new Error("APP_CHANGELOG marker not found in changelog.ts");
  }

  const items = changes.length > 0 ? changes : [CHANGELOG_PLACEHOLDER];
  // 使い方が空のリリースでは、項目ごと書かない（空の見出しは書き漏らしに見えるため）。
  const usageBlock =
    usage.length > 0
      ? `\n    usage: [\n${usage
          .map((item) => `      "${escapeForTs(item)}",`)
          .join("\n")}\n    ],`
      : "";
  const insertAt = index + marker.length;
  const entry = `
  {
    version: "${version}",
    date: "${date}",
    changes: [
${items.map((item) => `      "${escapeForTs(item)}",`).join("\n")}
    ],${usageBlock}
  },`;

  return {
    content: `${content.slice(0, insertAt)}${entry}${content.slice(insertAt)}`,
    inserted: true,
  };
}

function todayJst() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(
    new Date()
  );
}

function main() {
  const version = process.env.npm_package_version;
  if (!version) {
    throw new Error("npm_package_version is not set (run via npm version)");
  }

  const changes = parseReleaseChangelog(process.env.RELEASE_CHANGELOG);
  const usage = parseReleaseUsage(process.env.RELEASE_USAGE);
  const original = readFileSync(changelogPath, "utf8");
  const { content, inserted } = insertChangelogEntry(
    original,
    version,
    todayJst(),
    changes,
    usage
  );

  if (!inserted) {
    console.log(`changelog.ts already has version ${version}; skipping.`);
    return;
  }

  writeFileSync(changelogPath, content, "utf8");
  if (changes.length > 0) {
    console.log(
      `Added changelog entry for v${version} (${changes.length} change(s), ${usage.length} usage line(s))`
    );
  } else {
    console.log(`Added changelog stub for v${version}`);
  }
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  main();
}
