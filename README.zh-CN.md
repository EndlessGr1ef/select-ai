# Select AI

一个智能划词搜索 Chrome 扩展，具有上下文感知功能。选中网页上的文字即可获得即时 AI 解释。

[English](./README.md)

## 功能特性

- 🎯 **即时搜索** - 选中文字后点击浮动按钮获取 AI 解释
- 🧠 **上下文感知** - 自动提取周围上下文以获得更好的理解
- 🌍 **多语言支持** - 支持中文、英文、日文、韩文输出
- ⚙️ **可配置 API** - 自定义 API 端点和模型
- 💬 **Markdown 渲染** - 优美的 Markdown 格式响应

## 安装方式

### 开发者模式（推荐）

1. **构建扩展**
   ```bash
   cd select-ai
   pnpm install
   pnpm build
   ```

2. **在 Chrome 中加载**
   - 打开 Chrome，访问 `chrome://extensions/`
   - 开启右上角的 **"开发者模式"**
   - 点击 **"加载已解压的扩展程序"**
   - 选择 `select-ai/dist` 目录

3. **配置 API**
   - 点击扩展图标
   - 进入"设置"配置你的 API Key
   - 可自定义 API 端点和模型

### 开发模式

```bash
cd select-ai
pnpm install
pnpm dev
```

在 Chrome 中加载 `dist` 目录，修改代码后会自动热更新。

## 使用方法

1. 在任意网页中选中一段文字
2. 点击出现的浮动按钮
3. 等待 AI 分析并查看解释结果

## 技术栈

- React 19 + TypeScript
- Vite 7
- Chrome Extension Manifest V3
- Tailwind CSS 4
- Lucide React（图标）

## 项目结构

```
select-ai/
├── src/
│   ├── main.tsx             # 弹出窗口入口
│   ├── App.tsx              # 弹出窗口 UI
│   ├── background/          # Service Worker
│   ├── content/             # 内容脚本（划词功能）
│   ├── options/             # 设置页面
│   └── utils/               # 工具函数
├── public/                  # 静态资源
├── dist/                    # 构建输出
├── manifest.json            # 扩展配置
└── vite.config.ts           # Vite 配置
```

## API 配置

该扩展适用于任何兼容 Anthropic 格式的 API：

- Anthropic Claude
- MiniMax（默认）
- OpenAI 兼容 API

## 常见问题

### Q: 为什么扩展没有响应？
请确保已在设置中配置了有效的 API Key。

### Q: 为什么没有出现浮动按钮？
检查页面是否有内容脚本限制。部分网站（如 chrome:// 页面）无法注入内容脚本。

### Q: 支持哪些 API？
任何兼容 Anthropic 格式的 API 都支持。

## 许可证

MIT
