# ContentMachine

<div align="center">

![ContentMachine](https://img.shields.io/badge/ContentMachine-AI%E8%A7%86%E9%A2%91%E6%B5%81%E6%B0%B4%E7%BA%BF-blue?style=for-the-badge&logo=film&logoColor=white)

[![License](https://img.shields.io/badge/License-Apache%202.0-green?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![fal.ai](https://img.shields.io/badge/fal.ai-开发中-FF6B35?style=for-the-badge)](https://fal.ai)
[![Replicate](https://img.shields.io/badge/Replicate-已测试-000000?style=for-the-badge)](https://replicate.com)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-已测试-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-TTS-purple?style=for-the-badge)](https://elevenlabs.io)

## ❤️ 支持本项目

[![Ko-fi](https://img.shields.io/badge/支持-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/drbaph)
[![Donate](https://img.shields.io/badge/捐赠-Stripe-635BFF?logo=stripe&logoColor=white)](https://donate.stripe.com/eVq4gz6pO2SQ6p4bZw6kg0g)

![ContentMachineBanner-jpeg](https://github.com/user-attachments/assets/5a00c422-87de-4773-ad07-fd27892f32d7)

**一站式 AI 流水线，从单个主题到完整 YouTube 就绪项目，制作电影级纪录片风格视频。**

[工作流程](#工作流程) · [模型与API](#支持的模型与-api) · [真实成本](#真实成本) · [快速开始](#快速开始) · [功能特性](#功能特性)

</div>

## 🎥 观看演示

<p align="center">
  <a href="https://www.youtube.com/watch?v=3BC8OXMzeF4">
    <img src="https://img.shields.io/badge/▶_观看完整演示-YouTube-FF0000?style=for-the-badge&logo=youtube" alt="在 YouTube 上观看演示">
  </a>
</p>

[![观看演示](https://img.youtube.com/vi/3BC8OXMzeF4/maxresdefault.jpg)](https://www.youtube.com/watch?v=3BC8OXMzeF4)

---

> **API 状态：** 本人亲测 **Replicate** 和 **Gemini** API — 这两条路径经过充分验证。**fal.ai 和 ElevenLabs 支持已实现但未完全验证** — 可能存在边缘问题。欢迎提交 PR！

---

## ContentMachine 是什么？

ContentMachine 使用最先进的 AI 自动化整个纪录片视频生产工作流程。给它一个主题，它处理一切：研究真实历史故事、规划场景、生成图像、创建视频片段、撰写旁白脚本、生成配音、YouTube 元数据和缩略图 — 所有内容打包成一个整洁的 ZIP，直接供你的视频编辑器使用。

专为**内容创作者、纪录片制作者、教育工作者和爱好者**而构建，无需完整制作团队即可产出高质量电影级内容。

---

## 工作流程

ContentMachine 运行分步流水线，提供简洁的 UI 来监控、暂停和在任意阶段恢复。

```
主题输入
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  1. 故事生成                                         │
│     LLM 查找 4 个真实、有据可查的历史故事             │
│     具有电影潜力 → 你选择一个                        │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  2. 场景规划                                         │
│     LLM 构建完整的电影镜头列表                       │
│     智能节奏：时长根据视频模型自动调整               │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  3. 图像生成                                         │
│     每个场景 4 种变体（全景、亲密、细节、氛围）      │
│     选择最佳一张                                     │
│     所有图像作为真实 PNG/JPG 文件保存到 ZIP          │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  4. 视频生成                                         │
│     图像转视频，每次处理 2 个场景                    │
│     多种模型可选 — 选择最佳片段                      │
│     用 ← → 箭头浏览历史版本                         │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  5. 音频（可选）                                     │
│     ElevenLabs TTS 旁白 + 每场景音效                │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  6. 导出                                             │
│     YouTube 元数据 · 多选缩略图                     │
│     完整 ZIP：视频 + 图像/已选 + 图像/全部           │
│     + 音频 + 脚本 + 可恢复的 project.json           │
└─────────────────────────────────────────────────────┘
```

### 视觉风格

默认美学使用**无缝光滑瓷质人体模特** — 人物始终穿着符合时代的完整服装，包括明确命名的鞋类（如"铁扣棕色皮革高筒靴"），无可见关节、支架或支撑。逼真的环境、光线追踪、电影级照明。

视觉风格完全可自定义：在起始页展开 **高级 — 自定义系统提示词** 来编辑任意角色类型的图像提示词规则。结合 **角色基础图像** 功能（见下文），在每个场景中锁定一致的外观。

---

## 支持的模型与 API

> **注意：** Replicate 和 Gemini 是已测试的提供商。fal.ai 正在开发中 — 欢迎贡献。

### LLM — 故事、场景规划、脚本、元数据

| 提供商 | 模型 |
|---|---|
| **fal.ai** *(开发中)* | Claude 3.5 Sonnet |
| **Gemini（直连）** | Gemini 3 Flash *（推荐）*、Gemini 3.1 Pro、Gemini 3 Pro、Gemini 2.5 Flash、Gemini 2.5 Pro |
| **Replicate** | Gemini 2.5 Flash、Gemini 3 Flash、Gemini 3.1 Pro、Claude 3.5 Sonnet |

### 图像生成

| 提供商 | 模型 |
|---|---|
| **fal.ai** *(开发中)* | Flux Pro、Flux 2 Pro、Flux Schnell、Nano Banana Pro、Qwen Image 2512、Z-Image Base、Ideogram V3、SD 3.5 Large |
| **Replicate** | Flux 2 Pro、Flux 1.1 Pro、Nano Banana Pro *（Gemini）*、Imagen 4 |
| **Gemini（直连）** | Gemini 3 Pro Image Preview *（2K 原生输出）* |

### 视频生成

| 提供商 | 模型 | 说明 |
|---|---|---|
| **fal.ai** *(开发中)* | LTX-2 图像转视频 | 未完全验证 |
| **Replicate** | LTX-2 Pro | 含生成音频，6–10s |
| **Replicate** | LTX-2 Fast | 6–20s 每 2s 步进，偏向 12–20s |
| **Replicate** | Kling v3 | 3–15s，标准/专业模式，AI 音频 |
| **Replicate** | Kling v2.5 Turbo Pro | 仅 5s 或 10s |

### 音频 / TTS

| 提供商 | 功能 |
|---|---|
| **ElevenLabs** | 逐场景旁白配音 + 音效生成 |
| **本地 TTS** | 自备（QWEN TTS、Kokoro 等）— 零成本 |

---

## 真实成本

> 我使用 ContentMachine 制作一个 **4:30 分钟纪录片视频**，花费约 **28 美元**。

| 组件 | 使用的提供商/模型 | 说明 |
|---|---|---|
| 故事 + 场景规划 + 脚本 | Gemini 3 Flash Preview (Gemini API) | 非常便宜 |
| 场景图像 + 缩略图 | Nano Banana Pro / gemini-3-image-preview (Replicate) | 中等 |
| 视频片段 | LTX-2 Pro (Replicate) | 最大成本驱动因素 |
| 旁白 TTS | QWEN TTS（本地） | 免费 |

**降低成本的技巧：**
- 使用 `gemini-2.5-flash`（非预览版）作为 LLM — 配额更高，限速更少
- 使用 fal.ai LTX-2 代替 Replicate LTX-2 Pro 以降低视频成本 *（待 fal.ai 完全验证后）*
- 使用 Flux Schnell 进行更快、更便宜的图像生成
- 使用免费本地 TTS 工具实现零音频成本
- 使用 Replicate 上的 LTX-2 Fast 在相似价位获得更长场景

---

## 快速开始

### 前置条件

- **Node.js 18+**
- 至少一个 LLM 提供商和一个图像提供商的 API 密钥

### 安装与运行

```bash
# 克隆
git clone https://github.com/Saganaki22/ContentMachine
cd ContentMachine

# 安装所有依赖
npm install

# 同时启动后端和前端
npm run dev
```

应用运行在 **http://localhost:5173**。后端 API 在 **http://localhost:3000**。

### 配置 API 密钥

打开 **设置面板**（右上角齿轮图标）。粘贴你的 API 密钥 — 它们保存在浏览器的 localStorage 中，并在每次会话启动时自动推送到后端。本地使用无需 `.env` 文件。

| 提供商 | 链接 |
|---|---|
| fal.ai | [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys) |
| Replicate | [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) |
| Gemini | [aistudio.google.com/api-keys](https://aistudio.google.com/api-keys) |
| ElevenLabs | [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys) |

### 生产构建

```bash
npm run build
npm run start
```

---

## 项目结构

```
ContentMachine/
├── backend/
│   ├── server.js                Express API 服务器（200mb 请求体限制）
│   └── routes/
│       ├── claude.js            LLM：故事、场景规划、提示词、脚本、元数据
│       ├── images.js            图像生成：fal.ai / Replicate / Gemini
│       ├── videos.js            视频生成 + 状态轮询
│       ├── elevenlabs.js        TTS 旁白 + 音效生成
│       ├── thumbnail.js         缩略图图像生成
│       ├── export.js            ZIP 打包（流式传输到浏览器）
│       ├── session.js           自动保存会话到 output/ 文件夹
│       └── settings.js          API 密钥管理
│
├── output/                      自动保存的会话（每个会话一个文件夹）
│   └── session_YYYY-MM-DD_xxx/
│       ├── session.json         可恢复的项目状态
│       ├── images/selected/     每个场景的选定图像（PNG/JPG）
│       ├── images/all/          每个场景的所有 4 个生成变体
│       ├── images/history/      之前重新生成的图像版本
│       ├── videos/              每个场景的当前选定视频（MP4）
│       ├── videos/history/      之前重新生成的视频版本
│       └── thumbnails/          生成的缩略图 + 历史记录
│
└── frontend/src/
    ├── pages/
    │   ├── StorySelect.jsx      步骤 1 — 主题输入、故事选择、宽高比、角色图像、高级提示词
    │   ├── SceneImages.jsx      步骤 2 — 图像生成 + 选择 + 导出
    │   ├── VideoGeneration.jsx  步骤 3 — 视频生成 + 旁白脚本
    │   ├── AudioGeneration.jsx  步骤 4 — TTS 配音（可选）
    │   └── Export.jsx           步骤 5 — 缩略图、元数据、ZIP 导出
    ├── components/
    │   ├── Layout.jsx           页眉、导航、设置抽屉、会话浏览器、页脚
    │   ├── ImageModal.jsx       带历史导航的全屏图像查看器
    │   ├── VideoModal.jsx       带历史导航的全屏视频查看器
    │   └── ExportModal.jsx      共享导出弹窗（从图像页面起可用）
    ├── store/
    │   └── pipelineStore.js     Zustand 全局状态 + 所有异步操作
    ├── services/
    │   └── api.js               所有后端调用的 Axios 客户端
    └── workers/
        ├── zipImporter.worker.js   在 Web Worker 中提取 ZIP（JSZip + base64）
        └── jsonSerializer.worker.js  （遗留，保留供参考）
```

---

## 功能特性

### 生成
- **6 步引导流水线** — 故事 → 场景 → 图像 → 视频 → 音频 → 导出
- **每个场景 4 种图像变体** — 全景、亲密、细节、氛围
- **批量处理** — 图像逐场景生成，视频每次 2 个
- **模型感知场景规划** — LLM 根据所选视频模型的约束调整允许时长和节奏
- **宽高比支持** — 16:9（横屏）和 9:16（竖屏/TikTok/Reels）；通过 API 参数传递，从不写入提示词
- **分辨率锁定为 1080p** — 确保所有视频模型的质量一致
- **随时暂停/恢复** — 可以安全地在批次中途停止并稍后继续
- **重新生成** 任意单张图像或视频片段，无需重新运行整个流水线
- **全部重新生成** — 一键重新运行所有场景的图像生成
- **视频片段一键全选/全不选**
- **单视频下载** — 直接从卡片下载任意单个视频片段
- **自动重试** — 自动处理 Gemini 429 速率限制和 Replicate 中断，使用指数退避
- **JSON 修复** — 截断或格式错误的 LLM 输出在解析前自动修复
- **实时场景数估算** — 在起始页调整视频长度时显示估计场景数

### 重新生成历史
- **图像、视频和缩略图的版本历史** — 每次重新生成时，之前的版本自动保存
- **← → 箭头导航** — 在全屏弹窗中浏览任意图像、视频片段或缩略图的所有历史版本
- **选择任意版本** — 点击"选择"时，你正在查看的版本就是被使用的版本；你永远不会被锁定在最新的重新生成结果上
- **每个版本保存提示词** — 每个版本使用的确切提示词都会显示并保存；在重新生成前编辑提示词会在项目中更新它
- **历史在导出中保留** — 所有之前的图像版本都包含在 ZIP 中（`images/history/`）并通过会话保存/加载往返

### 视频模型（Replicate）
- **LTX-2 Pro** — 6/8/10s，含生成音频
- **LTX-2 Fast** — 6–20s 每 2s 步进，场景规划器偏向 12–20s 以充分利用模型
- **Kling v3** — 3–15s 整数，标准/专业模式，AI 音频，使用起始图像
- **Kling v2.5 Turbo Pro** — 仅 5s 或 10s，快速周转，使用起始图像

### 项目管理与会话自动保存
- **自动保存会话** — 应用在每个图像批次、每个完成的视频、缩略图生成后自动保存整个会话到后端 `output/` 文件夹；60 秒后备计时器捕获中间的任何内容
- **会话浏览器** — 点击页眉中的时钟图标，按日期浏览所有自动保存的会话；点击任意会话立即恢复，或删除不再需要的会话
- **图像和视频保存为真实文件** — 自动保存的会话将每个生成的图像和视频作为真实文件存储在磁盘上（`images/all/`、`images/selected/`、`images/history/`、`videos/`、`videos/history/`、`thumbnails/`）— 无 base64 膨胀，文件可立即在文件管理器中查看
- **ZIP 导出** — 可在任意阶段导出（甚至在生成视频之前的图像页面）；ZIP 包含：
  - `images/selected/scene_NN.jpg` — 每个场景的选定图像
  - `images/all/scene_NN_vN.jpg` — 每个场景的所有 4 个生成变体
  - `images/history/` — 之前重新生成的图像版本
  - `videos/scene_NN_v1.mp4`、`scene_NN_selected.mp4` — 每个场景的所有生成视频版本
  - `videos/history/` — 之前重新生成的视频版本
  - `audio/`、`thumbnail/selected/`、`thumbnail/all/`
  - `project.json` — 完全可恢复的项目状态（无 base64 — 图像是真实文件）
- **ZIP 导入** — 将 ZIP 加载回应用；提取在 Web Worker 中运行，UI 不会冻结；所有图像、视频和缩略图都会恢复，你可以从完全相同的地方继续
- **加载项目** — 加载按钮（文件夹图标）接受 `.zip` 和 `.json` 文件；自动导航到最远完成的步骤
- **安全加载** — 加载项目不会触发新的 API 请求或费用
- **浏览器持久化** — Zustand 状态通过 localStorage 在页面刷新后存活

> **关于视频 URL 过期的说明：**
> 部分视频提供商（包括 Replicate）会在生成后几小时内从服务器删除视频。一旦 URL 过期，视频就消失了。始终在关闭标签页之前导出 ZIP 或让自动保存会话将视频下载到磁盘。图像始终保存为真实文件，永不过期。

### API 密钥
- **保存在 localStorage** — 密钥在每次会话启动时自动加载到后端，无需重新输入
- **每个密钥的清除按钮** — 红色清除按钮立即从 localStorage 和后端删除密钥
- **保存前验证** — 测试按钮在存储之前检查每个密钥是否有效

### 角色基础图像
- **上传参考图像** — 在起始页上传男性和/或女性角色参考（JPG、PNG、WebP，每个最大 10 MB）
- **适用于任何角色风格** — 人体模特、真实人类、动漫角色或任何其他风格；在可选的 **角色风格** 文本字段中描述风格，模型会遵循
- **随每个场景发送** — 参考图像与每个图像生成请求一起包含，使模型在所有场景中保持角色的比例、色调和发型
- **场景服装始终覆盖** — 每个场景仍然从场景规划中获得其自己的时代正确服装和姿势；只有角色外观被锁定
- **模型感知传递** — Nano Banana Pro（Replicate 和 fal）和 Gemini 接收实际图像作为多模态输入；所有其他模型接收文本一致性提示
- **随"重新开始"重置** — 开始新项目时，角色图像和描述被清除

### 自定义
- **高级系统提示词** — 起始页上的可展开部分，包含所有 7 个流水线阶段的可编辑文本区域（故事选择、场景规划、图像提示词、视频提示词、旁白脚本、YouTube 元数据、缩略图提示词）
- **预填充默认值** — 每个文本区域显示当前实际使用的提示词，你确切知道要更改什么
- **重置为默认值** — 一键将任意阶段恢复为原始提示词
- **自定义提示词持久化** — 保存到 localStorage，在页面刷新后存活

### 导出
- **ZIP 导出** — 从图像页面起可用；无需在导出之前完成每个步骤
- **ZIP 内可恢复的 project.json** — 随时将 ZIP 加载回应用以从你离开的地方继续
- **多选缩略图** — 选择一个或多个缩略图进行导出
- **带历史的缩略图灯箱** — 全屏查看，用箭头浏览之前重新生成的版本，从灯箱中选择/取消选择
- **无需元数据即可生成缩略图** — 即使跳过了元数据步骤，缩略图生成也能正常工作
- **YouTube 元数据** — 4 个标题选项、SEO 描述、标签、章节时间戳 — 导出前全部可编辑

### 界面
- **ContentMachine 品牌** — 简洁深色 UI，页眉中的步骤指示器，GitHub 链接始终可见
- **重新开始** — 带确认对话框的红色按钮，安全清除所有进度
- **示例主题** — 带年份/类别标签的预填充故事建议
- **内联视频预览** — 完成的视频片段悬停时直接在卡片网格中播放
- **视频提示词编辑器** — 在重新生成之前编辑任意场景的运动提示词

---

## 贡献

欢迎提交 PR！以下领域最需要贡献：

- **fal.ai 验证** — 端到端测试和修复 fal.ai 图像和视频路径
- **新视频模型** — 添加对更多 Replicate 或 fal.ai 视频模型的支持
- **新图像模型** — 扩展图像提供商/模型列表
- **部署配置** — Docker、Railway、Render 或 Fly.io 设置
- **Bug 修复与完善** — 使用过程中发现的任何问题

---

## 许可证

根据 [Apache License 2.0](LICENSE) 授权。

---

[![GitHub](https://img.shields.io/badge/GitHub-Saganaki22%2FContentMachine-181717?style=flat-square&logo=github)](https://github.com/Saganaki22/ContentMachine)

</div>
