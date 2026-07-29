/**
 * 日志工具 - 提供格式化的控制台输出
 */

export const logger = {
  info: (message: string, data?: any) => {
    console.log(`\n📝 ${message}`);
    if (data) console.log(data);
  },

  success: (message: string, data?: any) => {
    console.log(`\n✅ ${message}`);
    if (data) console.log(data);
  },

  error: (message: string, error?: any) => {
    console.error(`\n❌ ${message}`);
    if (error) console.error(error);
  },

  warn: (message: string, data?: any) => {
    console.warn(`\n⚠️  ${message}`);
    if (data) console.warn(data);
  },

  step: (step: number, message: string) => {
    console.log(`\n🔹 Step ${step}: ${message}`);
  },

  divider: () => {
    console.log('\n' + '='.repeat(60) + '\n');
  },

  result: (label: string, content: string) => {
    console.log(`\n📊 ${label}:`);
    console.log(content);
  },
};
