/**
 * Demo 01: 基础 Agent
 * 
 * 最简单的 DeepAgent 使用示例
 * 展示如何创建 Agent 并进行对话
 */

import 'dotenv/config';
import { createDeepAgent } from 'deepagents';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';

async function main() {
  logger.divider();
  logger.info('Demo 01: 基础 Agent');
  logger.divider();

  // 创建基础 Agent
  logger.step(1, '创建 DeepAgent 实例');
  const agent = createDeepAgent({
    model: createLLM(),
    systemPrompt: '你是一个专业中文助手，回答准确、简洁。',
  });

  // 发送消息
  logger.step(2, '发送消息给 Agent');
  const result = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: '什么是 DeepAgents？用一句话概括。',
      },
    ],
  });

  // 获取最后一条消息（Agent 的回复）
  const lastMessage = result.messages[result.messages.length - 1];
  logger.result('Agent 回复', lastMessage.content as string);

  // 多轮对话示例
  logger.step(3, '多轮对话');
  const multiTurnResult = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: '我喜欢蓝色',
      },
      {
        role: 'assistant',
        content: '好的，我记住了，你喜欢蓝色。',
      },
      {
        role: 'user',
        content: '我喜欢什么颜色？',
      },
    ],
  });

  const finalMessage = multiTurnResult.messages[multiTurnResult.messages.length - 1];
  logger.result('多轮对话结果', finalMessage.content as string);

  logger.success('Demo 01 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});
