/**
 * Demo 09: MCP 工具
 * 
 * 展示如何集成 MCP（Model Context Protocol）工具
 * 连接外部服务
 */

import 'dotenv/config';
import { createDeepAgent } from 'deepagents';
import { tool } from 'langchain';
import { z } from 'zod';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';

// 模拟 MCP 工具：GitHub API
const githubSearchRepos = tool(
  async ({ query, limit = 5 }: { query: string; limit?: number }) => {
    // 模拟 GitHub API 响应
    const mockRepos = [
      {
        name: 'langchain',
        fullName: 'langchain-ai/langchain',
        description: 'Building applications with LLMs through composability',
        stars: 50000,
        language: 'Python',
        url: 'https://github.com/langchain-ai/langchain',
      },
      {
        name: 'deepagents',
        fullName: 'langchain-ai/deepagentsjs',
        description: 'The batteries-included agent harness for TypeScript',
        stars: 5000,
        language: 'TypeScript',
        url: 'https://github.com/langchain-ai/deepagentsjs',
      },
      {
        name: 'langgraph',
        fullName: 'langchain-ai/langgraphjs',
        description: 'Build stateful, multi-actor applications with LLMs',
        stars: 3000,
        language: 'TypeScript',
        url: 'https://github.com/langchain-ai/langgraphjs',
      },
    ];

    const filtered = mockRepos
      .filter((repo) => 
        repo.name.toLowerCase().includes(query.toLowerCase()) ||
        repo.description.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, limit);

    return JSON.stringify(filtered, null, 2);
  },
  {
    name: 'github_search_repos',
    description: '搜索 GitHub 仓库',
    schema: z.object({
      query: z.string().describe('搜索关键词'),
      limit: z.number().optional().default(5).describe('返回结果数量'),
    }),
  }
);

// 模拟 MCP 工具：数据库查询
const databaseQuery = tool(
  async ({ sql, params = {} }: { sql: string; params?: Record<string, any> }) => {
    // 模拟数据库查询
    const mockData = {
      'SELECT * FROM users': [
        { id: 1, name: '张三', email: 'zhangsan@example.com', role: 'admin' },
        { id: 2, name: '李四', email: 'lisi@example.com', role: 'user' },
        { id: 3, name: '王五', email: 'wangwu@example.com', role: 'user' },
      ],
      'SELECT * FROM orders': [
        { id: 101, userId: 1, product: '笔记本电脑', amount: 6999, status: 'completed' },
        { id: 102, userId: 2, product: '无线鼠标', amount: 199, status: 'pending' },
      ],
    };

    // 简单的 SQL 匹配
    const result = Object.entries(mockData).find(([key]) =>
      sql.toLowerCase().includes(key.toLowerCase().split(' ')[2])
    );

    if (result) {
      return JSON.stringify(result[1], null, 2);
    }

    return JSON.stringify({ message: '查询执行成功', rows: [] });
  },
  {
    name: 'database_query',
    description: '执行数据库 SQL 查询',
    schema: z.object({
      sql: z.string().describe('SQL 查询语句'),
      params: z.record(z.any()).optional().default({}).describe('查询参数'),
    }),
  }
);

// 模拟 MCP 工具：文件系统操作
const fileSystemList = tool(
  async ({ path = '.' }: { path?: string }) => {
    // 模拟文件系统
    const mockFiles = [
      { name: 'README.md', type: 'file', size: 2048, modified: '2024-01-15' },
      { name: 'package.json', type: 'file', size: 512, modified: '2024-01-14' },
      { name: 'src', type: 'directory', size: 0, modified: '2024-01-15' },
      { name: 'dist', type: 'directory', size: 0, modified: '2024-01-13' },
    ];

    return JSON.stringify(mockFiles, null, 2);
  },
  {
    name: 'filesystem_list',
    description: '列出目录内容',
    schema: z.object({
      path: z.string().optional().default('.').describe('目录路径'),
    }),
  }
);

async function main() {
  logger.divider();
  logger.info('Demo 09: MCP 工具');
  logger.divider();

  // 创建带 MCP 工具的 Agent
  logger.step(1, '创建带 MCP 工具的 Agent');
  const agent = createDeepAgent({
    model: createLLM(),
    tools: [githubSearchRepos, databaseQuery, fileSystemList],
    systemPrompt: `你是一个智能助手，可以使用各种 MCP 工具：
- GitHub 搜索：查找开源项目
- 数据库查询：查询用户和订单数据
- 文件系统：列出目录内容

请用中文回答。`,
  });

  // 测试场景 1：GitHub 搜索
  logger.step(2, '测试 GitHub 搜索工具');
  const githubResult = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: '搜索一下 langchain 相关的仓库',
      },
    ],
  });
  logger.result(
    'GitHub 搜索结果',
    githubResult.messages[githubResult.messages.length - 1].content as string
  );

  // 测试场景 2：数据库查询
  logger.step(3, '测试数据库查询工具');
  const dbResult = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: '查询所有用户信息',
      },
    ],
  });
  logger.result(
    '数据库查询结果',
    dbResult.messages[dbResult.messages.length - 1].content as string
  );

  // 测试场景 3：文件系统
  logger.step(4, '测试文件系统工具');
  const fsResult = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: '列出当前目录的文件',
      },
    ],
  });
  logger.result(
    '文件系统结果',
    fsResult.messages[fsResult.messages.length - 1].content as string
  );

  // 测试场景 4：组合使用
  logger.step(5, '测试工具组合使用');
  const combinedResult = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: '先查询用户 ID 为 1 的信息，然后搜索相关的 GitHub 仓库',
      },
    ],
  });
  logger.result(
    '组合使用结果',
    combinedResult.messages[combinedResult.messages.length - 1].content as string
  );

  // 说明 MCP 工具集成
  logger.step(6, 'MCP 工具集成说明');
  logger.info(`
MCP（Model Context Protocol）工具集成说明：

1. 什么是 MCP：
   - Model Context Protocol（模型上下文协议）
   - 标准化的工具调用协议
   - 支持连接各种外部服务

2. MCP 工具类型：
   - API 集成：GitHub、Notion、Slack 等
   - 数据库：MySQL、PostgreSQL、MongoDB 等
   - 文件系统：本地文件、云存储等
   - 自定义服务：企业内部系统

3. 集成方式：
   - 使用 langchain-mcp-adapters 包
   - 通过 MCP Server 连接外部服务
   - 工具自动注册到 Agent

4. 实际应用场景：
   - 企业内部系统集成
   - 第三方 SaaS 服务连接
   - 数据库操作
   - 文件系统管理
   - API 网关调用

5. 安全考虑：
   - 工具权限控制
   - 敏感数据脱敏
   - 审计日志记录
   - 速率限制

6. 生产环境建议：
   - 使用 MCP Server 管理服务连接
   - 实现工具调用的认证和授权
   - 监控工具调用性能
   - 实现错误重试和降级
  `);

  logger.success('Demo 09 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});
