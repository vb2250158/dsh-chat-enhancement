# DSH Chat Enhancement

公开的 DSH 插件。它为 `read_image` 和 Agent 可调用的 `show_image` 提供聊天内缩略图和点击后的全屏预览。

## 范围

- `show_image` 将工作区内的图片保存为 DSH 受管附件，Agent 可主动向用户展示结果。
- 只读取该会话日志中已经记录的 DSH 附件 ID。
- 浏览器通过会话授权的 `readAttachment` 获取字节，并在内存中创建、释放 `blob:` URL。
- 不读取 `file://`，不直接访问本机或 NAS 路径，不保存文件内容或个人配置。

视频预览会继续在本插件中实现，但需要独立的受管流读取协议；不会通过 `file://` 或将视频字节塞进模型上下文来绕过该限制。PDF、Markdown 和音频同理。

## 安装

```powershell
pnpm dsh plugin --profile web add github:vb2250158/dsh-chat-enhancement#<commit>
```

安装后重启 DSH。私有插件索引应固定提交，不要使用浮动分支。

## 验证

```powershell
npm test
node --check lib/client.js
npm pack --dry-run
```

## 许可证

MIT。
