# Language preference and drift reminders

Status: implemented behavior, with further tuning left for separate review. This document supersedes an earlier machine-specific investigation; its private transcript and measurements remain outside the public repository.

The plugin resolves the selected language through `src/languages.js` and registers its system instruction in `src/index.js`. The language-anchor modes are `onDrift`, `always` and `off`. Current implementation uses the existing plugin-sourced message path; the source and regression tests own the exact hook and inbox APIs, rather than historical line numbers in a proposal.

A reminder is an instruction to the model, not a guarantee about its response. It must be reconstructable in the Session log. Improvements should measure visible output against synthetic fixtures, preserve the user's automatic-language setting and avoid injecting reminders merely because a quoted document or code sample uses another language.

Future changes require focused tests for drift detection, short text, mixed-language quotations, automatic mode and repeated reminders. Do not run tests against a user's conversations, endpoints or credentials.

## 中文

当前语言设置和漂移提醒已在 `src/languages.js`、`src/index.js` 实现；行为以源码与回归测试为准。本文件替代旧的本机调查记录，私人会话及测量数据不公开。提醒只是模型指令，不能保证输出语言；后续优化使用合成样例验证漂移、短文本、引用、自动模式与重复提醒，并保留会话日志可重建性。
