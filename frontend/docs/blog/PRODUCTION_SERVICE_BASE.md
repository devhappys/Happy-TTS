---
title: 生产级服务基础类框架
description: 可复用的生产级服务基础类，提供断路器、限流器、缓存、监控等通用功能
date: 2025-10-19
author: Happy TTS Team
tags: [后端, 架构, 基础框架, 断路器, 限流, 缓存, 监控, 复用]
---

# 生产级服务基础类框架

## 概述

`ProductionServiceBase` 是一个可复用的生产级服务基础类，提供了**断路器、限流器、缓存、监控**等通用功能。所有服务都可以继承此基础类，快速获得生产级特性，同时支持灵活的自定义配置。

## 设计理念

### 核心思想

```
┌─────────────────────────────────────────────────────────────┐
│           可复用的生产级基础能力                                │
├─────────────────────────────────────────────────────────────┤
│  继承 ProductionServiceBase                                  │
│     ↓                                                        │
│  自动获得：                                                   │
│  ✅ 断路器模式                                                │
│  ✅ 限流器                                                    │
│  ✅ 缓存管理                                                  │
│  ✅ 性能监控                                                  │
│  ✅ 健康检查                                                  │
│  ✅ 错误追踪                                                  │
│  ✅ 优雅关闭                                                  │
│     ↓                                                        │
│  自定义配置：                                                 │
│  🔧 限流频率                                                  │
│  🔧 断路器阈值                                                │
│  🔧 缓存TTL                                                   │
│  🔧 监控间隔                                                  │
│  🔧 健康阈值                                                  │
└─────────────────────────────────────────────────────────────┘
```

### 设计优势

1. **DRY 原则**: 避免在每个服务中重复实现相同的功能
2. **一致性**: 所有服务使用统一的模式和接口
3. **可配置**: 每个服务可根据业务需求自定义配置
4. **可扩展**: 基础类提供通用能力，子类实现业务逻辑
5. **易维护**: 通用功能的改进会惠及所有服务

## 配置接口

### ServiceConfig 完整配置

```typescript
interface ServiceConfig {
  // 服务标识
  serviceName: string;

  // 限流器配置
  rateLimit?: {
    enabled: boolean; // 是否启用
    window: number; // 时间窗口（毫秒）
    maxRequests: number; // 最大请求数
    keyPrefix?: string; // 限流键前缀
  };

  // 断路器配置
  circuitBreaker?: {
    enabled: boolean; // 是否启用
    threshold: number; // 失败阈值
    timeout: number; // 超时时间（毫秒）
    successThreshold: number; // 成功阈值
  };

  // 缓存配置
  cache?: {
    enabled: boolean; // 是否启用
    ttl: number; // 缓存时间（毫秒）
    maxSize?: number; // 最大缓存数量
  };

  // 监控配置
  monitoring?: {
    enabled: boolean; // 是否启用
    performanceInterval: number; // 性能统计间隔（毫秒）
    healthCheckInterval: number; // 健康检查间隔（毫秒）
    cacheCleanupInterval: number; // 缓存清理间隔（毫秒）
  };

  // 性能配置
  performance?: {
    maxSamples: number; // 最大响应时间样本数
    queryTimeout: number; // 查询超时（毫秒）
    operationTimeout: number; // 操作总超时（毫秒）
  };

  // 健康状态阈值
  healthThresholds?: {
    degradedErrorRate: number; // 降级错误率阈值
    unhealthyErrorRate: number; // 不健康错误率阈值
    degradedResponseTime: number; // 降级响应时间阈值
    unhealthyResponseTime: number; // 不健康响应时间阈值
  };
}
```

### 默认配置

```typescript
const DEFAULT_SERVICE_CONFIG: ServiceConfig = {
  serviceName: "UnnamedService",

  rateLimit: {
    enabled: true,
    window: 60000, // 1分钟
    maxRequests: 100, // 100次/分钟
    keyPrefix: "rate_limit_",
  },

  circuitBreaker: {
    enabled: true,
    threshold: 5, // 5次失败
    timeout: 60000, // 1分钟
    successThreshold: 3, // 3次成功
  },

  cache: {
    enabled: true,
    ttl: 300000, // 5分钟
    maxSize: 1000, // 最多1000条缓存
  },

  monitoring: {
    enabled: true,
    performanceInterval: 600000, // 10分钟
    healthCheckInterval: 30000, // 30秒
    cacheCleanupInterval: 300000, // 5分钟
  },

  performance: {
    maxSamples: 100,
    queryTimeout: 5000, // 5秒
    operationTimeout: 10000, // 10秒
  },

  healthThresholds: {
    degradedErrorRate: 0.2, // 20%
    unhealthyErrorRate: 0.5, // 50%
    degradedResponseTime: 2000, // 2秒
    unhealthyResponseTime: 5000, // 5秒
  },
};
```

## 使用示例

### 示例 1: 创建基础服务

```typescript
import {
  ProductionServiceBase,
  createServiceConfig,
} from "../utils/ProductionServiceBase";

class MyService extends ProductionServiceBase {
  private static instance: MyService;

  private constructor() {
    super(
      createServiceConfig("MyService", {
        // 自定义配置
        rateLimit: {
          maxRequests: 50, // 限制为50次/分钟
        },
        cache: {
          ttl: 600000, // 缓存10分钟
        },
      })
    );
  }

  public static getInstance(): MyService {
    if (!MyService.instance) {
      MyService.instance = new MyService();
    }
    return MyService.instance;
  }

  // 业务方法示例
  public async doSomething(userId: string, data: any): Promise<any> {
    // 使用限流器
    if (!this.checkRateLimit(userId)) {
      throw new Error("请求过于频繁");
    }

    // 使用缓存
    const cacheKey = `data_${userId}`;
    const cached = this.getCachedValue<any>(cacheKey);
    if (cached) {
      return cached;
    }

    // 使用executeWithMonitoring自动跟踪性能
    const result = await this.executeWithMonitoring(async () => {
      // 执行业务逻辑
      return await this.processData(data);
    }, "doSomething");

    // 缓存结果
    this.setCachedValue(cacheKey, result);

    return result;
  }

  private async processData(data: any): Promise<any> {
    // 实际业务逻辑
    return { processed: true, data };
  }
}

// 使用服务
const service = MyService.getInstance();
const result = await service.doSomething("user123", { foo: "bar" });
```

### 示例 2: CDK 兑换服务配置

```typescript
class CDKService extends ProductionServiceBase {
  constructor() {
    super(
      createServiceConfig("CDKService", {
        rateLimit: {
          enabled: true,
          maxRequests: 50, // CDK兑换限制50次/分钟
          window: 60000,
        },
        circuitBreaker: {
          enabled: true,
          threshold: 5,
          timeout: 60000,
        },
        cache: {
          enabled: true,
          ttl: 60000, // CDK缓存1分钟
          maxSize: 500,
        },
        healthThresholds: {
          degradedResponseTime: 3000, // CDK兑换3秒算降级
          unhealthyResponseTime: 5000,
        },
      })
    );
  }

  public async redeemCDK(code: string, userId: string): Promise<any> {
    // 限流检查
    if (!this.checkRateLimit(userId)) {
      throw new Error("CDK兑换请求过于频繁");
    }

    // 使用executeWithMonitoring自动处理断路器、性能统计
    return await this.executeWithMonitoring(async () => {
      // 业务逻辑
      const cdk = await this.findCDK(code);
      if (!cdk) {
        throw new Error("CDK不存在");
      }

      return await this.useCDK(cdk, userId);
    }, "redeemCDK");
  }

  private async findCDK(code: string): Promise<any> {
    // 使用executeQuery添加超时保护
    return await this.executeQuery(
      CDKModel.findOne({ code }).lean().exec(),
      "findCDK"
    );
  }

  private async useCDK(cdk: any, userId: string): Promise<any> {
    // 业务逻辑
    return { success: true, cdk };
  }
}
```

### 示例 3: 数据收集服务配置

```typescript
class DataCollectionService extends ProductionServiceBase {
  constructor() {
    super(
      createServiceConfig("DataCollectionService", {
        rateLimit: {
          enabled: true,
          maxRequests: 1000, // 数据收集允许1000次/分钟
          window: 60000,
        },
        cache: {
          enabled: true,
          ttl: 300000, // 验证缓存5分钟
          maxSize: 2000,
        },
        monitoring: {
          enabled: true,
          performanceInterval: 600000, // 10分钟
          healthCheckInterval: 30000, // 30秒
          cacheCleanupInterval: 300000, // 5分钟
        },
        healthThresholds: {
          degradedErrorRate: 0.1, // 10%即算降级
          unhealthyErrorRate: 0.3, // 30%算不健康
          degradedResponseTime: 1000, // 数据收集1秒算降级
          unhealthyResponseTime: 3000,
        },
      })
    );
  }

  public async saveData(data: any): Promise<void> {
    const userId = data.userId || "anonymous";

    // 限流检查
    if (!this.checkRateLimit(userId)) {
      throw new Error("数据收集请求过于频繁");
    }

    // 使用executeWithMonitoring
    await this.executeWithMonitoring(async () => {
      // 验证数据
      this.validateData(data);

      // 保存到数据库
      await DataModel.create(data);
    }, "saveData");
  }

  private validateData(data: any): void {
    if (!data.userId || !data.action) {
      throw new Error("缺少必需字段");
    }
  }
}
```

### 示例 4: Clarity 配置服务

```typescript
class ClarityService extends ProductionServiceBase {
  private static instance: ClarityService;

  private constructor() {
    super(
      createServiceConfig("ClarityService", {
        rateLimit: {
          enabled: true,
          maxRequests: 20, // 配置操作限制20次/分钟
          window: 60000,
        },
        cache: {
          enabled: true,
          ttl: 60000, // 配置缓存1分钟
          maxSize: 10,
        },
        healthThresholds: {
          degradedResponseTime: 2000,
          unhealthyResponseTime: 5000,
        },
      })
    );
  }

  public static getInstance(): ClarityService {
    if (!ClarityService.instance) {
      ClarityService.instance = new ClarityService();
    }
    return ClarityService.instance;
  }

  public async updateConfig(projectId: string, userId: string): Promise<any> {
    // 限流检查
    if (!this.checkRateLimit(userId)) {
      throw new Error("配置更新请求过于频繁");
    }

    // 使用executeWithMonitoring
    return await this.executeWithMonitoring(async () => {
      // 验证格式
      if (!/^[a-z0-9]{10}$/.test(projectId)) {
        throw new Error("Project ID格式无效");
      }

      // 更新配置
      await ConfigModel.findOneAndUpdate(
        { key: "CLARITY_PROJECT_ID" },
        { value: projectId },
        { upsert: true }
      );

      // 清除缓存
      this.clearCache("clarity_config");

      return { success: true };
    }, "updateConfig");
  }

  public async getConfig(): Promise<string | null> {
    // 检查缓存
    const cached = this.getCachedValue<string>("clarity_config");
    if (cached) {
      return cached;
    }

    // 查询数据库
    const config = await this.executeQuery(
      ConfigModel.findOne({ key: "CLARITY_PROJECT_ID" }).lean().exec(),
      "getConfig"
    );

    const value = config?.value || null;

    // 缓存结果
    if (value) {
      this.setCachedValue("clarity_config", value);
    }

    return value;
  }
}
```

## 核心功能详解

### 1. 🔒 限流器（Rate Limiter）

**功能：**

- 基于标识符的限流（通常是用户 ID）
- 滑动窗口算法
- 自动清理过期记录
- 统计限流命中次数

**使用方法：**

```typescript
// 在业务方法中检查限流
public async myMethod(userId: string) {
  if (!this.checkRateLimit(userId)) {
    throw new Error('请求过于频繁，请稍后重试');
  }

  // 业务逻辑...
}
```

**自定义配置：**

```typescript
super(
  createServiceConfig("MyService", {
    rateLimit: {
      enabled: true,
      window: 60000, // 1分钟窗口
      maxRequests: 100, // 100次/分钟
      keyPrefix: "my_rate_", // 自定义前缀
    },
  })
);
```

### 2. 🛡️ 断路器（Circuit Breaker）

**功能：**

- 三种状态：CLOSED / OPEN / HALF_OPEN
- 自动失败检测和恢复
- 防止级联失败
- 统计断路器打开次数

**使用方法：**

```typescript
// executeWithMonitoring自动处理断路器
public async myMethod() {
  return await this.executeWithMonitoring(async () => {
    // 业务逻辑
    return await doSomething();
  }, 'myMethod');
}

// 或手动检查
public async manualCheck() {
  if (!this.checkCircuitBreaker()) {
    throw new Error('服务暂时不可用');
  }

  try {
    const result = await doSomething();
    this.recordCircuitBreakerSuccess();
    return result;
  } catch (error) {
    this.recordCircuitBreakerFailure();
    throw error;
  }
}
```

**自定义配置：**

```typescript
super(
  createServiceConfig("MyService", {
    circuitBreaker: {
      enabled: true,
      threshold: 5, // 5次失败后打开
      timeout: 60000, // 1分钟后尝试恢复
      successThreshold: 3, // 3次成功后关闭
    },
  })
);
```

### 3. 💾 缓存管理

**功能：**

- 键值对缓存
- TTL 自动过期
- 缓存大小限制（LRU）
- 统计缓存命中率

**使用方法：**

```typescript
public async getData(id: string): Promise<any> {
  // 检查缓存
  const cacheKey = `data_${id}`;
  const cached = this.getCachedValue<any>(cacheKey);
  if (cached) {
    return cached;
  }

  // 查询数据库
  const data = await Model.findById(id);

  // 缓存结果
  this.setCachedValue(cacheKey, data);

  return data;
}

// 清除缓存
this.clearCache('data_user123');  // 清除单个key
this.clearCache();                // 清除所有缓存
```

**自定义配置：**

```typescript
super(
  createServiceConfig("MyService", {
    cache: {
      enabled: true,
      ttl: 300000, // 5分钟TTL
      maxSize: 1000, // 最多1000条缓存
    },
  })
);
```

### 4. 📊 性能监控

**功能：**

- 自动跟踪操作次数、成功率、失败率
- 计算平均响应时间
- 统计缓存命中率、限流命中次数
- 定期输出性能日志

**使用方法：**

```typescript
// 获取性能统计
const stats = service.getPerformanceStats();
console.log("总操作:", stats.totalOperations);
console.log(
  "成功率:",
  (stats.successfulOperations / stats.totalOperations) * 100 + "%"
);
console.log("平均响应时间:", stats.avgResponseTime + "ms");
console.log("缓存命中率:", stats.cacheHitRate * 100 + "%");

// 重置统计
service.resetStats();
```

### 5. 🏥 健康检查

**功能：**

- 三级健康状态：healthy / degraded / unhealthy
- 自动判定健康状态
- 监控运行时间、错误率、响应时间
- 检查依赖服务（如 MongoDB）

**使用方法：**

```typescript
// 获取健康状态
const health = service.getHealthStatus();
console.log("状态:", health.status);
console.log("运行时间:", health.uptime / 1000 + "秒");
console.log("错误率:", health.errorRate * 100 + "%");
console.log("断路器:", health.circuitBreakerState);
console.log("MongoDB:", health.mongoConnected ? "已连接" : "未连接");

// 集成到健康检查端点
app.get("/health/my-service", (req, res) => {
  const health = service.getHealthStatus();
  res.status(health.status === "healthy" ? 200 : 503).json(health);
});
```

### 6. 🔧 数据库查询辅助

**功能：**

- 自动添加超时保护
- 检查 MongoDB 连接状态
- 统一错误处理

**使用方法：**

```typescript
public async findUser(userId: string): Promise<any> {
  // 检查MongoDB连接
  if (!this.isMongoReady()) {
    throw new Error('数据库未连接');
  }

  // 执行带超时保护的查询
  return await this.executeQuery(
    UserModel.findById(userId).lean().maxTimeMS(5000).exec(),
    'findUser'
  );
}
```

## 配置预设

### 预设 1: 高频读取服务

```typescript
const HIGH_READ_CONFIG = createServiceConfig("HighReadService", {
  rateLimit: {
    maxRequests: 500, // 高频读取
  },
  cache: {
    ttl: 600000, // 长缓存（10分钟）
    maxSize: 5000, // 大缓存
  },
  healthThresholds: {
    degradedResponseTime: 500,
    unhealthyResponseTime: 2000,
  },
});
```

### 预设 2: 低频写入服务

```typescript
const LOW_WRITE_CONFIG = createServiceConfig("LowWriteService", {
  rateLimit: {
    maxRequests: 20, // 严格限流
  },
  cache: {
    ttl: 60000, // 短缓存（1分钟）
    maxSize: 100, // 小缓存
  },
  healthThresholds: {
    degradedResponseTime: 2000,
    unhealthyResponseTime: 5000,
  },
});
```

### 预设 3: 关键业务服务

```typescript
const CRITICAL_CONFIG = createServiceConfig("CriticalService", {
  circuitBreaker: {
    threshold: 3, // 更敏感的断路器
    timeout: 30000, // 更快的恢复
    successThreshold: 5, // 更严格的恢复条件
  },
  monitoring: {
    enabled: true,
    performanceInterval: 300000, // 5分钟统计
    healthCheckInterval: 10000, // 10秒健康检查
    cacheCleanupInterval: 60000, // 1分钟缓存清理
  },
  healthThresholds: {
    degradedErrorRate: 0.05, // 5%即算降级
    unhealthyErrorRate: 0.1, // 10%算不健康
    degradedResponseTime: 1000,
    unhealthyResponseTime: 3000,
  },
});
```

## 完整示例

```typescript
import {
  ProductionServiceBase,
  createServiceConfig,
} from "../utils/ProductionServiceBase";
import logger from "../utils/logger";

/**
 * 用户服务 - 完整示例
 */
class UserService extends ProductionServiceBase {
  private static instance: UserService;

  private constructor() {
    super(
      createServiceConfig("UserService", {
        rateLimit: {
          enabled: true,
          maxRequests: 100,
          window: 60000,
        },
        cache: {
          enabled: true,
          ttl: 300000, // 用户数据缓存5分钟
          maxSize: 1000,
        },
        circuitBreaker: {
          enabled: true,
          threshold: 5,
          timeout: 60000,
          successThreshold: 3,
        },
        monitoring: {
          enabled: true,
          performanceInterval: 600000,
          healthCheckInterval: 30000,
          cacheCleanupInterval: 300000,
        },
      })
    );

    logger.info("[UserService] Service initialized");
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * 获取用户信息（带缓存）
   */
  public async getUser(userId: string): Promise<any> {
    // 检查限流
    if (!this.checkRateLimit(userId)) {
      throw new Error("请求过于频繁，请稍后重试");
    }

    // 检查缓存
    const cacheKey = `user_${userId}`;
    const cached = this.getCachedValue<any>(cacheKey);
    if (cached) {
      logger.debug(`[UserService] Cache hit for user: ${userId}`);
      return cached;
    }

    // 使用executeWithMonitoring自动处理断路器、性能跟踪
    const user = await this.executeWithMonitoring(async () => {
      // 检查MongoDB连接
      if (!this.isMongoReady()) {
        throw new Error("数据库未连接");
      }

      // 执行查询（带超时保护）
      return await this.executeQuery(
        UserModel.findById(userId).lean().maxTimeMS(5000).exec(),
        "getUser"
      );
    }, "getUser");

    // 缓存结果
    if (user) {
      this.setCachedValue(cacheKey, user);
    }

    return user;
  }

  /**
   * 更新用户信息
   */
  public async updateUser(userId: string, data: any): Promise<any> {
    // 限流检查
    if (!this.checkRateLimit(userId)) {
      throw new Error("更新请求过于频繁");
    }

    // 使用executeWithMonitoring
    const result = await this.executeWithMonitoring(async () => {
      // 验证数据
      this.validateUserData(data);

      // 更新数据库
      const updated = await this.executeQuery(
        UserModel.findByIdAndUpdate(userId, data, { new: true })
          .lean()
          .maxTimeMS(5000)
          .exec(),
        "updateUser"
      );

      // 清除缓存
      this.clearCache(`user_${userId}`);

      return updated;
    }, "updateUser");

    return result;
  }

  private validateUserData(data: any): void {
    if (!data || typeof data !== "object") {
      throw new Error("无效的用户数据");
    }

    // 更多验证逻辑...
  }

  /**
   * 批量获取用户（展示并发查询）
   */
  public async batchGetUsers(userIds: string[]): Promise<any[]> {
    if (userIds.length > 100) {
      throw new Error("批量查询不能超过100个用户");
    }

    return await this.executeWithMonitoring(async () => {
      // 分离缓存命中和未命中的ID
      const results: any[] = [];
      const uncachedIds: string[] = [];

      for (const userId of userIds) {
        const cached = this.getCachedValue<any>(`user_${userId}`);
        if (cached) {
          results.push(cached);
        } else {
          uncachedIds.push(userId);
        }
      }

      // 批量查询未缓存的用户
      if (uncachedIds.length > 0) {
        const users = await this.executeQuery(
          UserModel.find({ _id: { $in: uncachedIds } })
            .lean()
            .maxTimeMS(5000)
            .exec(),
          "batchGetUsers"
        );

        // 缓存新查询的用户
        users.forEach((user) => {
          this.setCachedValue(`user_${user._id}`, user);
          results.push(user);
        });
      }

      return results;
    }, "batchGetUsers");
  }
}

// 导出单例
export const userService = UserService.getInstance();

// 使用示例
const user = await userService.getUser("user123");
const stats = userService.getPerformanceStats();
const health = userService.getHealthStatus();
```

## API 集成示例

### 监控端点集成

```typescript
import express from "express";
import { userService } from "./services/userService";
import { cdkService } from "./services/cdkService";
import { clarityService } from "./services/clarityService";

const app = express();

// 统一监控端点
app.get("/metrics", (req, res) => {
  res.json({
    userService: {
      stats: userService.getPerformanceStats(),
      health: userService.getHealthStatus(),
    },
    cdkService: {
      stats: cdkService.getPerformanceStats(),
      health: cdkService.getHealthStatus(),
    },
    clarityService: {
      stats: clarityService.getPerformanceStats(),
      health: clarityService.getHealthStatus(),
    },
  });
});

// 单个服务监控
app.get("/metrics/user-service", (req, res) => {
  const stats = userService.getPerformanceStats();
  const health = userService.getHealthStatus();

  res.status(health.status === "healthy" ? 200 : 503).json({
    stats,
    health,
  });
});

// 健康检查端点
app.get("/health", (req, res) => {
  const services = [userService, cdkService, clarityService];
  const allHealthy = services.every(
    (s) => s.getHealthStatus().status === "healthy"
  );

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "healthy" : "unhealthy",
    services: services.map((s) => ({
      name: s["config"].serviceName,
      health: s.getHealthStatus(),
    })),
  });
});
```

## 优雅关闭示例

```typescript
// app.ts
import { userService } from "./services/userService";
import { cdkService } from "./services/cdkService";

// 注册优雅关闭处理
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, starting graceful shutdown");

  // 关闭所有服务
  await Promise.all([
    userService.gracefulShutdown(),
    cdkService.gracefulShutdown(),
  ]);

  process.exit(0);
});
```

## 最佳实践

### 1. 服务初始化

```typescript
// ✅ 推荐：使用单例模式
class MyService extends ProductionServiceBase {
  private static instance: MyService;

  private constructor() {
    super(createServiceConfig("MyService"));
  }

  public static getInstance(): MyService {
    if (!MyService.instance) {
      MyService.instance = new MyService();
    }
    return MyService.instance;
  }
}

// ❌ 不推荐：每次创建新实例
const service1 = new MyService(); // 统计数据会分散
const service2 = new MyService(); // 缓存不共享
```

### 2. 使用 executeWithMonitoring

```typescript
// ✅ 推荐：使用executeWithMonitoring包装业务逻辑
public async myMethod() {
  return await this.executeWithMonitoring(async () => {
    // 业务逻辑
    return await doSomething();
  }, 'myMethod');
}

// ❌ 不推荐：手动处理所有逻辑
public async myMethod() {
  const startTime = Date.now();
  this.stats.totalOperations++;

  try {
    if (!this.checkCircuitBreaker()) throw new Error('...');
    const result = await doSomething();
    this.stats.successfulOperations++;
    this.recordCircuitBreakerSuccess();
    this.updateResponseTime(Date.now() - startTime);
    return result;
  } catch (error) {
    this.stats.failedOperations++;
    this.recordCircuitBreakerFailure();
    this.recordError('myMethod', error);
    throw error;
  }
}
```

### 3. 缓存策略

```typescript
// ✅ 推荐：先检查缓存，再查询数据库
const cached = this.getCachedValue(key);
if (cached) return cached;

const data = await queryDatabase();
this.setCachedValue(key, data);
return data;

// ❌ 不推荐：总是查询数据库
const data = await queryDatabase();
return data;
```

## 配置对比表

| 服务类型     | 限流 (次/分钟) | 缓存 TTL | 断路器阈值 | 健康检查间隔 |
| ------------ | -------------- | -------- | ---------- | ------------ |
| 默认配置     | 100            | 5 分钟   | 5 次失败   | 30 秒        |
| 高频读取     | 500            | 10 分钟  | 5 次失败   | 30 秒        |
| 低频写入     | 20             | 1 分钟   | 5 次失败   | 30 秒        |
| CDK 服务     | 50             | 1 分钟   | 5 次失败   | 30 秒        |
| Clarity 配置 | 20             | 1 分钟   | 5 次失败   | 30 秒        |
| 数据收集     | 1000           | 5 分钟   | 5 次失败   | 30 秒        |

## 技术亮点

### 1. 开箱即用

- ✅ 继承即获得所有生产级特性
- ✅ 无需重复实现通用功能
- ✅ 自动启动监控和清理任务

### 2. 灵活配置

- ✅ 每个服务可自定义所有参数
- ✅ 支持部分配置覆盖
- ✅ 提供预设配置模板

### 3. 统一接口

- ✅ 所有服务使用相同的监控接口
- ✅ 统一的健康检查标准
- ✅ 一致的错误处理模式

### 4. 易于维护

- ✅ 通用功能集中管理
- ✅ 改进会惠及所有服务
- ✅ 减少代码重复

## 总结

`ProductionServiceBase` 提供了一个**标准化的生产级服务基础框架**，具备以下特性：

### ✅ 通用能力

- 断路器模式（防止级联失败）
- 限流器（防止滥用）
- 缓存管理（提升性能）
- 性能监控（实时统计）
- 健康检查（三级状态）
- 错误追踪（详细记录）

### ✅ 灵活性

- 完全可配置的所有参数
- 支持部分配置覆盖
- 提供预设配置模板
- 每个功能可独立启用/禁用

### ✅ 易用性

- 简单的继承模式
- 辅助函数简化使用
- executeWithMonitoring 自动处理
- 清晰的文档和示例

### ✅ 生产就绪

- 经过实战验证的模式
- 完整的错误处理
- 优雅关闭支持
- 监控集成友好

该基础类已在 **dataCollectionService、cdkService、clarityService** 三个服务的增强中验证，适用于所有需要生产级特性的服务。

## 相关文档

- [数据收集服务增强](./DATA_COLLECTION_SERVICE_ENHANCEMENT.md)
- [CDK 兑换服务增强](./CDK_SERVICE_ENHANCEMENT.md)
- [Clarity 配置服务增强](./CLARITY_SERVICE_ENHANCEMENT.md)
