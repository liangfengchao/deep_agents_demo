/**
 * 配置模块 - 从 .env 读取大模型配置
 *
 * LangSmith 集成说明：
 * - 不使用 LANGSMITH_TRACING=true（会自动注入 LangChainTracer，与 deepagents 冲突）
 * - 改用 langsmith/traceable 手动包装 agent 调用，避免回调生命周期冲突
 */

import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { traceable } from 'langsmith/traceable';

export const config = {
  // 模型名称（如 qwen3, gpt-4o-mini 等）
  model: process.env.LLM_MODEL || 'qwen3',

  // API Key
  apiKey: process.env.OPENAI_API_KEY || '',

  // API Base URL
  baseUrl: process.env.OPENAI_BASE_URL || 'http://10.8.0.36:33136/v1',

  // LangSmith 配置
  langsmith: {
    enabled: process.env.LANGSMITH_TRACING === 'true',
    endpoint: process.env.LANGSMITH_ENDPOINT,
    project: process.env.LANGSMITH_PROJECT,
    apiKey: process.env.LANGSMITH_API_KEY,
  },
};

/**
 * 创建 ChatOpenAI 实例，读取 .env 配置
 */
export function createLLM(temperature: number = 0.7): ChatOpenAI {
  return new ChatOpenAI({
    model: config.model,
    temperature,
    apiKey: config.apiKey || 'EMPTY',
    configuration: {
      baseURL: config.baseUrl,
    },
  });
}

/**
 * 使用 traceable 包装函数，使其在 LangSmith 中可追踪
 * 当 LangSmith 未启用时，直接返回原函数
 */
export function withTracing<T extends (...args: any[]) => any>(
  fn: T,
  name: string,
): T {
  if (!config.langsmith.enabled) return fn;
  return traceable(fn, { name, run_type: 'chain' }) as T;
}
