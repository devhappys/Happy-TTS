# 篡改检测系统手动触发指南

## 🚀 快速开始

在浏览器控制台中，篡改检测系统提供了全局 `TamperDetection` API，可以手动触发各种检测和操作。

### 基本使用

```javascript
// 查看帮助
TamperDetection.help();

// 查看系统状态
TamperDetection.status();

// 执行完整性检查
await TamperDetection.check();
```

## 📋 完整性检查

### 检查所有内容

```javascript
// 检查所有类型（DOM、网络、文本、基准）
const result = await TamperDetection.check();
console.log("检查结果:", result);
```

### 分类检查

```javascript
// 只检查DOM完整性
await TamperDetection.check({ type: "dom" });

// 只检查关键文本
await TamperDetection.check({ type: "text" });

// 只检查网络完整性
await TamperDetection.check({ type: "network" });

// 只检查基准内容
await TamperDetection.check({ type: "baseline" });
```

### 检查特定元素

```javascript
// 检查特定DOM元素
await TamperDetection.check({
  type: "dom",
  elementId: "app-header",
});
```

### 强制检查

```javascript
// 忽略豁免状态，强制执行检查
await TamperDetection.check({ force: true });
```

## 📤 手动报告篡改事件

### DOM 篡改报告

```javascript
await TamperDetection.report({
  type: "dom_modification",
  elementId: "app-header",
  original: "Happy TTS",
  tampered: "Modified Content",
  tamperType: "dom",
  method: "manual-detection",
});
```

### 网络篡改报告

```javascript
await TamperDetection.report({
  type: "network_tampering",
  original: "Original API Response",
  tampered: "Modified Response",
  tamperType: "network",
  info: {
    url: "/api/endpoint",
    statusCode: 200,
  },
});
```

### 代理篡改报告

```javascript
await TamperDetection.report({
  type: "proxy_tampering",
  original: "Happy TTS",
  tampered: "Replaced by Proxy",
  tamperType: "proxy",
  method: "content-analysis",
  info: {
    proxyHeaders: ["via", "x-forwarded-for"],
    confidence: 85,
  },
});
```

### 脚本注入报告

```javascript
await TamperDetection.report({
  type: "script_injection",
  elementId: "script-container",
  original: 'console.log("safe")',
  tampered: 'eval("malicious code")',
  tamperType: "injection",
  method: "pattern-detection",
  info: {
    injectionPattern: "eval(",
    riskLevel: "high",
  },
});
```

## 🔄 恢复功能

### 软恢复

```javascript
// 执行软恢复（恢复被保护的文本）
TamperDetection.recover();
```

### 紧急恢复

```javascript
// 执行紧急恢复（完全恢复页面内容）
TamperDetection.recover({ type: "emergency" });

// 紧急恢复但不显示警告
TamperDetection.recover({
  type: "emergency",
  showWarning: false,
});
```

### 基准重捕获

```javascript
// 重新捕获当前页面作为基准
TamperDetection.recover({ type: "baseline" });

// 或者直接调用
TamperDetection.captureBaseline();
```

## 🧪 测试功能

### 模拟不同类型的篡改

```javascript
// 模拟DOM篡改
TamperDetection.simulate({ type: "dom" });

// 模拟网络篡改
TamperDetection.simulate({ type: "network" });

// 模拟代理篡改
TamperDetection.simulate({ type: "proxy" });

// 模拟脚本注入
TamperDetection.simulate({ type: "injection" });
```

### 自定义模拟参数

```javascript
// 模拟特定元素的篡改
TamperDetection.simulate({
  type: "dom",
  elementId: "my-element",
  content: "Custom tampered content",
});
```

## 🎛️ 系统控制

### 基本控制

```javascript
// 暂停系统
TamperDetection.control("pause");

// 恢复系统
TamperDetection.control("resume");

// 禁用系统
TamperDetection.control("disable");

// 重新初始化系统
TamperDetection.control("reinit");

// 重置错误计数
TamperDetection.control("reset");
```

### 调试模式

```javascript
// 启用调试模式（显示详细日志）
TamperDetection.debug(true);

// 禁用调试模式
TamperDetection.debug(false);
```

## 📊 状态监控

### 查看系统状态

```javascript
const status = TamperDetection.status();

// 状态包含以下信息：
// - initialized: 是否已初始化
// - disabled: 是否已禁用
// - recoveryMode: 是否在恢复模式
// - proxyDetection: 代理检测是否启用
// - falsePositives: 误报次数
// - errors: 错误状态
// - exempt: 豁免状态
// - baseline: 基准内容信息
// - monitoring: 监控统计
```

### 检查豁免状态

```javascript
const status = TamperDetection.status();
console.log("豁免状态:", status.exempt);

// 豁免信息包含：
// - isExempt: 是否被豁免
// - isTrustedUrl: 是否为可信URL
// - exemptReasons: 豁免原因列表
```

## 🔍 高级用法

### 批量检查

```javascript
// 依次检查所有类型
const types = ["baseline", "dom", "text", "network"];
for (const type of types) {
  const result = await TamperDetection.check({ type });
  console.log(`${type} 检查结果:`, result);
}
```

### 条件检查

```javascript
// 只在非豁免页面执行检查
const status = TamperDetection.status();
if (!status.exempt.isExempt) {
  await TamperDetection.check();
} else {
  console.log("当前页面已豁免，跳过检查");
}
```

### 错误处理

```javascript
try {
  const result = await TamperDetection.check();
  if (!result.success) {
    console.error("检查失败:", result.errors);
    // 尝试恢复
    TamperDetection.recover();
  }
} catch (error) {
  console.error("检查过程中发生异常:", error);
}
```

## 🛠️ 开发者工具

### 自动化测试

```javascript
// 自动化测试脚本
async function runTamperTests() {
  console.log("🧪 开始篡改检测测试...");

  // 1. 检查初始状态
  const initialStatus = TamperDetection.status();
  console.log("初始状态:", initialStatus);

  // 2. 执行完整性检查
  const checkResult = await TamperDetection.check();
  console.log("完整性检查:", checkResult);

  // 3. 模拟篡改事件
  const simulations = ["dom", "network", "proxy", "injection"];
  for (const type of simulations) {
    console.log(`模拟 ${type} 篡改...`);
    TamperDetection.simulate({ type });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // 4. 执行恢复
  console.log("执行恢复...");
  TamperDetection.recover();

  console.log("✅ 测试完成");
}

// 运行测试
runTamperTests();
```

### 性能监控

```javascript
// 监控检查性能
async function benchmarkCheck() {
  const start = performance.now();
  await TamperDetection.check();
  const end = performance.now();
  console.log(`完整性检查耗时: ${end - start}ms`);
}

benchmarkCheck();
```

## 📝 注意事项

1. **调试模式**: 启用调试模式会显示详细的日志信息，有助于了解系统运行状态
2. **豁免页面**: 某些页面（如上传页面、API 文档等）会被自动豁免检查
3. **强制检查**: 使用 `force: true` 可以忽略豁免状态强制执行检查
4. **错误恢复**: 系统有自动错误恢复机制，但也可以手动重置
5. **性能影响**: 频繁的完整性检查可能影响页面性能，建议适度使用

## 🆘 故障排除

### 系统无响应

```javascript
// 检查系统状态
const status = TamperDetection.status();
if (status.disabled) {
  console.log("系统已禁用，尝试重新初始化...");
  TamperDetection.control("reinit");
}
```

### 误报过多

```javascript
// 重置错误计数
TamperDetection.control("reset");

// 重新捕获基准
TamperDetection.captureBaseline();
```

### 检查失败

```javascript
// 启用调试模式查看详细信息
TamperDetection.debug(true);

// 执行强制检查
await TamperDetection.check({ force: true });
```

更多问题请查看控制台日志或联系开发者。
