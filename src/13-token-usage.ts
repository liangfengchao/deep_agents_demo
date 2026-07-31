/**
 * Demo 13: 上下文 Token 分桶统计（中间件）
 *
 * 通过 createTokenBudgetMiddleware，在每次模型调用结束后对本次请求分桶统计。
 */

import 'dotenv/config';
import { createDeepAgent, type AsyncSubAgent } from 'deepagents';
import { tool } from 'langchain';
import { z } from 'zod';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';
import {
  createTokenBudgetMiddleware,
  formatContextTokenReport,
} from './utils/token-budget.js';

const getWeather = tool(
  async ({ city }: { city: string }) => `模拟天气: ${city} 晴 22°C`,
  {
    name: 'get_weather',
    description: '获取指定城市的天气信息',
    schema: z.object({ city: z.string().describe('城市名称') }),
  },
);

const githubSearch = tool(
  async ({ query }: { query: string }) => `模拟 GitHub 搜索: ${query}`,
  {
    name: 'github_search_repos',
    description: '通过 MCP 连接器搜索 GitHub 仓库',
    schema: z.object({ query: z.string().describe('搜索关键词') }),
  },
);

const dbQuery = tool(
  async ({ sql }: { sql: string }) => `模拟 SQL 结果: ${sql}`,
  {
    name: 'database_query',
    description: '通过 MCP 数据库连接器执行只读 SQL',
    schema: z.object({ sql: z.string().describe('SQL 语句') }),
  },
);

const asyncSubagents: AsyncSubAgent[] = [
  {
    name: 'data_analyst',
    description: '数据分析师，擅长指标与趋势分析',
    graphId: 'data_analyst',
    url: process.env.LANGGRAPH_URL || 'http://localhost:2024',
  },
];

async function main() {
  logger.divider();
  logger.info('Demo 13: Token 分桶统计（TokenBudgetMiddleware）');
  logger.divider();

  logger.step(1, '创建 TokenBudgetMiddleware 并挂到 DeepAgent');
  const tokenBudget = createTokenBudgetMiddleware({
    // 这两项按 MCP/连接器记账，其余 tools 归「工具及智能体」
    mcpToolNames: ['github_search_repos', 'database_query'],
    log: true,
  });

  const agent = createDeepAgent({
    model: createLLM(0),
    systemPrompt:
      '你是中文助手。查天气用 get_weather；需要开源信息再用 GitHub 工具。回答简洁。',
    tools: [getWeather, githubSearch, dbQuery],
    subagents: asyncSubagents as any,
    skills: ['./skills'],
    middleware: [tokenBudget],
  });

  logger.step(2, '调用 Agent（中间件在每次模型调用结束后自动统计）');
  const result = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: '查一下北京天气，并用一句话解释什么是 token。不要调用子 Agent。',
      },
    ],
  });

  const last = result.messages[result.messages.length - 1];
  const reply =
    typeof last?.content === 'string'
      ? last.content
      : JSON.stringify(last?.content ?? '');
  logger.result('Agent 回复', reply.slice(0, 500));

  logger.step(3, '读取中间件累计结果');
  logger.info(`模型调用次数: ${tokenBudget.getCallCount()}`);
  const report = tokenBudget.getLastReport();
  if (report) {
    logger.result('最后一次模型调用结束后上下文', formatContextTokenReport(report));
  }

  logger.info(`
分桶来源（均来自 wrapModelCall 的 request，调用结束后统计）：
1. 系统提示词  ← systemMessage 去掉 "## Skills System" 段
2. 工具及智能体 ← request.tools 中非 MCP 工具（含内置 / 业务 / task 等）
3. 对话消息    ← request.messages
4. 连接器及MCP ← mcpToolNames 指定的工具
5. 技能        ← systemMessage 中 SkillsMiddleware 注入的 "## Skills System" 段
  `);

  logger.success('Demo 13 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});
