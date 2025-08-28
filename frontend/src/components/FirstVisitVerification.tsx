import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TurnstileWidget } from './TurnstileWidget';
import { useTurnstileConfig } from '../hooks/useTurnstileConfig';
import { getFingerprint, verifyTempFingerprint, storeAccessToken } from '../utils/fingerprint';
import { useNotification } from './Notification';
import { integrityChecker } from '../utils/integrityCheck';

interface FirstVisitVerificationProps {
  onVerificationComplete: () => void;
  fingerprint: string;
  isIpBanned?: boolean;
  banReason?: string;
  banExpiresAt?: Date;
  clientIP?: string | null;
}

export const FirstVisitVerification: React.FC<FirstVisitVerificationProps> = ({
  onVerificationComplete,
  fingerprint,
  isIpBanned = false,
  banReason,
  banExpiresAt,
  clientIP,
}) => {
  // 响应式工具函数
  const getResponsiveSize = (mobile: number, desktop: number) => {
    if (isMobile) {
      return window.innerWidth < 400 ? mobile * 0.8 : mobile;
    }
    return desktop;
  };

  const getResponsiveFontSize = (mobile: string, desktop: string) => {
    if (isMobile) {
      return window.innerWidth < 400 ? mobile : mobile;
    }
    return desktop;
  };
  const { config: turnstileConfig, loading: turnstileConfigLoading } = useTurnstileConfig({ usePublicConfig: true });
  const { setNotification } = useNotification();
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [turnstileVerified, setTurnstileVerified] = useState(false);
  const [turnstileError, setTurnstileError] = useState(false);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showParticles, setShowParticles] = useState(false); // 控制背景粒子显示
  const [retryCount, setRetryCount] = useState(0); // 重试次数

  // 检测设备类型、方向和缩放
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const zoomLevel = window.devicePixelRatio || 1;

      // 考虑缩放因素，调整移动端判断逻辑
      const effectiveWidth = width * zoomLevel;
      const effectiveHeight = height * zoomLevel;

      // 移动端判断：考虑缩放后的实际像素密度
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSmallScreen = width <= 768 || effectiveWidth <= 768;

      setIsMobile(isMobileDevice || isSmallScreen);
      setIsLandscape(width > height);
    };

    checkDevice();

    // 监听窗口大小变化
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    // 监听缩放变化（部分浏览器支持）
    if ('visualViewport' in window) {
      window.visualViewport?.addEventListener('resize', checkDevice);
    }

    // 延迟显示背景粒子，避免加载时的视觉问题
    const timer = setTimeout(() => {
      setShowParticles(true);
    }, 100);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
      if ('visualViewport' in window) {
        window.visualViewport?.removeEventListener('resize', checkDevice);
      }
      clearTimeout(timer);
    };
  }, []);

  // 监听 Turnstile 配置加载状态
  useEffect(() => {
    if (turnstileConfigLoading) {
      setNotification({
        message: '正在加载验证配置...',
        type: 'info'
      });
    } else if (turnstileConfig.siteKey) {
      setNotification({
        message: '验证配置加载完成',
        type: 'success'
      });
    } else if (!turnstileConfig.siteKey && !turnstileConfigLoading) {
      setNotification({
        message: '验证配置加载失败，请刷新页面重试',
        type: 'error'
      });
    }
  }, [turnstileConfigLoading, turnstileConfig.siteKey, setNotification]);

  // 监听IP封禁状态变化
  useEffect(() => {
    if (isIpBanned) {
      setNotification({
        message: `IP地址已被封禁${banReason ? ': ' + banReason : ''}`,
        type: 'error'
      });
    }
  }, [isIpBanned, banReason, setNotification]);

  // 组件挂载时的欢迎通知
  useEffect(() => {
    const welcomeTimer = setTimeout(() => {
      setNotification({
        message: '欢迎访问 Happy TTS！',
        type: 'info'
      });
    }, 500);

    return () => clearTimeout(welcomeTimer);
  }, [setNotification]);

  // 验证完整性检查豁免状态（开发模式）
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const checkExemptStatus = () => {
        const status = integrityChecker.checkExemptStatus();
        console.log('🛡️ FirstVisitVerification 完整性检查豁免状态:', status);
        
        if (!status.isExempt) {
          console.warn('⚠️ FirstVisitVerification 组件未被豁免，可能会触发完整性检查');
          setNotification({
            message: '开发提示：组件未被完整性检查豁免',
            type: 'warning'
          });
        } else {
          console.log('✅ FirstVisitVerification 组件已被正确豁免');
          setNotification({
            message: '完整性检查豁免已生效',
            type: 'success'
          });
        }
      };

      // 延迟检查，确保DOM已完全渲染
      const checkTimer = setTimeout(checkExemptStatus, 1000);
      return () => clearTimeout(checkTimer);
    }
  }, [setNotification]);

  // 网络状态监听
  useEffect(() => {
    const handleOnline = () => {
      setNotification({
        message: '网络连接已恢复',
        type: 'success'
      });
    };

    const handleOffline = () => {
      setNotification({
        message: '网络连接已断开，请检查网络',
        type: 'error'
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setNotification]);

  // 页面可见性变化监听
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setNotification({
          message: '页面已切换到后台',
          type: 'info'
        });
      } else {
        setNotification({
          message: '欢迎回来！',
          type: 'success'
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [setNotification]);

  const handleTurnstileVerify = useCallback((token: string) => {
    console.log('Turnstile验证成功，token:', token);
    setTurnstileToken(token);
    setTurnstileVerified(true);
    setTurnstileError(false);
    setError('');

    // 显示验证成功通知
    setNotification({
      message: '人机验证通过！',
      type: 'success'
    });
  }, [setNotification]);

  const handleTurnstileExpire = useCallback(() => {
    console.log('Turnstile验证过期');
    setTurnstileToken('');
    setTurnstileVerified(false);
    setTurnstileError(false);

    // 显示验证过期通知
    setNotification({
      message: '验证已过期，请重新验证',
      type: 'warning'
    });
  }, [setNotification]);

  const handleTurnstileError = useCallback(() => {
    console.log('Turnstile验证错误');
    setTurnstileToken('');
    setTurnstileVerified(false);
    setTurnstileError(true);
    setError('人机验证失败，请重试');

    // 显示验证错误通知
    setNotification({
      message: '人机验证失败，请重试',
      type: 'error'
    });
  }, [setNotification]);

  // 将验证逻辑提前定义，避免在依赖数组中引用未初始化变量
  const handleVerify = useCallback(async () => {
    if (!turnstileVerified || !turnstileToken) {
      setError('请先完成人机验证');
      setNotification({
        message: '请先完成人机验证',
        type: 'warning'
      });
      return;
    }

    setVerifying(true);
    setError('');

    // 显示验证开始通知
    setNotification({
      message: '正在验证中...',
      type: 'info'
    });

    try {
      const result = await verifyTempFingerprint(fingerprint, turnstileToken);
      if (result.success) {
        console.log('首次访问验证成功');

        // 存储访问密钥
        if (result.accessToken) {
          storeAccessToken(fingerprint, result.accessToken);
          console.log('访问密钥已存储，5分钟内无需再次验证');

          // 显示访问密钥存储成功通知
          setNotification({
            message: '访问密钥已保存，5分钟内免验证',
            type: 'success'
          });
        }

        // 显示验证成功通知
        setNotification({
          message: '验证成功！正在跳转...',
          type: 'success'
        });

        // 重置重试计数器
        setRetryCount(0);

        // 延迟一下再跳转，让用户看到成功消息
        setTimeout(() => {
          onVerificationComplete();
        }, 1000);
      } else {
        const errorMsg = '验证失败，请重试';
        setError(errorMsg);
        setNotification({
          message: errorMsg,
          type: 'error'
        });
        setTurnstileToken('');
        setTurnstileVerified(false);
        setTurnstileKey(k => k + 1);
      }
    } catch (err) {
      console.error('验证失败:', err);
      let errorMsg = '验证失败，请重试';

      // 检查是否是IP封禁错误
      if (err instanceof Error && err.message.includes('IP已被封禁')) {
        // 从错误对象中提取封禁信息
        const banData = (err as any).banData;
        if (banData && banData.expiresAt) {
          // 如果组件接收到了封禁到期时间，更新它
          if (banExpiresAt !== new Date(banData.expiresAt)) {
            // 这里可以通过回调函数更新父组件的状态
            console.log('封禁到期时间:', banData.expiresAt);
          }
        }
        errorMsg = '您的IP地址已被封禁，请稍后再试';
        setNotification({
          message: 'IP地址已被封禁',
          type: 'error'
        });
      } else if (err instanceof Error && err.message.includes('网络')) {
        errorMsg = '网络连接异常，请检查网络后重试';
        setNotification({
          message: '网络连接异常',
          type: 'error'
        });
      } else if (err instanceof Error && err.message.includes('超时')) {
        errorMsg = '验证超时，请重试';
        setNotification({
          message: '验证超时，请重试',
          type: 'warning'
        });
      } else {
        setNotification({
          message: errorMsg,
          type: 'error'
        });
      }

      setError(errorMsg);
      setTurnstileToken('');
      setTurnstileVerified(false);
      setTurnstileKey(k => k + 1);

      // 增加重试次数并显示重试提示
      setRetryCount(prev => {
        const newCount = prev + 1;
        if (newCount <= 3) {
          setTimeout(() => {
            setNotification({
              message: `第 ${newCount} 次重试，还可重试 ${3 - newCount} 次`,
              type: 'warning'
            });
          }, 1000);
        } else {
          setTimeout(() => {
            setNotification({
              message: '重试次数过多，请刷新页面后重试',
              type: 'error'
            });
          }, 1000);
        }
        return newCount;
      });
    } finally {
      setVerifying(false);
    }
  }, [turnstileVerified, turnstileToken, fingerprint, onVerificationComplete, setNotification, banExpiresAt]);

  // 键盘快捷键支持（移动到此处，依赖 handleVerify）
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Enter 键快速验证
      if (event.key === 'Enter' && turnstileVerified && !verifying) {
        event.preventDefault();
        handleVerify();
        setNotification({
          message: '使用 Enter 键快速验证',
          type: 'info'
        });
      }

      // F5 或 Ctrl+R 刷新提示
      if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
        setNotification({
          message: '页面即将刷新，验证状态将重置',
          type: 'warning'
        });
      }

      // Escape 键提示
      if (event.key === 'Escape') {
        setNotification({
          message: '无法取消验证，请完成验证后继续',
          type: 'info'
        });
      }

      // 显示快捷键帮助
      if (event.key === 'F1' || (event.ctrlKey && event.key === '/')) {
        event.preventDefault();
        setNotification({
          message: 'Enter: 快速验证 | F5: 刷新页面 | Esc: 显示帮助',
          type: 'info'
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [turnstileVerified, verifying, handleVerify, setNotification]);

  // 重置重试计数器
  const resetRetryCount = useCallback(() => {
    setRetryCount(0);
    setNotification({
      message: '重试计数器已重置',
      type: 'success'
    });
  }, [setNotification]);

  // 如果IP被封禁，显示封禁页面
  console.log('显示封禁页面:', { isIpBanned, banReason, banExpiresAt, clientIP });
  if (isIpBanned) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center z-50"
          data-component="FirstVisitVerification"
          data-page="FirstVisitVerification"
          data-view="FirstVisitVerification"
          style={{
            minHeight: '100dvh',
            padding: isMobile ? '0.25rem' : '1.5rem',
            // 支持动态视口高度，适配移动端浏览器地址栏
            height: '100dvh',
            width: '100vw',
            overflow: 'hidden',
            // 添加CSS变量用于响应式设计
            '--mobile-scale': isMobile && window.innerWidth < 400 ? '0.85' : '1',
            '--mobile-padding': isMobile && window.innerWidth < 400 ? '0.5rem' : '1rem',
          } as React.CSSProperties}
        >
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -30, opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.6,
              ease: "easeOut",
              delay: 0.1
            }}
            className={`relative bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-red-200 ${isMobile
                ? 'w-full max-w-sm mx-1 p-3'
                : 'max-w-md w-full mx-4 p-8'
              }`}
            style={{
              maxHeight: isMobile ? 'calc(100dvh - 1rem)' : '80vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              // 动态缩放适配
              transform: isMobile && window.innerWidth < 400
                ? `scale(${Math.min(window.innerWidth / 350, 0.9)})`
                : 'scale(1)',
              transformOrigin: 'center center',
              // 确保在小屏幕上不会溢出
              width: isMobile && window.innerWidth < 400 ? '95vw' : undefined,
              maxWidth: isMobile && window.innerWidth < 400 ? '95vw' : undefined,
            }}
          >
            {/* 顶部装饰线 */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-20 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent rounded-full"></div>

            {/* 警告图标 */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative mx-auto mb-6"
            >
              <svg
                width={isMobile ? (window.innerWidth < 400 ? 60 : 80) : 100}
                height={isMobile ? (window.innerWidth < 400 ? 60 : 80) : 100}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mx-auto text-red-500"
                style={{
                  minWidth: isMobile ? '60px' : '100px',
                  minHeight: isMobile ? '60px' : '100px',
                }}
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M12 8v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="16" r="1" fill="currentColor" />
              </svg>
            </motion.div>

            {/* 标题 */}
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className={`text-center text-gray-800 mb-3 bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent font-bold ${isMobile ? (window.innerWidth < 400 ? 'text-xl' : 'text-2xl') : 'text-3xl'
                }`}
              style={{
                fontSize: isMobile ? (window.innerWidth < 400 ? '1.25rem' : '1.5rem') : '1.875rem',
                lineHeight: '1.2',
              }}
            >
              IP地址已被封禁
            </motion.h1>

            {/* 说明文字 */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className={`text-center text-gray-600 leading-relaxed mb-4 ${isMobile ? (window.innerWidth < 400 ? 'text-xs' : 'text-sm') : 'text-base'
                }`}
              style={{
                fontSize: isMobile ? (window.innerWidth < 400 ? '0.75rem' : '0.875rem') : '1rem',
                lineHeight: '1.4',
              }}
            >
              您的IP地址因违规行为已被临时封禁
              <br />
              请稍后再试或联系管理员
            </motion.p>

            {/* 封禁详情 */}
            {banReason && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className={`mb-4 p-3 bg-red-50 border border-red-200 rounded-xl ${isMobile ? (window.innerWidth < 400 ? 'text-xs' : 'text-sm') : 'text-base'
                  }`}
                style={{
                  padding: isMobile ? (window.innerWidth < 400 ? '0.75rem' : '1rem') : '1rem',
                }}
              >
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <svg className={`${isMobile && window.innerWidth < 400 ? 'w-4 h-4' : 'w-5 h-5'} flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium" style={{ fontSize: isMobile && window.innerWidth < 400 ? '0.75rem' : undefined }}>封禁原因</span>
                </div>
                <p className="text-red-700" style={{
                  fontSize: isMobile && window.innerWidth < 400 ? '0.75rem' : undefined,
                  wordBreak: 'break-word',
                  lineHeight: '1.3'
                }}>{banReason}</p>
              </motion.div>
            )}

            {/* 客户端IP地址 */}
            {clientIP && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.55 }}
                className={`mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl ${isMobile ? (window.innerWidth < 400 ? 'text-xs' : 'text-sm') : 'text-base'
                  }`}
                style={{
                  padding: isMobile ? (window.innerWidth < 400 ? '0.75rem' : '1rem') : '1rem',
                }}
              >
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <svg className={`${isMobile && window.innerWidth < 400 ? 'w-4 h-4' : 'w-5 h-5'} flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium" style={{ fontSize: isMobile && window.innerWidth < 400 ? '0.75rem' : undefined }}>客户端IP地址</span>
                </div>
                <p className="text-blue-700 font-mono" style={{
                  fontSize: isMobile && window.innerWidth < 400 ? '0.75rem' : undefined,
                  wordBreak: 'break-all',
                  lineHeight: '1.3'
                }}>{clientIP}</p>
              </motion.div>
            )}

            {/* 封禁到期时间 */}
            {banExpiresAt && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className={`mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-xl ${isMobile ? (window.innerWidth < 400 ? 'text-xs' : 'text-sm') : 'text-base'
                  }`}
                style={{
                  padding: isMobile ? (window.innerWidth < 400 ? '0.75rem' : '1rem') : '1rem',
                }}
              >
                <div className="flex items-center gap-2 text-yellow-600 mb-2">
                  <svg className={`${isMobile && window.innerWidth < 400 ? 'w-4 h-4' : 'w-5 h-5'} flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium" style={{ fontSize: isMobile && window.innerWidth < 400 ? '0.75rem' : undefined }}>封禁到期时间</span>
                </div>
                <p className="text-yellow-700" style={{
                  fontSize: isMobile && window.innerWidth < 400 ? '0.75rem' : undefined,
                  lineHeight: '1.3'
                }}>
                  {(() => {
                    console.log('渲染封禁到期时间:', banExpiresAt, typeof banExpiresAt);
                    return banExpiresAt.toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      timeZoneName: 'short'
                    });
                  })()}
                </p>
              </motion.div>
            )}

            {/* 底部说明 */}
            <motion.div
              className={`text-center ${isMobile ? 'mt-3' : 'mt-8'}`}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                <div className="w-1 h-1 bg-red-400 rounded-full"></div>
              </div>
              <p className={`text-gray-500 leading-relaxed ${isMobile ? (window.innerWidth < 400 ? 'text-xs' : 'text-xs') : 'text-sm'
                }`}
                style={{
                  fontSize: isMobile && window.innerWidth < 400 ? '0.75rem' : undefined,
                  lineHeight: '1.3'
                }}>
                如有疑问，请联系系统管理员
                <br />
                感谢您的理解与配合
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // 响应式Logo组件
  const Logo = () => {
    const logoSize = isMobile ? (isLandscape ? 80 : 100) : 140;

    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative"
      >
        <svg
          width={logoSize}
          height={logoSize}
          viewBox="0 0 140 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`mx-auto ${isMobile ? 'mb-4' : 'mb-8'} drop-shadow-lg`}
        >
          {/* 外圈光晕效果 */}
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.3" />
              <stop offset="70%" stopColor="#4F46E5" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>

          {/* 光晕背景 */}
          <circle cx="70" cy="70" r="65" fill="url(#glow)" />

          {/* 主圆形背景 */}
          <circle cx="70" cy="70" r="55" fill="url(#mainGradient)" stroke="#6366F1" strokeWidth="3" />

          {/* 内圈装饰 */}
          <circle cx="70" cy="70" r="45" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

          {/* 笑脸眼睛 - 添加动画 */}
          <motion.circle
            cx="55" cy="60" r="5" fill="white"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.circle
            cx="85" cy="60" r="5" fill="white"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />

          {/* 笑脸嘴巴 */}
          <path
            d="M 50 80 Q 70 95 90 80"
            stroke="white"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />

          {/* 装饰性元素 - 添加浮动动画 */}
          <motion.circle
            cx="35" cy="35" r="4" fill="#A78BFA" opacity="0.7"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.circle
            cx="105" cy="45" r="3" fill="#A78BFA" opacity="0.7"
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          <motion.circle
            cx="30" cy="95" r="3" fill="#A78BFA" opacity="0.7"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
          <motion.circle
            cx="110" cy="90" r="4" fill="#A78BFA" opacity="0.7"
            animate={{ y: [0, 3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          />
        </svg>
      </motion.div>
    );
  };

  // 响应式背景粒子效果
  const BackgroundParticles = () => {
    const particleCount = isMobile ? 10 : 20;

    return (
      <motion.div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
      >
        {Array.from({ length: particleCount }).map((_, i) => {
          // 使用固定的初始位置，避免随机位置导致的视觉问题
          const initialX = ((i * 137) % (typeof window !== 'undefined' ? window.innerWidth : 1200));
          const initialY = ((i * 193) % (typeof window !== 'undefined' ? window.innerHeight : 800));

          return (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full opacity-20"
              initial={{
                x: initialX,
                y: initialY,
                opacity: 0,
                scale: 0,
              }}
              animate={{
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
                y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
                opacity: 0.2,
                scale: 1,
              }}
              transition={{
                opacity: { duration: 0.8, delay: 1.2 + i * 0.05 },
                scale: { duration: 0.5, delay: 1.2 + i * 0.05 },
                x: {
                  duration: Math.random() * 20 + 20,
                  repeat: Infinity,
                  ease: "linear",
                  delay: 2 + i * 0.1
                },
                y: {
                  duration: Math.random() * 20 + 20,
                  repeat: Infinity,
                  ease: "linear",
                  delay: 2 + i * 0.1
                }
              }}
            />
          );
        })}
      </motion.div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center z-50"
        data-component="FirstVisitVerification"
        data-page="FirstVisitVerification"
        data-view="FirstVisitVerification"
        style={{
          minHeight: '100dvh', // 支持动态视口高度
          padding: isMobile ? '1rem' : '1.5rem',
        }}
      >
        {/* 背景粒子 */}
        {showParticles && <BackgroundParticles />}

        {/* 主容器 */}
        <motion.div
          initial={{ y: 30, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -30, opacity: 0, scale: 0.95 }}
          transition={{
            duration: 0.6,
            ease: "easeOut",
            delay: 0.1
          }}
          className={`relative bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 ${isMobile
              ? 'w-full max-w-sm mx-2 p-4'
              : 'max-w-md w-full mx-4 p-8'
            }`}
          style={{
            maxHeight: isMobile ? '90vh' : '80vh',
            overflowY: 'auto',
            overflowX: 'hidden', // 防止水平滚动条
          }}
        >
          {/* 顶部装饰线 */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-20 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full"></div>

          {/* Logo */}
          <Logo />

          {/* 标题 */}
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className={`text-center text-gray-800 mb-3 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent font-bold ${isMobile ? 'text-2xl' : 'text-3xl'
              }`}
          >
            欢迎访问
          </motion.h1>

          {/* 副标题 */}
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className={`text-center text-gray-600 mb-2 font-medium ${isMobile ? 'text-sm' : 'text-base'
              }`}
          >
            Happy TTS
          </motion.p>

          {/* 说明文字 */}
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className={`text-center text-gray-600 leading-relaxed ${isMobile ? 'text-sm mb-4' : 'text-base mb-8'
              }`}
          >
            为了确保您是人类用户
            <br />
            请完成下方验证以继续访问
          </motion.p>

          {/* Turnstile组件 */}
          {!turnstileConfigLoading && turnstileConfig.siteKey && typeof turnstileConfig.siteKey === 'string' && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className={`mb-6 ${isMobile ? 'mb-4' : 'mb-6'}`}
            >
              <div className="flex justify-center mb-4">
                <div className={`p-4 bg-gray-50 rounded-xl border border-gray-200 ${isMobile ? 'w-full' : ''
                  }`}>
                  <TurnstileWidget
                    key={turnstileKey}
                    siteKey={turnstileConfig.siteKey}
                    onVerify={handleTurnstileVerify}
                    onExpire={handleTurnstileExpire}
                    onError={handleTurnstileError}
                    theme="light"
                    size={isMobile ? "compact" : "normal"}
                  />
                </div>
              </div>

              {/* 验证状态 */}
              <motion.div
                className="text-center mb-4"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {turnstileVerified ? (
                  <motion.div
                    className={`flex items-center justify-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-full border border-green-200 ${isMobile ? 'text-sm' : 'text-base'
                      }`}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <motion.svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      initial={{ rotate: -180, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ duration: 0.5, type: "spring" }}
                    >
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </motion.svg>
                    <span className="font-medium">验证通过</span>
                  </motion.div>
                ) : (
                  <div className={`flex items-center justify-center gap-2 text-gray-500 bg-gray-50 px-4 py-2 rounded-full border border-gray-200 ${isMobile ? 'text-sm' : 'text-base'
                    }`}>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span>请完成验证</span>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* 错误信息 */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className={`mb-4 p-4 bg-red-50 border border-red-200 rounded-xl ${isMobile ? 'text-sm' : 'text-base'
                  }`}
              >
                <div className="flex items-center gap-3 text-red-600">
                  <motion.svg
                    className="w-5 h-5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 0.5, repeat: 2 }}
                  >
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </motion.svg>
                  <div className="flex-1">
                    <span className={`font-medium ${isMobile ? 'text-sm' : 'text-base'}`}>{error}</span>
                    {retryCount > 0 && (
                      <div className={`mt-2 text-red-500 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                        已重试 {retryCount} 次 {retryCount >= 3 ? '(已达上限)' : `(还可重试 ${3 - retryCount} 次)`}
                        {retryCount >= 3 && (
                          <button
                            onClick={resetRetryCount}
                            className="ml-2 text-blue-600 hover:text-blue-800 underline"
                          >
                            重置
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 验证按钮 */}
          <motion.button
            onClick={handleVerify}
            disabled={!turnstileVerified || verifying}
            className={`w-full text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-indigo-600 to-purple-600 ${isMobile
                ? 'py-3 px-4 text-base'
                : 'py-4 px-6 text-lg'
              }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            onMouseEnter={() => {
              if (!turnstileVerified) {
                setNotification({
                  message: '请先完成上方的人机验证',
                  type: 'info'
                });
              }
            }}
            onFocus={() => {
              if (!turnstileVerified) {
                setNotification({
                  message: '需要先通过人机验证才能继续',
                  type: 'warning'
                });
              }
            }}
          >
            {verifying ? (
              <div className="flex items-center justify-center gap-3">
                <motion.svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </motion.svg>
                <span>验证中...</span>
              </div>
            ) : (
              <span>继续访问</span>
            )}
          </motion.button>

          {/* 底部说明 */}
          <motion.div
            className={`text-center ${isMobile ? 'mt-4' : 'mt-8'}`}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            </div>
            <p
              className={`text-gray-500 leading-relaxed cursor-help ${isMobile ? 'text-xs' : 'text-sm'
                }`}
              onClick={() => {
                setNotification({
                  message: '我们使用 Cloudflare Turnstile 进行安全验证，保护您的隐私',
                  type: 'info'
                });
              }}
              onMouseEnter={() => {
                if (!isMobile) {
                  setNotification({
                    message: '点击了解更多隐私保护信息',
                    type: 'info'
                  });
                }
              }}
            >
              此验证仅用于防止自动化访问
              <br />
              您的隐私将得到充分保护
            </p>

            {/* 添加帮助按钮 */}
            <motion.button
              className={`mt-3 text-gray-400 hover:text-indigo-500 transition-colors duration-200 ${isMobile ? 'text-xs' : 'text-sm'
                }`}
              onClick={() => {
                setNotification({
                  message: '如遇验证问题，请尝试刷新页面或检查网络连接',
                  type: 'info'
                });
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="flex items-center justify-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span>遇到问题？</span>
              </div>
            </motion.button>

            {/* 开发模式下的豁免状态检查按钮 */}
            {process.env.NODE_ENV === 'development' && (
              <motion.button
                className={`mt-2 text-blue-400 hover:text-blue-600 transition-colors duration-200 ${
                  isMobile ? 'text-xs' : 'text-sm'
                }`}
                onClick={() => {
                  const status = integrityChecker.checkExemptStatus();
                  console.log('🛡️ 完整性检查豁免状态:', status);
                  setNotification({
                    message: status.isExempt 
                      ? `豁免生效: ${status.exemptReasons.join(', ')}` 
                      : '未被豁免，可能触发完整性检查',
                    type: status.isExempt ? 'success' : 'warning'
                  });
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="flex items-center justify-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 12a1 1 0 102 0V7a1 1 0 10-2 0v5zm1-8a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
                  </svg>
                  <span>检查豁免状态</span>
                </div>
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}; 