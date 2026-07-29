/**
 * Demo 08: 检查点持久化
 * 
 * 演示如何使用 Checkpointer 持久化对话状态
 * 支持中断恢复和状态回溯
 */

import 'dotenv/config';
import { createDeepAgent } from 'deepagents';
import { SqliteSaver } from '@langchain/langgraph';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  logger.divider();
  logger.info('Demo 08: 检查点持久化');
  logger.divider();

  // 创建 SQLite 数据库文件
  const dbPath = path.join(process.cwd(), '.checkpoint-demo.db');
  
  logger.step(1, '创建 SQLite Checkpointer');
  const checkpointer = await SqliteSaver.create({
    database: dbPath,
  });

  // 创建带检查点的 Agent
  logger.step(2, '创建带检查点的 Agent');
  const agent = createDeepAgent({
    model: createLLM(),
    systemPrompt: '你是一个智能助手，具有持久化记忆能力。',
    checkpointer,
  });

  const threadId = 'checkpoint-demo-thread';

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
    { configurable: { thread_id: threadId } }
  );
  logger.result(
    '第一轮回复',
    result1.messages[result1.messages.length - 1].content as string
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
    { configurable: { thread_id: threadId } }
  );
  logger.result(
    '第二轮回复',
    result2.messages[result2.messages.length - 1].content as string
  );

  // 获取检查点历史
  logger.step(5, '获取检查点历史');
  const threadState = await checkpointer.get({ thread_id: threadId });
  logger.info('检查点状态', {
    threadId,
    checkpointId: threadState?.checkpoint_id,
    messageCount: threadState?.channel_values?.messages?.length || 0,
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
    { configurable: { thread_id: threadId } }
  );
  logger.result(
    '恢复后回复',
    result3.messages[result3.messages.length - 1].content as string
  );

  // 清理数据库文件
  logger.step(7, '清理数据库文件');
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      logger.success('数据库文件已清理');
    }
  } catch (error) {
    logger.warn('清理数据库文件失败', error);
  }

  // 说明检查点系统
  logger.step(8, '检查点系统说明');
  logger.info(`
检查点系统说明：

1. Checkpointer 类型：
   - MemorySaver: 内存存储（重启后丢失）
   - SqliteSaver: SQLite 持久化（本地文件）
   - PostgresSaver: PostgreSQL 持久化（生产环境）

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

5. 生产环境建议：
   - 使用 PostgreSQL 作为存储
   - 定期清理过期检查点
   - 监控数据库大小
   - 实现检查点备份策略
  `);

  logger.success('Demo 08 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});
