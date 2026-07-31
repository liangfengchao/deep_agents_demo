/**
 * 上下文 Token 分桶统计（gpt-tokenizer）
 *
 * 分类：
 * - system: 系统提示词
 * - tools_agents: 工具及智能体（内置工具 / 业务工具 / 子 Agent）
 * - messages: 对话消息
 * - mcp: 连接器及 MCP
 * - skills: 技能（SKILL.md 等）
 */

import { countTokens, encodeChat } from 'gpt-tokenizer';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createMiddleware } from 'langchain';

export type ContextCategory =
  | 'system'
  | 'tools_agents'
  | 'messages'
  | 'mcp'
  | 'skills';

export const CONTEXT_CATEGORY_LABEL: Record<ContextCategory, string> = {
  system: '系统提示词',
  tools_agents: '工具及智能体',
  messages: '对话消息',
  mcp: '连接器及MCP',
  skills: '技能',
};

export type ToolLike = {
  name: string;
  description?: string;
  schema?: unknown;
  /** 来源标记，便于调试 */
  source?: 'builtin' | 'custom' | 'mcp' | string;
};

export type AgentLike = {
  name: string;
  description?: string;
  systemPrompt?: string;
};

export type ChatMessageLike = {
  role: 'system' | 'user' | 'assistant' | string;
  content: string;
};

export type SkillLike = {
  name: string;
  description?: string;
  /** SKILL.md 全文或片段 */
  content?: string;
  path?: string;
};

export type ContextTokenInput = {
  systemPrompt?: string;
  /** DeepAgent 默认内置工具估算 */
  includeBuiltinTools?: boolean;
  /** 业务自定义工具 */
  tools?: ToolLike[];
  /** 同步 / 异步子智能体 */
  agents?: AgentLike[];
  /** 对话消息（user/assistant/tool 结果等） */
  messages?: ChatMessageLike[];
  /** MCP / 连接器工具 */
  mcpTools?: ToolLike[];
  /** 技能元数据或全文 */
  skills?: SkillLike[];
};

export type CategoryStat = {
  category: ContextCategory;
  label: string;
  tokens: number;
  percent: number;
  items: Array<{ name: string; tokens: number }>;
};

export type ContextTokenReport = {
  total: number;
  categories: CategoryStat[];
};

const BUILTIN_TOOLS: ToolLike[] = [
  { name: 'write_todos', description: 'Create and manage a structured task list', source: 'builtin' },
  { name: 'task', description: 'Delegate work to a subagent with isolated context', source: 'builtin' },
  { name: 'ls', description: 'List files in a directory', source: 'builtin' },
  { name: 'read_file', description: 'Read a file from the filesystem', source: 'builtin' },
  { name: 'write_file', description: 'Write content to a file', source: 'builtin' },
  { name: 'edit_file', description: 'Edit an existing file', source: 'builtin' },
  { name: 'glob', description: 'Find files by glob pattern', source: 'builtin' },
  { name: 'grep', description: 'Search file contents by regex', source: 'builtin' },
  { name: 'execute', description: 'Execute a shell command in sandbox', source: 'builtin' },
  { name: 'start_async_task', description: 'Start an async subagent task', source: 'builtin' },
  { name: 'check_async_task', description: 'Check async task status and result', source: 'builtin' },
  { name: 'update_async_task', description: 'Send follow-up to a running async task', source: 'builtin' },
  { name: 'cancel_async_task', description: 'Cancel a running async task', source: 'builtin' },
  { name: 'list_async_tasks', description: 'List tracked async tasks', source: 'builtin' },
];

export function countTextTokens(text: string): number {
  if (!text) return 0;
  return countTokens(text);
}

export function serializeTool(tool: ToolLike): string {
  const schemaText =
    tool.schema == null
      ? ''
      : typeof tool.schema === 'string'
        ? tool.schema
        : JSON.stringify(tool.schema, null, 0);
  return [
    `tool:${tool.name}`,
    tool.description ? `description:${tool.description}` : '',
    schemaText ? `schema:${schemaText}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function serializeAgent(agent: AgentLike): string {
  return [
    `agent:${agent.name}`,
    agent.description ? `description:${agent.description}` : '',
    agent.systemPrompt ? `systemPrompt:${agent.systemPrompt}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function serializeSkill(skill: SkillLike): string {
  return [
    `skill:${skill.name}`,
    skill.description ? `description:${skill.description}` : '',
    skill.content ? `content:${skill.content}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function itemTokens(name: string, text: string) {
  return { name, tokens: countTextTokens(text) };
}

function sumItems(items: Array<{ tokens: number }>) {
  return items.reduce((s, x) => s + x.tokens, 0);
}

/**
 * 按上下文类别汇总 token（本地 gpt-tokenizer 估算）
 */
export function analyzeContextTokens(input: ContextTokenInput): ContextTokenReport {
  const buckets: Record<ContextCategory, Array<{ name: string; tokens: number }>> = {
    system: [],
    tools_agents: [],
    messages: [],
    mcp: [],
    skills: [],
  };

  if (input.systemPrompt) {
    buckets.system.push(itemTokens('systemPrompt', input.systemPrompt));
  }

  if (input.includeBuiltinTools !== false) {
    for (const tool of BUILTIN_TOOLS) {
      buckets.tools_agents.push(itemTokens(`builtin:${tool.name}`, serializeTool(tool)));
    }
  }

  for (const tool of input.tools ?? []) {
    buckets.tools_agents.push(itemTokens(`tool:${tool.name}`, serializeTool(tool)));
  }

  for (const agent of input.agents ?? []) {
    buckets.tools_agents.push(itemTokens(`agent:${agent.name}`, serializeAgent(agent)));
  }

  if (input.messages?.length) {
    const chat = input.messages.map((m) => ({
      role: (m.role === 'system' || m.role === 'user' || m.role === 'assistant'
        ? m.role
        : 'user') as 'system' | 'user' | 'assistant',
      content: m.content,
    }));
    // 整段对话按 chat 模板计一次，同时给出逐条明细
    buckets.messages.push({
      name: 'encodeChat(total)',
      tokens: encodeChat(chat, 'gpt-4o').length,
    });
    input.messages.forEach((m, i) => {
      buckets.messages.push(
        itemTokens(`msg[${i}]:${m.role}`, `${m.role}: ${m.content}`),
      );
    });
  }

  for (const tool of input.mcpTools ?? []) {
    const label = tool.source ? `${tool.source}/${tool.name}` : tool.name;
    buckets.mcp.push(itemTokens(label, serializeTool(tool)));
  }

  for (const skill of input.skills ?? []) {
    buckets.skills.push(itemTokens(`skill:${skill.name}`, serializeSkill(skill)));
  }

  // messages 桶里 encodeChat(total) + 逐条会双重计数，报告 total 时对 messages 只用 encodeChat
  const messageChatTotal = buckets.messages.find((x) => x.name === 'encodeChat(total)')?.tokens ?? 0;
  const messageDetails = buckets.messages.filter((x) => x.name !== 'encodeChat(total)');

  const categoryTotals: Record<ContextCategory, number> = {
    system: sumItems(buckets.system),
    tools_agents: sumItems(buckets.tools_agents),
    messages: messageChatTotal || sumItems(messageDetails),
    mcp: sumItems(buckets.mcp),
    skills: sumItems(buckets.skills),
  };

  const total =
    categoryTotals.system +
    categoryTotals.tools_agents +
    categoryTotals.messages +
    categoryTotals.mcp +
    categoryTotals.skills;

  const categories: CategoryStat[] = (Object.keys(CONTEXT_CATEGORY_LABEL) as ContextCategory[]).map(
    (category) => {
      const tokens = categoryTotals[category];
      const items =
        category === 'messages'
          ? [
              { name: 'encodeChat(total)', tokens: categoryTotals.messages },
              ...messageDetails,
            ]
          : buckets[category];
      return {
        category,
        label: CONTEXT_CATEGORY_LABEL[category],
        tokens,
        percent: total ? Number(((tokens / total) * 100).toFixed(1)) : 0,
        items,
      };
    },
  );

  return { total, categories };
}

export function formatContextTokenReport(report: ContextTokenReport): string {
  const lines = [
    `上下文合计 tokens: ${report.total}`,
    '',
    '分类占比:',
    ...report.categories.map(
      (c) =>
        `  - ${c.label.padEnd(10)} ${String(c.tokens).padStart(6)}  (${c.percent}%)`,
    ),
    '',
    '明细:',
  ];

  for (const c of report.categories) {
    if (!c.items.length) {
      lines.push(`  [${c.label}] (空)`);
      continue;
    }
    lines.push(`  [${c.label}]`);
    for (const item of c.items.slice(0, 20)) {
      lines.push(`    · ${item.name}: ${item.tokens}`);
    }
    if (c.items.length > 20) {
      lines.push(`    · ... 另有 ${c.items.length - 20} 项`);
    }
  }

  return lines.join('\n');
}

/** 从技能目录加载 SKILL.md（仅 name/description + 正文，用于估算） */
export async function loadSkillsFromDir(
  skillsDir: string,
  options?: { limit?: number },
): Promise<SkillLike[]> {
  const limit = options?.limit ?? 20;
  let entries: string[] = [];
  try {
    entries = await fs.readdir(skillsDir);
  } catch {
    return [];
  }

  const skills: SkillLike[] = [];
  for (const name of entries) {
    if (skills.length >= limit) break;
    const skillMd = path.join(skillsDir, name, 'SKILL.md');
    try {
      const content = await fs.readFile(skillMd, 'utf8');
      const description = extractFrontmatterField(content, 'description') ?? '';
      skills.push({
        name: extractFrontmatterField(content, 'name') ?? name,
        description,
        content,
        path: skillMd,
      });
    } catch {
      // skip
    }
  }
  return skills;
}

function extractFrontmatterField(md: string, field: string): string | null {
  const match = md.match(new RegExp(`^${field}:\\s*[\"']?(.+?)[\"']?\\s*$`, 'm'));
  return match?.[1]?.trim() ?? null;
}

/** 从 langchain tool 对象提取 ToolLike */
export function toolFromStructured(tool: {
  name: string;
  description?: string;
  schema?: unknown;
}): ToolLike {
  return {
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    source: 'custom',
  };
}

function messageContentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object' && 'text' in block) {
          return String((block as { text?: string }).text ?? '');
        }
        return '';
      })
      .join('');
  }
  return content == null ? '' : JSON.stringify(content);
}

/**
 * 从 DeepAgents SkillsMiddleware 注入后的 system 文本中拆出技能段。
 * 标记：`## Skills System`
 */
export function splitSystemAndSkills(systemText: string): {
  systemPrompt: string;
  skillsText: string;
} {
  const marker = '## Skills System';
  const idx = systemText.indexOf(marker);
  if (idx < 0) {
    return { systemPrompt: systemText.trim(), skillsText: '' };
  }
  return {
    systemPrompt: systemText.slice(0, idx).trim(),
    skillsText: systemText.slice(idx).trim(),
  };
}

export type TokenBudgetMiddlewareOptions = {
  /** MCP / 连接器工具名，计入「连接器及MCP」 */
  mcpToolNames?: string[];
  /** 每次模型调用结束后回调（可用于日志 / 埋点） */
  onReport?: (
    report: ContextTokenReport,
    meta: { callIndex: number; completionTokens: number },
  ) => void;
  /** 是否打印到 console，默认 true */
  log?: boolean;
};

/**
 * DeepAgent / createAgent 中间件：每次模型调用结束后，对本次请求上下文做分桶统计。
 *
 * SkillsMiddleware 等已改写过 systemMessage，tools 也已汇齐，统计的是真实上下文。
 */
export function createTokenBudgetMiddleware(options: TokenBudgetMiddlewareOptions = {}) {
  const mcpNames = new Set(options.mcpToolNames ?? []);
  const shouldLog = options.log !== false;
  let callIndex = 0;
  let lastReport: ContextTokenReport | null = null;

  const middleware = createMiddleware({
    name: 'TokenBudgetMiddleware',
    wrapModelCall: async (request, handler) => {
      const response = await handler(request);
      callIndex += 1;

      const systemRaw =
        messageContentToText(request.systemMessage?.content) ||
        request.systemPrompt ||
        '';
      const { systemPrompt, skillsText } = splitSystemAndSkills(systemRaw);

      const toolsAgents: ToolLike[] = [];
      const mcpTools: ToolLike[] = [];
      for (const t of request.tools ?? []) {
        const name = (t as { name?: string }).name ?? 'unknown';
        const description = (t as { description?: string }).description;
        const schema = (t as { schema?: unknown }).schema;
        const item: ToolLike = { name, description, schema };
        if (mcpNames.has(name)) {
          mcpTools.push({ ...item, source: 'mcp' });
        } else {
          toolsAgents.push({ ...item, source: 'custom' });
        }
      }

      const messages: ChatMessageLike[] = (request.messages ?? []).map((m) => {
        const type =
          typeof (m as { getType?: () => string }).getType === 'function'
            ? (m as { getType: () => string }).getType()
            : ((m as { role?: string }).role ?? 'user');
        const role =
          type === 'human' || type === 'user'
            ? 'user'
            : type === 'ai' || type === 'assistant'
              ? 'assistant'
              : type === 'system'
                ? 'system'
                : type === 'tool'
                  ? 'user'
                  : 'user';
        return {
          role,
          content: messageContentToText((m as { content?: unknown }).content),
        };
      });

      const report = analyzeContextTokens({
        systemPrompt,
        includeBuiltinTools: false, // 已包含在 request.tools 里
        tools: toolsAgents,
        messages,
        mcpTools,
        skills: skillsText
          ? [{ name: 'skills_system_section', content: skillsText }]
          : [],
      });

      const completionText = messageContentToText(
        (response as { content?: unknown })?.content,
      );
      const completionTokens = countTextTokens(completionText);

      lastReport = report;
      options.onReport?.(report, { callIndex, completionTokens });
      if (shouldLog) {
        console.log(
          `\n📊 [TokenBudget] 第 ${callIndex} 次模型调用结束:\n` +
            `${formatContextTokenReport(report)}\n` +
            `本次 completion tokens: ${completionTokens}\n`,
        );
      }

      return response;
    },
  });

  return Object.assign(middleware, {
    getLastReport: () => lastReport,
    getCallCount: () => callIndex,
    reset: () => {
      callIndex = 0;
      lastReport = null;
    },
  });
}
