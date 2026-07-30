/**
 * Agent Protocol 服务器
 *
 * 实现 LangGraph Platform API 规范，支持：
 * - 创建和运行 Deep Agent
 * - 异步任务管理
 * - 流式输出
 * - 线程状态管理
 *
 * 注意：此服务器实现了 LangGraph SDK Client 期望的 API 格式
 */

import express, { Express } from 'express';
import cors from 'cors';
import { createDeepAgent } from 'deepagents';
import { createLLM } from './utils/config.js';
import { logger } from './utils/logger.js';

const app: Express = express();
const PORT = process.env.AGENT_PROTOCOL_PORT || 8001;

// 中间件
app.use(cors());
app.use(express.json());

// 存储运行中的 Agent 实例
const agents = new Map<string, any>();
const threads = new Map<string, any[]>();
const runs = new Map<string, {
  id: string;
  threadId: string;
  assistantId: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}>();

// 生成 ID
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ========== LangGraph Platform API 端点 ==========

// 1. 创建 Thread
app.post('/threads', (req, res) => {
  const threadId = generateId('thread');

  threads.set(threadId, []);

  res.json({
    thread_id: threadId,
    created_at: new Date().toISOString(),
  });
});

// 2. 获取 Thread
app.get('/threads/:threadId', (req, res) => {
  const { threadId } = req.params;
  const messages = threads.get(threadId);

  if (!messages) {
    return res.status(404).json({ error: 'Thread not found' });
  }

  res.json({
    thread_id: threadId,
    created_at: new Date().toISOString(),
  });
});

// 2.1 获取 Thread 状态 (LangGraph SDK 需要)
app.get('/threads/:threadId/state', (req, res) => {
  const { threadId } = req.params;
  const messages = threads.get(threadId);

  if (!messages) {
    return res.status(404).json({ error: 'Thread not found' });
  }

  res.json({
    values: {
      messages: messages,
    },
    next: [],
    config: {},
    metadata: {},
    created_at: new Date().toISOString(),
    parent_config: {},
  });
});

// 3. 创建 Run (同步)
app.post('/threads/:threadId/runs', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { assistant_id, input } = req.body;
    const runId = generateId('run');

    const agentData = agents.get(assistant_id);
    if (!agentData) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    logger.info(`创建 Run: ${runId}, Thread: ${threadId}, Assistant: ${assistant_id}`);

    // 获取线程历史
    const threadMessages = threads.get(threadId) || [];
    const newMessages = input?.messages || [];
    const allMessages = [...threadMessages, ...newMessages];

    // 运行 Agent
    const result = await agentData.agent.invoke({
      messages: allMessages,
    });

    // 更新线程
    threads.set(threadId, result.messages);

    // 创建 run 记录
    runs.set(runId, {
      id: runId,
      threadId,
      assistantId: assistant_id,
      status: 'success',
      result,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.json({
      run_id: runId,
      thread_id: threadId,
      assistant_id,
      status: 'success',
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('创建 Run 失败', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 4. 创建 Run (异步/流式)
app.post('/threads/:threadId/runs/stream', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { assistant_id, input } = req.body;
    const runId = generateId('run');

    const agentData = agents.get(assistant_id);
    if (!agentData) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    logger.info(`创建流式 Run: ${runId}, Thread: ${threadId}, Assistant: ${assistant_id}`);

    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 获取线程历史
    const threadMessages = threads.get(threadId) || [];
    const newMessages = input?.messages || [];
    const allMessages = [...threadMessages, ...newMessages];

    // 发送 run 创建事件
    res.write(`event: run_created\n`);
    res.write(`data: ${JSON.stringify({ run_id: runId, thread_id: threadId, assistant_id, status: 'running' })}\n\n`);

    // 异步执行任务
    (async () => {
      try {
        const stream = await agentData.agent.streamEvents(
          { messages: allMessages },
          { version: 'v3' }
        );

        for await (const event of stream) {
          res.write(`event: ${event.event}\n`);
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        // 更新线程
        const result = await agentData.agent.invoke({ messages: allMessages });
        threads.set(threadId, result.messages);

        // 更新 run 状态
        runs.set(runId, {
          id: runId,
          threadId,
          assistantId: assistant_id,
          status: 'success',
          result,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        res.write(`event: run_completed\n`);
        res.write(`data: ${JSON.stringify({ run_id: runId, status: 'success' })}\n\n`);
        res.end();
      } catch (error) {
        logger.error('流式 Run 失败', error);
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n\n`);
        res.end();
      }
    })();
  } catch (error) {
    logger.error('创建流式 Run 失败', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 5. 获取 Run 状态
app.get('/threads/:threadId/runs/:runId', (req, res) => {
  const { threadId, runId } = req.params;
  const run = runs.get(runId);

  if (!run || run.threadId !== threadId) {
    return res.status(404).json({ error: 'Run not found' });
  }

  res.json({
    run_id: run.id,
    thread_id: run.threadId,
    assistant_id: run.assistantId,
    status: run.status,
    created_at: run.createdAt.toISOString(),
    updated_at: run.updatedAt.toISOString(),
  });
});

// 6. 获取 Run 输出
app.get('/threads/:threadId/runs/:runId/output', (req, res) => {
  const { threadId, runId } = req.params;
  const run = runs.get(runId);

  if (!run || run.threadId !== threadId) {
    return res.status(404).json({ error: 'Run not found' });
  }

  res.json({
    run_id: run.id,
    thread_id: run.threadId,
    assistant_id: run.assistantId,
    status: run.status,
    output: run.result,
    created_at: run.createdAt.toISOString(),
    updated_at: run.updatedAt.toISOString(),
  });
});

// 7. 取消 Run
app.post('/threads/:threadId/runs/:runId/cancel', (req, res) => {
  const { threadId, runId } = req.params;
  const run = runs.get(runId);

  if (!run || run.threadId !== threadId) {
    return res.status(404).json({ error: 'Run not found' });
  }

  if (run.status === 'success' || run.status === 'error') {
    return res.status(400).json({ error: 'Run already completed or failed' });
  }

  run.status = 'cancelled';
  run.updatedAt = new Date();

  res.json({
    run_id: run.id,
    thread_id: run.threadId,
    assistant_id: run.assistantId,
    status: 'cancelled',
    updated_at: run.updatedAt.toISOString(),
  });
});

// 8. 创建 Assistant (Agent)
app.post('/assistants', async (req, res) => {
  try {
    const { name, instructions, model, subagents, graph_id } = req.body;
    const assistantId = graph_id || generateId('assistant');

    logger.info(`创建 Assistant: ${name} (${assistantId})`);

    const agent = createDeepAgent({
      model: createLLM(),
      name,
      systemPrompt: instructions,
      subagents: subagents || [],
    });

    agents.set(assistantId, {
      id: assistantId,
      name,
      agent,
      createdAt: new Date(),
    });

    res.json({
      assistant_id: assistantId,
      name,
      graph_id: assistantId,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('创建 Assistant 失败', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 9. 获取 Assistant
app.get('/assistants/:assistantId', (req, res) => {
  const { assistantId } = req.params;
  const agentData = agents.get(assistantId);

  if (!agentData) {
    return res.status(404).json({ error: 'Assistant not found' });
  }

  res.json({
    assistant_id: agentData.id,
    name: agentData.name,
    graph_id: agentData.id,
    created_at: agentData.createdAt.toISOString(),
  });
});

// 10. 列出 Assistants
app.get('/assistants', (req, res) => {
  const assistantList = Array.from(agents.values()).map(agent => ({
    assistant_id: agent.id,
    name: agent.name,
    graph_id: agent.id,
    created_at: agent.createdAt.toISOString(),
  }));

  res.json({ assistants: assistantList });
});

// 11. 列出 Threads
app.get('/threads', (req, res) => {
  const threadList = Array.from(threads.keys()).map(id => ({
    thread_id: id,
    created_at: new Date().toISOString(),
  }));

  res.json({ threads: threadList });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    agents: agents.size,
    threads: threads.size,
    runs: runs.size,
  });
});

// 启动服务器
app.listen(PORT, () => {
  logger.success(`Agent Protocol 服务器启动在 http://localhost:${PORT}`);
  logger.info('LangGraph Platform API 端点:');
  logger.info('  POST   /threads                 - 创建 Thread');
  logger.info('  GET    /threads                 - 列出 Threads');
  logger.info('  GET    /threads/:id             - 获取 Thread');
  logger.info('  GET    /threads/:id/state     - 获取 Thread 状态');
  logger.info('  POST   /threads/:id/runs        - 创建 Run (同步)');
  logger.info('  POST   /threads/:id/runs/stream - 创建 Run (流式)');
  logger.info('  GET    /threads/:id/runs/:rid   - 获取 Run 状态');
  logger.info('  GET    /threads/:id/runs/:rid/output - 获取 Run 输出');
  logger.info('  POST   /threads/:id/runs/:rid/cancel - 取消 Run');
  logger.info('  POST   /assistants              - 创建 Assistant');
  logger.info('  GET    /assistants              - 列出 Assistants');
  logger.info('  GET    /assistants/:id          - 获取 Assistant');
  logger.info('  GET    /health                  - 健康检查');
});

export default app;