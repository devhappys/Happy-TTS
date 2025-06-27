---
id: getting-started
title: 快速开始
sidebar_position: 2
---

# 快速开始

本指南将帮助您快速上手 Happy-TTS API，包括注册账户、获取认证令牌和发送第一个请求。

## 注册账户

### 1. 创建账户

首先，您需要注册一个 Happy-TTS 账户：

```bash
curl -X POST https://tts-api.hapxs.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'
```

### 2. 登录获取令牌

注册成功后，使用您的凭据登录：

```bash
curl -X POST https://tts-api.hapxs.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'
```

响应示例：

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "username": "your_username"
  }
}
```

## 生成语音

### 基本请求

使用获取到的令牌生成语音：

```bash
curl -X POST https://tts-api.hapxs.com/api/tts/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "text": "你好，欢迎使用 Happy-TTS！",
    "model": "tts-1",
    "voice": "alloy",
    "output_format": "mp3",
    "speed": 1.0,
    "generationCode": "wmy"
  }'
```

### 请求参数说明

| 参数             | 类型   | 必需 | 描述                                             | 默认值 |
| ---------------- | ------ | ---- | ------------------------------------------------ | ------ |
| `text`           | string | ✅   | 要转换的文本内容                                 | -      |
| `model`          | string | ❌   | 语音模型 (tts-1, tts-1-hd)                       | tts-1  |
| `voice`          | string | ❌   | 发音人 (alloy, echo, fable, onyx, nova, shimmer) | alloy  |
| `output_format`  | string | ❌   | 输出格式 (mp3, opus, aac, flac)                  | mp3    |
| `speed`          | number | ❌   | 语速 (0.25-4.0)                                  | 1.0    |
| `generationCode` | string | ✅   | 生成码                                           | -      |

### 响应示例

```json
{
  "audioUrl": "https://tts-api.hapxs.com/static/audio/abc123.mp3",
  "fileName": "abc123.mp3",
  "signature": "signed_content_hash"
}
```

## 获取历史记录

查看您最近的语音生成记录：

```bash
curl -X GET https://tts-api.hapxs.com/api/tts/history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

响应示例：

```json
{
  "records": [
    {
      "text": "你好，欢迎使用 Happy-TTS！",
      "fileName": "abc123.mp3",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ]
}
```

## 代码示例

### JavaScript/Node.js

```javascript
const axios = require("axios");

// 登录获取令牌
async function login(username, password) {
  const response = await axios.post(
    "https://tts-api.hapxs.com/api/auth/login",
    {
      username,
      password,
    }
  );
  return response.data.token;
}

// 生成语音
async function generateSpeech(token, text) {
  const response = await axios.post(
    "https://tts-api.hapxs.com/api/tts/generate",
    {
      text,
      model: "tts-1",
      voice: "alloy",
      output_format: "mp3",
      speed: 1.0,
      generationCode: "wmy",
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
}

// 使用示例
async function main() {
  try {
    const token = await login("your_username", "your_password");
    const result = await generateSpeech(token, "你好，世界！");
    console.log("音频文件地址:", result.audioUrl);
  } catch (error) {
    console.error("错误:", error.response?.data || error.message);
  }
}

main();
```

### Python

```python
import requests

# 登录获取令牌
def login(username, password):
    response = requests.post('https://tts-api.hapxs.com/api/auth/login', json={
        'username': username,
        'password': password
    })
    return response.json()['token']

# 生成语音
def generate_speech(token, text):
    response = requests.post('https://tts-api.hapxs.com/api/tts/generate', json={
        'text': text,
        'model': 'tts-1',
        'voice': 'alloy',
        'output_format': 'mp3',
        'speed': 1.0,
        'generationCode': 'wmy'
    }, headers={
        'Authorization': f'Bearer {token}'
    })
    return response.json()

# 使用示例
def main():
    try:
        token = login('your_username', 'your_password')
        result = generate_speech(token, '你好，世界！')
        print('音频文件地址:', result['audioUrl'])
    except Exception as e:
        print('错误:', str(e))

if __name__ == '__main__':
    main()
```

## 错误处理

### 常见错误码

| 状态码 | 错误信息                     | 解决方案                 |
| ------ | ---------------------------- | ------------------------ |
| 400    | 文本内容不能为空             | 检查 text 参数是否为空   |
| 400    | 文本长度不能超过 4096 个字符 | 缩短文本内容             |
| 400    | 文本包含违禁内容             | 修改文本内容             |
| 400    | 您已经生成过相同的内容       | 登录账户或修改文本       |
| 401    | 认证失败                     | 检查令牌是否有效         |
| 403    | 生成码无效                   | 检查 generationCode 参数 |
| 429    | 请求过于频繁                 | 降低请求频率             |
| 429    | 您今日的使用次数已达上限     | 等待次日或升级账户       |

### 错误响应格式

```json
{
  "error": "错误描述信息"
}
```

## 下一步

- 📖 查看 [API 参考文档](./api/tts-endpoints.md) 了解所有可用接口
- 🔐 了解 [认证机制](./api/authentication.md)
  <!-- - 🛠️ 查看 [集成示例](./tutorials/integration-examples.md) -->
  <!-- - 📊 学习 [最佳实践](./best-practices/performance.md) -->

---

**继续学习** → [API 参考文档](./api/tts-endpoints.md)
