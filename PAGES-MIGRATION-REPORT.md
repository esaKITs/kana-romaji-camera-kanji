# 第二弾 Pages移行・公開前検証報告

2026-10-25。既存PR #26の修正と181ファイルの準備済みソースを再利用。第一弾のソース・リポジトリ・main・Pages設定は変更せず、新リポジトリだけを準備した。Sites認証・デプロイの再試行は行っていない。第二弾も未公開。

## 移行内容

- `/kana-romaji-camera-kanji/` をViteのbaseとし、Worker、モデル、サンプル、アイコン、ライセンスへの参照を共通化。
- 読みWorkerと解析モジュール、Kuromoji本体・IPADIC辞書、生成済み発音規則をdistへ配置。ノード実行時の辞書パスはmodule相対にして作業ディレクトリ依存を解消。
- 固定revisionのOCRモデル2個、ONNX Runtime Web 1.30.0のWASMとglueをSHA-256検証して同梱。研究用Sudachi生成物は既存の固定ソースとrustc 1.99.1／wasm-bindgen 0.2.114から生成し、既存のJS・辞書ハッシュを照合した。生成WASMはパス依存で旧測定hashと異なるため、今回の実hashを記録した。
- 原アプリ・vendor・モデル・runtime・Kuromoji/IPADIC・UniDic通知と対応ソースarchiveを同梱。現行カメラの解析器・辞書・発音規則を交換していない。
- 新リポジトリ固定のチェックworkflowと、明示入力が必要な手動公開workflowを追加。既存第一弾のworkflowはコピーしていない。

## ブラウザーで見つかった問題と修正

1. Kuromojiへ完全な `http://...` 辞書URLを渡すと、内部の `path.join` によりprotocol部分が崩れ、`/127.0.0.1:port/...` のような誤ったURLになった。Worker位置から解決した同一originのpathnameを渡すよう修正した。モデル・辞書は今すべて第二弾サブパスで取得できる。
2. Stillのキャッシュ再解析ではUIが更新されても `stillLab.lastRun` が古いmode/styleのまま残った。世代と表示可否を確認した結果を診断にも反映し、モード切替の診断を修正した。非同期の古い結果が画面を塗り直す既存ガードは維持。
3. Nodeを子プロセス起動できない環境で、テストファイルの終了だけを成功と扱う危険を避けるため、新しいtest runnerは同じNodeプロセスに全テストをimportする。個々のテストが実行された96件のサマリーを保存した。既存の期待値は変更していない。

## 検証結果

- build成功、配信パスと資産検証成功。
- 全単体・回帰テスト96件成功、失敗0、skip0。以前不足していたcanvas・Kuromoji・Sudachi生成資産を準備し、既存テストも実行した。
- Chromiumの実Worker・実ONNX推論で生成日本語サンプルを認識し23ラベル表示。生OCRはサンプルの5行を取得。3モード、長音切替、再OCR、ズーム・パン・復帰、横画面UIを確認。
- 生成画像から作る実MediaStreamを使い、Live→Still→Live→Homeの操作とOCRを確認。実カメラ映像・実機の検証ではない。
- 30件の取得要求はいずれも第二弾のローカルサブパス。rootパス逸脱、外部画像送信、JSエラーなし。モデル・WASM・辞書のHTTPエラーもなし。
- 初回生成サンプルのrunStill処理930.2ms（OCR877.7ms、解析24.7ms、描画27.9ms）。エンジン初期ロード時間を含まない。移行前との同条件比較やスマートフォン速度を示すものではない。
- 配信成果物57ファイル、約84,944,000 bytes（対応ソースarchiveの内容により再build時は微増）。asset-inventory.jsonのサイズとhashを照合済み。Pagesの1GB制限内。
- Viteは大きなJS chunkの警告を出すがbuildエラーなし。モデル・辞書を読み込む初回待ちと実機メモリは未測定。

実測ログ: verification/unit-tests.txt、chromium-browser.json、dist-summary.json、sudachi-build.json。元ソースの由来はimport-provenance.json。

## 未検証・公開承認時に明示すること

ユーザー教材の元画像はこの実行環境に画像ファイルとしてなく、「いい」がshi+iiになる真因や「どう」「か」の実画像上の欠落が解決したとは報告しない。元の合成座標テストはii / doo / ka / kireeを維持している。

実機iPhone Safari・Android Chrome、WebKit、実カメラ、長時間メモリ、教材画像の認識精度、公開HTTPS上の資産取得は未検証。新リポジトリのGitHub Actionsリモート結果は、push後に別途確認する。ローカルでの成功をリモートCI成功として扱わない。

## 公開の停止点

Pages設定変更・workflow_dispatch・deploy-pages実行はしていない。承認前のpushはcheck workflowしか起動しない。公開承認後に新リポジトリだけのPages sourceをActionsへ設定し、レビュー済みcommitを明示した手動公開を行う。旧リポジトリや第一弾へ書き込む必要はない。
