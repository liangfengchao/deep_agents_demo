/**
 * Demo 04: 技能系统
 * 
 * 演示 DeepAgents 的技能（Skills）系统
 * 技能是预定义的工具集合和使用说明
 */

import 'dotenv/config';
import { createDeepAgent } from 'deepagents';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';

async function main() {
  logger.divider();
  logger.info('Demo 04: 技能系统');
  logger.divider();

  // 创建带技能的 Agent
  // 注意：技能需要通过 skills 参数指定技能目录路径
  logger.step(1, '创建带技能的 Agent');
  
  const agent = createDeepAgent({
    model: createLLM(),
    systemPrompt: '你是一个智能助手，可以使用各种技能来完成任务。',
    // 技能目录路径（相对或绝对路径）
    // 技能目录结构示例：
    // skills/
    //   doc-generator/
    //     SKILL.md
    //   code-helper/
    //     SKILL.md
    // skills: ['./skills'], // 如果有技能目录，取消注释
  });

  // 模拟技能使用场景
  logger.step(2, '测试文档生成能力');
  const docResult = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: '帮我写一份产品需求文档的大纲，包含以下模块：用户管理、权限控制、数据统计。',
      },
    ],
  });
  logger.result(
    '文档大纲',
    docResult.messages[docResult.messages.length - 1].content as string
  );

  // 测试代码辅助能力
  logger.step(3, '测试代码辅助能力');
  const codeResult = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: '用 TypeScript 写一个防抖函数，要求支持泛型。',
      },
    ],
  });
  logger.result(
    '代码实现',
    codeResult.messages[codeResult.messages.length - 1].content as string
  );

  // 说明技能系统的工作原理
  logger.step(4, '技能系统说明');
  logger.info(`
技能系统工作原理：

1. 技能定义（SKILL.md）：
   - 包含技能名称、描述、使用说明
   - 定义技能提供的工具
   - 提供使用示例

2. 技能加载：
   - Agent 启动时扫描技能目录
   - 解析 SKILL.md 文件
   - 注册技能提供的工具

3. 技能使用：
   - Agent 根据任务自动选择合适的技能
   - 调用技能提供的工具
   - 返回执行结果

4. 技能目录结构示例：
   skills/
   ├── doc-generator/
   │   ├── SKILL.md          # 技能说明文档
   │   └── tools.ts          # 工具实现（可选）
   ├── code-helper/
   │   ├── SKILL.md
   │   └── tools.ts
   └── data-analysis/
       ├── SKILL.md
       └── tools.ts
  `);

  logger.success('Demo 04 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});
