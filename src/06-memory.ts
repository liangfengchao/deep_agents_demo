/**
 * Demo 06: 记忆系统
 * 
 * 演示跨会话的长期记忆功能
 * Agent 可以记住用户偏好和上下文
 */

import 'dotenv/config';
import { createDeepAgent } from 'deepagents';
import { MemorySaver } from '@langchain/langgraph';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';

async function main() {
  logger.divider();
  logger.info('Demo 06: 记忆系统');
  logger.divider();

  // 创建记忆存储
  logger.step(1, '创建记忆存储');
  const memory = new MemorySaver();

  // 创建带记忆的 Agent
  logger.step(2, '创建带长期记忆的 Agent');
  const agent = createDeepAgent({
    model: createLLM(),
    systemPrompt: `你是一个智能助手，具有长期记忆能力。
你会记住用户告诉你的信息，并在后续对话中使用这些信息。
请记住用户的偏好、习惯和重要信息。`,
    checkpointer: memory,
  });

  // 会话 1：用户告诉 Agent 一些信息
  logger.step(3, '会话 1：用户输入偏好信息');
  const threadId1 = 'user-123';
  
  const session1Result = await agent.invoke(
    {
      messages: [
        {
          role: 'user',
          content: '我叫张三，我是一名前端开发工程师，我喜欢使用 TypeScript 和 React。',
        },
      ],
    },
    { configurable: { thread_id: threadId1 } }
  );
  logger.result(
    '会话 1 回复',
    session1Result.messages[session1Result.messages.length - 1].content as string
  );

  // 会话 2：继续对话，测试记忆
  logger.step(4, '会话 2：测试记忆（新会话，同一用户）');
  const session2Result = await agent.invoke(
    {
      messages: [
        {
          role: 'user',
          content: '我叫什么名字？我是什么职业？',
        },
      ],
    },
    { configurable: { thread_id: threadId1 } }
  );
  logger.result(
    '会话 2 回复',
    session2Result.messages[session2Result.messages.length - 1].content as string
  );

  // 会话 3：测试不同用户的记忆隔离
  logger.step(5, '会话 3：测试不同用户的记忆隔离');
  const threadId2 = 'user-456';
  
  const session3Result = await agent.invoke(
    {
      messages: [
        {
          role: 'user',
          content: '我叫李四，我是一名后端开发工程师。',
        },
      ],
    },
    { configurable: { thread_id: threadId2 } }
  );
  logger.result(
    '会话 3 回复',
    session3Result.messages[session3Result.messages.length - 1].content as string
  );

  // 会话 4：验证用户 1 的记忆未受影响
  logger.step(6, '会话 4：验证用户 1 的记忆');
  const session4Result = await agent.invoke(
    {
      messages: [
        {
          role: 'user',
          content: '我还喜欢用什么技术栈？',
        },
      ],
    },
    { configurable: { thread_id: threadId1 } }
  );
  logger.result(
    '会话 4 回复',
    session4Result.messages[session4Result.messages.length - 1].content as string
  );

  // 说明记忆系统的工作原理
  logger.step(7, '记忆系统说明');
  logger.info(`
记忆系统工作原理：

1. Checkpointer（检查点器）：
   - MemorySaver: 内存存储（适合开发测试）
   - SqliteSaver: SQLite 持久化存储
   - PostgresSaver: PostgreSQL 持久化存储

2. Thread ID（线程标识）：
   - 每个用户/会话有唯一的 thread_id
   - 同一 thread_id 的对话共享记忆
   - 不同 thread_id 的记忆相互隔离

3. 记忆持久化：
   - 每次对话自动保存检查点
   - 支持中断恢复
   - 可以回溯历史状态

4. 使用场景：
   - 记住用户偏好
   - 跨会话上下文保持
   - 长期对话历史
   - 任务状态追踪
  `);

  logger.success('Demo 06 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});
