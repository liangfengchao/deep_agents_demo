/**
 * Demo 06: 记忆系统
 * 
 * 演示跨会话的长期记忆功能
 * 采用文件系统存储，类似 Claude Code 的记忆架构
 */

import 'dotenv/config';
import { createDeepAgent } from 'deepagents';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';

/**
 * 文件系统记忆存储（类似 Claude Code）
 * 
 * 存储结构：
 * ./memory/
 * ├── MEMORY.md          ← 索引文件（每条≤150字符）
 * ├── user.md            ← 用户偏好（角色、喜好、习惯）
 * ├── project.md         ← 项目记忆（决策、架构、技术栈）
 * └── feedback.md        ← 反馈纠正（用户纠正、改进建议）
 */
class FileSystemMemory {
  private memoryDir: string;
  private memoryContent: Map<string, string[]> = new Map();

  constructor() {
    // 使用项目目录下的 memory 文件夹
    this.memoryDir = path.join(process.cwd(), 'memory');
  }

  async init() {
    await fs.mkdir(this.memoryDir, { recursive: true });
    await this.loadMemories();
  }

  private async loadMemories() {
    const files = ['user.md', 'project.md', 'feedback.md'];
    
    for (const file of files) {
      const filePath = path.join(this.memoryDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.startsWith('- '));
        this.memoryContent.set(file, lines);
      } catch {
        this.memoryContent.set(file, []);
      }
    }
  }

  private async saveMemory(filename: string, lines: string[]) {
    const filePath = path.join(this.memoryDir, filename);
    const title = `# ${filename.replace('.md', '').toUpperCase()}\n\n`;
    await fs.writeFile(filePath, title + lines.join('\n'));
    this.memoryContent.set(filename, lines);
  }

  private async updateIndex(filename: string, description: string) {
    const indexPath = path.join(this.memoryDir, 'MEMORY.md');
    let indexContent = '';
    
    try {
      indexContent = await fs.readFile(indexPath, 'utf-8');
    } catch {
      indexContent = '# MEMORY INDEX\n\n';
    }

    // 如果索引中没有这个文件，添加它
    if (!indexContent.includes(filename)) {
      const newLine = `- [${description}](${filename})\n`;
      await fs.writeFile(indexPath, indexContent + newLine);
    }
  }

  /**
   * 智能分类并保存记忆
   */
  async save(content: string, threadId: string) {
    const timestamp = new Date().toISOString().split('T')[0];
    const entry = `- [${timestamp}] ${content}`;

    // 扩展分类关键词
    if (this.isUserMemory(content)) {
      await this.addToUser(entry, threadId);
    } else if (this.isProjectMemory(content)) {
      await this.addToProject(entry, threadId);
    } else if (this.isFeedbackMemory(content)) {
      await this.addToFeedback(entry, threadId);
    }
  }

  private isUserMemory(content: string): boolean {
    const keywords = [
      '我叫', '我是', '我喜欢', '我不喜欢',
      '我是一名', '我的职业', '我的名字',
      '我擅长', '我不擅长', '我的习惯',
      '我偏好', '我想要', '我需要'
    ];
    return keywords.some(k => content.includes(k));
  }

  private isProjectMemory(content: string): boolean {
    const keywords = [
      '项目', '架构', '技术栈', '框架',
      '数据库', 'API', '接口', '模块',
      '设计模式', '部署', '环境', '配置',
      '依赖', '版本', '规范', '约定'
    ];
    return keywords.some(k => content.includes(k));
  }

  private isFeedbackMemory(content: string): boolean {
    const keywords = [
      '不对', '错了', '应该', '不要', '必须',
      '记住', '以后', '下次', '注意', '提醒',
      '纠正', '改进', '改进', '建议', '要求'
    ];
    return keywords.some(k => content.includes(k));
  }

  private async addToUser(entry: string, threadId: string) {
    const lines = this.memoryContent.get('user.md') || [];
    lines.push(entry);
    await this.saveMemory('user.md', lines);
    await this.updateIndex('user.md', '用户偏好 — 角色、喜好、习惯');
    logger.info(`💾 记忆已保存到 user.md: ${entry}`);
  }

  private async addToProject(entry: string, threadId: string) {
    const lines = this.memoryContent.get('project.md') || [];
    lines.push(entry);
    await this.saveMemory('project.md', lines);
    await this.updateIndex('project.md', '项目记忆 — 决策、架构、技术栈');
    logger.info(`💾 记忆已保存到 project.md: ${entry}`);
  }

  private async addToFeedback(entry: string, threadId: string) {
    const lines = this.memoryContent.get('feedback.md') || [];
    lines.push(entry);
    await this.saveMemory('feedback.md', lines);
    await this.updateIndex('feedback.md', '反馈纠正 — 用户纠正、改进建议');
    logger.info(`💾 记忆已保存到 feedback.md: ${entry}`);
  }

  /**
   * 获取所有记忆（用于注入上下文）
   */
  getAllMemories(): string {
    const sections: string[] = [];

    for (const [filename, lines] of this.memoryContent.entries()) {
      if (lines.length > 0) {
        const title = this.getFileTitle(filename);
        sections.push(`## ${title}\n${lines.join('\n')}`);
      }
    }

    return sections.length > 0 ? sections.join('\n\n---\n\n') : '';
  }

  private getFileTitle(filename: string): string {
    const titles: Record<string, string> = {
      'user.md': '👤 用户偏好',
      'project.md': '📁 项目记忆',
      'feedback.md': '💡 反馈纠正',
    };
    return titles[filename] || filename;
  }

  /**
   * 打印所有记忆（用于调试）
   */
  async printMemories() {
    logger.info(`\n📂 记忆存储路径: ${this.memoryDir}\n`);
    
    for (const [filename, lines] of this.memoryContent.entries()) {
      logger.info(`📄 ${filename} (${lines.length} 条记忆):`);
      if (lines.length > 0) {
        logger.info(lines.join('\n'));
      } else {
        logger.info('  (空)');
      }
      logger.info('');
    }
  }

  getMemoryDir(): string {
    return this.memoryDir;
  }
}

async function main() {
  logger.divider();
  logger.info('Demo 06: 记忆系统（文件系统版）');
  logger.divider();

  // 创建记忆存储
  logger.step(1, '创建文件系统记忆存储');
  const memory = new FileSystemMemory();
  await memory.init();
  logger.info(`记忆存储路径: ${memory.getMemoryDir()}`);

  // 读取已有记忆
  const existingMemories = memory.getAllMemories();
  if (existingMemories) {
    logger.info(`\n📖 已加载 ${existingMemories.split('\n').length} 条记忆`);
  }

  // 创建 Agent，将记忆作为独立上下文
  logger.step(2, '创建带长期记忆的 Agent');
  
  const systemPrompt = `你是一个智能助手，具有长期记忆能力。

## 你的记忆

${existingMemories || '（暂无记忆）'}

## 指令

1. 当用户告诉你关于他们的信息时，记住这些信息
2. 在后续对话中使用这些记忆来提供更好的服务
3. 如果用户纠正你，记住纠正内容
4. 主动询问是否需要记住某些信息`;

  const agent = createDeepAgent({
    model: createLLM(),
    systemPrompt,
  });

  // 会话 1：用户告诉 Agent 一些信息
  logger.step(3, '会话 1：用户输入偏好信息');
  const threadId1 = 'user-123';
  
  const input1 = '我叫张三，我是一名前端开发工程师，我喜欢使用 TypeScript 和 React。';
  logger.info(`用户: ${input1}`);
  
  // 先保存记忆
  await memory.save(input1, threadId1);
  
  // 再调用 Agent
  const session1Result = await agent.invoke({
    messages: [
      { role: 'user', content: input1 },
      { role: 'system', content: `当前记忆:\n${memory.getAllMemories()}` },
    ],
  });
  
  logger.result(
    '会话 1 回复',
    session1Result.messages[session1Result.messages.length - 1].content as string
  );

  // 会话 2：测试项目记忆
  logger.step(4, '会话 2：用户输入项目信息');
  const input2 = '我们项目使用微服务架构，数据库是 PostgreSQL，部署在 Docker 容器中。';
  logger.info(`用户: ${input2}`);
  
  await memory.save(input2, threadId1);
  
  const session2Result = await agent.invoke({
    messages: [
      { role: 'user', content: input2 },
      { role: 'system', content: `当前记忆:\n${memory.getAllMemories()}` },
    ],
  });
  
  logger.result(
    '会话 2 回复',
    session2Result.messages[session2Result.messages.length - 1].content as string
  );

  // 会话 3：测试反馈记忆
  logger.step(5, '会话 3：用户纠正/反馈');
  const input3 = '不对，我们不用 MySQL，应该记住我们用的是 PostgreSQL。下次不要再搞错了。';
  logger.info(`用户: ${input3}`);
  
  await memory.save(input3, threadId1);
  
  const session3Result = await agent.invoke({
    messages: [
      { role: 'user', content: input3 },
      { role: 'system', content: `当前记忆:\n${memory.getAllMemories()}` },
    ],
  });
  
  logger.result(
    '会话 3 回复',
    session3Result.messages[session3Result.messages.length - 1].content as string
  );

  // 会话 4：验证记忆
  logger.step(6, '会话 4：验证记忆是否正确');
  const input4 = '我叫什么名字？我们项目用什么数据库？';
  logger.info(`用户: ${input4}`);
  
  const session4Result = await agent.invoke({
    messages: [
      { role: 'user', content: input4 },
      { role: 'system', content: `当前记忆:\n${memory.getAllMemories()}` },
    ],
  });
  
  logger.result(
    '会话 4 回复',
    session4Result.messages[session4Result.messages.length - 1].content as string
  );

  // 打印记忆文件内容
  logger.step(7, '查看持久化的记忆文件');
  await memory.printMemories();

  // 说明记忆系统的工作原理
  logger.step(8, '记忆系统说明');
  logger.info(`
文件系统记忆架构（类似 Claude Code）：

1. 存储结构：
   ./memory/
   ├── MEMORY.md          ← 索引文件（每条≤150字符）
   ├── user.md            ← 用户偏好（角色、喜好、习惯）
   ├── project.md         ← 项目记忆（决策、架构、技术栈）
   └── feedback.md        ← 反馈纠正（用户纠正、改进建议）

2. 智能分类（扩展关键词）：
   用户偏好: 我叫/我是/我喜欢/我是一名/我的职业/我擅长...
   项目记忆: 项目/架构/技术栈/框架/数据库/API/模块/部署...
   反馈纠正: 不对/错了/应该/不要/必须/记住/以后/下次...

3. 记忆注入方式：
   - 启动时读取所有记忆文件
   - 作为独立的 system message 注入
   - 不混在 systemPrompt 里，便于管理

4. 优势：
   - 人可读：Markdown 格式，可直接编辑
   - Git 友好：可版本控制
   - 持久化：重启不丢失
   - 按需加载：只读取相关记忆

5. Electron 适配：
   - 当前使用 process.cwd()/memory
   - Electron 中替换为 app.getPath('userData')/memory
  `);

  logger.success('Demo 06 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});
