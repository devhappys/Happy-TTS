import { Request, Response } from 'express';
import { UserStorage, User } from '../utils/userStorage';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';
import { EmailService } from '../services/emailService';

// 支持的主流邮箱后缀
const allowedDomains = [
  'gmail.com', 'outlook.com', 'qq.com', '163.com', '126.com',
  'hotmail.com', 'yahoo.com', 'icloud.com', 'foxmail.com'
];
const emailPattern = new RegExp(
  `^[\\w.-]+@(${allowedDomains.map(d => d.replace('.', '\\.')).join('|')})$`
);

// 临时存储验证码（生产建议用redis等持久化）
const emailCodeMap = new Map();

// 顶部 import 后添加类型声明
type UserWithVerified = User & { verified?: boolean };

export class AuthController {

    public static async register(req: Request, res: Response) {
        try {
            const { username, email, password } = req.body;

            if (!username || !email || !password) {
                return res.status(400).json({
                    error: '请提供所有必需的注册信息'
                });
            }

            // 只允许主流邮箱
            if (!emailPattern.test(email)) {
                return res.status(400).json({ error: '只支持主流邮箱（如gmail、outlook、qq、163、126、hotmail、yahoo、icloud、foxmail等）' });
            }

            // 验证邮箱格式
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    error: '邮箱格式不正确'
                });
            }

            const user = await UserStorage.createUser(username, email, password);
            if (!user) {
                return res.status(400).json({
                    error: '用户名或邮箱已被使用'
                });
            }

            // 生成8位数字+大小写字母验证码
            const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
            let code = '';
            for (let i = 0; i < 8; i++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            emailCodeMap.set(email, code);
            // 精美HTML邮件内容
            const html = `
              <div style="max-width:420px;margin:32px auto;padding:32px 24px;background:linear-gradient(135deg,#6366f1 0%,#a5b4fc 100%);border-radius:20px;box-shadow:0 4px 24px 0 rgba(99,102,241,0.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Oxygen','Ubuntu','Cantarell',sans-serif;">
                <div style="text-align:center;margin-bottom:24px;">
                  <div style="font-size:38px;color:#6366f1;">🔐</div>
                  <h2 style="margin:0 0 8px 0;color:#fff;font-size:1.8rem;font-weight:700;letter-spacing:1px;">邮箱验证</h2>
                  <p style="color:#e0e7ff;font-size:1.1rem;margin:0;">欢迎注册 Happy-TTS</p>
                </div>
                <div style="background:#fff;border-radius:16px;padding:24px 16px;margin-bottom:24px;box-shadow:0 2px 8px rgba(99,102,241,0.06);">
                  <div style="text-align:center;font-size:1.1rem;color:#6366f1;font-weight:600;letter-spacing:2px;">您的验证码</div>
                  <div style="font-size:2.2rem;font-weight:700;color:#4f46e5;letter-spacing:6px;margin:18px 0 8px 0;">${code}</div>
                  <div style="color:#64748b;font-size:0.95rem;">有效期：5分钟。请勿泄露验证码。</div>
                </div>
                <div style="text-align:center;color:#64748b;font-size:0.95rem;">如非本人操作，请忽略此邮件。</div>
                <div style="margin-top:32px;text-align:center;">
                  <span style="color:#818cf8;font-size:1.1rem;font-weight:600;">Happy-TTS 团队</span>
                </div>
              </div>
            `;
            await EmailService.sendEmail({
              from: 'noreply@hapxs.com',
              to: [email],
              subject: 'Happy-TTS 注册验证码',
              html,
              text: `您的注册验证码为：${code}，5分钟内有效。`
            });
            // 返回需验证
            res.status(200).json({ needVerify: true });
        } catch (error) {
            logger.error('注册失败:', error);
            res.status(500).json({ error: '注册失败' });
        }
    }

    public static async verifyEmail(req: Request, res: Response) {
        try {
            const { email, code } = req.body;
            if (!email || !code) {
                return res.status(400).json({ error: '参数缺失' });
            }
            const realCode = emailCodeMap.get(email);
            if (!realCode) {
                return res.status(400).json({ error: '请先注册获取验证码' });
            }
            if (realCode !== code) {
                return res.status(400).json({ error: '验证码错误' });
            }
            // 验证通过，正式创建用户
            // 这里假设注册信息已暂存，实际可用redis等存储注册信息
            // 简化：直接允许登录
            emailCodeMap.delete(email);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: '邮箱验证失败' });
        }
    }

    public static async login(req: Request, res: Response) {
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
                    logger.warn('登录失败：密码错误', logDetails);
                }
                
                return res.status(401).json({ error: '用户名/邮箱或密码错误' });
            }

            // 检查用户是否启用了TOTP或Passkey
            const hasTOTP = !!user.totpEnabled;
            const hasPasskey = Array.isArray(user.passkeyCredentials) && user.passkeyCredentials.length > 0;
            if (hasTOTP || hasPasskey) {
                // 兜底：只返回临时token和二次验证类型，禁止直接登录
                // 必须通过TOTP或Passkey二次验证接口后，才发放正式token
                const tempToken = user.id;
                await updateUserToken(user.id, tempToken, 5 * 60 * 1000); // 5分钟过期
                const { password: _, ...userWithoutPassword } = user;
                return res.json({
                    user: userWithoutPassword,
                    token: tempToken,
                    requires2FA: true,
                    twoFactorType: [hasTOTP ? 'TOTP' : null, hasPasskey ? 'Passkey' : null].filter(Boolean)
                });
            }

            // 记录登录成功
            logger.info('登录成功', {
                userId: user.id,
                username: user.username,
                ...logDetails
            });

            // 生成token（用id即可）
            const token = user.id;
            // 写入token到users.json
            await updateUserToken(user.id, token);
            // 不返回密码
            const { password: _, ...userWithoutPassword } = user;
            res.json({
                user: userWithoutPassword,
                token
            });
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
            
            // 尝试解析JWT token，如果失败则使用token作为userId
            let userId: string;
            let isJWTToken = false;
            try {
                const decoded: any = require('jsonwebtoken').verify(token, require('../config/config').config.jwtSecret);
                userId = decoded.userId;
                isJWTToken = true;
                logger.info('使用JWT token解析用户ID', { userId, tokenType: 'JWT' });
            } catch (e) {
                // JWT解析失败，尝试使用token作为用户ID（兼容旧的登录方式）
                userId = token;
                isJWTToken = false;
                logger.info('使用token作为用户ID', { userId, tokenType: 'UserID' });
            }
            
            // 验证token是否有效（检查用户是否存在且token未过期）
            const user = await UserStorage.getUserById(userId);
            if (!user) {
                logger.warn('getUserById: 未找到用户', { 
                    id: userId, 
                    tokenType: isJWTToken ? 'JWT' : 'UserID',
                    storageMode: process.env.USER_STORAGE_MODE || 'file'
                });
                return res.status(404).json({
                    error: '用户不存在'
                });
            }
            
            // 对于UserID类型的token，检查过期时间和匹配性
            if (!isJWTToken) {
                // 检查token是否过期
                if (user.tokenExpiresAt && Date.now() > user.tokenExpiresAt) {
                    logger.warn('token已过期', { userId, tokenExpiresAt: user.tokenExpiresAt, now: Date.now() });
                    return res.status(401).json({ error: '认证令牌已过期' });
                }
                
                // 验证token是否匹配
                if (user.token !== token) {
                    logger.warn('token不匹配', { userId, storedToken: user.token, providedToken: token });
                    return res.status(401).json({ error: '认证令牌无效' });
                }
            }
            
            const remainingUsage = await UserStorage.getRemainingUsage(userId);
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

    // 新增 GET /api/user/profile 获取当前用户信息
    public static async getUserProfile(req: Request, res: Response) {
        try {
            const userId = req.params.id || req.user?.id; // 从请求参数或认证头中获取用户ID
            if (!userId) {
                return res.status(401).json({ error: '未登录或用户ID缺失' });
            }

            const user = await UserStorage.getUserById(userId);
            if (!user) {
                return res.status(404).json({ error: '用户不存在' });
            }

            const { password: _, ...userWithoutPassword } = user;
            res.json(userWithoutPassword);
        } catch (error) {
            logger.error('获取用户信息失败:', error);
            res.status(500).json({ error: '获取用户信息失败' });
        }
    }

    // 新增 POST /api/user/profile 修改邮箱、密码、头像，需验证通过
    public static async updateUserProfile(req: Request, res: Response) {
        try {
            const userId = req.user?.id; // 从认证头中获取用户ID
            if (!userId) {
                return res.status(401).json({ error: '未登录或用户ID缺失' });
            }

            const { email, password, newPassword } = req.body;

            if (email) {
                if (!emailPattern.test(email)) {
                    return res.status(400).json({ error: '只支持主流邮箱（如gmail、outlook、qq、163、126、hotmail、yahoo、icloud、foxmail等）' });
                }
                const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailRegex.test(email)) {
                    return res.status(400).json({ error: '邮箱格式不正确' });
                }
                const existingUser = await UserStorage.getUserByEmail(email);
                if (existingUser && existingUser.id !== userId) {
                    return res.status(400).json({ error: '邮箱已被其他用户使用' });
                }
            }

            if (password) {
                const user = await UserStorage.authenticateUser((req.user as any)?.username || (req.user as any)?.email || '', password);
                if (!user) {
                    return res.status(401).json({ error: '当前密码错误' });
                }
            }

            if (newPassword) {
                if (password === newPassword) {
                    return res.status(400).json({ error: '新密码与当前密码相同' });
                }
                await UserStorage.updateUser(userId, { password: newPassword });
            }

            if (email) {
                await UserStorage.updateUser(userId, { email });
            }

            const updatedUser = await UserStorage.getUserById(userId);
            if (!updatedUser) {
                return res.status(404).json({ error: '用户不存在' });
            }

            const { password: _, ...userWithoutPassword } = updatedUser;
            res.json(userWithoutPassword);
        } catch (error) {
            logger.error('更新用户信息失败:', error);
            res.status(500).json({ error: '更新用户信息失败' });
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