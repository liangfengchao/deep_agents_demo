/**
 * 配置模块 - 从 .env 读取大模型配置
 */

import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';

export const config = {
  // 模型名称（如 qwen3, gpt-4o-mini 等）
  model: process.env.LLM_MODEL || 'qwen3',

  // API Key
  apiKey: process.env.OPENAI_API_KEY || '',

  // API Base URL
  baseUrl: process.env.OPENAI_BASE_URL || 'http://10.8.0.36:33136/v1',

  // LangSmith 配置
  langsmith: {
    tracing: process.env.LANGSMITH_TRACING === 'true',
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
