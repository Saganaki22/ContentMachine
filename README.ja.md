# ContentMachine

<div align="center">

![ContentMachine](https://img.shields.io/badge/ContentMachine-AI動画パイプライン-blue?style=for-the-badge&logo=film&logoColor=white)

[![License](https://img.shields.io/badge/License-Apache%202.0-green?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![fal.ai](https://img.shields.io/badge/fal.ai-開発中-FF6B35?style=for-the-badge)](https://fal.ai)
[![Replicate](https://img.shields.io/badge/Replicate-テスト済-000000?style=for-the-badge)](https://replicate.com)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-テスト済-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-TTS-purple?style=for-the-badge)](https://elevenlabs.io)

## ❤️ プロジェクトを支援する

[![Ko-fi](https://img.shields.io/badge/支援-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/drbaph)
[![Donate](https://img.shields.io/badge/寄付-Stripe-635BFF?logo=stripe&logoColor=white)](https://donate.stripe.com/eVq4gz6pO2SQ6p4bZw6kg0g)

![ContentMachineBanner-jpeg](https://github.com/user-attachments/assets/5a00c422-87de-4773-ad07-fd27892f32d7)

**単一のトピックから YouTube 対応の完成プロジェクトまで、映画レベルのドキュメンタリー動画を制作するオールインワン AI パイプライン。**

[パイプライン](#パイプライン) · [モデルとAPI](#対応モデルとapi) · [実際のコスト](#実際のコスト) · [はじめに](#はじめに) · [機能](#機能)

</div>

## 🎥 デモを見る

<p align="center">
  <a href="https://www.youtube.com/watch?v=3BC8OXMzeF4">
    <img src="https://img.shields.io/badge/▶_フルデモを見る-YouTube-FF0000?style=for-the-badge&logo=youtube" alt="YouTubeでデモを見る">
  </a>
</p>

[![デモを見る](https://img.youtube.com/vi/3BC8OXMzeF4/maxresdefault.jpg)](https://www.youtube.com/watch?v=3BC8OXMzeF4)

---

> **API ステータス：** 個人的に **Replicate** と **Gemini** API をテスト済み — これらは実証済みのパスです。**fal.ai と ElevenLabs のサポートは実装済みですが完全には検証されていません** — エッジケースがある可能性があります。PR 歓迎！

---

## ContentMachine とは？

ContentMachine は最先端の AI を使用してドキュメンタリー動画制作ワークフロー全体を自動化します。トピックを与えると、すべてを処理します：実際の歴史的ストーリーのリサーチ、シーン計画、画像生成、動画クリップ作成、ナレーション脚本執筆、ボイスオーバー生成、YouTube メタデータ、サムネイル — すべてがビデオエディター用のきれいな ZIP にパッケージ化されます。

**コンテンツクリエイター、ドキュメンタリー制作者、教育者、愛好家**向けに構築され、フルの制作チームなしで高品質な映画レベルのコンテンツを制作できます。

---

## パイプライン

ContentMachine は段階的なパイプラインを実行し、任意のステージで監視、一時停止、再開できるクリーンな UI を提供します。

```
トピック入力
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  1. ストーリー生成                                    │
│     LLM が映画的ポテンシャルを持つ                    │
│     4つの実在・記録済み歴史的ストーリーを発見         │
│     → あなたが1つ選択                                │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  2. シーン計画                                        │
│     LLM が完全な映画ショットリストを構築              │
│     スマートペーシング：選択した動画モデルに          │
│     合わせて時間が自動調整                            │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  3. 画像生成                                          │
│     シーンごとに4バリエーション                       │
│     （全景・親密・ディテール・雰囲気）                │
│     最良のものを選択                                  │
│     すべての画像は ZIP 内に PNG/JPG として保存        │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  4. 動画生成                                          │
│     画像→動画、一度に2シーン処理                     │
│     複数のモデルから選択 — 最良のクリップを選択       │
│     ← → 矢印で過去バージョンを閲覧                  │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  5. オーディオ（オプション）                          │
│     ElevenLabs TTS ナレーション + シーンごとの音効   │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  6. エクスポート                                      │
│     YouTube メタデータ · 複数サムネイル選択          │
│     完全 ZIP：動画 + 画像/選択済 + 画像/全部         │
│     + オーディオ + スクリプト + 復元可能な project.json │
└─────────────────────────────────────────────────────┘
```

### ビジュアルスタイル

デフォルトの美学は**シームレスな光沢磁器マネキン**を使用します — 人物は常に時代に合った完全な衣装を着用し、明示的に名前を付けた履物（例：「鉄製バックル付きブラウンレザーニーブーツ」）を含み、可視のジョイント、スタンド、サポートはありません。フォトリアリスティックな環境、レイトレーシング、映画レベルの照明。

ビジュアルスタイルは完全にカスタマイズ可能：スタートページで **詳細設定 — システムプロンプトをカスタマイズ** を展開して、任意のキャラクタータイプの画像プロンプトルールを編集します。**キャラクターベース画像**機能と組み合わせて（以下参照）、すべてのシーンで一貫した外観を固定できます。

---

## 対応モデルとAPI

> **注意：** Replicate と Gemini はテスト済みのプロバイダーです。fal.ai は開発中 — 貢献歓迎。

### LLM — ストーリー、シーン計画、スクリプト、メタデータ

| プロバイダー | モデル |
|---|---|
| **fal.ai** *(開発中)* | Claude 3.5 Sonnet |
| **Gemini（直接）** | Gemini 3 Flash *（推奨）*、Gemini 3.1 Pro、Gemini 3 Pro、Gemini 2.5 Flash、Gemini 2.5 Pro |
| **Replicate** | Gemini 2.5 Flash、Gemini 3 Flash、Gemini 3.1 Pro、Claude 3.5 Sonnet |

### 画像生成

| プロバイダー | モデル |
|---|---|
| **fal.ai** *(開発中)* | Flux Pro、Flux 2 Pro、Flux Schnell、Nano Banana Pro、Qwen Image 2512、Z-Image Base、Ideogram V3、SD 3.5 Large |
| **Replicate** | Flux 2 Pro、Flux 1.1 Pro、Nano Banana Pro *（Gemini）*、Imagen 4 |
| **Gemini（直接）** | Gemini 3 Pro Image Preview *（2K ネイティブ出力）* |

### 動画生成

| プロバイダー | モデル | 注記 |
|---|---|---|
| **fal.ai** *(開発中)* | LTX-2 画像→動画 | 完全未検証 |
| **Replicate** | LTX-2 Pro | 生成オーディオ付き、6–10秒 |
| **Replicate** | LTX-2 Fast | 6–20秒を2秒ステップで、12–20秒を優先 |
| **Replicate** | Kling v3 | 3–15秒整数、スタンダード/プロモード、AI オーディオ |
| **Replicate** | Kling v2.5 Turbo Pro | 5秒または10秒のみ |

### オーディオ / TTS

| プロバイダー | 機能 |
|---|---|
| **ElevenLabs** | シーンごとのナレーションボイスオーバー + 音効生成 |
| **ローカル TTS** | 自前のツールを使用（QWEN TTS、Kokoro など）— ゼロコスト |

---

## 実際のコスト

> ContentMachine を使用して **4:30分のドキュメンタリー動画**を制作したコストは約 **28 USD** でした。

| コンポーネント | 使用プロバイダー/モデル | 注記 |
|---|---|---|
| ストーリー + シーン計画 + スクリプト | Gemini 3 Flash Preview (Gemini API) | 非常に安い |
| シーン画像 + サムネイル | Nano Banana Pro / gemini-3-image-preview (Replicate) | 中程度 |
| 動画クリップ | LTX-2 Pro (Replicate) | 最大コスト要因 |
| ナレーター TTS | QWEN TTS（ローカル） | 無料 |

**コスト削減のヒント：**
- LLM に `gemini-2.5-flash`（非プレビュー版）を使用 — より高いクォータ、レート制限少
- Replicate LTX-2 Pro の代わりに fal.ai LTX-2 を使用してビデオコストを削減 *（fal.ai が完全検証後）*
- より速く安い画像生成に Flux Schnell を使用
- ゼロオーディオコストのために無料ローカル TTS ツールを使用
- Replicate の LTX-2 Fast で同様の価格帯でより長いシーンを取得

---

## はじめに

### 前提条件

- **Node.js 18+**
- 少なくとも1つの LLM プロバイダーと1つの画像プロバイダーの API キー

### インストールと実行

```bash
# クローン
git clone https://github.com/Saganaki22/ContentMachine
cd ContentMachine

# すべての依存関係をインストール
npm install

# バックエンドとフロントエンドを同時に起動
npm run dev
```

アプリは **http://localhost:5173** で実行されます。バックエンド API は **http://localhost:3000**。

### API キーの設定

**設定パネル**（右上の歯車アイコン）を開きます。API キーを貼り付けます — ブラウザの localStorage に保存され、セッション開始時に自動的にバックエンドにプッシュされます。ローカル使用には `.env` ファイルは不要です。

| プロバイダー | リンク |
|---|---|
| fal.ai | [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys) |
| Replicate | [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) |
| Gemini | [aistudio.google.com/api-keys](https://aistudio.google.com/api-keys) |
| ElevenLabs | [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys) |

### プロダクションビルド

```bash
npm run build
npm run start
```

---

## プロジェクト構造

```
ContentMachine/
├── backend/
│   ├── server.js                Express API サーバー（200mb ボディ制限）
│   └── routes/
│       ├── claude.js            LLM：ストーリー、シーン計画、プロンプト、スクリプト、メタデータ
│       ├── images.js            画像生成：fal.ai / Replicate / Gemini
│       ├── videos.js            動画生成 + ステータスポーリング
│       ├── elevenlabs.js        TTS ナレーション + 音効生成
│       ├── thumbnail.js         サムネイル画像生成
│       ├── export.js            ZIP パッケージング（ブラウザへのストリーミング）
│       ├── session.js           output/ フォルダへの自動保存セッション
│       └── settings.js          API キー管理
│
├── output/                      自動保存セッション（セッションごとに1フォルダ）
│   └── session_YYYY-MM-DD_xxx/
│       ├── session.json         復元可能なプロジェクト状態
│       ├── images/selected/     シーンごとの選択済み画像（PNG/JPG）
│       ├── images/all/          シーンごとの全4生成バリアント
│       ├── images/history/      以前に再生成した画像バージョン
│       ├── videos/              シーンごとの現在選択済み動画（MP4）
│       ├── videos/history/      以前に再生成した動画バージョン
│       └── thumbnails/          生成済みサムネイル + 履歴
│
└── frontend/src/
    ├── pages/
    │   ├── StorySelect.jsx      ステップ1 — トピック入力、ストーリー選択、アスペクト比、キャラクター画像、詳細プロンプト
    │   ├── SceneImages.jsx      ステップ2 — 画像生成 + 選択 + エクスポート
    │   ├── VideoGeneration.jsx  ステップ3 — 動画生成 + ナレーションスクリプト
    │   ├── AudioGeneration.jsx  ステップ4 — TTS ボイスオーバー（オプション）
    │   └── Export.jsx           ステップ5 — サムネイル、メタデータ、ZIP エクスポート
    ├── components/
    │   ├── Layout.jsx           ヘッダー、ナビ、設定ドロワー、セッションブラウザー、フッター
    │   ├── ImageModal.jsx       履歴ナビゲーション付きフルスクリーン画像ビューアー
    │   ├── VideoModal.jsx       履歴ナビゲーション付きフルスクリーン動画ビューアー
    │   └── ExportModal.jsx      共有エクスポートモーダル（画像ページ以降で利用可能）
    ├── store/
    │   └── pipelineStore.js     Zustand グローバル状態 + すべての非同期アクション
    ├── services/
    │   └── api.js               すべてのバックエンド呼び出し用 Axios クライアント
    └── workers/
        ├── zipImporter.worker.js   Web Worker での ZIP 展開（JSZip + base64）
        └── jsonSerializer.worker.js  （レガシー、参照用に保持）
```

---

## 機能

### 生成
- **6ステップのガイド付きパイプライン** — ストーリー → シーン → 画像 → 動画 → オーディオ → エクスポート
- **シーンごとに4つの画像バリエーション** — 全景、親密、ディテール、雰囲気
- **バッチ処理** — 画像はシーンごとに生成、動画は一度に2本
- **モデル対応シーン計画** — LLM が選択した動画モデルの制約に合わせて許可時間とペーシングを調整
- **アスペクト比サポート** — 16:9（横向き）と 9:16（縦向き/TikTok/Reels）；API パラメーターで渡され、プロンプトには書き込まれない
- **解像度を 1080p に固定** — すべての動画モデルで一貫した品質を確保
- **任意のポイントで一時停止/再開** — バッチ途中で安全に停止し後で続行可能
- **任意の個別画像または動画クリップを再生成** — パイプライン全体を再実行しない
- **すべて再生成** — ワンクリックですべてのシーンの画像生成を再実行
- **動画クリップのワンクリック全選択/全解除**
- **動画の個別ダウンロード** — カードから直接任意の動画クリップをダウンロード
- **自動リトライ** — Gemini 429 レート制限と Replicate 中断を指数バックオフで自動処理
- **JSON 修復** — 切り捨てられたまたは不正な LLM 出力をパース前に自動修復
- **リアルタイムシーン数見積もり** — スタートページで動画長さを調整すると推定シーン数が表示

### 再生成履歴
- **画像、動画、サムネイルのバージョン履歴** — 再生成のたびに以前のバージョンが自動保存
- **← → 矢印ナビゲーション** — フルスクリーンモーダルで任意の画像、動画クリップ、またはサムネイルのすべての過去バージョンを閲覧
- **任意のバージョンを選択** — 選択時に表示しているバージョンが使用されるもの；最新の再生成結果に縛られることはない
- **バージョンごとにプロンプト保存** — 各バージョンに使用された正確なプロンプトが表示・保存；再生成前にプロンプトを編集するとプロジェクトで更新される
- **履歴はエクスポートで保持** — すべての以前の画像バージョンが ZIP に含まれ（`images/history/`）、セッション保存/読み込みで往復

### 動画モデル（Replicate）
- **LTX-2 Pro** — 6/8/10秒、生成オーディオ付き
- **LTX-2 Fast** — 6–20秒を2秒ステップで、シーンプランナーはモデルをフル活用するために 12–20秒に偏重
- **Kling v3** — 3–15秒整数、スタンダード/プロモード、AI オーディオ、スタート画像使用
- **Kling v2.5 Turbo Pro** — 5秒または10秒のみ、高速ターンアラウンド、スタート画像使用

### プロジェクト管理とセッション自動保存
- **セッション自動保存** — アプリは画像バッチごと、完了した動画ごと、サムネイル生成後にバックエンドの `output/` フォルダにセッション全体を自動保存；60秒のフォールバックタイマーが間の何でもキャッチ
- **セッションブラウザー** — ヘッダーの時計アイコンをクリックして、日付順にすべての自動保存セッションを閲覧；任意のセッションをクリックして即座に復元、または不要なセッションを削除
- **画像と動画が実際のファイルとして保存** — 自動保存セッションはすべての生成済み画像と動画をディスク上の実際のファイルとして保存（`images/all/`、`images/selected/`、`images/history/`、`videos/`、`videos/history/`、`thumbnails/`）— base64 の肥大化なし、ファイルはすぐにファイルエクスプローラーで表示可能
- **ZIP エクスポート** — 任意のステージでエクスポート可能（動画生成前の画像ページでも）；ZIP に含まれるもの：
  - `images/selected/scene_NN.jpg` — シーンごとの選択済み画像
  - `images/all/scene_NN_vN.jpg` — シーンごとのすべての4生成バリアント
  - `images/history/` — 以前に再生成した画像バージョン
  - `videos/scene_NN_v1.mp4`、`scene_NN_selected.mp4` — シーンごとのすべての生成動画バージョン
  - `videos/history/` — 以前に再生成した動画バージョン
  - `audio/`、`thumbnail/selected/`、`thumbnail/all/`
  - `project.json` — 完全に復元可能なプロジェクト状態（base64 なし — 画像は実際のファイル）
- **ZIP インポート** — ZIP をアプリに読み込む；展開は Web Worker で実行されるため UI がフリーズしない；すべての画像、動画、サムネイルが復元され、まったく同じ場所から続行できる
- **プロジェクト読み込み** — 読み込みボタン（フォルダアイコン）は `.zip` と `.json` ファイルを受け付ける；最も遠く完成したステップに自動ナビゲート
- **安全な読み込み** — プロジェクトの読み込みは新しい API リクエストや課金をトリガーしない
- **ブラウザー永続化** — Zustand 状態は localStorage を通じてページリロード後も存続

> **動画 URL の有効期限に関する注意：**
> 一部の動画プロバイダー（Replicate を含む）は生成後数時間以内にサーバーから動画を削除します。URL が期限切れになると動画は消えます。タブを閉じる前に必ず ZIP をエクスポートするか、自動保存セッションで動画をディスクにダウンロードしてください。画像は常に実際のファイルとして保存され、期限切れになりません。

### API キー
- **localStorage に保存** — キーはセッション開始時に自動的にバックエンドに読み込まれ、再入力不要
- **キーごとのクリアボタン** — 赤いクリアボタンが localStorage とバックエンドからすぐにキーを削除
- **保存前の検証** — テストボタンが保存前に各キーが有効かどうかを確認

### キャラクターベース画像
- **参照画像をアップロード** — スタートページで男性および/または女性キャラクターの参照画像をアップロード（JPG、PNG、WebP、各最大 10 MB）
- **任意のキャラクタースタイルに対応** — マネキン、リアルな人間、アニメキャラクター、またはその他；オプションの **キャラクタースタイル** テキストフィールドでスタイルを説明すると、モデルがそれに従う
- **すべてのシーンで送信** — 参照画像はすべての画像生成リクエストに含まれ、モデルがすべてのシーンでキャラクターの体型、色調、髪型を維持できる
- **シーンの衣装は常に上書き** — 各シーンはシーン計画から時代に合った衣装とポーズを取得；ロックされるのはキャラクターの外見のみ
- **モデル対応の配信** — Nano Banana Pro（Replicate と fal）と Gemini は実際の画像をマルチモーダル入力として受け取る；他のすべてのモデルはテストの一貫性ヒントを受け取る
- **「最初からやり直す」でリセット** — 新しいプロジェクトを開始するとキャラクター画像と説明が削除

### カスタマイズ
- **詳細システムプロンプト** — スタートページの展開可能なセクションで、すべての7パイプラインステージ（ストーリー選択、シーン計画、画像プロンプト、動画プロンプト、ナレーションスクリプト、YouTube メタデータ、サムネイルプロンプト）の編集可能なテキストエリア
- **デフォルトで事前入力** — 各テキストエリアは現在実際に使用されているプロンプトを表示し、何を変更するか正確にわかる
- **デフォルトにリセット** — ワンクリックで任意のステージを元のプロンプトに戻す
- **カスタムプロンプトの永続化** — localStorage に保存され、ページリロード後も存続

### エクスポート
- **ZIP エクスポート** — 画像ページ以降で利用可能；エクスポート前にすべてのステップを完了する必要なし
- **ZIP 内の復元可能な project.json** — いつでも ZIP をアプリに読み込んで離れた場所から続行
- **複数サムネイル選択** — エクスポート用に1つまたは複数のサムネイルを選択
- **履歴付きサムネイルライトボックス** — フルサイズで表示、矢印で以前の再生成バージョンを閲覧、ライトボックスから選択/選択解除
- **メタデータなしでサムネイル生成** — メタデータステップをスキップした場合でもサムネイル生成は動作
- **YouTube メタデータ** — 4つのタイトルオプション、SEO 説明、タグ、チャプタータイムスタンプ — エクスポート前にすべて編集可能

### UI
- **ContentMachine ブランディング** — クリーンなダーク UI、ヘッダーのステップインジケーター、GitHub リンクが常に表示
- **最初からやり直す** — 確認ダイアログ付きの赤いボタンで、すべての進行状況を安全にクリア
- **サンプルトピック** — 年/カテゴリータグ付きの事前入力済みストーリー提案
- **インライン動画プレビュー** — 完成した動画クリップはカードグリッドでホバー時に直接再生
- **動画プロンプトエディター** — 再生成前に任意のシーンのモーションプロンプトを編集

---

## 貢献

PR 歓迎！最も貢献が必要な分野：

- **fal.ai 検証** — fal.ai 画像と動画パスのエンドツーエンドのテストと修正
- **新しい動画モデル** — 追加の Replicate または fal.ai 動画モデルのサポートを追加
- **新しい画像モデル** — 画像プロバイダー/モデルリストの拡張
- **デプロイメント設定** — Docker、Railway、Render、または Fly.io のセットアップ
- **バグ修正とポリッシュ** — 使用中に見つけたもの

---

## ライセンス

[Apache License 2.0](LICENSE) の下でライセンス。

---

[![GitHub](https://img.shields.io/badge/GitHub-Saganaki22%2FContentMachine-181717?style=flat-square&logo=github)](https://github.com/Saganaki22/ContentMachine)

</div>
