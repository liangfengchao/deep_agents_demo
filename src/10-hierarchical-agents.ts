/**
 * Demo 10: 扁平化多智能体协作（专家团）
 *
 * 展示扁平化智能体架构：
 * - 顶层：执行总监（协调各领域专家）
 * - 底层：数据分析师、可视化专家、市场分析师、策略顾问
 *
 * 注意：deepagents 的 subagents 使用声明式 SubAgent 配置对象，
 * 框架会自动编译为 ReactAgent。
 */

import 'dotenv/config';
import { createDeepAgent } from 'deepagents';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';

async function main() {
  logger.divider();
  logger.info('Demo 10: 扁平化多智能体协作（专家团）');
  logger.divider();

  // ========== 底层专家（声明式配置） ==========
  logger.step(1, '定义底层专家');

  const dataAnalyst = {
    name: 'data_analyst',
    description: '数据分析师，擅长 SQL 查询、数据清洗、统计分析和趋势洞察',
    systemPrompt: `你是一名资深数据分析师。你的职责：
- SQL 查询和数据提取
- 数据清洗和预处理
- 统计分析和趋势洞察

请用简洁的中文回答，必要时提供示例代码。`,
  };

  const visualizationExpert = {
    name: 'visualization_expert',
    description: '可视化专家，擅长选择合适的图表类型和设计数据展示方案',
    systemPrompt: `你是一名数据可视化专家。你的职责：
- 选择合适的图表类型
- 设计清晰的数据展示方案
- 提供 Python/JavaScript 可视化代码示例

请用简洁的中文回答。`,
  };

  const marketAnalyst = {
    name: 'market_analyst',
    description: '市场分析师，擅长市场趋势分析、竞争对手研究和用户行为洞察',
    systemPrompt: `你是一名市场分析师。你的职责：
- 市场趋势分析
- 竞争对手研究
- 用户行为洞察

请用简洁的中文回答。`,
  };

  const strategyAdvisor = {
    name: 'strategy_advisor',
    description: '策略顾问，擅长制定业务策略、风险评估和提供可执行建议',
    systemPrompt: `你是一名策略顾问。你的职责：
- 制定业务策略
- 风险评估和机会识别
- 提供可执行的建议

请用简洁的中文回答。`,
  };

  logger.success('底层专家定义完成：data_analyst, visualization_expert, market_analyst, strategy_advisor');

  // ========== 顶层执行总监 ==========
  logger.step(2, '创建顶层执行总监');

  const executive = createDeepAgent({
    model: createLLM(),
    name: '执行总监',
    systemPrompt: `你是执行总监，负责协调以下团队成员：

- 数据分析师：SQL 查询、数据清洗、统计分析
- 可视化专家：图表设计、数据展示
- 市场分析师：市场趋势、竞争对手、用户行为
- 策略顾问：业务策略、风险评估

你的职责：
1. 理解高层需求
2. 判断任务性质，委派给合适的专家
3. 整合各方输出，提供综合建议

重要提示：
- 直接输出分析结果，不要使用 write_todos 工具
- 不要创建任务列表，直接给出最终答案

请用简洁的中文回答。`,
    subagents: [dataAnalyst, visualizationExpert, marketAnalyst, strategyAdvisor],
  });

  logger.success('顶层执行总监创建完成');

  // ========== 测试场景 ==========
  logger.step(3, '测试场景：综合分析任务');

  console.log('\n--- 流式输出开始 ---\n');

  // 使用方法 3：streamEvents（获取子智能体输出）
  const run = await (executive.streamEvents as any)(
    {
      messages: [
        {
          role: 'user',
          content: `我们公司最近销售额下降了 15%，请帮我分析原因并提出解决方案。

背景信息：
- 产品：SaaS 软件服务
- 目标客户：中小企业
- 下降时间：最近 3 个月
- 竞争对手：新进入者增多

请从技术和业务两个角度进行分析。`,
        },
      ],
    },
    { version: 'v3' } as any
  );

  // 使用 Promise.all 并行收集所有输出
  await Promise.all([
    // 并行收集顶层消息
    (async () => {
      for await (const msg of run.messages) {
        console.log(`\n--- [顶层] ---`);
        for await (const token of msg.text) {
          process.stdout.write(token);
        }
      }
    })(),

    // 并行收集子智能体消息
    (async () => {
      for await (const subagent of run.subagents) {
        console.log(`\n=== 子智能体: ${subagent.name} ===`);
        for await (const msg of subagent.messages) {
          console.log(`\n--- [${subagent.name}] ---`);
          for await (const token of msg.text) {
            process.stdout.write(token);
          }
        }
      }
    })(),
  ]);

  console.log('\n\n--- 流式输出结束 ---');

  // 说明扁平化架构
  logger.step(4, '扁平化架构说明');
  logger.info(`
扁平化多智能体架构：

1. 架构层次：
   执行总监（顶层 createDeepAgent）
   ├── 数据分析师（声明式 SubAgent）
   ├── 可视化专家（声明式 SubAgent）
   ├── 市场分析师（声明式 SubAgent）
   └── 策略顾问（声明式 SubAgent）

2. 关键要点：
   - 所有智能体都使用声明式 SubAgent 配置（name/description/systemPrompt）
   - 框架自动编译为 ReactAgent
   - 执行总监直接管理所有专家
   - 专家可被并行调用

3. 适用场景：
   - 任务可明确分配给不同专家
   - 需要多领域并行分析
   - 减少层级，降低延迟

4. 注意事项：
   - 扁平化结构减少层级，降低 LLM 调用次数
   - 子智能体 system prompt 需明确禁止使用 write_todos 工具
  `);

  logger.success('Demo 10 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});
