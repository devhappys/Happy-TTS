import express from 'express';
import rateLimit from 'express-rate-limit';
import { TurnstileService } from '../services/turnstileService';
import { authenticateToken } from '../middleware/authenticateToken';
import { schedulerService } from '../services/schedulerService';

const router = express.Router();

// 创建不同类型的速率限制器
// 公共接口限流器（无需认证的接口）
const publicLimiter = rateLimit({
    windowMs: 60 * 1000, // 1分钟
    max: 30, // 每分钟30次请求
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '请求过于频繁，请稍后再试' },
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
    handler: (req, res) => {
        res.status(429).json({
            error: '请求过于频繁，请稍后再试',
            retryAfter: 60
        });
    }
});

// 指纹验证接口限流器（更严格）
const fingerprintLimiter = rateLimit({
    windowMs: 60 * 1000, // 1分钟
    max: 20, // 每分钟20次请求
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '指纹验证请求过于频繁，请稍后再试' },
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
    handler: (req, res) => {
        res.status(429).json({
            error: '指纹验证请求过于频繁，请稍后再试',
            retryAfter: 60
        });
    }
});

// 新增：认证用户的指纹上报限流器（按用户+IP 更严格）
const authenticatedFingerprintLimiter = rateLimit({
    windowMs: 60 * 1000, // 1分钟
    max: 10, // 每分钟10次请求
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '指纹上报请求过于频繁，请稍后再试' },
    keyGenerator: (req) => {
        const userId = (req as any).user?.id || 'anonymous';
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        return `${userId}:${ip}`;
    },
    handler: (req, res) => {
        res.status(429).json({
            error: '指纹上报请求过于频繁，请稍后再试',
            retryAfter: 60
        });
    }
});

// 管理员接口限流器
const adminLimiter = rateLimit({
    windowMs: 60 * 1000, // 1分钟
    max: 50, // 每分钟50次请求
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '管理员操作过于频繁，请稍后再试' },
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
    handler: (req, res) => {
        res.status(429).json({
            error: '管理员操作过于频繁，请稍后再试',
            retryAfter: 60
        });
    }
});

// 配置管理接口限流器（更严格）
const configLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5分钟
    max: 10, // 每5分钟10次请求
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '配置操作过于频繁，请稍后再试' },
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
    handler: (req, res) => {
        res.status(429).json({
            error: '配置操作过于频繁，请稍后再试',
            retryAfter: 300
        });
    }
});

// 指纹上报接口（需要认证，用于已登录用户）
router.post('/fingerprint/report', authenticateToken, authenticatedFingerprintLimiter, async (req, res) => {
    try {
        const { fingerprint } = req.body;
        const clientIp = req.ip || req.socket.remoteAddress || (Array.isArray(req.headers['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : req.headers['x-forwarded-for']) || 'unknown';
        const validatedClientIp = typeof clientIp === 'string' ? clientIp : 'unknown';
        const userId = (req as any).user?.id;
        const userAgent = req.headers['user-agent'] || 'unknown';

        console.log('🔍 收到指纹上报请求:', {
            fingerprint: fingerprint ? fingerprint.substring(0, 8) + '...' : 'null',
            clientIp: validatedClientIp,
            userId,
            userAgent: userAgent.substring(0, 50) + '...'
        });

        if (!fingerprint || typeof fingerprint !== 'string') {
            console.warn('❌ 指纹参数无效:', { fingerprint });
            return res.status(400).json({
                success: false,
                error: '指纹参数无效'
            });
        }

        // 检查IP是否被封禁
        const banStatus = await TurnstileService.isIpBanned(validatedClientIp);
        if (banStatus.banned) {
            console.warn('🚫 IP已被封禁:', {
                ip: validatedClientIp,
                reason: banStatus.reason,
                expiresAt: banStatus.expiresAt
            });
            return res.status(403).json({
                success: false,
                error: 'IP已被封禁',
                reason: banStatus.reason,
                expiresAt: banStatus.expiresAt
            });
        }

        // 这里可以添加指纹存储逻辑，目前只是记录日志
        // 可以考虑将指纹信息存储到数据库中，用于用户行为分析
        console.log('✅ 指纹上报成功:', {
            fingerprint: fingerprint.substring(0, 8) + '...',
            userId,
            clientIp: validatedClientIp,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: '指纹上报成功',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ 指纹上报失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 临时指纹上报接口（无需认证）
router.post('/temp-fingerprint', publicLimiter, async (req, res) => {
    try {
        const { fingerprint } = req.body;
        const clientIp = req.ip || req.socket.remoteAddress || (Array.isArray(req.headers['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : req.headers['x-forwarded-for']) || 'unknown';
        const validatedClientIp = typeof clientIp === 'string' ? clientIp : 'unknown';

        if (!fingerprint || typeof fingerprint !== 'string') {
            return res.status(400).json({
                success: false,
                error: '指纹参数无效'
            });
        }

        // 检查IP是否被封禁
        const banStatus = await TurnstileService.isIpBanned(validatedClientIp);
        if (banStatus.banned) {
            return res.status(403).json({
                success: false,
                error: 'IP已被封禁',
                reason: banStatus.reason,
                expiresAt: banStatus.expiresAt
            });
        }

        const result = await TurnstileService.reportTempFingerprint(fingerprint, validatedClientIp);

        res.json({
            success: true,
            isFirstVisit: result.isFirstVisit,
            verified: result.verified
        });
    } catch (error) {
        console.error('临时指纹上报失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 验证临时指纹接口（无需认证）
router.post('/verify-temp-fingerprint', fingerprintLimiter, async (req, res) => {
    try {
        const { fingerprint, cfToken, userAgent, captchaType } = req.body;
        const clientIp = req.ip || req.socket.remoteAddress || (Array.isArray(req.headers['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : req.headers['x-forwarded-for']) || 'unknown';
        const validatedClientIp = typeof clientIp === 'string' ? clientIp : 'unknown';
        const clientUserAgent = userAgent || req.headers['user-agent'] || 'unknown';

        if (!fingerprint || typeof fingerprint !== 'string') {
            return res.status(400).json({
                success: false,
                error: '指纹参数无效'
            });
        }

        if (!cfToken || typeof cfToken !== 'string') {
            return res.status(400).json({
                success: false,
                error: '验证令牌无效'
            });
        }

        // 检查IP是否被封禁
        const banStatus = await TurnstileService.isIpBanned(validatedClientIp);
        if (banStatus.banned) {
            return res.status(403).json({
                success: false,
                error: 'IP已被封禁',
                reason: banStatus.reason,
                expiresAt: banStatus.expiresAt
            });
        }

        const result = await TurnstileService.verifyTempFingerprint(fingerprint, cfToken, validatedClientIp, clientUserAgent, captchaType || 'turnstile');

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: '验证失败'
            });
        }

        // CAPTCHA验证成功后直接通过，无需其他检查
        const serviceName = (captchaType === 'hcaptcha') ? 'hCaptcha' : 'Turnstile';
        console.log(`✅ ${serviceName}验证成功，直接通过`, {
            fingerprint: fingerprint.substring(0, 8) + '...',
            ip: validatedClientIp,
            accessToken: result.accessToken ? result.accessToken.substring(0, 8) + '...' : 'null'
        });

        res.json({
            success: true,
            verified: true,
            accessToken: result.accessToken
        });
    } catch (error) {
        console.error('验证临时指纹失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 验证访问密钥接口（无需认证）
router.post('/verify-access-token', fingerprintLimiter, async (req, res) => {
    try {
        const { token, fingerprint } = req.body;
        const clientIp = req.ip || req.socket.remoteAddress || (Array.isArray(req.headers['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : req.headers['x-forwarded-for']) || 'unknown';
        const validatedClientIp = typeof clientIp === 'string' ? clientIp : 'unknown';

        if (!token || typeof token !== 'string') {
            return res.status(400).json({
                success: false,
                error: '访问密钥无效'
            });
        }

        if (!fingerprint || typeof fingerprint !== 'string') {
            return res.status(400).json({
                success: false,
                error: '指纹参数无效'
            });
        }

        // 检查IP是否被封禁
        const banStatus = await TurnstileService.isIpBanned(clientIp);
        if (banStatus.banned) {
            return res.status(403).json({
                success: false,
                error: 'IP已被封禁',
                reason: banStatus.reason,
                expiresAt: banStatus.expiresAt
            });
        }

        const isValid = await TurnstileService.verifyAccessToken(token, fingerprint, clientIp);

        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: '访问密钥无效或已过期'
            });
        }

        res.json({
            success: true,
            valid: true
        });
    } catch (error) {
        console.error('验证访问密钥失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 检查指纹是否有有效访问密钥接口（无需认证）
router.get('/check-access-token/:fingerprint', fingerprintLimiter, async (req, res) => {
    try {
        const { fingerprint } = req.params;
        const clientIp = req.ip || req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
        const validatedClientIp = typeof clientIp === 'string' ? clientIp : 'unknown';

        if (!fingerprint) {
            return res.status(400).json({
                success: false,
                error: '指纹参数无效'
            });
        }

        // 检查IP是否被封禁
        const banStatus = await TurnstileService.isIpBanned(validatedClientIp);
        if (banStatus.banned) {
            return res.status(403).json({
                success: false,
                error: 'IP已被封禁',
                reason: banStatus.reason,
                expiresAt: banStatus.expiresAt
            });
        }

        const hasValidToken = await TurnstileService.hasValidAccessToken(fingerprint, validatedClientIp);

        res.json({
            success: true,
            hasValidToken
        });
    } catch (error) {
        console.error('检查访问密钥失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 检查临时指纹状态接口（无需认证）
router.get('/temp-fingerprint/:fingerprint', fingerprintLimiter, async (req, res) => {
    try {
        const { fingerprint } = req.params;
        const clientIp = req.ip || req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
        const validatedClientIp = typeof clientIp === 'string' ? clientIp : 'unknown';

        if (!fingerprint) {
            return res.status(400).json({
                success: false,
                error: '指纹参数无效'
            });
        }

        // 检查IP是否被封禁
        const banStatus = await TurnstileService.isIpBanned(validatedClientIp);
        if (banStatus.banned) {
            return res.status(403).json({
                success: false,
                error: 'IP已被封禁',
                reason: banStatus.reason,
                expiresAt: banStatus.expiresAt
            });
        }

        const status = await TurnstileService.checkTempFingerprintStatus(fingerprint);

        res.json({
            success: true,
            exists: status.exists,
            verified: status.verified
        });
    } catch (error) {
        console.error('检查临时指纹状态失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 清理过期指纹接口（管理员专用）
router.post('/cleanup-expired-fingerprints', authenticateToken, adminLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        const deletedCount = await TurnstileService.cleanupExpiredFingerprints();

        res.json({
            success: true,
            deletedCount,
            message: `清理了 ${deletedCount} 条过期指纹记录`
        });
    } catch (error) {
        console.error('清理过期指纹失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 获取指纹统计信息接口（管理员专用）
router.get('/fingerprint-stats', authenticateToken, adminLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        const stats = await TurnstileService.getTempFingerprintStats();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('获取指纹统计失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 获取IP封禁统计信息接口（管理员专用）
router.get('/ip-ban-stats', authenticateToken, adminLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        const stats = await TurnstileService.getIpBanStats();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('获取IP封禁统计失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 手动封禁IP接口（管理员专用）
router.post('/ban-ip', authenticateToken, adminLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        const { ipAddress, reason, durationMinutes, fingerprint, userAgent } = req.body;

        if (!ipAddress || typeof ipAddress !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'IP地址参数无效'
            });
        }

        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({
                success: false,
                error: '封禁原因参数无效'
            });
        }

        // 验证IP地址格式
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ipAddress)) {
            return res.status(400).json({
                success: false,
                error: 'IP地址格式无效'
            });
        }

        // 验证和设置封禁时长
        let banDuration = 60; // 默认60分钟

        if (durationMinutes !== undefined && durationMinutes !== null) {
            // 确保是数字类型
            const duration = Number(durationMinutes);

            // 检查是否为有效数字
            if (isNaN(duration) || !isFinite(duration)) {
                return res.status(400).json({
                    success: false,
                    error: '封禁时长必须是有效的数字'
                });
            }

            // 设置合理的范围：1分钟到24小时（1440分钟）
            banDuration = Math.min(
                Math.max(duration, 1), // 最少1分钟
                24 * 60 // 最多24小时
            );
        }

        // 手动封禁IP（如果IP已被封禁，会更新过期时间）
        const banResult = await TurnstileService.manualBanIp(
            ipAddress,
            reason,
            banDuration,
            fingerprint,
            userAgent
        );

        if (banResult.success) {
            // 由于服务层已经处理了更新逻辑，这里直接返回成功
            // 简化逻辑，不再尝试判断是否是更新操作
            res.json({
                success: true,
                message: `IP ${ipAddress} 封禁操作成功，过期时间: ${banResult.expiresAt}`,
                banInfo: {
                    ipAddress,
                    reason,
                    durationMinutes: banDuration,
                    expiresAt: banResult.expiresAt,
                    bannedAt: banResult.bannedAt
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: banResult.error || '封禁失败'
            });
        }
    } catch (error) {
        console.error('手动封禁IP失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 手动解除IP封禁接口（管理员专用）
router.post('/unban-ip', authenticateToken, adminLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        const { ipAddress } = req.body;

        if (!ipAddress || typeof ipAddress !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'IP地址参数无效'
            });
        }

        // 验证IP地址格式
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ipAddress)) {
            return res.status(400).json({
                success: false,
                error: 'IP地址格式无效'
            });
        }

        const success = await TurnstileService.unbanIp(ipAddress);

        if (success) {
            res.json({
                success: true,
                message: `IP ${ipAddress} 封禁已解除`
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'IP地址未找到或未被封禁'
            });
        }
    } catch (error) {
        console.error('解除IP封禁失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 批量封禁IP接口（管理员专用）
router.post('/ban-ips', authenticateToken, adminLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        const { ipAddresses, reason, durationMinutes } = req.body;

        if (!Array.isArray(ipAddresses) || ipAddresses.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'IP地址列表参数无效'
            });
        }

        if (!reason || typeof reason !== 'string') {
            return res.status(400).json({
                success: false,
                error: '封禁原因参数无效'
            });
        }

        // 验证IP地址格式
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const invalidIPs = ipAddresses.filter(ip => !ipRegex.test(ip));
        if (invalidIPs.length > 0) {
            return res.status(400).json({
                success: false,
                error: '以下IP地址格式无效',
                invalidIPs
            });
        }

        // 验证和设置封禁时长
        let banDuration = 60; // 默认60分钟

        if (durationMinutes !== undefined && durationMinutes !== null) {
            // 确保是数字类型
            const duration = Number(durationMinutes);

            // 检查是否为有效数字
            if (isNaN(duration) || !isFinite(duration)) {
                return res.status(400).json({
                    success: false,
                    error: '封禁时长必须是有效的数字'
                });
            }

            // 设置合理的范围：1分钟到24小时（1440分钟）
            banDuration = Math.min(
                Math.max(duration, 1), // 最少1分钟
                24 * 60 // 最多24小时
            );
        }

        const results = [];
        const errors = [];

        for (const ipAddress of ipAddresses) {
            try {
                // 手动封禁IP（如果IP已被封禁，会更新过期时间）
                const banResult = await TurnstileService.manualBanIp(
                    ipAddress,
                    reason,
                    banDuration
                );

                if (banResult.success) {
                    // 由于服务层已经处理了更新逻辑，这里直接返回成功
                    results.push({
                        ipAddress,
                        success: true,
                        message: `IP ${ipAddress} 封禁操作成功，过期时间: ${banResult.expiresAt}`,
                        banInfo: {
                            reason,
                            durationMinutes: banDuration,
                            expiresAt: banResult.expiresAt,
                            bannedAt: banResult.bannedAt
                        }
                    });
                } else {
                    errors.push({
                        ipAddress,
                        error: banResult.error || '封禁失败'
                    });
                }
            } catch (error) {
                errors.push({
                    ipAddress,
                    error: error instanceof Error ? error.message : '未知错误'
                });
            }
        }

        res.json({
            success: true,
            total: ipAddresses.length,
            successful: results.length,
            failed: errors.length,
            results,
            errors
        });
    } catch (error) {
        console.error('批量封禁IP失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 批量解封IP接口（管理员专用）
router.post('/unban-ips', authenticateToken, adminLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        const { ipAddresses } = req.body;

        if (!Array.isArray(ipAddresses) || ipAddresses.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'IP地址列表参数无效'
            });
        }

        // 验证IP地址格式
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const invalidIPs = ipAddresses.filter(ip => !ipRegex.test(ip));
        if (invalidIPs.length > 0) {
            return res.status(400).json({
                success: false,
                error: '以下IP地址格式无效',
                invalidIPs
            });
        }

        const results = [];
        const errors = [];

        for (const ipAddress of ipAddresses) {
            try {
                const success = await TurnstileService.unbanIp(ipAddress);

                if (success) {
                    results.push({
                        ipAddress,
                        success: true,
                        message: `IP ${ipAddress} 封禁已解除`
                    });
                } else {
                    errors.push({
                        ipAddress,
                        error: 'IP地址未找到或未被封禁'
                    });
                }
            } catch (error) {
                errors.push({
                    ipAddress,
                    error: error instanceof Error ? error.message : '未知错误'
                });
            }
        }

        res.json({
            success: true,
            total: ipAddresses.length,
            successful: results.length,
            failed: errors.length,
            results,
            errors
        });
    } catch (error) {
        console.error('批量解封IP失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 获取定时任务状态接口（管理员专用）
router.get('/scheduler-status', authenticateToken, adminLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        const status = schedulerService.getStatus();

        res.json({
            success: true,
            status
        });
    } catch (error) {
        console.error('获取定时任务状态失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 手动触发清理接口（管理员专用）
router.post('/manual-cleanup', authenticateToken, adminLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        const result = await schedulerService.manualCleanup();

        res.json({
            success: result.success,
            deletedCount: result.deletedCount,
            message: result.success
                ? `手动清理完成，删除了 ${result.deletedCount} 条过期记录`
                : `手动清理失败: ${result.error}`,
            error: result.error
        });
    } catch (error) {
        console.error('手动清理失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 启动定时任务接口（管理员专用）
router.post('/scheduler/start', authenticateToken, adminLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        schedulerService.start();

        res.json({
            success: true,
            message: '定时任务已启动'
        });
    } catch (error) {
        console.error('启动定时任务失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

// 停止定时任务接口（管理员专用）
router.post('/scheduler/stop', authenticateToken, adminLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        schedulerService.stop();

        res.json({
            success: true,
            message: '定时任务已停止'
        });
    } catch (error) {
        console.error('停止定时任务失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @openapi
 * /api/turnstile/config:
 *   get:
 *     summary: 获取Turnstile配置
 *     description: 获取当前Turnstile配置信息（需要认证）
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Turnstile配置信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 *                   description: 是否启用
 *                 siteKey:
 *                   type: string
 *                   description: 站点密钥
 *                 secretKey:
 *                   type: string
 *                   description: 密钥（仅管理员可见）
 *       401:
 *         description: 未授权
 */
router.get('/config', authenticateToken, configLimiter, async (req, res) => {
    try {
        const config = await TurnstileService.getConfig();

        // 非管理员用户不返回secretKey
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        // 对Secret Key进行脱敏处理
        const maskedSecretKey = config.secretKey && config.secretKey.length > 8
            ? (config.secretKey.slice(0, 2) + '***' + config.secretKey.slice(-4))
            : (config.secretKey ? '***' : null);

        res.json({
            enabled: config.enabled,
            siteKey: config.siteKey,
            ...(isAdmin && { secretKey: maskedSecretKey })
        });
    } catch (error) {
        console.error('获取Turnstile配置失败:', error);
        res.status(500).json({
            error: '获取配置失败'
        });
    }
});

/**
 * @openapi
 * /api/turnstile/public-config:
 *   get:
 *     summary: 获取Turnstile和hCaptcha公共配置
 *     description: 获取Turnstile和hCaptcha公共配置信息（无需认证，用于首次访问验证）
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 *                   description: Turnstile是否启用
 *                 siteKey:
 *                   type: string
 *                   description: Turnstile站点密钥
 *                 hcaptchaEnabled:
 *                   type: boolean
 *                   description: hCaptcha是否启用
 *                 hcaptchaSiteKey:
 *                   type: string
 *                   description: hCaptcha站点密钥
 *       500:
 *         description: 服务器内部错误
 */
router.get('/public-config', publicLimiter, async (req, res) => {
    try {
        const config = await TurnstileService.getConfig();
        const hcaptchaConfig = await TurnstileService.getHCaptchaConfig();

        // 返回前端需要的公共信息，包括 Turnstile 和 hCaptcha 配置
        res.json({
            enabled: config.enabled,
            siteKey: config.siteKey,
            hcaptchaEnabled: hcaptchaConfig.enabled,
            hcaptchaSiteKey: hcaptchaConfig.siteKey
        });
    } catch (error) {
        console.error('获取公共配置失败:', error);
        res.status(500).json({
            error: '获取配置失败'
        });
    }
});

/**
 * @openapi
 * /api/turnstile/secure-captcha-config:
 *   post:
 *     summary: 获取安全的CAPTCHA配置
 *     description: 基于加密的随机选择返回对应的CAPTCHA配置信息
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - encryptedData
 *               - timestamp
 *               - hash
 *               - fingerprint
 *             properties:
 *               encryptedData:
 *                 type: string
 *                 description: 加密的选择数据
 *               timestamp:
 *                 type: number
 *                 description: 时间戳
 *               hash:
 *                 type: string
 *                 description: 完整性哈希
 *               fingerprint:
 *                 type: string
 *                 description: 浏览器指纹
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 captchaType:
 *                   type: string
 *                   enum: [turnstile, hcaptcha]
 *                 config:
 *                   type: object
 *                   properties:
 *                     enabled:
 *                       type: boolean
 *                     siteKey:
 *                       type: string
 *       400:
 *         description: 请求参数无效
 *       500:
 *         description: 服务器内部错误
 */
router.post('/secure-captcha-config', publicLimiter, async (req, res) => {
    try {
        const { encryptedData, timestamp, hash, fingerprint } = req.body;

        // 验证请求参数
        if (!encryptedData || !timestamp || !hash || !fingerprint) {
            return res.status(400).json({
                success: false,
                error: '请求参数不完整'
            });
        }

        // 验证时间戳（5分钟内有效，放宽时间窗口以处理时钟偏差）
        const now = Date.now();
        const timeDiff = now - timestamp;
        const timeWindowMs = 5 * 60 * 1000; // 5分钟

        // 详细的时间戳调试日志
        console.log('=== 时间戳验证调试 ===');
        console.log('客户端时间戳:', timestamp);
        console.log('服务器当前时间:', now);
        console.log('时间差 (ms):', timeDiff);
        console.log('时间差 (分钟):', Math.round(timeDiff / 60000 * 100) / 100);
        console.log('客户端时间 (上海):', new Date(timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
        console.log('服务器时间 (上海):', new Date(now).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
        console.log('允许的最大时间差:', timeWindowMs, 'ms (5分钟)');
        console.log('时间戳是否过期:', Math.abs(timeDiff) > timeWindowMs);
        console.log('========================');

        if (Math.abs(timeDiff) > timeWindowMs) {
            console.log('时间戳验证失败 - 请求被拒绝');
            return res.status(400).json({
                success: false,
                error: '请求已过期',
                debug: {
                    clientTimestamp: timestamp,
                    serverTimestamp: now,
                    timeDiff: timeDiff,
                    timeDiffMinutes: Math.round(timeDiff / 60000 * 100) / 100,
                    clientTime: new Date(timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
                    serverTime: new Date(now).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
                }
            });
        }

        // 验证完整性哈希
        const expectedHashData = `${encryptedData}_${timestamp}_${fingerprint}`;
        const crypto = require('crypto');
        const expectedHash = crypto.createHash('sha256').update(expectedHashData).digest('hex');

        if (hash !== expectedHash) {
            return res.status(400).json({
                success: false,
                error: '请求完整性验证失败'
            });
        }

        // 解密选择数据（兼容crypto-js格式）
        const keyMaterial = `${fingerprint}_${Math.floor(timestamp / 60000)}`;
        const decryptionKey = crypto.createHash('sha256').update(keyMaterial).digest('hex');

        let decryptedSelection;
        try {
            // crypto-js使用不同的格式，需要兼容处理
            const CryptoJS = require('crypto-js');
            const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, decryptionKey);
            const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);

            if (!decryptedText) {
                throw new Error('解密结果为空');
            }

            decryptedSelection = JSON.parse(decryptedText);
        } catch (decryptError) {
            console.error('解密CAPTCHA选择失败:', decryptError);
            return res.status(400).json({
                success: false,
                error: '解密失败'
            });
        }

        // 验证解密后的数据
        if (decryptedSelection.timestamp !== timestamp || decryptedSelection.fingerprint !== fingerprint) {
            return res.status(400).json({
                success: false,
                error: '解密数据不一致'
            });
        }

        // 根据选择的类型返回对应配置
        const captchaType = decryptedSelection.type;
        let config;

        if (captchaType === 'turnstile') {
            const turnstileConfig = await TurnstileService.getConfig();
            config = {
                enabled: turnstileConfig.enabled,
                siteKey: turnstileConfig.siteKey
            };
        } else if (captchaType === 'hcaptcha') {
            const hcaptchaConfig = await TurnstileService.getHCaptchaConfig();
            config = {
                enabled: hcaptchaConfig.enabled,
                siteKey: hcaptchaConfig.siteKey
            };
        } else {
            return res.status(400).json({
                success: false,
                error: '无效的验证类型'
            });
        }

        // 记录选择日志（用于审计）
        console.log('安全CAPTCHA选择:', {
            type: captchaType,
            fingerprint: fingerprint.substring(0, 8) + '...',
            timestamp: new Date(timestamp).toISOString(),
            clientIp: req.ip || 'unknown'
        });

        res.json({
            success: true,
            captchaType,
            config
        });
    } catch (error) {
        console.error('获取安全CAPTCHA配置失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @openapi
 * /api/turnstile/config:
 *   post:
 *     summary: 更新Turnstile配置
 *     description: 更新Turnstile配置信息（需要管理员权限）
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - value
 *             properties:
 *               key:
 *                 type: string
 *                 enum: [TURNSTILE_SECRET_KEY, TURNSTILE_SITE_KEY]
 *                 description: 配置键名
 *               value:
 *                 type: string
 *                 description: 配置值
 *     responses:
 *       200:
 *         description: 更新成功
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 */
router.post('/config', authenticateToken, configLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        const { key, value } = req.body;

        if (!key || !value || !['TURNSTILE_SECRET_KEY', 'TURNSTILE_SITE_KEY'].includes(key)) {
            return res.status(400).json({
                success: false,
                error: '参数无效'
            });
        }

        const success = await TurnstileService.updateConfig(key as 'TURNSTILE_SECRET_KEY' | 'TURNSTILE_SITE_KEY', value);

        if (success) {
            res.json({
                success: true,
                message: '配置更新成功'
            });
        } else {
            res.status(500).json({
                success: false,
                error: '配置更新失败'
            });
        }
    } catch (error) {
        console.error('更新Turnstile配置失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @openapi
 * /api/turnstile/config/{key}:
 *   delete:
 *     summary: 删除Turnstile配置
 *     description: 删除指定的Turnstile配置（需要管理员权限）
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *           enum: [TURNSTILE_SECRET_KEY, TURNSTILE_SITE_KEY]
 *         description: 要删除的配置键名
 *     responses:
 *       200:
 *         description: 删除成功
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 */
router.delete('/config/:key', authenticateToken, configLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        const { key } = req.params;

        if (!key || !['TURNSTILE_SECRET_KEY', 'TURNSTILE_SITE_KEY'].includes(key)) {
            return res.status(400).json({
                success: false,
                error: '参数无效'
            });
        }

        const success = await TurnstileService.deleteConfig(key as 'TURNSTILE_SECRET_KEY' | 'TURNSTILE_SITE_KEY');

        if (success) {
            res.json({
                success: true,
                message: '配置删除成功'
            });
        } else {
            res.status(500).json({
                success: false,
                error: '配置删除失败'
            });
        }
    } catch (error) {
        console.error('删除Turnstile配置失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @openapi
 * /api/turnstile/hcaptcha-config:
 *   get:
 *     summary: 获取hCaptcha配置
 *     description: 获取hCaptcha配置信息（需要管理员权限）
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: boolean
 *                 siteKey:
 *                   type: string
 *                 secretKey:
 *                   type: string
 *                 updatedAt:
 *                   type: string
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 */
router.get('/hcaptcha-config', authenticateToken, configLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        const config = await TurnstileService.getHCaptchaConfig();

        res.json({
            enabled: config.enabled,
            siteKey: config.siteKey,
            secretKey: config.secretKey ? '***已设置***' : null
        });
    } catch (error) {
        console.error('获取hCaptcha配置失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @openapi
 * /api/turnstile/hcaptcha-config:
 *   post:
 *     summary: 更新hCaptcha配置
 *     description: 更新hCaptcha配置信息（需要管理员权限）
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - value
 *             properties:
 *               key:
 *                 type: string
 *                 enum: [HCAPTCHA_SECRET_KEY, HCAPTCHA_SITE_KEY]
 *                 description: 配置键名
 *               value:
 *                 type: string
 *                 description: 配置值
 *     responses:
 *       200:
 *         description: 更新成功
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 */
router.post('/hcaptcha-config', authenticateToken, configLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        const { key, value } = req.body;

        if (!key || !value || !['HCAPTCHA_SECRET_KEY', 'HCAPTCHA_SITE_KEY'].includes(key)) {
            return res.status(400).json({
                success: false,
                error: '参数无效'
            });
        }

        const success = await TurnstileService.updateHCaptchaConfig(key as 'HCAPTCHA_SECRET_KEY' | 'HCAPTCHA_SITE_KEY', value);

        if (success) {
            res.json({
                success: true,
                message: '配置更新成功'
            });
        } else {
            res.status(500).json({
                success: false,
                error: '配置更新失败'
            });
        }
    } catch (error) {
        console.error('更新hCaptcha配置失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @openapi
 * /api/turnstile/hcaptcha-config/{key}:
 *   delete:
 *     summary: 删除hCaptcha配置
 *     description: 删除指定的hCaptcha配置项（需要管理员权限）
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *           enum: [HCAPTCHA_SECRET_KEY, HCAPTCHA_SITE_KEY]
 *         description: 配置键名
 *     responses:
 *       200:
 *         description: 删除成功
 *       401:
 *         description: 未授权
 *       403:
 *         description: 权限不足
 */
router.delete('/hcaptcha-config/:key', authenticateToken, configLimiter, async (req, res) => {
    try {
        const userRole = (req as any).user?.role;
        const isAdmin = userRole === 'admin' || userRole === 'administrator';

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: '权限不足'
            });
        }

        const { key } = req.params;

        if (!key || !['HCAPTCHA_SECRET_KEY', 'HCAPTCHA_SITE_KEY'].includes(key)) {
            return res.status(400).json({
                success: false,
                error: '参数无效'
            });
        }

        const success = await TurnstileService.deleteHCaptchaConfig(key as 'HCAPTCHA_SECRET_KEY' | 'HCAPTCHA_SITE_KEY');

        if (success) {
            res.json({
                success: true,
                message: '配置删除成功'
            });
        } else {
            res.status(500).json({
                success: false,
                error: '配置删除失败'
            });
        }
    } catch (error) {
        console.error('删除hCaptcha配置失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误'
        });
    }
});

/**
 * @openapi
 * /api/turnstile/hcaptcha-verify:
 *   post:
 *     summary: 验证hCaptcha token
 *     description: 验证hCaptcha返回的token（无需认证）
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: hCaptcha返回的验证token
 *               fingerprint:
 *                 type: string
 *                 description: 浏览器指纹（可选，用于生成访问令牌）
 *               timestamp:
 *                 type: string
 *                 description: 验证时间戳
 *     responses:
 *       200:
 *         description: 验证成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 verified:
 *                   type: boolean
 *                 accessToken:
 *                   type: string
 *                   description: 访问令牌（如果提供了指纹）
 *                 timestamp:
 *                   type: string
 *                 details:
 *                   type: object
 *       400:
 *         description: 验证失败
 *       500:
 *         description: 服务器内部错误
 */
router.post('/hcaptcha-verify', publicLimiter, async (req, res) => {
    try {
        const { token, timestamp, fingerprint } = req.body;
        const clientIp = req.ip || req.socket.remoteAddress || (Array.isArray(req.headers['x-forwarded-for']) ? req.headers['x-forwarded-for'][0] : req.headers['x-forwarded-for']) || 'unknown';
        const validatedClientIp = typeof clientIp === 'string' ? clientIp : 'unknown';

        if (!token || typeof token !== 'string') {
            return res.status(400).json({
                success: false,
                message: '验证令牌无效',
                timestamp: new Date().toISOString()
            });
        }

        // 检查IP是否被封禁
        const banStatus = await TurnstileService.isIpBanned(validatedClientIp);
        if (banStatus.banned) {
            return res.status(403).json({
                success: false,
                message: 'IP已被封禁',
                details: {
                    reason: banStatus.reason,
                    expiresAt: banStatus.expiresAt
                },
                timestamp: new Date().toISOString()
            });
        }

        // 验证hCaptcha token
        const isValid = await TurnstileService.verifyHCaptchaToken(token, validatedClientIp);

        if (isValid) {
            // hCaptcha验证成功后生成访问令牌，确保与Turnstile一致的处理
            const { fingerprint } = req.body;
            let accessToken = null;
            
            // 如果提供了指纹，生成访问令牌
            if (fingerprint && typeof fingerprint === 'string') {
                try {
                    accessToken = await TurnstileService.generateAccessToken(fingerprint, validatedClientIp);
                } catch (error) {
                    console.warn('生成访问令牌失败，但hCaptcha验证成功', error);
                }
            }

            console.log('✅ hCaptcha验证成功，直接通过', {
                ip: validatedClientIp,
                token: token.substring(0, 8) + '...',
                accessToken: accessToken ? accessToken.substring(0, 8) + '...' : 'null'
            });

            res.json({
                success: true,
                message: '验证成功',
                timestamp: new Date().toISOString(),
                verified: true,
                accessToken: accessToken,
                details: {
                    hostname: req.hostname,
                    challenge_ts: timestamp || new Date().toISOString()
                }
            });
        } else {
            res.status(400).json({
                success: false,
                message: '验证失败，请重试',
                timestamp: new Date().toISOString(),
                details: {
                    error_codes: ['verification-failed']
                }
            });
        }
    } catch (error) {
        console.error('hCaptcha验证失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            timestamp: new Date().toISOString()
        });
    }
});

export default router; 