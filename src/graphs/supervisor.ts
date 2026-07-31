/**
 * 主协调 Agent（同部署 ASGI + 可选远程 HTTP）
 */

import { createDeepAgent, type AsyncSubAgent } from 'deepagents';
import { createLLM } from '../utils/config.js';

const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || 'http://localhost:8001';

const asyncSubagents: AsyncSubAgent[] = [
  {
    name: 'asgi_data_analyst',
    description: '同进程 ASGI 数据分析师，擅长数据分析和洞察提取',
    graphId: 'data_analyst', // 对应 langgraph.json 中的 graphs.data_analyst
  },
  {
    name: 'remote_report_writer',
    description: '远程报告撰写专家，擅长撰写结构化报告',
    graphId: process.env.REMOTE_REPORT_WRITER_ID || 'report_writer',
    url: AGENT_SERVER_URL,
  },
];

export const graph:any = createDeepAgent({
  model: createLLM(),
  name: 'supervisor',
  systemPrompt: `你是任务协调者：理解需求，把任务委派给合适的子 Agent，整合结果后用简洁中文回答用户。
可并行委派，拿到结果后再汇总。`,
  subagents: asyncSubagents,
});
