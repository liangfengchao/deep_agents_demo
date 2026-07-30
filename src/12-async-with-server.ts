/**
 * Demo 12: 使用自建 Agent Protocol 服务器
 *
 * 展示如何使用 AsyncSubAgent 连接自建的 Agent Protocol 服务器
 */

import 'dotenv/config';
import { createDeepAgent, type AsyncSubAgent } from 'deepagents';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';

// Agent Protocol 服务器地址
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || 'http://localhost:8001';

// 创建 AsyncSubAgent 配置
const asyncSubagents: AsyncSubAgent[] = [
  {
    name: 'remote_data_analyst',
    description: '远程数据分析师，擅长数据分析和洞察提取',
    graphId: 'data_analyst', // 对应服务器上的 Agent ID
    url: AGENT_SERVER_URL,
  },
  {
    name: 'remote_report_writer',
    description: '远程报告撰写专家，擅长撰写结构化报告',
    graphId: 'report_writer',
    url: AGENT_SERVER_URL,
  },
];

async function main() {
  logger.divider();
  logger.info('Demo 12: 使用自建 Agent Protocol 服务器');
  logger.divider();

  // 步骤 1: 在服务器上创建远程 Agent
  logger.step(1, '在 Agent Protocol 服务器上创建远程 Agent');

  try {
    // 创建数据分析师 Agent
    const dataAnalystResponse = await fetch(`${AGENT_SERVER_URL}/assistants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '数据分析师',
        instructions: `你是一个专业的数据分析师。你的职责是：
- 分析用户提供的数据
- 提取关键指标和趋势
- 给出数据驱动的洞察和建议

请用简洁的中文回答。`,
      }),
    });

    if (!dataAnalystResponse.ok) {
      throw new Error(`创建数据分析师失败: ${dataAnalystResponse.statusText}`);
    }

    const dataAnalyst = await dataAnalystResponse.json();
    logger.success(`数据分析师创建成功: ${dataAnalyst.assistant_id}`);

    // 创建报告撰写专家 Agent
    const reportWriterResponse = await fetch(`${AGENT_SERVER_URL}/assistants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '报告撰写专家',
        instructions: `你是一个专业的报告撰写专家。你的职责是：
- 根据数据分析结果撰写结构化报告
- 使用清晰的标题和段落
- 确保报告专业、易读

请用 Markdown 格式输出报告。`,
      }),
    });

    if (!reportWriterResponse.ok) {
      throw new Error(`创建报告撰写专家失败: ${reportWriterResponse.statusText}`);
    }

    const reportWriter = await reportWriterResponse.json();
    logger.success(`报告撰写专家创建成功: ${reportWriter.assistant_id}`);

    // 更新 AsyncSubAgent 配置
    asyncSubagents[0].graphId = dataAnalyst.assistant_id;
    asyncSubagents[1].graphId = reportWriter.assistant_id;

  } catch (error) {
    logger.error('创建远程 Agent 失败', error);
    logger.info('请确保 Agent Protocol 服务器已启动: pnpm demo:server');
    process.exit(1);
  }

  // 步骤 2: 创建主 Agent，使用 AsyncSubAgent
  logger.step(2, '创建主 Agent，配置 AsyncSubAgent');

  const mainAgent = createDeepAgent({
    model: createLLM(),
    name: '主协调Agent',
    systemPrompt: `你是一个智能任务协调者。你的职责是：
- 理解用户需求
- 将任务分解并委派给合适的远程子 Agent
- 使用 start_async_task 启动异步任务
- 使用 check_async_task 检查任务状态
- 使用 list_async_tasks 列出所有任务
- 整合子 Agent 的结果
- 向用户提供最终答案

可用的远程子 Agent：
1. 数据分析师 (remote_data_analyst) - 擅长数据分析
2. 报告撰写专家 (remote_report_writer) - 擅长撰写报告

重要提示：
- 使用 start_async_task 启动异步任务，立即返回任务 ID
- 使用 check_async_task 检查任务状态和结果
- 主 Agent 可以继续与用户交互，不需要等待任务完成
- 直接输出分析结果，不要使用 write_todos 工具

请用简洁的中文回答。`,
    subagents: asyncSubagents as any, // AsyncSubAgent 类型
  });

  logger.success('主 Agent 创建完成');

  // 步骤 3: 测试异步任务
  logger.step(3, '测试异步任务执行');

  console.log('\n--- 启动异步任务 ---\n');

  // 使用 streamEvents 查看主 Agent 如何使用异步工具
  const run = await (mainAgent.streamEvents as any)(
    {
      messages: [
        {
          role: 'user',
          content: `请帮我完成以下任务：

1. 分析销售数据：
   - 1月：100万
   - 2月：120万
   - 3月：90万
   - 4月：150万
   - 5月：180万

2. 根据分析结果撰写一份报告

请同时启动这两个任务，并在任务完成后告诉我结果。`,
        },
      ],
    },
    { version: 'v3' }
  );

  // 收集所有输出
  const messagesPromise = (async () => {
    for await (const msg of run.messages) {
      console.log(`\n--- [主 Agent] ---`);
      for await (const token of msg.text) {
        process.stdout.write(token);
      }
    }
  })();

  const toolCallsPromise = (async () => {
    for await (const call of run.toolCalls) {
      console.log(`\n>>> 工具调用: ${call.name}`);
      console.log(`>>> 参数:`, JSON.stringify(call.input, null, 2));

      if (call.name === 'start_async_task') {
        console.log(`>>> 异步任务已启动，任务ID: ${call.input.task_id || '待返回'}`);
      }
    }
  })();

  await Promise.all([messagesPromise, toolCallsPromise]);

  console.log('\n\n--- 异步任务执行完成 ---');

  // 步骤 4: 手动测试异步任务结果获取
  logger.step(4, '手动测试异步任务结果获取');

  console.log('\n--- 手动测试：创建任务并获取结果 ---\n');

  try {
    // 1. 创建 Thread
    const threadResponse = await fetch(`${AGENT_SERVER_URL}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const thread = await threadResponse.json();
    console.log(`创建 Thread: ${thread.thread_id}`);

    // 2. 创建 Run
    const runResponse = await fetch(`${AGENT_SERVER_URL}/threads/${thread.thread_id}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assistant_id: asyncSubagents[0].graphId,
        input: {
          messages: [{
            role: 'user',
            content: '分析销售数据：1月100万，2月120万，3月90万，4月150万，5月180万。给出趋势分析和关键洞察。'
          }]
        }
      }),
    });
    const run = await runResponse.json();
    console.log(`创建 Run: ${run.run_id}, 状态: ${run.status}`);

    // 3. 获取 Thread 状态（包含结果）
    const stateResponse = await fetch(`${AGENT_SERVER_URL}/threads/${thread.thread_id}/state`);
    const state = await stateResponse.json();
    
    console.log('\n--- 任务结果 ---');
    const messages = state.values?.messages || [];
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      console.log('最后一条消息:');
      console.log(lastMessage.content || lastMessage);
    } else {
      console.log('没有结果消息');
    }

  } catch (error) {
    logger.error('手动测试失败', error);
  }

  // 说明架构
  logger.step(5, 'Agent Protocol 架构说明');
  logger.info(`
Agent Protocol 服务器架构：

1. 服务器端点：
   - POST /v1/agents              - 创建 Agent
   - GET  /v1/agents/:id          - 获取 Agent 信息
   - POST /v1/threads             - 创建对话线程
   - POST /v1/runs                - 同步运行 Agent
   - POST /v1/runs/async          - 启动异步任务
   - GET  /v1/runs/async          - 列出异步任务
   - GET  /v1/runs/async/:id      - 检查任务状态
   - POST /v1/runs/async/:id/cancel - 取消任务
   - POST /v1/runs/stream         - 流式运行

2. AsyncSubAgent 配置：
   - graphId: 服务器上的 Agent ID
   - url: Agent Protocol 服务器地址
   - name: 子 Agent 名称
   - description: 子 Agent 描述

3. 异步工具：
   - start_async_task: 启动异步任务
   - check_async_task: 检查任务状态
   - update_async_task: 更新运行中的任务
   - cancel_async_task: 取消任务
   - list_async_tasks: 列出所有任务

4. 使用流程：
   1. 启动 Agent Protocol 服务器: pnpm demo:server
   2. 在服务器上创建远程 Agent
   3. 主 Agent 配置 AsyncSubAgent，指向服务器
   4. 主 Agent 使用 start_async_task 启动远程任务
   5. 主 Agent 继续执行，稍后使用 check_async_task 获取结果

5. 优势：
   - 真正的异步执行，不阻塞主 Agent
   - 支持任务状态持久化
   - 支持跨网络、跨进程调用
   - 可以水平扩展远程 Agent
  `);

  logger.success('Demo 12 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});