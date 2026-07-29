/**
 * Demo 02: 自定义工具
 * 
 * 演示如何定义和使用自定义工具
 * 让 Agent 能够调用外部函数
 */

import 'dotenv/config';
import { createDeepAgent } from 'deepagents';
import { tool } from 'langchain';
import { z } from 'zod';
import { logger } from './utils/logger.js';
import { createLLM, withTracing } from './utils/config.js';

// 定义自定义工具：查询天气
const getWeather = tool(
  async ({ city }: { city: string }) => {
    // 模拟天气数据
    const weatherData: Record<string, any> = {
      '北京': { temp: 22, condition: '晴', humidity: 45 },
      '上海': { temp: 25, condition: '多云', humidity: 65 },
      '广州': { temp: 28, condition: '小雨', humidity: 80 },
      '深圳': { temp: 27, condition: '阴', humidity: 70 },
    };

    const weather = weatherData[city];
    if (!weather) {
      return `未找到 ${city} 的天气数据`;
    }

    return JSON.stringify({
      city,
      temperature: `${weather.temp}°C`,
      condition: weather.condition,
      humidity: `${weather.humidity}%`,
    });
  },
  {
    name: 'get_weather',
    description: '获取指定城市的天气信息',
    schema: z.object({
      city: z.string().describe('城市名称，如：北京、上海'),
    }),
  }
);

// 定义自定义工具：查询订单
const queryOrder = tool(
  async ({ orderId }: { orderId: string }) => {
    // 模拟订单数据
    const orders: Record<string, any> = {
      'ORD001': {
        orderId: 'ORD001',
        product: '无线蓝牙耳机',
        price: 699,
        status: '已发货',
        trackingNumber: 'SF1234567890',
      },
      'ORD002': {
        orderId: 'ORD002',
        product: '智能手表',
        price: 1299,
        status: '待发货',
        trackingNumber: null,
      },
    };

    const order = orders[orderId];
    if (!order) {
      return `未找到订单 ${orderId}`;
    }

    return JSON.stringify(order);
  },
  {
    name: 'query_order',
    description: '根据订单号查询订单详情',
    schema: z.object({
      orderId: z.string().describe('订单号，如：ORD001'),
    }),
  }
);

// 定义自定义工具：计算
const calculate = tool(
  async ({ expression }: { expression: string }) => {
    try {
      // 安全计算（仅支持基本数学运算）
      const result = eval(expression.replace(/[^0-9+\-*/().]/g, ''));
      return JSON.stringify({ expression, result });
    } catch (error) {
      return JSON.stringify({ expression, error: '计算失败' });
    }
  },
  {
    name: 'calculate',
    description: '计算数学表达式',
    schema: z.object({
      expression: z.string().describe('数学表达式，如：2 + 3 * 4'),
    }),
  }
);

async function main() {
  logger.divider();
  logger.info('Demo 02: 自定义工具');
  logger.divider();

  // 创建带自定义工具的 Agent
  logger.step(1, '创建带自定义工具的 Agent');
  const agent = createDeepAgent({
    model: createLLM(),
    tools: [getWeather, queryOrder, calculate],
    systemPrompt: '你是一个智能助手，可以查询天气、订单和进行计算。请用中文回答。',
  });

  // 使用 withTracing 包装 agent.invoke
  const invokeAgent = withTracing(
    (input: any) => agent.invoke(input),
    'tools-agent-invoke'
  );

  // 测试天气工具
  logger.step(2, '测试天气查询工具');
  const weatherResult = await invokeAgent({
    messages: [
      {
        role: 'user',
        content: '北京今天天气怎么样？',
      },
    ],
  });
  logger.result('天气查询', weatherResult.messages[weatherResult.messages.length - 1].content as string);

  // 测试订单工具
  logger.step(3, '测试订单查询工具');
  const orderResult = await invokeAgent({
    messages: [
      {
        role: 'user',
        content: '帮我查一下订单 ORD001 的状态',
      },
    ],
  });
  logger.result('订单查询', orderResult.messages[orderResult.messages.length - 1].content as string);

  // 测试计算工具
  logger.step(4, '测试计算工具');
  const calcResult = await invokeAgent({
    messages: [
      {
        role: 'user',
        content: '计算 (15 + 27) * 3 - 18 / 2 的结果',
      },
    ],
  });
  logger.result('计算结果', calcResult.messages[calcResult.messages.length - 1].content as string);

  // 测试多工具组合
  logger.step(5, '测试多工具组合');
  const multiToolResult = await invokeAgent({
    messages: [
      {
        role: 'user',
        content: '查一下上海的天气，然后计算 25 + 15 的结果',
      },
    ],
  });
  logger.result('多工具组合', multiToolResult.messages[multiToolResult.messages.length - 1].content as string);

  logger.success('Demo 02 完成');
}

main().catch((error) => {
  logger.error('运行失败', error);
  process.exit(1);
});
