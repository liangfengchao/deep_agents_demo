/**
 * Demo 03: 多智能体协作
 * 
 * 展示多个 Agent 之间的协作
 * 主 Agent 可以将任务委派给子 Agent
 */

import 'dotenv/config';
import { createDeepAgent } from 'deepagents';
import { tool } from 'langchain';
import { z } from 'zod';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';

// 定义子 Agent 配置（SubAgent 声明式定义）
const dataAnalystSubagent = {
  name: 'data_analyst',
  description: '数据分析师，擅长数据分析和洞察提取',
  systemPrompt: `你是一个专业的数据分析师。你的职责是：
- 分析用户提供的数据
- 提取关键指标和趋势
- 给出数据驱动的洞察和建议

请用简洁的中文回答。`,
};

const reportWriterSubagent = {
  name: 'report_writer',
  description: '报告撰写专家，擅长撰写结构化报告',
  systemPrompt: `你是一个专业的报告撰写专家。你的职责是：
- 根据数据分析结果撰写结构化报告
- 使用清晰的标题和段落
- 确保报告专业、易读

请用 Markdown 格式输出报告。`,
};

const translatorSubagent = {
  name: 'translator',
  description: '翻译专家，擅长中英翻译',
  systemPrompt: `你是一个专业的中英翻译专家。你的职责是：
- 将中文内容翻译成地道的英文
- 保持专业术语的准确性
- 确保翻译流畅自然

只输出英文翻译结果，不要添加额外说明。`,
};

// 创建主 Agent，配置子 Agent
async function main() {
  logger.divider();
  logger.info('Demo 03: 多智能体协作');
  logger.divider();

  // 创建主 Agent
  logger.step(1, '创建主 Agent 和子 Agent');
  
  const mainAgent = createDeepAgent({
    model: createLLM(),
    name: '主协调Agent',
    systemPrompt: `你是一个智能任务协调者。你的职责是：
- 理解用户需求
- 将任务分解并委派给合适的子 Agent
- 整合子 Agent 的结果
- 向用户提供最终答案

可用的子 Agent：
1. 数据分析师 - 擅长数据分析
2. 报告撰写专家 - 擅长撰写报告
3. 翻译专家 - 擅长中英翻译

请根据任务性质选择合适的子 Agent。`,
    subagents: [
      dataAnalystSubagent,
      reportWriterSubagent,
      translatorSubagent,
    ],
  });

  // 测试场景 1：数据分析任务
  logger.step(2, '测试场景 1：数据分析');
  const analysisResult = await mainAgent.invoke({
    messages: [
      {
        role: 'user',
        content: `分析以下销售数据：
- 1月：100万
- 2月：120万
- 3月：90万
- 4月：150万
- 5月：180万

请分析趋势并给出建议。`,
      },
    ],
  });
  logger.result(
    '数据分析结果',
    analysisResult.messages[analysisResult.messages.length - 1].content as string
  );

  // 测试场景 2：报告生成任务
  logger.step(3, '测试场景 2：报告生成');
  const reportResult = await mainAgent.invoke({
    messages: [
      {
        role: 'user',
        content: `根据以下信息撰写一份季度报告摘要：
- 公司：TechCorp
- 季度：2024 Q1
- 营收：5000万
- 同比增长：25%
- 主要成就：推出3款新产品，客户满意度提升至95%

请撰写一份专业的报告摘要。`,
      },
    ],
  });
  logger.result(
    '报告生成结果',
    reportResult.messages[reportResult.messages.length - 1].content as string
  );

  // 测试场景 3：翻译任务
  logger.step(4, '测试场景 3：中英翻译');
  const translationResult = await mainAgent.invoke({
    messages: [
      {
        role: 'user',
        content: '将以下内容翻译成英文：\n\n人工智能正在改变我们的生活方式。从智能手机到自动驾驶汽车，AI技术已经渗透到日常生活的方方面面。',
      },
    ],
  });
  logger.result(
    '翻译结果',
    translationResult.messages[translationResult.messages.length - 1].content as string
  );

  logger.success('Demo 03 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});
