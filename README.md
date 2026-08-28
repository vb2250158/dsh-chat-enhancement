# DSH Chat Enhancement

公开的 DSH 浏览器插件。它为 `read_image` 工具的受管图片附件提供聊天内缩略图和点击后的全屏预览。

## 范围

- 只读取该会话日志中已经记录的 DSH 附件 ID。
- 浏览器通过会话授权的 `readAttachment` 获取字节，并在内存中创建、释放 `blob:` URL。
- 不读取 `file://`，不直接访问本机或 NAS 路径，不保存文件内容或个人配置。

PDF、Markdown、音频和视频需要各自受管的附件或流读取协议；在有可验证的 Host 通道前，本插件不宣称支持它们。

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
