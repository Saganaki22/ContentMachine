# ContentMachine

<div align="center">

![ContentMachine](https://img.shields.io/badge/ContentMachine-AI%20纪录片流水线-blue?style=for-the-badge&logo=film&logoColor=white)

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

**一站式 AI 流水线——从一个主题出发，生成完整的电影风格纪录片，直至打包好的 YouTube 就绪项目。**

[流水线流程](#流水线流程) · [模型与 API](#支持的模型与-api) · [实际费用](#实际费用) · [快速开始](#快速开始) · [功能特性](#功能特性)

</div>

## 🎥 观看演示

<p align="center">
  <a href="https://www.youtube.com/watch?v=3BC8OXMzeF4">
    <img src="https://img.shields.io/badge/▶_观看完整演示-YouTube-FF0000?style=for-the-badge&logo=youtube" alt="在 YouTube 上观看演示">
  </a>
</p>

[![观看演示](https://img.youtube.com/vi/3BC8OXMzeF4/maxresdefault.jpg)](https://www.youtube.com/watch?v=3BC8OXMzeF4)

---

> **API 状态：** 本项目已在 **Replicate** 和 **Gemini** API 上进行过实测——这两条路径是经过验证的。**fal.ai 支持已实现但未完整验证**，可能存在问题。欢迎提交 PR！

---

## ContentMachine 是什么？

ContentMachine 使用最先进的 AI 自动完成整个纪录片制作流程。只需输入一个主题，它会处理所有事情：挖掘真实历史故事、规划场景、生成图像、制作视频片段、撰写解说词、生成配音、YouTube 元数据和缩略图——最终打包成一个整洁的 ZIP 文件，随时可导入视频编辑器。

专为**内容创作者、纪录片制作人、教育者和爱好者**打造，无需完整制作团队即可产出高质量的电影风格内容。您可以在起始页（故事页面）展开高级设置，完全自定义并微调您的提示词，打造属于自己的风格。

> **这是我为自己打造的一体化流水线**——本地运行足够简单，AI 提供商可灵活切换，一次会话即可产出发布就绪的素材。

---

## 流水线流程

ContentMachine 按步骤运行，提供简洁的 UI 界面，可在任意阶段监控、暂停和恢复。

```
输入主题
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  1. 故事生成                                         │
│     LLM 找出 4 个真实、有据可查的历史故事            │
│     具有电影潜力 → 你从中选择一个                    │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  2. 场景规划                                         │
│     LLM 构建完整的电影分镜列表                        │
│     智能节奏：时长根据所选视频模型自动适配            │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  3. 图像生成                                         │
│     每个场景 4 种变体（全景、近景、细节、氛围）       │
│     选出最佳图像                                     │
│     所有图像以 base64 格式保存在项目 JSON 中          │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  4. 视频生成                                         │
│     图像转视频，每次处理 2 个场景                     │
│     多种模型可选——选出最佳片段                       │
│     视频 URL 保存在项目 JSON 中                      │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  5. 音频（可选）                                     │
│     ElevenLabs TTS 解说配音 + 每场景音效生成         │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  6. 导出                                             │
│     YouTube 元数据 · 多选缩略图                      │
│     完整 ZIP：视频 + 图像 + 音频 + 脚本              │
└─────────────────────────────────────────────────────┘
```

### 视觉风格

默认美学使用**无缝光泽瓷器人体模型**——人物始终穿着符合历史时期的服装，无可见接缝、支架或支撑物。写实环境、光线追踪、电影级布光。对于 YouTube 内容创作者而言，这是一个极佳的起点，因为它不描绘可能被篡改的真实场景。

视觉风格完全可自定义：在起始页展开 **Advanced — Customize System Prompts**，即可编辑适用于任意角色类型的图像提示词规则。结合下方的**角色基础图像**功能，可在所有场景中锁定一致的外观。

---

## 支持的模型与 API

> **注意：** Replicate 和 Gemini 是已验证的提供商。fal.ai 仍在完善中——欢迎贡献代码。

### LLM——故事、场景规划、脚本、元数据

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
| **Gemini（直连）** | Gemini 3 Pro Image Preview *（原生 2K 输出）* |

### 视频生成

| 提供商 | 模型 | 说明 |
|---|---|---|
| **fal.ai** *(开发中)* | LTX-2 图像转视频 | 未完整验证 |
| **Replicate** | LTX-2 Pro | 含 AI 生成音频，6–10 秒 |
| **Replicate** | LTX-2 Fast | 6–20 秒，2 秒步进 |
| **Replicate** | Kling v3 | 3–15 秒整数，标准/专业模式，AI 音频 |
| **Replicate** | Kling v2.5 Turbo Pro | 仅 5 秒或 10 秒 |

### 音频 / TTS

| 提供商 | 功能 |
|---|---|
| **ElevenLabs** | 逐场景解说配音 + 音效生成 |
| **本地 TTS** | 自带工具（QWEN TTS、Kokoro 等）——零成本 |

---

## 实际费用

> 使用 ContentMachine 全程制作一个 **4:30 分钟纪录片视频**，费用约为 **28 美元**。

| 组件 | 使用的提供商/模型 | 说明 |
|---|---|---|
| 故事 + 场景规划 + 脚本 | Gemini 3 Flash Preview（Gemini API） | 非常便宜 |
| 场景图像 + 缩略图 | Nano Banana Pro / gemini-3-image-preview（Replicate） | 中等 |
| 视频片段 | LTX-2 Pro（Replicate） | 最大费用来源 |
| 解说配音 | QWEN TTS（本地） | 免费 |

**降低费用的技巧：**
- LLM 使用 `gemini-2.5-flash`（非预览版）——配额更高，频率限制更少
- 视频使用 fal.ai LTX-2 代替 Replicate LTX-2 Pro（*fal.ai 完整验证后*）
- 图像使用 Flux Schnell——更快更便宜
- 使用免费本地 TTS 工具，音频零成本
- 使用 Replicate 上的 LTX-2 Fast 生成较长场景，价格相近

---

## 快速开始

### 前置条件

- **Node.js 18+**
- 至少一个 LLM 提供商和一个图像提供商的 API 密钥

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/Saganaki22/ContentMachine
cd ContentMachine

# 安装所有依赖
npm install

# 同时启动后端和前端
npm run dev
```

前端运行于 **http://localhost:5173**，后端 API 运行于 **http://localhost:3000**。

### 配置 API 密钥

打开**设置面板**（右上角齿轮图标）。粘贴您的 API 密钥——密钥会保存在浏览器的 localStorage 中，每次会话启动时自动推送至后端。本地使用无需 `.env` 文件。

| 提供商 | 链接 |
|---|---|
| fal.ai | [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys) |
| Replicate | [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) |
| Gemini | [aistudio.google.com/api-keys](https://aistudio.google.com/api-keys) |
| ElevenLabs | [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys) |

### 生产环境构建

```bash
npm run build
npm run start
```

---

## 项目结构

```
ContentMachine/
├── backend/
│   ├── server.js                Express API 服务器（200MB 请求体限制）
│   └── routes/
│       ├── claude.js            LLM：故事、场景规划、提示词、脚本、元数据
│       ├── images.js            图像生成：fal.ai / Replicate / Gemini
│       ├── videos.js            视频生成 + 状态轮询
│       ├── elevenlabs.js        TTS 解说配音 + 音效生成
│       ├── thumbnail.js         缩略图生成
│       ├── export.js            ZIP 打包（流式传输至浏览器）
│       └── settings.js          API 密钥管理
│
└── frontend/src/
    ├── pages/
    │   ├── StorySelect.jsx      第 1 步——主题输入、故事选择、宽高比、角色图像、高级提示词
    │   ├── SceneImages.jsx      第 2 步——图像生成与选择
    │   ├── VideoGeneration.jsx  第 3 步——视频生成 + 解说脚本
    │   ├── AudioGeneration.jsx  第 4 步——TTS 配音（可选）
    │   └── Export.jsx           第 5 步——缩略图、元数据、ZIP 导出
    ├── components/
    │   └── Layout.jsx           页眉、导航、设置抽屉、GitHub 链接、页脚
    ├── store/
    │   └── pipelineStore.js     Zustand 全局状态 + 所有异步操作
    └── services/
        └── api.js               所有后端调用的 Axios 客户端
```

---

## 功能特性

### 生成
- **6 步引导式流水线**——故事 → 场景 → 图像 → 视频 → 音频 → 导出
- **每场景 4 种图像变体**——全景、近景、细节、氛围
- **批量处理**——图像逐场景生成，视频每次 2 个
- **模型感知的场景规划**——LLM 根据所选视频模型的约束自动调整允许时长和节奏
- **宽高比支持**——16:9（横屏）和 9:16（竖屏/TikTok/Reels）；通过 API 参数传递，不写入提示词
- **分辨率锁定为 1080p**——确保所有视频模型输出质量一致
- **暂停/恢复**——可在任意时刻安全停止并稍后继续
- **单独重新生成**——无需重跑整个流水线即可重新生成任意图像或视频片段
- **全部重新生成**——一键重跑所有场景的图像生成
- **一键全选/取消全选**视频片段
- **单视频下载**——直接从卡片下载任意视频片段
- **自动重试**——自动处理 Gemini 429 频率限制和 Replicate 中断，使用指数退避
- **JSON 修复**——截断或格式错误的 LLM 输出在解析前自动修复
- **实时场景数量估算**——在起始页调整视频时长时实时显示估计场景数

### 视频模型（Replicate）
- **LTX-2 Pro**——6/8/10 秒，含 AI 生成音频
- **LTX-2 Fast**——6–20 秒，2 秒步进，含 AI 生成音频
- **Kling v3**——3–15 秒整数，标准/专业模式，AI 音频，使用起始图像
- **Kling v2.5 Turbo Pro**——仅 5 秒或 10 秒，出图快，使用起始图像

### 项目管理
- **保存项目为 JSON**——所有图像以 base64 格式存储（永不过期的 CDN 链接），视频 URL 已保留
- **加载项目**——完整恢复包括图像、视频、选择和脚本在内的流水线状态；自动跳转至正确步骤
- **安全加载**——加载已完成的项目不会触发任何新的 API 请求或产生费用
- **浏览器持久化**——Zustand 状态通过 localStorage 在页面刷新后保留

> **重要提示——尽早保存，及时导出：**
>
> 部分视频提供商（包括 Replicate）会在生成后**数小时内从服务器删除视频**。URL 一旦失效，视频将永久消失。请在关闭会话前务必导出 ZIP。
>
> 您也可以**在流水线进行中的任意时刻保存项目 JSON**——无需等到最后。JSON 会将所有已生成的图像嵌入为 base64 数据，无论 CDN 是否过期，图像都会永久保存在文件中。如需中途停止，保存 JSON 后关闭应用，之后加载即可从断点继续——图像不会重新生成，加载时也不会产生任何 API 费用。

### API 密钥
- **保存在 localStorage**——每次会话启动时自动加载至后端，无需重复输入
- **单独清除按钮**——红色清除按钮可立即从 localStorage 和后端移除对应密钥
- **保存前验证**——测试按钮在存储前验证每个密钥是否有效

### 角色基础图像
- **上传参考图像**——在起始页分别上传男性和/或女性角色参考图像（JPG、PNG、WebP，单张最大 10 MB）
- **支持任意角色风格**——瓷器人体模型、写实人物、动漫角色或其他任何风格均可；在可选的**角色风格**文本框中描述风格，模型将按此执行
- **随每个场景发送**——参考图像随每次图像生成请求一同发送，使模型在所有场景中保持角色的比例、肤色和发型一致
- **场景服装始终覆盖**——每个场景仍会从场景规划中获取符合历史时期的服装和姿势；锁定的仅是角色外观
- **模型感知传递**——Nano Banana Pro（Replicate 和 fal）及 Gemini 接收实际图像作为多模态输入；其他模型则接收文本一致性提示
- **随"重新开始"重置**——开始新项目时，角色图像和描述将被清除

### 自定义
- **高级系统提示词**——起始页可展开的区域，包含 7 个流水线阶段的可编辑文本框（故事选择、场景规划、图像提示词、视频提示词、解说脚本、YouTube 元数据、缩略图提示词）
- **预填充默认值**——每个文本框显示当前实际使用的提示词，让您清楚知道需要修改什么
- **重置为默认**——一键恢复任意阶段的原始提示词
- **自定义提示词持久化**——保存至 localStorage，页面刷新后仍然保留

### 导出
- **ZIP 导出**——视频、选中图像、音频、缩略图、解说脚本、元数据和项目 JSON 一键打包下载
- **多选缩略图**——选择一张或多张缩略图导出
- **缩略图灯箱**——点击任意缩略图可全屏查看，并在灯箱中选择/取消选择
- **不依赖元数据生成缩略图**——即使跳过元数据步骤，缩略图生成仍然可用
- **YouTube 元数据**——4 个标题选项、SEO 描述、标签、章节时间戳——导出前均可编辑

### 界面
- **ContentMachine 品牌设计**——简洁深色 UI，页眉显示步骤指示器，GitHub 链接始终可见
- **重新开始**——带确认对话框的红色按钮，安全清除所有进度
- **示例主题**——预填充的故事建议，带年份和类别标签
- **悬停视频预览**——已完成的视频片段可在卡片网格中悬停直接播放
- **视频提示词编辑器**——在重新生成前可编辑任意场景的运镜提示词

---

## 贡献

欢迎提交 PR！以下方向最需要贡献：

- **fal.ai 验证**——端到端测试并修复 fal.ai 图像和视频路径
- **新视频模型**——为 Replicate 或 fal.ai 添加更多视频模型支持
- **新图像模型**——扩展图像提供商和模型列表
- **部署配置**——Docker、Railway、Render 或 Fly.io 配置文件
- **Bug 修复与完善**——使用过程中发现的任何问题

---

## 许可证

基于 [Apache License 2.0](LICENSE) 授权。

---

<div align="center">

由 AI 构建，为 AI 内容创作者服务。

[![GitHub](https://img.shields.io/badge/GitHub-Saganaki22%2FContentMachine-181717?style=flat-square&logo=github)](https://github.com/Saganaki22/ContentMachine)

</div>
