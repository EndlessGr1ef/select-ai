# Select AI - AI划词解释🎯

<div align="center">

**AI-powered 划词搜索工具 | 选中即解释 | 上下文感知**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg)]()
[![English](https://img.shields.io/badge/English-README-blue)](README.en.md)

</div>
<div align="center">

![Demo](demo.gif)

</div>

## ✨ 特性

| 特性 | 描述 | 适用场景 |
|------|------|----------|
| 🎯 **智能划词** | 选中文字自动弹出悬浮按钮，点击即可查询 | 随时随地获取解释 |
| 🧠 **上下文感知** | 自动提取周围 500-3000 字符上下文，AI 理解更准确 | 专业术语、复杂句子 |
| 🌐 **多语言支持** | 支持中文、英语、日语、韩语输出 | 外文阅读、学习 |
| 🔌 **多 API 支持** | MiniMax / OpenAI / Claude / DeepSeek / 自定义 API | 灵活部署、自建服务 |
| 💬 **Markdown 渲染** | AI 返回内容以优雅的 Markdown 格式展示 | 清晰的阅读体验 |
| 🔒 **隐私优先** | API Key 本地存储，不收集用户数据 | 安全使用 |

## 📖 为什么选择 Select AI？

| 传统词典 | Select AI |
|----------|-----------|
| 只能查单词/短语 | 整段翻译解释，理解更全面 |
| 词库有限，更新滞后 | AI 实时理解，覆盖面更广 |
| 无上下文支持 | 自动获取上下文，专业术语也能懂 |
| 功能单一 | 支持多语言、多模型、个性化配置 |
| 付费订阅制 | 完全免费，无隐藏费用 |
| 数据上传云端 | 本地处理，安全无忧 |

## 🚀 快速开始

### 1. 安装依赖

```bash
cd select-ai
pnpm install
```

### 2. 构建扩展

```bash
pnpm build
```

### 3. 在 Chrome 中加载

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的 **"开发者模式"**
3. 点击 **"加载已解压的扩展程序"**
4. 选择 `select-ai/dist` 目录

### 4. 配置 API

1. 点击扩展图标
2. 进入 **"设置"** 配置你的 API Key
3. 可自定义 API 端点和模型

## 🔧 开发

```bash
# 开发模式（热更新）
pnpm dev

# 构建生产版本
pnpm build

# 类型检查
pnpm type-check
```

## 💻 使用方法

1. 在任意网页中选中一段文字
2. 点击出现的粉紫色悬浮按钮
3. 等待 AI 分析并查看解释结果

## 🔌 支持的 API

该扩展兼容任意 Anthropic 格式的 API：

| Provider | 默认模型 | 说明 |
|----------|----------|------|
| **MiniMax** | MiniMax-M2.1 | 默认配置，开箱即用 |
| **OpenAI** | GPT-4o | 兼容 GPT 系列模型 |
| **Anthropic Claude** | Claude 3.5 | 兼容 Claude 系列模型 |
| **DeepSeek** | DeepSeek Chat | 兼容 DeepSeek 系列模型 |
| **自定义** | - | 任何兼容 Anthropic 格式的 API |

## 🛠️ 技术栈

<div align="center">

✨ **React 19** + TypeScript
⚡ **Vite 7** + HMR
🔒 **Manifest V3**
📦 **@crxjs/vite-plugin**
🎨 **Tailwind CSS 4**
📱 **Chrome Extension**

</div>

## 📁 项目结构

```
select-ai/
├── src/
│   ├── main.tsx              # 弹出窗口入口
│   ├── App.tsx               # 弹出窗口 UI
│   ├── background/
│   │   └── index.ts          # Service Worker（API 请求处理）
│   ├── content/
│   │   ├── index.tsx         # 内容脚本入口
│   │   ├── ContentApp.tsx    # 划词浮层 UI
│   │   └── content.css       # 内容脚本样式
│   ├── options/
│   │   ├── index.tsx         # 设置页面入口
│   │   └── OptionsApp.tsx    # 设置页面 UI
│   └── utils/
│       ├── ContextExtractor.ts  # 上下文提取算法
│       ├── i18n.ts              # 多语言文案
│       └── language.ts          # 语言检测
├── public/
│   └── icon.svg              # 扩展图标
├── manifest.json             # 扩展配置
├── vite.config.ts            # Vite 构建配置
└── package.json              # 依赖配置
```

## 🤝 贡献

欢迎贡献代码、提交 Issue 或提出建议！

- 🐛 发现 Bug？请 [提交 Issue](https://github.com/yourusername/select-ai/issues)
- 💡 有新想法？请 [提交 Feature Request](https://github.com/yourusername/select-ai/issues)
- 🔧 想贡献代码？请 Fork 后提交 PR

## 📝 常见问题

**Q: 为什么扩展没有响应？**
A: 请确保已在设置中配置了有效的 API Key。

**Q: 为什么没有出现悬浮按钮？**
A: 检查页面是否有内容脚本限制。部分网站（如 `chrome://` 页面）无法注入内容脚本。

**Q: 支持哪些 API？**
A: 支持 MiniMax、OpenAI、Anthropic Claude、DeepSeek，以及任何兼容 Anthropic 格式的自定义 API。

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

<div align="center">

**如果这个项目对你有帮助，欢迎点亮 Star ⭐**

</div>
