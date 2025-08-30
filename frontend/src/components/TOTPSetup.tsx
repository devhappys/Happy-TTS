import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api/api';
import { TOTPSetupData } from '../types/auth';
import { handleTOTPError, cleanTOTPToken, validateTOTPToken } from '../utils/totpUtils';
import { PasskeySetup } from './PasskeySetup';
import { useNotification } from './Notification';
import { FaLock, FaQrcode, FaKey, FaCheck, FaTimes, FaExclamationTriangle, FaBan, FaUserPlus } from 'react-icons/fa';

interface TOTPSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TOTPSetup: React.FC<TOTPSetupProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'loading' | 'setup' | 'verify' | 'success'>('loading');
  const [setupData, setSetupData] = useState<TOTPSetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [activeTab, setActiveTab] = useState<'totp' | 'passkey'>('totp');
  const { setNotification } = useNotification();

  useEffect(() => {
    if (isOpen) {
      setRotation(0);
      generateSetup();
    }
  }, [isOpen]);

  useEffect(() => {
    setRotation(0);
  }, [activeTab, step]);

  const generateSetup = async () => {
    try {
      setStep('loading');
      setError('');
      
      const response = await api.post('/api/totp/generate-setup');
      setSetupData(response.data);
      setStep('setup');
    } catch (error: any) {
      console.error('TOTP setup generation failed:', error);
      setError(error.response?.data?.error || '生成TOTP设置失败');
      setStep('setup');
    }
  };

  const handleVerify = async () => {
    // 清理输入
    const cleanCode = cleanTOTPToken(verificationCode);
    
    if (!cleanCode.trim()) {
      setNotification({ message: '请输入验证码', type: 'warning' });
      return;
    }

    if (!validateTOTPToken(cleanCode)) {
      setNotification({ message: '验证码必须是6位数字', type: 'warning' });
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await api.post('/api/totp/verify-and-enable', {
        token: cleanCode
      });
      
      setStep('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (error: any) {
      setNotification({ message: handleTOTPError(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('loading');
    setVerificationCode('');
    setError('');
    setShowBackupCodes(false);
    setSetupData(null);
    setActiveTab('totp');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 50 }}
          transition={{ duration: 0.4, type: "spring", stiffness: 300, damping: 25 }}
          className="bg-white rounded-2xl shadow-2xl w-full mx-auto my-8 min-h-fit border border-gray-100"
          style={{ width: '90vw', maxWidth: '900px' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 可滚动的内容容器 */}
          <div className="max-h-[90vh] overflow-y-auto space-y-4 p-6">
            {/* 标题 */}
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <motion.div
                  animate={{ rotate: rotation }}
                  whileHover={{ rotate: 20 }}
                  onHoverEnd={() => setRotation(0)}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                >
                  <FaLock className="w-7 h-7 text-indigo-500" />
                </motion.div>
                二次验证设置
              </h2>
              <motion.button
                onClick={handleClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="关闭页面"
              >
                <FaTimes className="w-5 h-5" />
              </motion.button>
            </div>
            
            {/* 标签页 */}
            <div className="text-center mb-4 w-full">
              <div className="flex flex-col items-center">
                <div className="flex mb-4 gap-2">
                  <motion.button
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${activeTab === 'totp' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    onClick={() => setActiveTab('totp')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <FaQrcode className="w-4 h-4" />
                    动态口令（TOTP）
                  </motion.button>
                  <motion.button
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${activeTab === 'passkey' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    onClick={() => setActiveTab('passkey')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <FaKey className="w-4 h-4" />
                    Passkey 无密码认证
                  </motion.button>
                </div>
                {activeTab === 'totp' && (
                  <span className="text-sm sm:text-base text-gray-600 leading-normal select-none">使用认证器应用扫描QR码</span>
                )}
              </div>
            </div>

            {/* 内容区条件渲染 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="bg-white rounded-2xl p-6 shadow-lg"
            >
            {activeTab === 'totp' ? (
              <AnimatePresence mode="wait">
                {step === 'loading' && (
                  <motion.div 
                    className="text-center py-8 w-full"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div 
                      className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"
                      initial={{ rotate: 0 }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.p 
                      className="text-sm text-gray-600 leading-normal"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                    >
                      正在生成设置...
                    </motion.p>
                  </motion.div>
                )}
                {step === 'setup' && setupData && (
                  <motion.div 
                    className="space-y-4 w-full"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    {/* QR码 */}
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full max-w-[220px] mx-auto my-2">
                        <QRCodeSVG
                          value={setupData.otpauthUrl}
                          size={Math.min(220, window.innerWidth * 0.7)}
                          level="M"
                          includeMargin={true}
                          bgColor="#FFFFFF"
                          fgColor="#000000"
                          className="w-full h-auto"
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-2 text-center leading-normal">
                        使用Google Authenticator、Microsoft Authenticator等应用扫描
                      </div>
                    </div>

                    {/* 密钥 */}
                    <motion.div 
                      className="bg-gray-50 rounded-lg p-4 w-full"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.4 }}
                      whileHover={{ scale: 1.01 }}
                    >
                      <motion.p 
                        className="text-sm text-gray-600 mb-2 leading-normal"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.5 }}
                      >
                        手动输入密钥（如果无法扫描QR码）：
                      </motion.p>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full">
                        <motion.code 
                          className="bg-white px-3 py-2 rounded border text-sm font-mono flex-1 break-all w-full"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: 0.6 }}
                        >
                          {setupData.secret}
                        </motion.code>
                        <motion.button
                          onClick={() => {
                            navigator.clipboard.writeText(setupData.secret);
                            setNotification({ message: '密钥已复制到剪贴板', type: 'success' });
                          }}
                          className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors whitespace-nowrap flex items-center gap-2"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <FaKey className="w-3 h-3" />
                          复制
                        </motion.button>
                      </div>
                    </motion.div>

                    {/* 备用恢复码 */}
                    <motion.div 
                      className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 w-full"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <motion.p 
                          className="text-sm font-medium text-yellow-800 leading-normal"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: 0.6 }}
                        >
                          备用恢复码
                        </motion.p>
                        <motion.button
                          onClick={() => setShowBackupCodes(!showBackupCodes)}
                          className="text-sm text-yellow-700 hover:text-yellow-800 flex items-center gap-1"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {showBackupCodes ? (
                            <>
                              <FaExclamationTriangle className="w-3 h-3" />
                              隐藏
                            </>
                          ) : (
                            <>
                              <FaKey className="w-3 h-3" />
                              显示
                            </>
                          )}
                        </motion.button>
                      </div>
                      <motion.p 
                        className="text-sm text-yellow-700 mb-2 leading-normal"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.7 }}
                      >
                        请妥善保存这些恢复码，在无法使用认证器时可以使用它们登录。
                      </motion.p>
                      <AnimatePresence>
                        {showBackupCodes && (
                          <motion.div 
                            className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            {setupData.backupCodes.map((code, index) => (
                              <motion.code 
                                key={index} 
                                className="bg-white px-2 py-1 rounded text-xs font-mono text-center break-all border border-yellow-200 w-full"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.2, delay: 0.1 * index }}
                                whileHover={{ scale: 1.05 }}
                              >
                                {code}
                              </motion.code>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    {/* 验证码输入 */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.6 }}
                      className="w-full"
                    >
                      <motion.label 
                        className="block text-sm font-medium text-gray-700 mb-2 leading-normal"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.7 }}
                      >
                        输入6位验证码
                      </motion.label>
                      <motion.input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !loading && verificationCode.length === 6) {
                            handleVerify();
                          }
                        }}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-lg font-mono transition-all duration-200 hover:border-gray-300"
                        placeholder="000000"
                        maxLength={6}
                        autoComplete="one-time-code"
                        whileFocus={{ scale: 1.02 }}
                      />
                    </motion.div>

                    {/* 错误信息 */}
                    <AnimatePresence>
                      {error && (
                        <motion.div 
                          className="bg-red-50 border border-red-200 rounded-lg p-3 w-full"
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.3 }}
                        >
                          <motion.p 
                            className="text-red-700 text-sm leading-normal"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2, delay: 0.1 }}
                          >
                            {error}
                          </motion.p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* 操作按钮 */}
                    <motion.div 
                      className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.8 }}
                    >
                      <motion.button
                        onClick={handleClose}
                        className="flex-1 px-4 py-3 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-200 w-full flex items-center justify-center gap-2"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <FaBan className="w-4 h-4" />
                        取消
                      </motion.button>
                      <motion.button
                        onClick={handleVerify}
                        disabled={loading || verificationCode.length !== 6}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl w-full flex items-center justify-center gap-2"
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {loading ? (
                          <>
                            <motion.div 
                              className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                            验证中...
                          </>
                        ) : (
                          <>
                            <FaUserPlus className="w-4 h-4" />
                            验证并启用
                          </>
                        )}
                      </motion.button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            ) : (
              <div className="w-full flex flex-col items-center">
                <div className="w-full max-w-lg mx-auto">
                  <PasskeySetup onClose={() => {}} />
                </div>
              </div>
            )}
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TOTPSetup; 