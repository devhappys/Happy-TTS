import { Request, Response } from 'express';
import { UserStorage, User } from '../utils/userStorage';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';
import { EmailService } from '../services/emailService';

// 支持的主流邮箱后缀
const allowedDomains = [
    'gmail.com', 'outlook.com', 'qq.com', '163.com', '126.com',
    'hotmail.com', 'yahoo.com', 'icloud.com', 'foxmail.com', 'hapxs.com', 'hapx.one'
];
const emailPattern = new RegExp(
    `^[\\w.-]+@(${allowedDomains.map(d => d.replace('.', '\\.')).join('|')})$`
);

// 临时存储验证码和注册信息
const emailCodeMap = new Map(); // email -> { code, time, regInfo }

// 顶部 import 后添加类型声明
type UserWithVerified = User & { verified?: boolean };

// 生成邮箱验证码HTML模板（与TtsPage UI风格统一）
function generateVerificationEmailHtml(username: string, code: string): string {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Happy-TTS 邮箱验证码</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #f0f8ff 0%, #ffffff 50%, #f8f0ff 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(10px);
            border-radius: 24px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
        }
        .header .icon {
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }
        .header p {
            color: #bfdbfe;
            font-size: 18px;
        }
        .content {
            padding: 40px 30px;
        }
        .welcome {
            text-align: center;
            margin-bottom: 30px;
        }
        .welcome h2 {
            font-size: 24px;
            color: #1f2937;
            margin-bottom: 10px;
        }
        .welcome p {
            color: #6b7280;
            font-size: 16px;
        }
        .code-section {
            background: #f9fafb;
            border-radius: 16px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
            border: 1px solid #e5e7eb;
        }
        .code-label {
            color: #374151;
            font-size: 16px;
            margin-bottom: 15px;
            font-weight: 500;
        }
        .verification-code {
            font-size: 36px;
            font-weight: bold;
            color: #3b82f6;
            letter-spacing: 6px;
            font-family: 'Courier New', monospace;
            background: white;
            padding: 20px 30px;
            border-radius: 12px;
            border: 2px solid #3b82f6;
            display: inline-block;
            margin: 10px 0;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
        }
        .instructions {
            background: rgba(59, 130, 246, 0.05);
            border-left: 4px solid #3b82f6;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .instructions h3 {
            color: #1f2937;
            font-size: 18px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .instructions ul {
            color: #4b5563;
            padding-left: 20px;
        }
        .instructions li {
            margin-bottom: 8px;
        }
        .warning {
            background: rgba(239, 68, 68, 0.05);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
        }
        .warning p {
            color: #dc2626;
            font-size: 14px;
            margin: 5px 0;
        }
        .footer {
            background: #f9fafb;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
        }
        .footer p {
            color: #6b7280;
            font-size: 14px;
            margin-bottom: 10px;
        }
        .footer .brand {
            color: #3b82f6;
            font-weight: 600;
            font-size: 16px;
        }
        @media (max-width: 600px) {
            .container {
                margin: 10px;
                border-radius: 16px;
            }
            .header {
                padding: 30px 20px;
            }
            .header h1 {
                font-size: 24px;
            }
            .content {
                padding: 30px 20px;
            }
            .verification-code {
                font-size: 28px;
                letter-spacing: 4px;
                padding: 15px 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>
                <span class="icon">🔊</span>
                Happy-TTS
            </h1>
            <p>文本转语音服务平台</p>
        </div>
        
        <div class="content">
            <div class="welcome">
                <h2>欢迎注册 Happy-TTS！</h2>
                <p>亲爱的 <strong>${username}</strong>，感谢您选择我们的服务</p>
            </div>
            
            <div class="code-section">
                <div class="code-label">您的邮箱验证码</div>
                <div class="verification-code">${code}</div>
                <p style="color: #6b7280; font-size: 14px; margin-top: 10px;">
                    验证码有效期为 10 分钟
                </p>
            </div>
            
            <div class="instructions">
                <h3>
                    📋 验证步骤
                </h3>
                <ul>
                    <li>返回注册页面</li>
                    <li>在验证码输入框中输入上方的 8 位数字验证码</li>
                    <li>点击"创建账户"完成注册</li>
                    <li>开始享受我们的文本转语音服务</li>
                </ul>
            </div>
            
            <div class="warning">
                <p><strong>⚠️ 安全提醒</strong></p>
                <p>请勿将验证码告知他人，我们不会主动索要您的验证码</p>
                <p>如果您没有进行注册操作，请忽略此邮件</p>
            </div>
        </div>
        
        <div class="footer">
            <p class="brand">Happy-TTS 团队</p>
            <p>让文字拥有声音的力量</p>
            <p style="font-size: 12px; color: #9ca3af;">
                此邮件由系统自动发送，请勿回复
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

export class AuthController {

    public static async register(req: Request, res: Response) {
        try {
            const { username, email, password } = req.body;
            if (!username || !email || !password) {
                return res.status(400).json({ error: '请提供所有必需的注册信息' });
            }
            // 禁止用户名为admin等保留字段，仅注册时校验
            if (username && ['admin', 'root', 'system', 'test', 'administrator'].includes(username.toLowerCase())) {
                return res.status(400).json({ error: '用户名不能为保留字段' });
            }
            // 只允许主流邮箱
            if (!emailPattern.test(email)) {
                return res.status(400).json({ error: '只支持主流邮箱（如gmail、outlook、qq、163、126、hotmail、yahoo、icloud、foxmail、hapxs、hapx等）' });
            }
            // 验证邮箱格式
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: '邮箱格式不正确' });
            }
            // 检查用户名或邮箱是否已注册
            const existUser = await UserStorage.getUserByUsername(username);
            const existEmail = await UserStorage.getUserByEmail(email);
            if (existUser || existEmail) {
                return res.status(400).json({ error: '用户名或邮箱已被使用' });
            }
            // 生成8位数字验证码
            let code = '';
            for (let i = 0; i < 8; i++) {
                code += Math.floor(Math.random() * 10);
            }
            const now = Date.now();
            // 缓存注册信息和验证码
            emailCodeMap.set(email, { code, time: now, regInfo: { username, email, password } });
            // 发送邮件验证码
            try {
                const emailHtml = generateVerificationEmailHtml(username, code);
                const emailResult = await EmailService.sendHtmlEmail(
                    [email],
                    'Happy-TTS 邮箱验证码',
                    emailHtml
                );

                if (emailResult.success) {
                    logger.info(`[邮箱验证码] 成功发送到: ${email}`);
                    res.json({ needVerify: true });
                } else {
                    logger.error(`[邮箱验证码] 发送失败: ${email}, 错误: ${emailResult.error}`);
                    // 清理缓存的注册信息
                    emailCodeMap.delete(email);
                    res.status(500).json({ error: '验证码发送失败，请稍后重试' });
                }
            } catch (emailError) {
                logger.error(`[邮箱验证码] 发送异常: ${email}`, emailError);
                // 清理缓存的注册信息
                emailCodeMap.delete(email);
                res.status(500).json({ error: '验证码发送失败，请稍后重试' });
            }
        } catch (error) {
            res.status(500).json({ error: '注册失败' });
        }
    }

    public static async verifyEmail(req: Request, res: Response) {
        try {
            const { email, code } = req.body;
            if (!email || !code) {
                return res.status(400).json({ error: '参数缺失' });
            }
            if (!/^[0-9]{8}$/.test(code)) {
                return res.status(400).json({ error: '验证码仅为八位数字' });
            }
            const entry = emailCodeMap.get(email);
            if (!entry) {
                return res.status(400).json({ error: '请先注册获取验证码' });
            }
            if (entry.code !== code) {
                return res.status(400).json({ error: '验证码错误' });
            }
            // 校验通过，正式创建用户
            const { regInfo } = entry;
            if (!regInfo) {
                return res.status(400).json({ error: '注册信息已过期或无效' });
            }
            // 再次检查用户名/邮箱是否被注册（防止并发）
            const existUser = await UserStorage.getUserByUsername(regInfo.username);
            const existEmail = await UserStorage.getUserByEmail(regInfo.email);
            if (existUser || existEmail) {
                emailCodeMap.delete(email);
                return res.status(400).json({ error: '用户名或邮箱已被使用' });
            }
            await UserStorage.createUser(regInfo.username, regInfo.email, regInfo.password);
            emailCodeMap.delete(email);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: '邮箱验证失败' });
        }
    }

    // 新增：重发验证码接口
    public static async sendVerifyEmail(req: Request, res: Response) {
        try {
            const { email } = req.body;
            if (!email || !emailPattern.test(email)) {
                return res.status(400).json({ error: '邮箱格式不正确' });
            }
            const entry = emailCodeMap.get(email);
            const now = Date.now();
            if (entry && now - entry.time < 60000) {
                return res.status(429).json({ error: '请60秒后再试' });
            }

            // 检查是否有注册信息
            if (!entry || !entry.regInfo) {
                return res.status(400).json({ error: '请先进行注册操作' });
            }

            // 生成8位数字验证码
            let code = '';
            for (let i = 0; i < 8; i++) {
                code += Math.floor(Math.random() * 10);
            }

            // 更新验证码但保留注册信息
            emailCodeMap.set(email, { code, time: now, regInfo: entry.regInfo });

            // 发送邮件验证码
            try {
                const emailHtml = generateVerificationEmailHtml(entry.regInfo.username, code);
                const emailResult = await EmailService.sendHtmlEmail(
                    [email],
                    'Happy-TTS 邮箱验证码',
                    emailHtml
                );

                if (emailResult.success) {
                    logger.info(`[重发邮箱验证码] 成功发送到: ${email}`);
                    res.json({ success: true });
                } else {
                    logger.error(`[重发邮箱验证码] 发送失败: ${email}, 错误: ${emailResult.error}`);
                    res.status(500).json({ error: '验证码发送失败，请稍后重试' });
                }
            } catch (emailError) {
                logger.error(`[重发邮箱验证码] 发送异常: ${email}`, emailError);
                res.status(500).json({ error: '验证码发送失败，请稍后重试' });
            }
        } catch (error) {
            res.status(500).json({ error: '验证码发送失败' });
        }
    }

    public static async login(req: Request, res: Response) {
        const t0 = Date.now();
        try {
            // 记录收到的请求体
            logger.info('收到登录请求', {
                body: req.body,
                headers: req.headers,
                ip: req.ip,
                timestamp: new Date().toISOString()
            });

            const { identifier, password } = req.body;
            const ip = req.ip || 'unknown';
            const userAgent = req.headers['user-agent'] || 'unknown';

            // 验证必填字段
            if (!identifier) {
                logger.warn('登录失败：identifier 字段缺失', { body: req.body });
                return res.status(400).json({ error: '请提供用户名或邮箱' });
            }
            if (!password) {
                logger.warn('登录失败：password 字段缺失', { body: req.body });
                return res.status(400).json({ error: '请提供密码' });
            }

            const logDetails = {
                identifier,
                ip,
                userAgent,
                timestamp: new Date().toISOString()
            };



            logger.info('开始用户认证', logDetails);

            // 使用 UserStorage 进行认证
            const user = await UserStorage.authenticateUser(identifier, password);

            if (!user) {
                // 为了确定失败的具体原因，我们再次查找用户
                const allUsers = await UserStorage.getAllUsers();
                const userExists = allUsers.some(u => u.username === identifier || u.email === identifier);

                if (!userExists) {
                    logger.warn('登录失败：用户不存在', logDetails);
                } else {
                    // 仅开发环境输出预期密码
                    let expectedPassword = undefined;
                    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') {
                        const user = allUsers.find(u => u.username === identifier || u.email === identifier);
                        expectedPassword = user?.password;
                    }
                    logger.warn('登录失败：密码错误', { ...logDetails, expectedPassword }); // 仅开发环境输出预期密码
                }

                return res.status(401).json({ error: '用户名/邮箱或密码错误' });
            }

            // 检查用户是否启用了TOTP或Passkey
            const hasTOTP = !!user.totpEnabled;
            const hasPasskey = Array.isArray(user.passkeyCredentials) && user.passkeyCredentials.length > 0;
            if (hasTOTP || hasPasskey) {
                const tempToken = user.id;
                const tToken = Date.now();
                await updateUserToken(user.id, tempToken, 5 * 60 * 1000); // 5分钟过期
                const tTokenEnd = Date.now();
                logger.info('[login] updateUserToken耗时', { 耗时: tTokenEnd - tToken + 'ms' });
                // 不返回avatarBase64
                const { id, username, email, role } = user;
                const t1 = Date.now();
                res.json({
                    user: { id, username, email, role },
                    token: tempToken,
                    requires2FA: true,
                    twoFactorType: [hasTOTP ? 'TOTP' : null, hasPasskey ? 'Passkey' : null].filter(Boolean)
                });
                logger.info('[login] 已返回二次验证响应', { 总耗时: t1 - t0 + 'ms', t0, t1 });
                return;
            }

            // 登录成功
            logger.info('登录成功', {
                userId: user.id,
                username: user.username,
                ...logDetails
            });
            // 生成JWT token
            const jwt = require('jsonwebtoken');
            const config = require('../config/config').config;
            const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '2h' });
            // 不再写入user.token，仅返回JWT
            const { id, username, email, role } = user;
            const t1 = Date.now();
            res.json({ user: { id, username, email, role }, token });
            logger.info('[login] 已返回登录响应', { 总耗时: t1 - t0 + 'ms', t0, t1 });
            return;
        } catch (error) {
            logger.error('登录流程发生未知错误', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                identifier: req.body?.identifier,
                ip: req.ip,
                body: req.body
            });
            res.status(500).json({ error: '登录失败' });
        }
    }

    public static async getCurrentUser(req: Request, res: Response) {
        try {
            const ip = req.ip || 'unknown';
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    error: '未登录'
                });
            }
            const token = authHeader.split(' ')[1];
            if (!token) {
                return res.status(401).json({
                    error: '无效的认证令牌'
                });
            }
            // 只支持JWT token
            let userId: string;
            try {
                const decoded: any = require('jsonwebtoken').verify(token, require('../config/config').config.jwtSecret);
                userId = decoded.userId;
            } catch (e) {
                return res.status(401).json({ error: '认证令牌无效' });
            }
            // 验证token是否有效（检查用户是否存在）
            const user = await UserStorage.getUserById(userId);
            if (!user) {
                logger.warn('getUserById: 未找到用户', { id: userId, tokenType: 'JWT', storageMode: process.env.USER_STORAGE_MODE || 'file' });
                return res.status(404).json({ error: '用户不存在' });
            }
            const remainingUsage = await UserStorage.getRemainingUsage(userId);
            // 不返回avatarBase64
            const { password: _, ...userWithoutPassword } = user;
            res.json({
                ...userWithoutPassword,
                remainingUsage
            });
        } catch (error) {
            logger.error('获取用户信息失败:', error);
            res.status(500).json({ error: '获取用户信息失败' });
        }
    }

    /**
     * Passkey 二次校验接口
     * @param req.body { username: string, passkeyCredentialId: string }
     */
    public static async passkeyVerify(req: Request, res: Response) {
        try {
            const { username, passkeyCredentialId } = req.body;
            if (!username || !passkeyCredentialId) {
                return res.status(400).json({ error: '缺少必要参数' });
            }

            // 查找用户并验证
            const user = await UserStorage.getUserByUsername(username);
            if (!user) {
                logger.warn('[AuthController] Passkey校验失败：用户不存在', { username });
                return res.status(404).json({ error: '用户不存在' });
            }

            // 验证用户是否启用了Passkey
            if (!user.passkeyEnabled || !Array.isArray(user.passkeyCredentials) || user.passkeyCredentials.length === 0) {
                logger.warn('[AuthController] Passkey校验失败：用户未启用Passkey', {
                    username,
                    userId: user.id,
                    passkeyEnabled: user.passkeyEnabled,
                    credentialsCount: user.passkeyCredentials?.length || 0
                });
                return res.status(400).json({ error: '用户未启用Passkey' });
            }

            // 验证用户名与用户数据的一致性
            if (user.username !== username) {
                logger.error('[AuthController] Passkey校验失败：用户名与用户数据不匹配', {
                    providedUsername: username,
                    actualUsername: user.username,
                    userId: user.id
                });
                return res.status(400).json({ error: '用户名验证失败' });
            }

            // 校验 passkeyCredentialId 是否存在
            const found = user.passkeyCredentials.some(
                cred => cred.credentialID === passkeyCredentialId
            );
            if (!found) {
                logger.warn('[AuthController] Passkey校验失败：找不到匹配的credentialID', {
                    username,
                    userId: user.id,
                    providedCredentialId: passkeyCredentialId,
                    availableCredentialIds: user.passkeyCredentials.map(c => c.credentialID?.substring(0, 10) + '...')
                });
                return res.status(401).json({ error: 'Passkey 校验失败' });
            }

            // 更新用户状态（如添加 passkeyVerified 字段）
            await UserStorage.updateUser(user.id, { passkeyVerified: true });
            logger.info('[AuthController] Passkey 校验通过，已更新用户状态', {
                userId: user.id,
                username,
                credentialId: passkeyCredentialId.substring(0, 10) + '...'
            });

            // 生成JWT token
            const jwt = require('jsonwebtoken');
            const config = require('../config/config').config;
            const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '2h' });

            logger.info('[AuthController] Passkey验证成功，生成JWT token', {
                userId: user.id,
                username,
                tokenType: 'JWT'
            });

            const { password: _, ...userWithoutPassword } = user;
            return res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                }
            });
        } catch (error) {
            logger.error('[AuthController] Passkey 校验接口异常', {
                error: error instanceof Error ? error.message : String(error),
                username: req.body?.username
            });
            return res.status(500).json({ error: '服务器异常' });
        }
    }

    // 新增 POST /api/user/verify 支持邮箱验证码、TOTP等验证方式
    public static async verifyUser(req: Request, res: Response) {
        try {
            const { userId, verificationCode } = req.body;
            if (!userId || !verificationCode) {
                return res.status(400).json({ error: '用户ID或验证码缺失' });
            }

            const user = await UserStorage.getUserById(userId);
            if (!user) {
                return res.status(404).json({ error: '用户不存在' });
            }

            // 检查是否启用了TOTP或Passkey
            const hasTOTP = !!user.totpEnabled;
            const hasPasskey = Array.isArray(user.passkeyCredentials) && user.passkeyCredentials.length > 0;

            if (!hasTOTP && !hasPasskey) {
                return res.status(400).json({ error: '用户未启用任何二次验证' });
            }

            let verificationResult = false;
            if (hasTOTP) {
                // TOTP验证
                if (user.totpSecret) {
                    const totp = require('otplib');
                    totp.options = {
                        digits: 6,
                        step: 30,
                        window: 1
                    };
                    const isValid = totp.verify({
                        secret: user.totpSecret,
                        token: verificationCode,
                        encoding: 'hex'
                    });
                    if (isValid) {
                        verificationResult = true;
                        logger.info(`TOTP验证成功: userId=${userId}, token=${verificationCode}`);
                    } else {
                        logger.warn(`TOTP验证失败: userId=${userId}, token=${verificationCode}`);
                    }
                } else {
                    logger.warn(`TOTP验证失败: userId=${userId}, 用户未启用TOTP`);
                }
            }

            if (!verificationResult && hasPasskey) {
                // Passkey验证
                const { username, passkeyCredentials } = user;
                if (username && passkeyCredentials && passkeyCredentials.length > 0) {
                    const found = passkeyCredentials.some(
                        cred => cred.credentialID === verificationCode
                    );
                    if (found) {
                        verificationResult = true;
                        logger.info(`Passkey验证成功: userId=${userId}, credentialId=${verificationCode}`);
                    } else {
                        logger.warn(`Passkey验证失败: userId=${userId}, credentialId=${verificationCode}`);
                    }
                } else {
                    logger.warn(`Passkey验证失败: userId=${userId}, 用户未启用Passkey`);
                }
            }

            if (!verificationResult) {
                return res.status(401).json({ error: '验证码错误或用户未启用二次验证' });
            }

            // 验证通过，更新用户状态
            await UserStorage.updateUser(userId, { verified: true } as Partial<UserWithVerified>);
            logger.info(`用户 ${userId} 验证成功`);
            // 不返回avatarBase64
            res.json({ success: true });
        } catch (error) {
            logger.error('用户验证失败:', error);
            res.status(500).json({ error: '用户验证失败' });
        }
    }


}

// 辅助函数：写入token和过期时间到users.json
async function updateUserToken(userId: string, token: string, expiresInMs = 2 * 60 * 60 * 1000) {
    await UserStorage.updateUser(userId, { token, tokenExpiresAt: Date.now() + expiresInMs });
}

// 校验管理员token
export async function isAdminToken(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    const users = await UserStorage.getAllUsers();
    const user = users.find(u => u.role === 'admin' && u.token === token);
    if (!user) return false;
    if (!user.tokenExpiresAt || Date.now() > user.tokenExpiresAt) return false;
    return true;
}

// 登出接口
export function registerLogoutRoute(app: any) {
    app.post('/api/auth/logout', async (req: any, res: any) => {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) return res.json({ success: true });
            const users = await UserStorage.getAllUsers();
            const idx = users.findIndex((u: any) => u.token === token);
            if (idx !== -1) {
                await UserStorage.updateUser(users[idx].id, { token: undefined, tokenExpiresAt: undefined });
            }
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: '登出失败' });
        }
    });
} 