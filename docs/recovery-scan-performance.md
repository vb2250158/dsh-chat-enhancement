# 中断记录检查

启动扫描串行调用 `sessionQuery.observeSession(..., { projectionMode: 'none' })`。冷读取仍包含日志解压、解析和 Session 恢复校验；默认 5 项完整历史缓存无法容纳 1221 项扫描。恢复资格只需要最后轮次，原实现却多次筛选和复制整个事件数组。

0.3.61 默认使用 4 个只读工作者，保留每项超时、逐项失败重试和句柄释放。取消时收束全部工作者，迟到观察仍由原等待者释放。候选按列表顺序整理后才进入原恢复流程；根会话反向遍历最后轮次，子会话继续读取自己的模式记录。并发度可配置为 1–16，避免无界加载完整历史。

1221 个固定合成会话，每项模拟 2 ms 异步读取；实际 Windows 定时器分辨率使单项等待长于请求值。Node 24.15.0 的三次完整扫描测量如下，包含列表、读取、资格判断、释放和进度更新，不包含磁盘解压或浏览器绘制。

| 样本 | 原串行 | 4 路并行 |
| --- | ---: | ---: |
| 1 | 22325 ms | 5193 ms |
| 2 | 20690 ms | 5665 ms |
| 3 | 22355 ms | 5455 ms |

中位数从 22325 ms 降至 5455 ms，约 4.09 倍。每次均完成 1221 次读取及释放，并行峰值为 4。确定性测试检查并行上限、候选顺序、最早等待项、取消后释放，以及根会话不访问旧轮次；原串行实现无法满足并行断言，原数组筛选会触发旧轮次访问探针。

保持原有数据校验和恢复前重新核验。未增加跨重启摘要缓存：当前公共 revision 只保证同一持久化服务实例内可比，已有投影检查点可能落后于日志。后续摘要索引应由日志拥有者提供可核验的当前序号和增量更新，不能把旧“已完成”摘要当作最新状态。

# Interruption scans

The original startup scan serially observed every session, including cold decompression, parsing and restore validation. The five-entry full-history cache does not cover a 1221-session corpus. Version 0.3.61 bounds read concurrency to four, checks root-session final turns backwards and preserves original recovery ordering, individual timeouts, retries and disposal. Configuration accepts 1–16 workers.

Three synthetic 1221-session samples with a requested 2 ms asynchronous read delay measured 22325/20690/22355 ms before and 5193/5665/5455 ms after under Node 24.15.0 on Windows. The median improved by 4.09 times. Both versions completed and disposed every observation. These timings include scan orchestration and eligibility but exclude real disk decoding and browser rendering. Tests enforce concurrency, cancellation cleanup, ordering and bounded root-history traversal.

No cross-restart summary cache is introduced: persistence revisions are comparable only within the same service instance, and projection checkpoints may lag the log. A future index requires a current-log watermark and incremental updates from the log owner. Resumption still revalidates the original session.
