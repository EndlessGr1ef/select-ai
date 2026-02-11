# 截图OCR "Failed to fetch" 问题诊断指南

## 问题现象

- 点击截图识别后，显示"识别中..."一直转圈
- 控制台报错：`Uncaught Error: TypeError: Failed to fetch`
- OCR 识别无法完成

## 可能原因与解决方案

### 1. 语言包未下载 ⭐ 最常见

**原因**: Tesseract.js 需要从 CDN 下载语言包文件（约 20-50MB）

**解决步骤**:
1. 打开扩展设置页面（右键扩展图标 → 选项）
2. 找到"图片文字识别"部分
3. 勾选需要的语言（英语/中文/日语）
4. 点击"下载"按钮，等待语言包下载完成
5. 看到"✓ 已缓存"标记后再使用

**验证方法**:
- 打开浏览器控制台（F12）
- 查看是否有 `[OCR] Language xxx downloaded successfully` 日志

### 2. 网络连接问题

**原因**: 无法访问 Tesseract.js 的 CDN (cdn.jsdelivr.net)

**解决步骤**:
1. 检查网络连接是否正常
2. 尝试访问 https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.1.0/
3. 如果无法访问，可能需要使用代理或等待网络恢复

**临时方案**:
- 使用移动热点或其他网络环境
- 确保防火墙没有屏蔽 jsdelivr.net

### 3. 扩展权限问题

**原因**: 扩展可能没有足够的权限访问网络资源

**解决步骤**:
1. 确认 manifest.json 中包含 `"host_permissions": ["<all_urls>"]`
2. 重新加载扩展
3. 检查浏览器是否显示权限警告

### 4. 浏览器缓存问题

**原因**: 之前的语言包下载可能失败或损坏

**解决步骤**:
1. 打开 Chrome DevTools (F12)
2. 进入 Application → Storage → Clear site data
3. 或在扩展设置页面重新下载语言包

## 调试步骤

### 第一步：检查语言包设置

打开扩展设置页面，检查：
- [ ] OCR 功能已启用
- [ ] 至少选择了一种语言
- [ ] 语言显示"✓ 已缓存"标记

### 第二步：查看控制台日志

1. 打开网页，按 F12 打开开发者工具
2. 切换到 Console 标签
3. 触发截图识别
4. 查看日志输出：

**正常日志**:
```
[ContentApp] Starting OCR recognition...
[ContentApp] OCR settings: {ocrEnabled: true, ocrLanguages: ['eng', 'jpn']}
[OCR] Progress: 0%
[OCR] Progress: 50%
[OCR] Progress: 100%
[ContentApp] OCR result: {text: "...", confidence: 85}
```

**异常日志**:
```
[OCR] Failed to fetch worker script: ...
[ContentApp] Screenshot OCR failed: TypeError: Failed to fetch
```

### 第三步：检查网络请求

1. 在 DevTools 切换到 Network 标签
2. 触发截图识别
3. 查看是否有失败的请求（红色）
4. 特别关注 `.traineddata` 文件的请求

### 第四步：手动测试语言包下载

在控制台执行：
```javascript
fetch('https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.1.0/eng.traineddata.gz')
  .then(r => console.log('Success:', r.ok))
  .catch(e => console.error('Failed:', e))
```

如果失败，说明无法访问 CDN。

## 解决方案汇总

| 问题 | 解决方案 | 预计时间 |
|------|----------|----------|
| 语言包未下载 | 在设置页面下载 | 30秒-2分钟 |
| 网络连接问题 | 更换网络或使用代理 | 即时 |
| 浏览器缓存 | 清除缓存并重新下载 | 1分钟 |
| 扩展权限 | 重新加载扩展 | 即时 |

## 常见错误信息对照表

| 错误信息 | 含义 | 解决方法 |
|---------|------|---------|
| `Failed to fetch` | 网络请求失败 | 检查网络，下载语言包 |
| `语言包未找到` | 未选择语言或未下载 | 在设置页面下载语言包 |
| `语言包加载失败` | CDN 无法访问 | 更换网络环境 |
| `未识别到文字` | 图片质量问题 | 选择清晰文字区域 |

## 推荐配置

**基础配置**（适合大多数用户）:
- ✅ 英语 (English) - 20MB
- ✅ 简体中文 (Chinese) - 50MB

**完整配置**（支持多语言）:
- ✅ 英语 (English) - 20MB
- ✅ 日语 (Japanese) - 50MB
- ✅ 简体中文 (Chinese) - 50MB

总下载量: 约 120MB

## 性能优化建议

1. **只下载需要的语言**: 减少加载时间和存储空间
2. **首次使用先下载**: 避免在识别时才下载导致长时间等待
3. **定期清理缓存**: 如果发现识别速度变慢

## 仍然无法解决？

请提供以下信息：

1. **控制台完整错误日志**
2. **Network 标签中失败的请求**
3. **扩展设置页面截图**（显示语言包状态）
4. **操作系统和 Chrome 版本**

---

**更新日期**: 2026-02-09
