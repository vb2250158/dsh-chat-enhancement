# DSH Chat Enhancement

公开的 DSH 插件，为聊天中的媒体和 Markdown 文件提供页内预览。

## 范围

- `show_image` 将工作区内的图片保存为 DSH 受管附件，Agent 可主动向用户展示结果。
- `show_video` 在当前 DSH 进程中暂存 MP4/WebM，并以会话绑定的随机令牌供聊天端播放；浏览器不会得到原始路径。
- 两个展示工具均声明显式对象根 JSON Schema，兼容要求标准工具参数结构的模型提供商。
- 聊天内的 `.md` / `.markdown` 文件芯片（包括已生成文件和文件引用）点击后显示页内 Markdown 预览，不再交给本机默认应用。
- 连续三项及以上工具调用和上下文注入默认折叠为一行执行摘要；只收起较早记录，最新一项无论运行中或已完成都保留在摘要后面，下一项出现后才并入摘要。展开后保留 DSH 原有工具卡片、参数、输出、媒体预览和子调用，不替换官方工具渲染器。
- 连续三项及以上思考跨聊天渲染容器合并为一组，摘要展开状态按聊天流稳定保存，最新一项始终显示在摘要后面。
- 图片和视频展示卡不参与折叠，始终留在聊天中；其前后的普通工具调用仍可收起。
- Markdown 预览只读取当前活跃会话工作目录内的常规 UTF-8 文件；路径穿出工作目录、非 Markdown 文件和超限内容都会被拒绝。
- 只读取该会话日志中已经记录的 DSH 附件 ID。
- 浏览器通过会话授权的 `readAttachment` 获取字节，并在内存中创建、释放 `blob:` URL。
- 不读取 `file://`，不直接访问本机或 NAS 路径，不保存文件内容或个人配置。

视频缓存仅在 DSH 运行期间有效，且默认单文件上限为 50 MiB。Markdown 默认读取上限为 2 MiB。可通过该插件的 `maxVideoBytes`、`maxMarkdownBytes` 配置调整；不要把本机路径、NAS 路径或凭据写入共享配置。插件通过 `./typert` 为媒体和 Markdown 读取导出严格的 Host Remote 描述，预览服务在根 Host 上下文完成注册；已存在和后续打开的会话均通过相同的 Host 端点读取预览数据。PDF 和音频仍需要各自受管的读取协议。

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
