/**
 * Demo 05: 沙盒执行
 * 
 * 展示在安全沙盒环境中执行代码
 * 包括 Python、Node.js 脚本
 */

import 'dotenv/config';
import { createDeepAgent } from 'deepagents';
import { FilesystemBackend } from 'deepagents';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  logger.divider();
  logger.info('Demo 05: 沙盒执行');
  logger.divider();

  // 创建临时工作目录
  const workDir = path.join(process.cwd(), '.sandbox-workspace');
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  logger.step(1, '创建沙盒后端');
  const backend = new FilesystemBackend({
    rootDir: workDir,
  });

  // 创建带沙盒的 Agent
  logger.step(2, '创建带沙盒执行能力的 Agent');
  const agent = createDeepAgent({
    model: createLLM(),
    systemPrompt: `你是一个编程助手，可以在沙盒环境中执行代码。
你可以：
- 创建和编辑文件
- 执行 Python 脚本
- 执行 Node.js 脚本
- 执行 Shell 命令

所有操作都在安全的沙盒环境中进行。`,
    backend,
  });

  // 测试场景 1：Python 脚本执行
  logger.step(3, '测试 Python 脚本执行');
  const pythonResult = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: `创建一个 Python 脚本 calculate.py，计算斐波那契数列的前 10 项，然后执行它。`,
      },
    ],
  });
  logger.result(
    'Python 执行结果',
    pythonResult.messages[pythonResult.messages.length - 1].content as string
  );

  // 测试场景 2：Node.js 脚本执行
  logger.step(4, '测试 Node.js 脚本执行');
  const nodeResult = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: `创建一个 Node.js 脚本 array-ops.js，演示数组的各种操作方法（map, filter, reduce），然后执行它。`,
      },
    ],
  });
  logger.result(
    'Node.js 执行结果',
    nodeResult.messages[nodeResult.messages.length - 1].content as string
  );

  // 测试场景 3：文件操作
  logger.step(5, '测试文件操作');
  const fileResult = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: `创建一个 data.json 文件，包含一些示例数据（用户列表），然后读取并显示内容。`,
      },
    ],
  });
  logger.result(
    '文件操作结果',
    fileResult.messages[fileResult.messages.length - 1].content as string
  );

  // 清理工作目录
  logger.step(6, '清理工作目录');
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
    logger.success('工作目录已清理');
  } catch (error) {
    logger.warn('清理工作目录失败', error);
  }

  logger.success('Demo 05 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});
