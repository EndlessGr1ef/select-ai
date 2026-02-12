# Changelog / 更新日志

## [0.4.3] - 2026-02-12

### Added / 新增
- **Image OCR Recognition** - Right-click on any image to extract text and get AI explanation / **图片OCR识别** - 右键任意图片提取文字并获得AI解释
- **Screenshot OCR** - Select any area on screen to capture and recognize text / **截图识别** - 选择屏幕任意区域截图并识别文字
- Multi-language OCR support (Japanese, English, Simplified Chinese) / 多语言OCR支持（日语、英语、简体中文）
- OCR language pack download with progress indicator / OCR语言包下载带进度指示器
- OCR settings panel in options page / 设置页面新增OCR设置面板

### Changed / 改进
- Added `contextMenus` and `notifications` permissions for right-click menu / 添加右键菜单所需的权限
- Added `web_accessible_resources` for Tesseract.js worker files / 添加Tesseract.js工作文件资源访问配置
- Improved extension context validation to prevent "Extension context invalidated" errors / 改进扩展上下文验证，防止"Extension context invalidated"错误

---

## [0.4.0] - 2026-01-30

### Added / 新增
- Explanation detail level option (concise/standard/detailed) / 解释详细程度选项（简洁/标准/详细）
- API connection test in settings / 设置页新增 API 连接测试
- Zip build script for distribution / 新增 zip 打包脚本

### Changed / 改进
- Enhanced panel auto-positioning with better viewport handling / 优化面板自动定位，更好处理视口边界
- Added hover delay for trigger dot / 触发点增加悬停延迟
- Improved drag and resize behavior / 改进拖拽和调整大小行为
- Replaced text badge with app icon in panel header / 面板头部文字徽章替换为应用图标
- Updated application icons / 更新应用图标
- Increased context token limits (default 5000, max 50000) / 提高上下文 token 限制（默认 5000，最大 50000）
- Refactored config module to src/config directory / 配置模块重构到 src/config 目录
- Refactored translation panel sizing and selection logic / 重构翻译面板尺寸和选择逻辑
- Improved language detection / 优化语言检测
- Updated documentation / 更新文档

### Fixed / 修复
- Sanitized API keys to prevent HTTP header issues with non-ASCII characters / 清理 API 密钥非 ASCII 字符，防止 HTTP 头问题
- Safe postMessage handling for port disconnects / 断开连接时的消息发送保护

---

## [0.3.3] - 2026-01-21

### Added / 新增
- Kana ruby toggle for Japanese kanji / 日语汉字假名标注开关
- Original text TTS / 原文朗读（TTS）
- Configurable context length (max_tokens) / 可配置上下文长度（max_tokens）

### Changed / 改进
- Increased context max tokens and improved extraction / 提升上下文最大长度与抽取优化

---

## [0.3.2] - 2026-01-20

### Fixed / 修复
- Fixed translation button loading effect and animation / 修复翻译按钮 Loading 加载效果与动画
- Corrected streaming translation Promise lifecycle / 修正流式翻译 Promise 生命周期
- Resolved CSS animation naming conflicts / 解决 CSS 动画命名冲突
- Fixed state synchronization issues in translation / 修复翻译状态同步问题

### Changed / 改进
- Improved floating button visibility and UI responsiveness / 提升悬浮按钮可见性与 UI 响应速度
- Optimized bilingual translation display logic / 优化双语翻译显示逻辑

---

## [0.3.1] - 2026-01-19

### Changed / 改进
- Internal code optimizations and version preparation / 内部代码优化与版本准备

---

## [0.3.0] - 2026-01-17

### Added / 新增
- Global translation feature with floating button / 全局翻译功能，带悬浮按钮
- Full-page or selected text translation / 支持全页或选中文本翻译
- Bilingual translation display (original + translation) / 双语翻译显示（原文+译文）
- Streaming AI response output / 流式 AI 响应输出
- Support for OpenAI and Anthropic stream formats / 支持 OpenAI 和 Anthropic 流式格式
- Content priority-based translation / 基于内容优先级的翻译
- Blacklist for excluding certain elements / 黑名单功能排除特定元素

### Changed / 改进
- Internationalized all code comments to English / 将所有代码注释国际化为英文
- Updated 7 files with 100+ comment translations / 更新了 7 个文件中的 100+ 条注释翻译
- Improved code maintainability and international collaboration / 提升代码可维护性和国际化协作

---

## [0.2.0] - 2026-01-10

### Added / 新增
- DeepSeek provider support / DeepSeek 提供商支持
- Text-to-speech functionality / 语音合成功能
- Show/hide API key toggle / API 密钥显示切换

### Fixed / 修复
- Provider switching issues / 修复提供商切换问题

---

## [0.1.0] - 2026-01-09

### Added / 新增
- Initial release / 首次发布
- Text selection AI search / 文本选择 AI 搜索
- Three LLM providers / 三种 LLM 提供商
- Multi-language support / 多语言支持
