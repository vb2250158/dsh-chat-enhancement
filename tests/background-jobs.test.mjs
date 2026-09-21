import assert from 'node:assert/strict'
import test from 'node:test'
import { backgroundJobDescriptions, backgroundJobDuration, orderedBackgroundJobs } from '../src/background-jobs.js'

const job = { id: 'pwsh-1', kind: 'pwsh', label: 'Get-Process', startedAt: 100, status: 'running' }
const result = (description = '检查运行进程') => ({ kind: 'tool-result', isError: false, time: 110, callTime: 90, call: { name: 'pwsh', argsRaw: JSON.stringify({ command: job.label, description, run_in_background: true }) }, content: [{ type: 'text', text: 'started background job pwsh-1' }] })

test('后台任务从确切的启动结果关联说明，同名命令不串任务', () => {
  const jobs = [job, { ...job, id: 'pwsh-2' }]
  const labels = backgroundJobDescriptions([result()], jobs)
  assert.equal(labels.get('pwsh-1'), '检查运行进程')
  assert.equal(labels.has('pwsh-2'), false)
  const bash = { ...job, id: 'bash-1', kind: 'bash' }
  const node = result('构建项目')
  node.call.name = 'bash'
  node.content[0].text = 'started background job bash-1'
  assert.equal(backgroundJobDescriptions([node], [bash]).get('bash-1'), '构建项目')
})

test('缺失、失败、旧进程记录和无法解析的描述保留命令', () => {
  for (const node of [
    result(' '), { ...result(), isError: true }, { ...result(), time: 99 },
    { ...result(), callTime: 101 }, { ...result(), callTime: null }, { ...result(), call: null },
    { ...result(), call: { name: 'pwsh', argsRaw: '{' } },
    { ...result(), content: [{ type: 'text', text: 'log: started background job pwsh-1' }] },
    { ...result(), call: { name: 'pwsh', argsRaw: JSON.stringify({ command: 'other', description: 'wrong', run_in_background: true }) } },
  ]) assert.equal(backgroundJobDescriptions([node], [job]).size, 0)
  assert.equal(backgroundJobDescriptions(undefined, [job]).size, 0)
  assert.equal(backgroundJobDescriptions([result()], []).size, 0)
})

test('列表保留运行优先和结束任务倒序；结束后耗时冻结', () => {
  const completed = { ...job, id: 'pwsh-2', status: 'completed', finishedAt: 3100 }
  const failed = { ...completed, id: 'pwsh-3', status: 'failed', finishedAt: 4100 }
  assert.deepEqual(orderedBackgroundJobs([completed, failed, job]).map(item => item.id), ['pwsh-1', 'pwsh-3', 'pwsh-2'])
  const t = (key, data) => JSON.stringify({ key, ...data })
  assert.equal(backgroundJobDuration(completed, 999999, t), backgroundJobDuration(completed, 3100, t))
  assert.equal(JSON.parse(backgroundJobDuration(job, 62100, t)).minutes, 1)
  assert.equal(JSON.parse(backgroundJobDuration(job, 3600100, t)).hours, 1)
})
