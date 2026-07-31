/**
 * Demo 09: MCP 连接器 — 腾讯文档
 *
 * 用真实远程 MCP（腾讯文档）演示连接器鉴权与工具挂载：
 * 1. 用户在腾讯文档开放平台领取个人 Token
 * 2. 通过 Authorization Header 连接 https://docs.qq.com/openapi/mcp
 * 3. MultiServerMCPClient 拉取 tools → 交给 createDeepAgent
 *
 * Token 获取：https://docs.qq.com/open/auth/mcp.html
 * 官方说明：https://docs.qq.com/open/document/mcp/
 *
 * 运行：
 *   在 .env 中设置 TENCENT_DOCS_TOKEN=你的Token
 *   pnpm demo:mcp
 */

import 'dotenv/config';
import { createDeepAgent } from 'deepagents';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { logger } from './utils/logger.js';
import { createLLM } from './utils/config.js';

/** 腾讯文档 MCP 默认端点（与 WorkBuddy / IDE 配置一致） */
const TENCENT_DOCS_MCP_URL =
  process.env.TENCENT_DOCS_MCP_URL || 'https://docs.qq.com/openapi/mcp';

const TOKEN_PAGE = 'https://docs.qq.com/open/auth/mcp.html';

function requireTencentDocsToken(): string {
  const token = process.env.TENCENT_DOCS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      `未配置 TENCENT_DOCS_TOKEN。\n` +
        `1. 打开 ${TOKEN_PAGE} 登录并复制 Token\n` +
        `2. 在 .env 中写入：TENCENT_DOCS_TOKEN=你的Token\n` +
        `注意：Header 的 key 必须是 Authorization，不要用 X-Token 等别名`,
    );
  }
  return token;
}

/**
 * 连接腾讯文档 MCP。
 * 鉴权方式：API Token 注入 Authorization（腾讯文档个人 MCP Token，非 OAuth 浏览器流）。
 * 企业版 WorkBuddy 还可选 MCP OAuth 2.1 / OAuth 2.0；本 Demo 对齐个人开发者最简路径。
 */
function createTencentDocsMcpClient(token: string) {
  return new MultiServerMCPClient({
    throwOnLoadError: true,
    prefixToolNameWithServerName: false,
    mcpServers: {
      'tencent-docs': {
        transport: 'http',
        url: TENCENT_DOCS_MCP_URL,
        headers: {
          // 官方要求 key 必须是 Authorization；值为开放平台复制的 Token
          Authorization: token,
        },
      },
    },
  });
}

async function main() {
  logger.divider();
  logger.info('Demo 09: MCP 连接器 — 腾讯文档');
  logger.divider();

  // 步骤 1: 读取鉴权 Token
  logger.step(1, '读取腾讯文档 MCP Token');
  const token = requireTencentDocsToken();
  logger.success(
    `Token 已加载（长度 ${token.length}），MCP URL: ${TENCENT_DOCS_MCP_URL}`,
  );

  // 步骤 2: 连接远程 MCP，拉取工具列表
  logger.step(2, '连接腾讯文档 MCP 并列出工具');
  const mcpClient = createTencentDocsMcpClient(token);

  let tools;
  try {
    tools = await mcpClient.getTools();
  } catch (err) {
    await mcpClient.close().catch(() => undefined);
    throw new Error(
      `连接腾讯文档 MCP 失败（常见原因：Token 无效/过期、网络不通）。\n` +
        `请到 ${TOKEN_PAGE} 重新获取 Token。\n` +
        `原始错误: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!tools.length) {
    await mcpClient.close();
    throw new Error('MCP 已连接，但未返回任何工具，请检查账号权限或会员状态');
  }

  logger.success(`已加载 ${tools.length} 个工具：`);
  for (const t of tools) {
    const desc = (t.description || '').replace(/\s+/g, ' ').slice(0, 80);
    logger.info(`  - ${t.name}${desc ? `：${desc}` : ''}`);
  }

  // 步骤 3: 挂到 DeepAgent
  logger.step(3, '创建带腾讯文档 MCP 工具的 DeepAgent');
  const toolNames = tools.map((t) => t.name).join('、');
  const agent = createDeepAgent({
    model: createLLM(),
    tools,
    systemPrompt: `你是办公助手，已连接「腾讯文档」MCP 连接器。
可用工具：${toolNames}

规则：
- 优先调用腾讯文档相关工具完成用户请求
- 用简洁中文回复；需要时说明调用了哪个工具
- 若工具返回鉴权/会员错误，提示用户检查 Token 或会员状态`,
  });
  logger.success('Agent 创建完成');

  // 步骤 4: 试跑一轮（只读查询，避免误改用户文档）
  logger.step(4, '试跑：让 Agent 使用腾讯文档工具');
  const userPrompt =
    process.env.TENCENT_DOCS_DEMO_PROMPT ||
    '请用腾讯文档工具，帮我看看我最近能访问的文档或空间里有什么（只读，不要创建或修改）';

  logger.info(`用户：${userPrompt}`);

  const result = await agent.invoke({
    messages: [{ role: 'user', content: userPrompt }],
  });

  const last = result.messages[result.messages.length - 1];
  const content =
    typeof last.content === 'string'
      ? last.content
      : JSON.stringify(last.content);
  logger.result('Agent 回复', content);

  // 步骤 5: 说明连接器鉴权模型
  logger.step(5, '连接器鉴权说明（对照产品设计）');
  logger.info(`
腾讯文档 MCP 鉴权路径（本 Demo）：

  用户领取 Token（${TOKEN_PAGE}）
       ↓
  .env: TENCENT_DOCS_TOKEN
       ↓
  MultiServerMCPClient
    url: ${TENCENT_DOCS_MCP_URL}
    headers.Authorization: <Token>   ← key 名必须是 Authorization
       ↓
  getTools() → createDeepAgent({ tools })
       ↓
  Agent 调工具时，适配器自动带上该 Header 访问腾讯文档

与 WorkBuddy「连接器」的对应关系：
  - MCP Server URL  → TENCENT_DOCS_MCP_URL
  - 认证类型 API Key → Authorization Header + Token
  - 企业版还可选 MCP OAuth 2.1 / OAuth 2.0（浏览器授权拿 Token）
  - 本 Demo 用个人 Token，适合本地联调；产品里应把 Token 加密存 electron-store

常见错误：
  - 400006 Token 鉴权失败 → 检查 Header key / 重新获取 Token
  - 400007 VIP 权限不足 → 部分能力需超级会员
`);

  await mcpClient.close();
  logger.success('Demo 09 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});
