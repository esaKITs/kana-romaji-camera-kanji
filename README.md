# Kana漢 → Romaji Camera — independent second edition

第二弾専用リポジトリです。GitHub Pagesで公開中です。教材OCRの追加修正は開発ブランチで検証しており、公開版への追加反映はまだ行っていません。

公開URL: https://esakits.github.io/kana-romaji-camera-kanji/

第一弾 https://esakits.github.io/kana-romaji-camera/ とそのリポジトリ・main・Pages設定は変更しません。旧PR [#26](https://github.com/esaKITs/kana-romaji-camera/pull/26) の修正を再利用し、独立した配信パスと資産準備を追加しています。

無料・広告なし・ログイン不要。日本語OCRと読み推定はブラウザー内で動作し、画像や認識結果を外部サーバーに送りません。初回はモデル・WASM・辞書のダウンロードが必要です。設定だけを端末に保存します。

## Build and verify

Node 24、Python 3、tarが必要です。

```sh
npm run deps
npm run prepare:assets
npm run build
npm run verify:dist
```

`dist/` にOCRモデル、単一thread WASM、Kuromoji/IPADIC辞書、Worker、サンプル、ライセンス通知、対応ソースをまとめます。モデルは固定revision・SHA-256で検証し、Gitに巨大な生成バイナリを直接コミットしません。公開成果物に資産を含めるため、第一弾やSitesへの実行時依存はありません。

```sh
# Optional analyzer-comparison assets needed by the complete inherited tests:
rustup toolchain install 1.99.1 --profile minimal --target wasm32-unknown-unknown
rustup default 1.99.1
python3 scripts/prepare-research-assets.py
npm test

# Install Chromium for integration tests if needed:
node meikiocr-test/node_modules/playwright/cli.js install chromium
npm run test:browser
```

テスト用ブラウザーは `CHROMIUM_PATH` で指定できます。実行環境の検証では `/usr/bin/chromium` を使用しました。カメラ本体は既存どおりKuromojiを使い、Sudachiは比較テスト専用です。

## Current validation

教材画像での再現・修正と実画素検査は [TEXTBOOK-OCR-REPORT.md](TEXTBOOK-OCR-REPORT.md) と [verification/textbook/](verification/textbook/) を参照してください。元画像、同画像の0.5倍／1.5倍、マクロン切替、3モードの実OCRテストを追加しています。

- 単体・回帰テスト **101成功、0失敗、0スキップ**。
- Chromiumで `/kana-romaji-camera-kanji/` 配下の実OCRを確認。生成日本語サンプルで23ラベル。モデル・WASM・辞書は同じサブパスから取得し、root URL逸脱・外部送信・JSエラーなし。
- 3モード、長音切替、実DOMでのジェスチャー処理、横画面UI、生成映像によるLive→Still→Live→Homeを確認。
- 配信成果物は約85MB。モデル2個とruntime2ファイルを含み、資産ハッシュを検証。
- 提供された教材画像は実モデルと実描画で検証済みです。実機iPhone Safari／Android Chrome、実カメラ、WebKitの再確認は未完了です。

詳細・実測ログは [verification](verification/) と [移行検証報告](PAGES-MIGRATION-REPORT.md) を参照してください。旧 `kanji-reading/*REPORT.md` は移行前の履歴であり、当時の未実行件数を記録しています。

## Publication gate

`check.yml` はbuild/testのみです。`pages.yml` は手動 `workflow_dispatch` 専用で、`PUBLISH_SECOND_EDITION` の明示入力と、新リポジトリへの固定ガードがあります。pushやPRでは公開しません。

所有者の公開承認後にのみ、新リポジトリの Settings → Pages → Source を GitHub Actions に設定し、公開workflowを手動実行します。必要なら新リポジトリの `github-pages` environmentにも承認ルールを設定してください。第一弾の設定変更・旧PRのmainマージは不要です。

結合配布はGPL-3.0-onlyです。元アプリのMIT表記、モデルLGPL、Kuromoji/IPADIC・UniDic等の通知を維持しています。[SOURCE.md](SOURCE.md) を参照してください。
