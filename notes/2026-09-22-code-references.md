# 正文代码定位

对话增强通过已记录的 systemPrompt.section 告知 Agent 显式链接格式，提供 chatCodeReferences 瞬时导航服务；Markdown 增强 0.1.5 消费该服务。点击使用公开 sidebarRight.openResourceIn，文档正文通过公开 keyed slot 替换，保留原文件标签页与 CodeBlock。

末行用于驱动原分页读取；读取后滚动至起始行，主题高亮默认 1600 毫秒。高亮时长使用设置 schema 限定为 100–10000 毫秒，计时器随目标变更或卸载释放，重复点击分配新 revision。地址包含会话身份，网页链接不进入文件导航。

单元测试覆盖路径转义、范围解析、地址隔离和重复点击。Markdown 插件浏览器测试使用真实 CodeBlock 覆盖指定行颜色、滚动、自动恢复与键盘再次触发；安装后验收原预览器。
