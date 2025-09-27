import winston from 'winston';
import path from 'path';
import fs from 'fs';

import { inspect } from 'util';

// 创建日志目录
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 配置日志格式（上海时间）
const logFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: () => {
            try {
                const dtf = new Intl.DateTimeFormat('zh-CN', {
                    timeZone: 'Asia/Shanghai',
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: false
                });
                // e.g. 2025/08/14 20:46:50 → replace / with - for consistency (avoid replaceAll for wider TS targets)
                return dtf.format(new Date()).replace(/\//g, '-');
            } catch {
                return new Date().toISOString();
            }
        }
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaString = meta && Object.keys(meta).length
            ? inspect(meta, { depth: 5, breakLength: 120, colors: false })
            : '';
        return `[${timestamp}] ${level}: ${message} ${metaString}`;
    })
);

// 创建 logger
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    transports: [
        // 错误日志文件
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error'
        }),
        // 全部日志文件
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log')
        }),
        new winston.transports.Console({
            stderrLevels: ['error', 'warn', 'info']
        })
    ]
});

// 敏感信息过滤配置
const DISABLE_SENSITIVE_FILTER = process.env.DISABLE_SENSITIVE_FILTER === 'true';
const sensitiveFields = ['password', 'token', 'secret', 'key', 'adminPassword', 'jwt', 'apiKey'];

const maskSensitiveData = (obj: any, seen: WeakSet<object> = new WeakSet()): any => {
  // 如果环境变量设置为禁用敏感信息过滤，直接返回原始对象
  if (DISABLE_SENSITIVE_FILTER) {
    return obj;
  }

  if (typeof obj !== 'object' || obj === null) return obj;
  if (seen.has(obj as object)) return '[Circular]';
  seen.add(obj as object);

  const masked: { [key: string]: any } | any[] = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      (masked as any)[key] = typeof value === 'string' ? '***' : '***';
    } else if (typeof value === 'object' && value !== null) {
      (masked as any)[key] = maskSensitiveData(value, seen);
    } else {
      (masked as any)[key] = value as any;
    }
  }
  return masked;
};

// 安全日志记录
const safeLog = (level: string, message: string, meta?: any) => {
  const safeMeta = meta ? maskSensitiveData(meta) : undefined;
  (logger as any)[level](message, safeMeta);
};

export { safeLog, maskSensitiveData };
export default logger; 