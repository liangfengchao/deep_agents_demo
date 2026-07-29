/**
 * Demo 07: 流式输出
 * 
 * 展示如何实时流式输出 Agent 的思考过程和执行结果
 */

import 'dotenv/config';
import { createDeepAgent } from 'deepagents';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';

async function main() {
  logger.divider();
  logger.info('Demo 07: 流式输出');
  logger.divider();

  // 创建 Agent
  logger.step(1, '创建 Agent');
  const agent = createDeepAgent({
    model: createLLM(),
    systemPrompt: '你是一个专业中文助手，回答详细且有条理。',
  });

  // 流式输出示例 1：简单对话
  logger.step(2, '流式输出：简单对话');
  console.log('\n--- 流式输出开始 ---\n');
  
  const stream1 = await agent.stream({
    messages: [
      {
        role: 'user',
        content: '用 100 字介绍一下人工智能。',
      },
    ],
  });

  for await (const event of stream1) {
    // 事件类型判断
    if (event.__end__) {
      // 流结束
      break;
    }
    
    // 处理不同类型的流事件
    if (event.messages) {
      for (const message of event.messages) {
        if (message.content) {
          process.stdout.write(message.content as string);
        }
      }
    }
  }
  
  console.log('\n\n--- 流式输出结束 ---');

  // 流式输出示例 2：工具调用
  logger.step(3, '流式输出：带工具调用的复杂任务');
  console.log('\n--- 工具调用流开始 ---\n');

  const stream2 = await agent.stream(
    {
      messages: [
        {
          role: 'user',
          content: '请帮我列出当前目录的文件，并统计文件数量。',
        },
      ],
    },
    {
      streamMode: ['messages', 'updates'], // 同时流式输出消息和状态更新
    }
  );

  for await (const event of stream2) {
    if (event.__end__) {
      break;
    }
    
    if (event.messages) {
      for (const message of event.messages) {
        if (message.content) {
          process.stdout.write(message.content as string);
        }
      }
    }
  }

  console.log('\n\n--- 工具调用流结束 ---');

  // 说明流式输出的使用场景
  logger.step(4, '流式输出说明');
  logger.info(`
流式输出使用场景：

1. 实时交互：
   - 用户可以看到 Agent 的思考过程
   - 减少等待感，提升用户体验
   - 适合长文本生成任务

2. 工具调用监控：
   - 实时查看工具调用状态
   - 监控执行进度
   - 及时发现错误

3. 调试和追踪：
   - 查看 Agent 的决策过程
   - 分析工具调用链
   - 优化 Agent 行为

4. 实现方式：
   - agent.stream() 方法返回异步迭代器
   - 使用 for await...of 循环处理事件
   - 事件类型：messages, updates, tools 等
  `);

  logger.success('Demo 07 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});
