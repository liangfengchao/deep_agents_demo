/**
 * ASGI 子 Agent：数据分析师
 * graphId 需与 langgraph.json / AsyncSubAgent.graphId 一致：data_analyst
 */

import { createDeepAgent } from 'deepagents';
import { createLLM } from '../utils/config.js';

export const graph:any = createDeepAgent({
  model: createLLM(),
  name: 'data_analyst',
  systemPrompt: `你是专业数据分析师。职责：
- 分析用户提供的数据
- 提取关键指标和趋势
- 给出数据驱动的洞察和建议

请用简洁的中文回答。`,
});
