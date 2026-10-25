# Kana漢 → Romaji Camera — 技術説明（試作版）

2026年10月24日。現在のカメラ試作の実装に基づく説明です。第一弾の技術履歴と、解析器の比較実験を区別しています。

| 用途 | 現在使う技術 | 役割 |
|---|---|---|
| 文字認識 | MeikiOCR Web・配布済みOCRモデル | 画像から日本語文字と位置を検出・認識する機械学習OCR |
| モデル実行 | ONNX Runtime Web 1.30.0、WebAssembly | 認識モデルを利用者のブラウザ内で実行。実行設定はwasm、1スレッド |
| 読み推定 | Kuromoji 0.1.2と同梱IPADIC（仮採用） | 語の分割・品詞・辞書読みを取得 |
| 読み補正 | 独自の数詞・助数詞・日付処理、限定的な語彙補正 | 三本、十分、万一等を扱う。すべての曖昧な語を解決する仕組みではない |
| ふりがな | OCR座標、本文との位置関係、拡大切り出し再OCR | 対応が確認できたふりがなの読みを優先する試作 |
| ローマ字化 | 第一弾の変換規則、UniDic由来の発音データ、教材語彙 | 撥音、促音、助詞、aa／ā等を処理。解析器独自のローマ字出力は使わない |
| 表示 | HTML／CSS／JavaScript、Canvas 2D | 文字幅を計測し、元画像の語位置へラベルを配置 |
| 並列処理 | Web Workers | OCRと辞書解析を画面処理から分離。認識要求自体は重ねて実行しない |
| カメラ | getUserMedia等のブラウザ標準API | カメラ映像・撮影・対応端末のライト操作 |
| 設定保持 | localStorage | 3モードと長音表記の選択のみを保存。第一弾とは別のキー |
| 配信 | HTTPSの静的Webアプリ | 今は本人限定Sites試用ページ。本番公開先は未決定 |

## 処理に使っていないもの

- 生成AI・大規模言語モデル、ChatGPT／OpenAI API。開発時にChatGPT/Codexを利用していることと、利用者の画像処理の実行経路は別です。
- クラウドOCR、有料の認識API、画像やOCR結果をサーバーへ送るアプリ処理。
- 機械翻訳・自動翻訳。日本語の読みをローマ字で示すツールです。
- Tesseract。過去の開発履歴にありますが、現在の認識経路はMeikiOCRです。
- Sudachiの実運用。比較検証には利用していますが、現在の試用ページはKuromojiです。
- OpenCV、shimage等による画像追跡。第一弾の関連実装を、今回のカメラ試作へ統合したわけではありません。
- WebGPU。現在はWASM実行です。
- 利用者の画像を学習データとして集める処理、広告・アクセス解析のアプリ内SDK。

## 利用者向け説明の推奨文

このツールは、端末内で動く機械学習OCRと日本語辞書を使って、かな・漢字の読みを推定し、元の文字位置にローマ字を表示します。生成AIやクラウドOCRは利用していません。アプリは画像や認識した文章を外部サーバーへ送信しません。初回はOCRモデルと辞書のダウンロードが必要なため、起動まで時間がかかる場合があります。読み違いや読みを確定できない場合があります。

## 表現上の注意

「AI不使用」は不正確です。OCRには機械学習モデルを使っています。「生成AI不使用」が適切です。「完全オフライン」「通信なし」「誤読しない」「文脈を理解して必ず読み分ける」とは説明しません。ダウンロードや通常のWebアクセスは発生し、配信サービスが通常の接続情報を扱う場合があります。本人限定の試用ページではChatGPTログインが必要ですが、それは画像認識にChatGPTを利用する意味ではありません。

ライセンスは一律MITではありません。MeikiOCR WebはGPL-3.0-only、OCRモデルはLGPL-3.0、ONNX RuntimeはMIT、KuromojiはApache-2.0とIPADIC通知、UniDic由来データはmodified BSDです。元の表示と対応ソースを維持します。解析器の最終採用は未決定です。

## 2026-10-24 camera update

The development camera uses translation-tolerant scene-change rejection, not object tracking. Labels sample local paper colors with a bounded 32-tone palette and hysteresis. A separate four-step control reveals the original image beneath fully opaque romaji. Portrait and landscape layouts are implemented; this revision still requires physical-phone Live validation. See LIVE-LANDSCAPE-REPORT.md.
