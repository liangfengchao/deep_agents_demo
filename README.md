# DeepAgents TypeScript Demo Collection

基于 [DeepAgents](https://github.com/langchain-ai/deepagentsjs) 的 TypeScript 演示集合，展示多智能体、技能系统、沙盒执行等核心功能。

## 📋 前置要求

- Node.js >= 18
- pnpm 或 npm
- OpenAI API Key（或其他支持的模型提供商）

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入你的 API Key
```

### 3. 运行 Demo

```bash
# 基础 Agent
pnpm demo:basic

# 自定义工具
pnpm demo:tools

# 多智能体协作
pnpm demo:multi

# 技能系统
pnpm demo:skills

# 沙盒执行
pnpm demo:sandbox

# 记忆系统
pnpm demo:memory

# 流式输出
pnpm demo:stream

# 检查点持久化
pnpm demo:checkpoint

# MCP 工具
pnpm demo:mcp

# Token 用量统计
pnpm demo:token
```

## 📚 Demo 列表

### 01 - 基础 Agent
最简单的 DeepAgent 使用示例，展示如何创建 Agent 并进行对话。

### 02 - 自定义工具
演示如何定义和使用自定义工具，让 Agent 能够调用外部函数。

### 03 - 多智能体协作
展示多个 Agent 之间的协作，主 Agent 可以将任务委派给子 Agent。

### 04 - 技能系统
演示 DeepAgents 的技能（Skills）系统，如何加载和使用预定义技能。

### 05 - 沙盒执行
展示在安全沙盒环境中执行代码，包括 Python、Node.js 脚本。

### 06 - 记忆系统
演示跨会话的长期记忆功能，Agent 可以记住用户偏好和上下文。

### 07 - 流式输出
展示如何实时流式输出 Agent 的思考过程和执行结果。

### 08 - 检查点持久化
演示如何使用 Checkpointer 持久化对话状态，支持中断恢复。

### 09 - MCP 连接器（腾讯文档）
通过 `@langchain/mcp-adapters` 连接远程腾讯文档 MCP（`https://docs.qq.com/openapi/mcp`），
用 `Authorization` Header 注入个人 Token，拉取真实工具并交给 DeepAgent。

```bash
# 1. 打开 https://docs.qq.com/open/auth/mcp.html 获取 Token
# 2. .env 写入 TENCENT_DOCS_TOKEN=...
pnpm demo:mcp
```

### 13 - Token 用量统计
`TokenBudgetMiddleware` 在每次模型调用结束后分桶统计：系统提示词 / 工具及智能体 / 对话消息 / 连接器及MCP / 技能。

## 🏗️ 项目结构

```
qlzc-electron/
├── src/
│   ├── 01-basic-agent.ts      # 基础 Agent
│   ├── 02-custom-tools.ts     # 自定义工具
│   ├── 03-multi-agent.ts      # 多智能体
│   ├── 04-skills.ts           # 技能系统
│   ├── 05-sandbox.ts          # 沙盒执行
│   ├── 06-memory.ts           # 记忆系统
│   ├── 07-streaming.ts        # 流式输出
│   ├── 08-checkpoint.ts       # 检查点
│   ├── 09-mcp-tools.ts        # MCP 工具
│   └── utils/
│       └── logger.ts          # 日志工具
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🔧 技术栈

- **DeepAgents**: LangChain 官方 Agent Harness
- **LangGraph**: 状态管理和流程控制
- **TypeScript**: 类型安全
- **tsx**: TypeScript 执行器

## 📖 参考文档

- [DeepAgents 官方文档](https://docs.langchain.com/oss/javascript/deepagents/)
- [DeepAgents npm 包](https://www.npmjs.com/package/deepagents)
- [LangChain JS 文档](https://js.langchain.com/)

## 📝 许可证

MIT
