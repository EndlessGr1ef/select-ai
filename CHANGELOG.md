# Changelog / 更新日志

## [0.3.4] - 2026-01-21

### Added / 新增
- API connection test in settings / 设置页新增 API 连接测试

### Changed / 改进
- Improved language detection and response formatting / 优化语言检测与回答格式
- Show error messages directly in results / 错误信息直接展示在结果中

### Fixed / 修复
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
