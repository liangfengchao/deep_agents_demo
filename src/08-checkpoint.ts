/**
 * Demo 08: 检查点持久化
 * 
 * 演示如何使用 Checkpointer 持久化对话状态
 * 支持中断恢复和状态回溯
 */

import 'dotenv/config';
import { createDeepAgent } from 'deepagents';
import { MemorySaver } from '@langchain/langgraph';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';

async function main() {
  logger.divider();
  logger.info('Demo 08: 检查点系统');
  logger.divider();

  logger.step(1, '创建 MemorySaver Checkpointer');
  const checkpointer = new MemorySaver();

  // 创建带检查点的 Agent
  logger.step(2, '创建带检查点的 Agent');
  const agent = createDeepAgent({
    model: createLLM(),
    systemPrompt: '你是一个智能助手，具有持久化记忆能力。',
    checkpointer,
  });

  const threadId = 'checkpoint-demo-thread';
  const config = { configurable: { thread_id: threadId } } as Record<string, any>;

  // 对话 1：第一轮
  logger.step(3, '对话 1：第一轮对话');
  const result1 = await agent.invoke(
    {
      messages: [
        {
          role: 'user',
          content: '我想学习 TypeScript，请给我一个学习计划。',
        },
      ],
    },
    config
  );
  logger.result(
    '第一轮回复',
    String(result1.messages[result1.messages.length - 1].content)
  );

  // 对话 2：继续对话
  logger.step(4, '对话 2：继续对话（状态保持）');
  const result2 = await agent.invoke(
    {
      messages: [
        {
          role: 'user',
          content: '我已经有 JavaScript 基础了，可以跳过基础部分吗？',
        },
      ],
    },
    config
  );
  logger.result(
    '第二轮回复',
    result2.messages[result2.messages.length - 1].content as string
  );

  // 获取检查点历史
  logger.step(5, '获取检查点历史');
  const getConfig: any = { configurable: { thread_id: threadId } };
  const threadState = await checkpointer.get(getConfig);
  logger.info('检查点状态', {
    threadId,
  });

  // 模拟中断恢复场景
  logger.step(6, '模拟中断恢复');
  logger.info('假设程序在这里中断了...');
  logger.info('重新启动后，可以恢复到之前的状态继续对话。');

  // 恢复对话
  const result3 = await agent.invoke(
    {
      messages: [
        {
          role: 'user',
          content: '继续刚才的话题，推荐一些学习资源。',
        },
      ],
    },
    config
  );
  logger.result(
    '恢复后回复',
    String(result3.messages[result3.messages.length - 1].content)
  );

  // 说明检查点系统
  logger.step(7, '检查点系统说明');
  logger.info(`
检查点系统说明：

1. Checkpointer 类型：
   - MemorySaver: 内存存储（重启后丢失）
   - 自定义 Checkpointer: 可实现持久化存储

2. 核心功能：
   - 自动保存对话状态
   - 支持中断恢复
   - 状态回溯和重放
   - 多用户隔离

3. 使用场景：
   - 长对话状态保持
   - 任务中断恢复
   - 审计和调试
   - 多租户应用

4. Thread ID 管理：
   - 每个用户/会话唯一标识
   - 可以使用 UUID 生成
   - 建议使用业务标识（如 userId）

5. 持久化方案：
   - 开发测试：MemorySaver（内存）
   - 生产环境：自定义 Checkpointer 实现
  `);

  logger.success('Demo 08 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});
