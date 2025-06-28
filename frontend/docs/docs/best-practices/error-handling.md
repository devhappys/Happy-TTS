---
title: 错误处理最佳实践
sidebar_position: 3
---

# 错误处理最佳实践

## 简介

本章节介绍 Happy-TTS 的错误处理最佳实践，包括错误分类、重试机制、日志记录等方面的建议。

## 错误分类

### 1. 错误类型定义

```javascript
class TTSError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "TTSError";
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// 预定义错误类型
const ErrorTypes = {
  // 网络相关错误
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT_ERROR: "TIMEOUT_ERROR",
  CONNECTION_ERROR: "CONNECTION_ERROR",

  // 认证相关错误
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_API_KEY: "INVALID_API_KEY",
  EXPIRED_TOKEN: "EXPIRED_TOKEN",

  // 请求相关错误
  INVALID_REQUEST: "INVALID_REQUEST",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",

  // 服务相关错误
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",

  // 内容相关错误
  INVALID_TEXT: "INVALID_TEXT",
  TEXT_TOO_LONG: "TEXT_TOO_LONG",
  UNSUPPORTED_LANGUAGE: "UNSUPPORTED_LANGUAGE",
};
```

### 2. 错误映射

```javascript
class ErrorMapper {
  static mapHTTPError(status, response) {
    switch (status) {
      case 400:
        return new TTSError("请求参数无效", ErrorTypes.INVALID_REQUEST, {
          response,
        });
      case 401:
        return new TTSError("API 密钥无效或已过期", ErrorTypes.UNAUTHORIZED, {
          response,
        });
      case 403:
        return new TTSError("访问被拒绝", ErrorTypes.UNAUTHORIZED, {
          response,
        });
      case 429:
        return new TTSError(
          "请求过于频繁，请稍后重试",
          ErrorTypes.RATE_LIMIT_EXCEEDED,
          { response }
        );
      case 500:
        return new TTSError("服务器内部错误", ErrorTypes.INTERNAL_ERROR, {
          response,
        });
      case 503:
        return new TTSError("服务暂时不可用", ErrorTypes.SERVICE_UNAVAILABLE, {
          response,
        });
      default:
        return new TTSError(`HTTP ${status} 错误`, ErrorTypes.NETWORK_ERROR, {
          response,
        });
    }
  }

  static mapNetworkError(error) {
    if (error.code === "ECONNREFUSED") {
      return new TTSError("无法连接到服务器", ErrorTypes.CONNECTION_ERROR, {
        originalError: error,
      });
    }
    if (error.code === "ETIMEDOUT") {
      return new TTSError("请求超时", ErrorTypes.TIMEOUT_ERROR, {
        originalError: error,
      });
    }
    return new TTSError("网络连接失败", ErrorTypes.NETWORK_ERROR, {
      originalError: error,
    });
  }
}
```

## 重试机制

### 1. 基础重试策略

```javascript
class RetryManager {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
  }

  async executeWithRetry(fn, shouldRetry = this.defaultShouldRetry) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === this.maxRetries || !shouldRetry(error)) {
          throw error;
        }

        // 计算延迟时间（指数退避）
        const delay = Math.min(
          this.baseDelay * Math.pow(this.backoffMultiplier, attempt),
          this.maxDelay
        );

        console.log(`重试 ${attempt + 1}/${this.maxRetries}，延迟 ${delay}ms`);
        await this.sleep(delay);
      }
    }
  }

  defaultShouldRetry(error) {
    // 只对特定错误类型重试
    const retryableErrors = [
      ErrorTypes.NETWORK_ERROR,
      ErrorTypes.TIMEOUT_ERROR,
      ErrorTypes.CONNECTION_ERROR,
      ErrorTypes.SERVICE_UNAVAILABLE,
      ErrorTypes.INTERNAL_ERROR,
    ];

    return retryableErrors.includes(error.code);
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 2. 智能重试策略

```javascript
class SmartRetryManager extends RetryManager {
  constructor(options = {}) {
    super(options);
    this.retryHistory = new Map();
    this.circuitBreaker = new CircuitBreaker();
  }

  async executeWithRetry(fn, context = {}) {
    // 检查断路器状态
    if (this.circuitBreaker.isOpen()) {
      throw new TTSError(
        "服务暂时不可用（断路器开启）",
        ErrorTypes.SERVICE_UNAVAILABLE
      );
    }

    try {
      const result = await super.executeWithRetry(
        fn,
        this.shouldRetry.bind(this)
      );
      this.circuitBreaker.onSuccess();
      return result;
    } catch (error) {
      this.circuitBreaker.onFailure();
      throw error;
    }
  }

  shouldRetry(error, attempt) {
    // 根据错误类型和重试次数决定是否重试
    if (error.code === ErrorTypes.RATE_LIMIT_EXCEEDED) {
      // 速率限制错误，使用更长的延迟
      return attempt < 2;
    }

    if (error.code === ErrorTypes.UNAUTHORIZED) {
      // 认证错误，不重试
      return false;
    }

    return super.defaultShouldRetry(error);
  }
}

class CircuitBreaker {
  constructor() {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
    this.threshold = 5;
    this.timeout = 60000; // 1分钟
  }

  isOpen() {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = "HALF_OPEN";
        return false;
      }
      return true;
    }
    return false;
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = "OPEN";
    }
  }
}
```

## 错误处理模式

### 1. 统一错误处理

```javascript
class TTSClient {
  constructor(options = {}) {
    this.retryManager = new SmartRetryManager(options.retry);
    this.logger = new ErrorLogger();
  }

  async generateSpeech(text, options = {}) {
    try {
      // 输入验证
      this.validateInput(text, options);

      // 执行请求
      return await this.retryManager.executeWithRetry(
        () => this.callAPI(text, options),
        { text, options }
      );
    } catch (error) {
      // 统一错误处理
      const ttsError = this.normalizeError(error);
      this.logger.logError(ttsError);
      throw ttsError;
    }
  }

  validateInput(text, options) {
    if (!text || typeof text !== "string") {
      throw new TTSError("文本内容不能为空", ErrorTypes.INVALID_TEXT);
    }

    if (text.length > 4000) {
      throw new TTSError("文本长度不能超过4000字符", ErrorTypes.TEXT_TOO_LONG);
    }

    // 验证其他参数...
  }

  normalizeError(error) {
    if (error instanceof TTSError) {
      return error;
    }

    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return ErrorMapper.mapNetworkError(error);
    }

    return new TTSError("未知错误", ErrorTypes.INTERNAL_ERROR, {
      originalError: error,
    });
  }
}
```

### 2. 错误恢复策略

```javascript
class ErrorRecovery {
  constructor() {
    this.fallbackStrategies = new Map();
  }

  registerFallback(errorCode, strategy) {
    this.fallbackStrategies.set(errorCode, strategy);
  }

  async executeWithFallback(fn, context = {}) {
    try {
      return await fn();
    } catch (error) {
      const fallback = this.fallbackStrategies.get(error.code);

      if (fallback) {
        console.log(`使用备用策略处理错误: ${error.code}`);
        return await fallback(context);
      }

      throw error;
    }
  }

  // 示例：缓存备用策略
  async cacheFallback(context) {
    const { text, options } = context;
    const cacheKey = this.generateCacheKey(text, options);

    // 尝试从缓存获取
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    throw new TTSError("无法生成语音且无缓存", ErrorTypes.SERVICE_UNAVAILABLE);
  }
}
```

## 日志记录

### 1. 错误日志记录

```javascript
class ErrorLogger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || "info";
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile || false;
    this.logFile = options.logFile || "tts-errors.log";
  }

  logError(error, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: "error",
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack,
        details: error.details,
      },
      context,
      severity: this.getSeverity(error),
    };

    this.writeLog(logEntry);

    // 对于高严重性错误，发送告警
    if (logEntry.severity === "high") {
      this.sendAlert(logEntry);
    }
  }

  getSeverity(error) {
    const severityMap = {
      [ErrorTypes.UNAUTHORIZED]: "high",
      [ErrorTypes.RATE_LIMIT_EXCEEDED]: "medium",
      [ErrorTypes.SERVICE_UNAVAILABLE]: "high",
      [ErrorTypes.INTERNAL_ERROR]: "high",
    };

    return severityMap[error.code] || "low";
  }

  writeLog(logEntry) {
    const logString = JSON.stringify(logEntry) + "\n";

    if (this.enableConsole) {
      console.error(logString);
    }

    if (this.enableFile) {
      // 写入文件（需要适当的文件系统权限）
      require("fs").appendFileSync(this.logFile, logString);
    }
  }

  sendAlert(logEntry) {
    // 发送到监控系统或邮件
    console.warn("错误告警:", logEntry);
  }
}
```

### 2. 性能监控

```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      errorRates: new Map(),
    };
  }

  async trackRequest(fn, context = {}) {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result = await fn();
      this.metrics.successfulRequests++;
      this.updateResponseTime(Date.now() - startTime);
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.recordError(error);
      throw error;
    }
  }

  updateResponseTime(responseTime) {
    const { totalRequests, averageResponseTime } = this.metrics;
    this.metrics.averageResponseTime =
      (averageResponseTime * (totalRequests - 1) + responseTime) /
      totalRequests;
  }

  recordError(error) {
    const errorCode = error.code || "UNKNOWN";
    const currentCount = this.metrics.errorRates.get(errorCode) || 0;
    this.metrics.errorRates.set(errorCode, currentCount + 1);
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.successfulRequests / this.metrics.totalRequests,
      errorRates: Object.fromEntries(this.metrics.errorRates),
    };
  }
}
```

## 用户友好的错误信息

### 1. 错误信息本地化

```javascript
class ErrorMessageLocalizer {
  constructor(locale = "zh-CN") {
    this.locale = locale;
    this.messages = this.loadMessages(locale);
  }

  loadMessages(locale) {
    const messages = {
      "zh-CN": {
        [ErrorTypes.NETWORK_ERROR]: "网络连接失败，请检查网络设置",
        [ErrorTypes.UNAUTHORIZED]: "认证失败，请检查 API 密钥",
        [ErrorTypes.RATE_LIMIT_EXCEEDED]: "请求过于频繁，请稍后重试",
        [ErrorTypes.INVALID_TEXT]: "文本内容无效，请检查输入",
        [ErrorTypes.TEXT_TOO_LONG]: "文本过长，请缩短内容",
        [ErrorTypes.SERVICE_UNAVAILABLE]: "服务暂时不可用，请稍后重试",
      },
      "en-US": {
        [ErrorTypes.NETWORK_ERROR]:
          "Network connection failed, please check your network settings",
        [ErrorTypes.UNAUTHORIZED]:
          "Authentication failed, please check your API key",
        [ErrorTypes.RATE_LIMIT_EXCEEDED]:
          "Too many requests, please try again later",
        [ErrorTypes.INVALID_TEXT]:
          "Invalid text content, please check your input",
        [ErrorTypes.TEXT_TOO_LONG]: "Text too long, please shorten the content",
        [ErrorTypes.SERVICE_UNAVAILABLE]:
          "Service temporarily unavailable, please try again later",
      },
    };

    return messages[locale] || messages["zh-CN"];
  }

  getLocalizedMessage(error) {
    return this.messages[error.code] || error.message;
  }
}
```

### 2. 错误恢复建议

```javascript
class ErrorRecoveryAdvisor {
  getRecoveryAdvice(error) {
    const adviceMap = {
      [ErrorTypes.NETWORK_ERROR]: [
        "检查网络连接",
        "确认服务器地址正确",
        "尝试使用代理或 VPN",
      ],
      [ErrorTypes.UNAUTHORIZED]: [
        "检查 API 密钥是否正确",
        "确认 API 密钥未过期",
        "联系管理员获取新的 API 密钥",
      ],
      [ErrorTypes.RATE_LIMIT_EXCEEDED]: [
        "减少请求频率",
        "实施请求缓存",
        "联系管理员提高限制",
      ],
      [ErrorTypes.TEXT_TOO_LONG]: [
        "将长文本分段处理",
        "使用批量处理接口",
        "压缩或简化文本内容",
      ],
    };

    return adviceMap[error.code] || ["请稍后重试"];
  }
}
```

## 最佳实践总结

### 1. 错误处理要点

- ✅ 定义清晰的错误类型
- ✅ 实施智能重试机制
- ✅ 提供用户友好的错误信息
- ✅ 记录详细的错误日志

### 2. 重试策略要点

- ✅ 使用指数退避算法
- ✅ 只对可重试错误进行重试
- ✅ 实施断路器模式
- ✅ 设置合理的重试限制

### 3. 监控要点

- ✅ 跟踪错误率和响应时间
- ✅ 记录错误上下文信息
- ✅ 设置错误告警机制
- ✅ 定期分析错误模式

### 4. 用户体验要点

- ✅ 提供本地化错误信息
- ✅ 给出具体的恢复建议
- ✅ 实施优雅降级策略
- ✅ 保持错误信息简洁明了

## 下一步

- 🔒 了解 [安全最佳实践](./security.md)
- 📊 学习 [性能优化](./performance.md)
- 🛠️ 查看 [集成示例](../tutorials/integration-examples.md)
