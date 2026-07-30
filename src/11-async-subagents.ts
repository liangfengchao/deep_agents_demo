/**
 * Demo 11: 模拟异步子智能体协作
 *
 * 模拟 AsyncSubAgent 的行为：
 * - 启动任务后立即返回任务 ID
 * - 主 Agent 可以继续与用户交互
 * - 可以随时检查任务状态、更新任务或取消任务
 *
 * 注意：这是模拟实现，真正的 AsyncSubAgent 需要 Agent Protocol 服务器
 */

import 'dotenv/config';
import { createDeepAgent } from 'deepagents';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';

// ========== 模拟 AsyncSubAgent 任务管理器 ==========
class MockAsyncTaskManager {
  private tasks: Map<string, {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    result?: string;
    createdAt: Date;
    updatedAt: Date;
  }> = new Map();

  private taskIdCounter = 0;

  // 启动异步任务
  async startTask(name: string, taskFn: () => Promise<string>): Promise<string> {
    const taskId = `task_${++this.taskIdCounter}_${Date.now()}`;

    this.tasks.set(taskId, {
      id: taskId,
      name,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 异步执行任务
    this.executeTask(taskId, taskFn);

    return taskId;
  }

  private async executeTask(taskId: string, taskFn: () => Promise<string>) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'running';
    task.updatedAt = new Date();

    try {
      const result = await taskFn();
      task.status = 'completed';
      task.result = result;
    } catch (error) {
      task.status = 'failed';
      task.result = error instanceof Error ? error.message : String(error);
    }
    task.updatedAt = new Date();
  }

  // 检查任务状态
  checkTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { status: 'not_found', message: '任务不存在' };
    }
    return {
      status: task.status,
      result: task.result,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  // 列出所有任务
  listTasks() {
    return Array.from(this.tasks.values()).map(task => ({
      id: task.id,
      name: task.name,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));
  }

  // 取消任务（模拟）
  cancelTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, message: '任务不存在' };
    }
    if (task.status === 'completed' || task.status === 'failed') {
      return { success: false, message: '任务已完成或失败，无法取消' };
    }
    task.status = 'cancelled';
    task.updatedAt = new Date();
    return { success: true, message: '任务已取消' };
  }
}

// ========== 创建模拟子智能体 ==========
async function createMockSubAgent(name: string, systemPrompt: string) {
  const agent = createDeepAgent({
    model: createLLM(),
    name,
    systemPrompt,
  });

  return {
    name,
    invoke: async (input: string) => {
      const result = await agent.invoke({
        messages: [{ role: 'user', content: input }],
      });
      return result.messages[result.messages.length - 1].content as string;
    },
  };
}

// ========== 主函数 ==========
async function main() {
  logger.divider();
  logger.info('Demo 11: 模拟异步子智能体协作');
  logger.divider();

  // 创建任务管理器
  const taskManager = new MockAsyncTaskManager();

  // 创建模拟子智能体
  logger.step(1, '创建模拟异步子智能体');

  const dataAnalyst = await createMockSubAgent(
    '数据分析师',
    `你是一个专业的数据分析师。你的职责是：
- 分析用户提供的数据
- 提取关键指标和趋势
- 给出数据驱动的洞察和建议

请用简洁的中文回答。`
  );

  const reportWriter = await createMockSubAgent(
    '报告撰写专家',
    `你是一个专业的报告撰写专家。你的职责是：
- 根据数据分析结果撰写结构化报告
- 使用清晰的标题和段落
- 确保报告专业、易读

请用 Markdown 格式输出报告。`
  );

  const translator = await createMockSubAgent(
    '翻译专家',
    `你是一个专业的中英翻译专家。你的职责是：
- 将中文内容翻译成地道的英文
- 保持专业术语的准确性
- 确保翻译流畅自然

只输出英文翻译结果，不要添加额外说明。`
  );

  logger.success('模拟异步子智能体创建完成');

  // 模拟异步任务执行
  logger.step(2, '模拟异步任务执行');

  console.log('\n--- 启动异步任务 ---\n');

  // 启动数据分析任务
  const dataTaskId = await taskManager.startTask('数据分析任务', async () => {
    console.log(`[${new Date().toISOString()}] 数据分析任务开始执行...`);
    const result = await dataAnalyst.invoke(`分析以下销售数据：
- 1月：100万
- 2月：120万
- 3月：90万
- 4月：150万
- 5月：180万

请分析趋势并给出建议。`);
    console.log(`[${new Date().toISOString()}] 数据分析任务完成`);
    return result;
  });
  console.log(`>>> 数据分析任务已启动，任务ID: ${dataTaskId}`);

  // 启动报告生成任务
  const reportTaskId = await taskManager.startTask('报告生成任务', async () => {
    console.log(`[${new Date().toISOString()}] 报告生成任务开始执行...`);
    const result = await reportWriter.invoke(`根据以下信息撰写一份季度报告摘要：
- 公司：TechCorp
- 季度：2024 Q1
- 营收：5000万
- 同比增长：25%
- 主要成就：推出3款新产品，客户满意度提升至95%

请撰写一份专业的报告摘要。`);
    console.log(`[${new Date().toISOString()}] 报告生成任务完成`);
    return result;
  });
  console.log(`>>> 报告生成任务已启动，任务ID: ${reportTaskId}`);

  // 启动翻译任务
  const translateTaskId = await taskManager.startTask('翻译任务', async () => {
    console.log(`[${new Date().toISOString()}] 翻译任务开始执行...`);
    const result = await translator.invoke('将以下内容翻译成英文：\n\n人工智能正在改变我们的生活方式。从智能手机到自动驾驶汽车，AI技术已经渗透到日常生活的方方面面。');
    console.log(`[${new Date().toISOString()}] 翻译任务完成`);
    return result;
  });
  console.log(`>>> 翻译任务已启动，任务ID: ${translateTaskId}`);

  // 主 Agent 继续执行其他操作（模拟）
  console.log('\n--- 主 Agent 继续执行其他操作 ---');
  console.log('主 Agent: 已启动 3 个异步任务，现在可以继续与用户交互...');
  console.log('主 Agent: 用户可以继续提问，不需要等待任务完成');

  // 模拟用户交互
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('\n主 Agent: 用户问"任务进展如何？"');

  // 检查任务状态
  logger.step(3, '检查任务状态');

  console.log('\n--- 任务状态列表 ---');
  const tasks = taskManager.listTasks();
  for (const task of tasks) {
    console.log(`任务ID: ${task.id}`);
    console.log(`  名称: ${task.name}`);
    console.log(`  状态: ${task.status}`);
    console.log(`  创建时间: ${task.createdAt.toISOString()}`);
    console.log(`  更新时间: ${task.updatedAt.toISOString()}`);
    console.log('');
  }

  // 等待所有任务完成
  console.log('\n--- 等待所有任务完成 ---\n');

  // 轮询检查任务状态
  const checkInterval = setInterval(() => {
    const dataStatus = taskManager.checkTask(dataTaskId);
    const reportStatus = taskManager.checkTask(reportTaskId);
    const translateStatus = taskManager.checkTask(translateTaskId);

    console.log(`[${new Date().toISOString()}] 任务状态检查:`);
    console.log(`  数据分析: ${dataStatus.status}`);
    console.log(`  报告生成: ${reportStatus.status}`);
    console.log(`  翻译: ${translateStatus.status}`);

    if (dataStatus.status === 'completed' &&
        reportStatus.status === 'completed' &&
        translateStatus.status === 'completed') {
      clearInterval(checkInterval);
      printResults();
    }
  }, 2000);

  // 打印结果
  function printResults() {
    logger.step(4, '打印任务结果');

    const dataResult = taskManager.checkTask(dataTaskId);
    const reportResult = taskManager.checkTask(reportTaskId);
    const translateResult = taskManager.checkTask(translateTaskId);

    console.log('\n=== 数据分析任务结果 ===');
    console.log(dataResult.result);

    console.log('\n=== 报告生成任务结果 ===');
    console.log(reportResult.result);

    console.log('\n=== 翻译任务结果 ===');
    console.log(translateResult.result);

    // 说明异步子智能体架构
    logger.step(5, '异步子智能体架构说明');
    logger.info(`
异步子智能体架构（模拟实现）：

1. 架构特点：
   - 启动任务后立即返回任务 ID
   - 主 Agent 可以继续与用户交互
   - 可以随时检查任务状态、更新任务或取消任务
   - 任务在后台并行执行

2. 关键要点：
   - 使用任务管理器跟踪所有异步任务
   - 每个任务有独立的状态和结果
   - 主 Agent 通过任务 ID 管理任务
   - 支持任务取消和状态查询

3. 与同步子智能体的区别：
   - 同步：主 Agent 阻塞等待子 Agent 完成
   - 异步：主 Agent 立即返回，继续执行其他操作
   - 异步：支持中途更新和取消任务
   - 异步：任务状态持久化，可跨交互查询

4. 真正的 AsyncSubAgent：
   - 需要 Agent Protocol 服务器（如 LangSmith Deployments）
   - 使用 graphId 指定远程 Agent
   - 通过 start_async_task、check_async_task 等工具管理
   - 支持跨网络、跨进程的异步执行

5. 适用场景：
   - 长时间运行的任务（如深度研究、代码分析）
   - 需要并行处理多个独立任务
   - 需要与用户持续交互的场景
   - 需要中途调整任务的场景
    `);

    logger.success('Demo 11 完成');
  }
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});