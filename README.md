# MakingLovart

本项目是一个本地优先的 AI 创作白板原型，目标是做出接近 Lovart 的创作体验：左侧图层与工具，中间无限画布，底部主 Prompt 输入框，右侧轻量生成与历史面板。

当前版本已经以白板模式为主，不再把节点工作流当作主入口。项目仍然处在快速迭代阶段，适合继续开发和验证产品方向，不适合直接当成“已完成的生产级应用”使用。

![MakingLovart preview](show.jpg)

## 当前版本定位

- 白板为核心工作区
- AI 生图 / 生视频 / Prompt 润色已接入基础能力
- 支持将白板元素通过 `@` 引用到主输入框
- 支持右侧导入参考图、自动保存历史生成内容到本地、并拖回白板
- API 配置、模型偏好、图层管理、素材库、基础多画板切换已经有可用版本

## 当前已实现

### 1. 白板与编辑

- 无限画布的平移与缩放
- 图片、视频、文字、形状、箭头、线条、自由绘制
- 选中、移动、缩放、删除、复制、编组、图层顺序调整
- 左侧图层面板与工具栏
- 多画板切换
- 撤销 / 重做

### 2. 底部主输入框

- 浅色大输入区，自动根据文本高度伸缩
- 简洁的底部功能栏，按 `模式 / 模型 / LLM 润色 / 更多` 展开
- 支持 `@` 引用当前白板元素
- 支持保存常用提示词
- 支持角色锁定入口

### 3. AI 能力

- `LLM 润色`
  - 已接入基础路由
  - 可根据所选文本模型走不同 provider
- `图片生成`
  - Google `gemini / imagen`
  - OpenAI `dall-e-3`
  - Stability `sdxl`
- `视频生成`
  - 当前稳定支持 Google `veo`
- `参考图生成 / 白板元素组合生成`
  - 当前优先支持 Google 路线
- `首尾帧`
  - 已有模式入口与命名逻辑
  - 还不是完整的专用双帧视频工作流

### 4. 右侧面板

- 轻量生成区
- 导入参考图
- 自动保存本地历史生成内容
- 历史结果可直接拖拽回白板
- 素材库面板可查看与拖拽已有素材

### 5. 设置系统

- 保存 API Key
- 为一个 API Key 指定能力：
  - `LLM`
  - `图片`
  - `视频`
  - `Agent`
- 设置文本 / 图片 / 视频 / Agent 默认模型
- 基础外观设置与画布设置

## 当前能力边界

这部分很重要，下面这些是当前版本真实存在的限制：

- 视频生成目前只稳定支持 Google `veo`
- 白板元素参考生成、`@` 引用参考生成、图像编辑，目前主要依赖 Google 路线
- `首尾帧` 现在还是“白板端入口 + 图片命名”的阶段，不是完整的时间轴 / 双帧视频管线
- 多 provider 路由刚刚接上，仍然需要继续补全异常处理、能力校验和更细的 provider 适配
- 画板数据目前还没有完整的项目级持久化方案，仍以浏览器本地临时状态为主
- 素材库、API Key、生成历史主要用 `localStorage`
- 代码里仍然有一部分历史遗留组件和乱码文案，需要继续清理

## 技术栈

- React 19
- TypeScript
- Vite 6
- `@google/genai`
- Tiptap 相关依赖仍在仓库中
- 本地存储当前以 `localStorage` 为主

## 快速启动

### 环境要求

- Node.js 18+
- npm 9+

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

默认配置当前仍是 Vite 开发模式。如果你本机的 `3000` 端口存在权限或占用问题，可以手动指定：

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

### 打包

```bash
npm run build
```

### 本地预览构建结果

```bash
npm run preview
```

## API 配置方式

推荐直接在应用内配置：

1. 启动项目
2. 打开右上角设置
3. 新增 API Key
4. 勾选这个 Key 用于哪些能力：`LLM / 图片 / 视频 / Agent`
5. 再设置默认文本模型、图片模型、视频模型

当前实际建议：

- `LLM 润色`：优先配 Google / OpenAI / Anthropic / Qwen
- `图片生成`：优先配 Google / OpenAI / Stability
- `视频生成`：优先配 Google
- `Agent`：如果你要继续使用 Banana 相关能力，再配置 Banana

## 当前推荐用法

### 生图

1. 在底部输入框输入 Prompt
2. 通过 `模型` 面板选择图片模型
3. 点击 `生成`

### 白板元素组合生成

1. 在主输入框里输入 `@`
2. 选择白板中的一个或多个元素
3. 补充描述
4. 点击 `生成`

### 参考图生成

1. 在右侧面板导入图片
2. 输入描述
3. 点击生成
4. 生成结果会自动保存到右侧历史区

### Prompt 润色

1. 底部点击 `LLM 润色`
2. 选择润色模式
3. 选择 LLM 模型
4. 点击润色并应用结果

## 目录结构

```text
.
|-- App.tsx
|-- index.tsx
|-- components/
|   |-- PromptBar.tsx
|   |-- RightPanel.tsx
|   |-- CanvasSettings.tsx
|   |-- Toolbar.tsx
|   |-- LayerPanelMinimizable.tsx
|   |-- BoardPanel.tsx
|   |-- NodeWorkflowPanel.tsx        # 仍在仓库中，但不是当前主入口
|   `-- ...
|-- services/
|   |-- geminiService.ts
|   |-- bananaService.ts
|   `-- aiGateway.ts
|-- utils/
|   |-- assetStorage.ts
|   |-- generationHistory.ts
|   `-- fileUtils.ts
|-- types.ts
|-- translations.ts
`-- README.md
```

## 已知问题

- 仍有部分中文文案编码异常
- `App.tsx` 仍然偏大，状态和流程耦合较重
- 右侧面板与底部主输入框的能力分工还可以继续收敛
- Vite 构建仍有大包警告，需要后续拆包

## 下一步方向

- 把 `首尾帧` 做成真正独立的视频创作流程
- 把多 provider 能力路由继续补全
- 重构 `App.tsx`，拆出更清晰的 store / service / panel 结构
- 把本地存储从 `localStorage` 逐步迁到更稳的方案
- 完善导出、项目保存、作品管理

## 参考文档

- [DOCKER_GUIDE.md](DOCKER_GUIDE.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [REVIEW.md](REVIEW.md)

## License

MIT
