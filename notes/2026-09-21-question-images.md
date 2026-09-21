# 提问中的图文混排

当前部署通过 `queue_user_question` 展示非阻塞问题。`dsh-proactive-questioning` 声明 session 范围的公开单实例插槽 `proactive.question.content`，owner 仅提供 `text`；无贡献时回退到原文。对话增强提供官方 `MarkdownText` 渲染器，不接管问题队列、选择、草稿、发送或持久化。

问题 `question`、新增的 `detail` 和选项 `description` 可显示 Markdown 图片；标签保持短纯文本作为提交值。正文与选项说明允许文字、图片交错；选项说明中的链接及图片不触发选择。标准 HTTP(S) 图片由 Markdown 原语过滤，本地 POSIX/Windows 绝对路径使用现有同源 `/api/file` 鉴权接口，沿用宿主文件权限及大小限制。相对路径、UNC、任意协议和直接 data URL 不扩展为可访问文件。加载失败沿用原语的替代文字。

普通回复已有官方 Markdown 图片渲染，本改动不替换其 renderer。官方阻塞 `ask_user_question` 没有对应内容插槽，本次不接管其 composer。两个第三方插件需要同时更新，旧主动提问版本只会显示原文。源码测试、构建与已安装运行实例分别验收。
