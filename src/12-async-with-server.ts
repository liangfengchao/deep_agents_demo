/**
 * Demo 12: AsyncSubAgent 混合 HTTP 传输
 *
 * 本脚本在独立 Node 进程中运行，不能使用「无 url」的 ASGI（那只在
 * langgraph:dev 同部署进程内生效，见 src/graphs/supervisor.ts）。
 *
 * 这里用两个远程 HTTP 目标演示混合：
 * - data_analyst → LangGraph 本地服务（pnpm langgraph:dev）
 * - report_writer → 自建 Agent Protocol 服务器（pnpm demo:server）
 */

import 'dotenv/config';
import { createDeepAgent, type AsyncSubAgent } from 'deepagents';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';

const LANGGRAPH_URL = process.env.LANGGRAPH_URL || 'http://localhost:2024';
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || 'http://localhost:8001';

const asyncSubagents: AsyncSubAgent[] = [
  {
    name: 'langgraph_data_analyst',
    description: 'LangGraph 数据分析师，擅长数据分析和洞察提取',
    graphId: 'data_analyst', // 对应 langgraph.json
    url: LANGGRAPH_URL,
  },
  {
    name: 'remote_report_writer',
    description: '远程报告撰写专家，擅长撰写结构化报告',
    graphId: 'report_writer',
    url: AGENT_SERVER_URL,
  },
];

async function ensureOk(url: string, hint: string) {
  try {
    const res = await fetch(`${url}/ok`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (error) {
    logger.error(`${url} 不可用`, error);
    logger.info(hint);
    process.exit(1);
  }
}

async function main() {
  logger.divider();
  logger.info('Demo 12: AsyncSubAgent 混合 HTTP（LangGraph + 自建服务器）');
  logger.divider();

  logger.step(1, '检查依赖服务并创建远程报告撰写专家');
  await ensureOk(LANGGRAPH_URL, '请先启动: pnpm langgraph:dev');
  logger.success(`LangGraph 可用: ${LANGGRAPH_URL} (graphId=data_analyst)`);

  try {
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
    asyncSubagents[1].graphId = reportWriter.assistant_id;
    logger.success(`远程报告撰写专家创建成功: ${reportWriter.assistant_id}`);
    logger.info(`子 Agent[0]: ${asyncSubagents[0].name} → ${LANGGRAPH_URL}`);
    logger.info(`子 Agent[1]: ${asyncSubagents[1].name} → ${AGENT_SERVER_URL}`);
  } catch (error) {
    logger.error('创建远程 Agent 失败', error);
    logger.info('请确保 Agent Protocol 服务器已启动: pnpm demo:server');
    process.exit(1);
  }

  // 步骤 2: 创建主 Agent，使用 AsyncSubAgent
  logger.step(2, '创建主 Agent，配置混合 AsyncSubAgent');

  const mainAgent = createDeepAgent({
    model: createLLM(),
    name: '主协调Agent',
    systemPrompt: `你是任务协调者：理解需求，把任务委派给合适的子 Agent，整合结果后用简洁中文回答用户。
可并行委派，拿到结果后再汇总。分析数据用 langgraph_data_analyst，写报告用 remote_report_writer。`,
    subagents: asyncSubagents as any,
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
        assistant_id: asyncSubagents[1].graphId, // 远程子 Agent
        input: {
          messages: [{
            role: 'user',
            content: '根据销售数据（1月100万，2月120万，3月90万，4月150万，5月180万）撰写一份简要分析报告。'
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
  logger.step(5, '混合传输架构说明');
  logger.info(`
本脚本（独立进程）只能用 HTTP：

1. LangGraph HTTP → ${LANGGRAPH_URL}
   - langgraph_data_analyst / graphId=data_analyst
   - 需先: pnpm langgraph:dev

2. 自建服务器 HTTP → ${AGENT_SERVER_URL}
   - remote_report_writer
   - 需先: pnpm demo:server

真正的 ASGI（不写 url）只在 src/graphs/supervisor.ts 内生效，
即通过 Studio / langgraph:dev 调用 supervisor 时才会走进程内通信。
  `);

  logger.success('Demo 12 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});