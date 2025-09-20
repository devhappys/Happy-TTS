import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useNotification } from './Notification';
import getApiBaseUrl from '../api';
import { useAuth } from '../hooks/useAuth';
import { useLocation } from 'react-router-dom';
import CryptoJS from 'crypto-js';
import {
  FaClipboard, 
  FaUpload, 
  FaDownload,
  FaLink,
  FaCopy,
  FaEye,
  FaEyeSlash,
  FaSync,
  FaArchive,
  FaCloud,
  FaCompress,
  FaTrash
} from 'react-icons/fa';
import {
  getStoredHistory,
  saveHistoryToStorage,
  deleteHistoryFromStorage,
  clearAllHistory,
  exportHistoryData,
  importHistoryData,
  checkAndFixLogShareDB,
  generateHistoryId,
  LogShareHistory
} from '../utils/logShareStorage';

const isTextExt = (ext: string) => ['.txt', '.log', '.json', '.md'].includes(ext);

// 安全的解码函数，支持多种编码格式
const safeDecode = (decrypted: any): any => {
  console.log('🔓 [LogShare] 开始解码解密数据...');
  console.log('    解密数据类型:', typeof decrypted);
  console.log('    解密数据长度:', decrypted ? decrypted.length : 'undefined');
  
  // 首先尝试直接转换为UTF-8字符串
  try {
    const utf8String = decrypted.toString(CryptoJS.enc.Utf8);
    console.log('🔓 [LogShare] UTF-8解码结果:', utf8String.substring(0, 100) + '...');
    const parsedData = JSON.parse(utf8String);
    console.log('🔓 [LogShare] JSON解析成功');
    return parsedData;
  } catch (error) {
    console.log('🔓 [LogShare] UTF-8解码失败:', error);
  }
  
  // 如果UTF-8失败，尝试其他编码
  const encodings = [
    { name: 'Base64', decoder: () => {
      const base64 = decrypted.toString(CryptoJS.enc.Base64);
      return atob(base64);
    }},
    { name: 'Hex', decoder: () => {
      const hex = decrypted.toString(CryptoJS.enc.Hex);
      const hexBytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
      return new TextDecoder().decode(hexBytes);
    }},
    { name: 'Latin1', decoder: () => {
      return decrypted.toString(CryptoJS.enc.Latin1);
    }}
  ];

  for (const encoding of encodings) {
    try {
      console.log(`🔓 [LogShare] 尝试${encoding.name}解码...`);
      const decodedString = encoding.decoder();
      console.log(`🔓 [LogShare] ${encoding.name}解码结果:`, decodedString.substring(0, 100) + '...');
      const parsedData = JSON.parse(decodedString);
      console.log(`🔓 [LogShare] ${encoding.name}解码成功`);
      return parsedData;
    } catch (error) {
      console.log(`🔓 [LogShare] ${encoding.name}解码失败:`, error);
      continue;
    }
  }
  
  // 如果所有编码都失败，尝试直接返回原始数据
  console.log('🔓 [LogShare] 所有编码方式都失败，尝试直接使用原始数据');
  try {
    if (typeof decrypted === 'object' && decrypted !== null) {
      return decrypted;
    }
  } catch (error) {
    console.log('🔓 [LogShare] 直接使用原始数据也失败:', error);
  }
  
  throw new Error('所有解码方式都失败，无法处理解密后的数据');
};

const LogShare: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [adminPassword, setAdminPassword] = useState('');
  const [logContent, setLogContent] = useState('');
  const [uploadResult, setUploadResult] = useState<{ link: string, ext: string } | null>(null);
  const [queryId, setQueryId] = useState('');
  const [queryResult, setQueryResult] = useState<{ content: string, ext: string, encoding?: string } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<{ link: string, ext: string, time: string }[]>([]);
  const [queryHistory, setQueryHistory] = useState<{ id: string, ext: string, time: string }[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportType, setExportType] = useState<'plain' | 'base64' | 'aes256'>('plain');
  const { setNotification } = useNotification();
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [autoQueryId, setAutoQueryId] = useState<string | null>(null);
  const [allLogs, setAllLogs] = useState<{ id: string, ext: string, uploadTime: string, size: number }[]>([]);
  const [isLoadingAllLogs, setIsLoadingAllLogs] = useState(false);
  const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingLog, setEditingLog] = useState<{ id: string, fileName?: string, note?: string } | null>(null);
  const [editFileName, setEditFileName] = useState('');
  const [editNote, setEditNote] = useState('');
  
  // Archive related state
  const [archives, setArchives] = useState<any[]>([]);
  const [isLoadingArchives, setIsLoadingArchives] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveName, setArchiveName] = useState('');
  const [includePattern, setIncludePattern] = useState('');
  const [excludePattern, setExcludePattern] = useState('');
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // 加载历史记录
  const loadHistory = async () => {
    try {
      await checkAndFixLogShareDB();
      const history = await getStoredHistory();
      
      const uploadItems = history
        .filter(item => item.type === 'upload' && item.data.link && item.data.ext)
        .map(item => ({
          link: item.data.link!,
          ext: item.data.ext!,
          time: item.data.time
        }))
        .slice(0, 10);
      
      const queryItems = history
        .filter(item => item.type === 'query' && item.data.queryId)
        .map(item => ({
          id: item.data.queryId!,
          ext: item.data.ext || '',
          time: item.data.time
        }))
        .slice(0, 10);
      
      setUploadHistory(uploadItems);
      setQueryHistory(queryItems);
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  };

  // 选择相关
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selectAll = () => {
    if (selectedIds.length === allLogs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allLogs.map(l => l.id));
    }
  };

  // 删除单个
  const handleDeleteOne = async (id: string) => {
    try {
      await axios.delete(getApiBaseUrl() + `/api/sharelog/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setNotification({ message: '删除成功', type: 'success' });
      await loadAllLogs();
    } catch (e: any) {
      setNotification({ message: e.response?.data?.error || '删除失败', type: 'error' });
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      setNotification({ message: '请先选择要删除的日志', type: 'warning' });
      return;
    }
    try {
      await axios.post(getApiBaseUrl() + '/api/sharelog/delete-batch', { ids: selectedIds }, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setNotification({ message: '批量删除成功', type: 'success' });
      await loadAllLogs();
    } catch (e: any) {
      setNotification({ message: e.response?.data?.error || '批量删除失败', type: 'error' });
    }
  };

  // 全部删除
  const handleDeleteAll = async () => {
    if (allLogs.length === 0) {
      setNotification({ message: '暂无可删除日志', type: 'info' });
      return;
    }
    if (!confirm('确定要删除所有日志吗？该操作不可恢复')) return;
    try {
      await axios.delete(getApiBaseUrl() + '/api/sharelog/all', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setNotification({ message: '已清空所有日志', type: 'success' });
      await loadAllLogs();
    } catch (e: any) {
      setNotification({ message: e.response?.data?.error || '清空失败', type: 'error' });
    }
  };

  // Archive related functions
  const loadArchives = async () => {
    setIsLoadingArchives(true);
    try {
      const res = await axios.get(getApiBaseUrl() + '/api/logs/archives', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      setArchives(res.data.archives || []);
      setNotification({ message: '归档列表加载成功', type: 'success' });
    } catch (e: any) {
      setNotification({ message: e.response?.data?.error || '加载归档列表失败', type: 'error' });
    } finally {
      setIsLoadingArchives(false);
    }
  };

  const handleCreateArchive = async () => {
    if (!adminPassword) {
      setNotification({ message: '请先输入管理员密码', type: 'warning' });
      return;
    }
    
    setArchiveLoading(true);
    try {
      const res = await axios.post(getApiBaseUrl() + '/api/logs/archive', {
        archiveName: archiveName || undefined,
        includePattern: includePattern || undefined,
        excludePattern: excludePattern || undefined
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      setNotification({ 
        message: `归档创建成功！已归档 ${res.data.archivedFiles} 个文件，压缩率 ${res.data.overallCompressionRatio}，IPFS上传 ${res.data.ipfsUpload.uploadedFiles} 个文件`, 
        type: 'success' 
      });
      
      setShowArchiveModal(false);
      setArchiveName('');
      setIncludePattern('');
      setExcludePattern('');
      await loadArchives();
    } catch (e: any) {
      setNotification({ message: e.response?.data?.error || '创建归档失败', type: 'error' });
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleDeleteArchive = async (archiveName: string) => {
    if (!confirm(`确定要删除归档 "${archiveName}" 吗？此操作不可恢复！`)) {
      return;
    }
    
    try {
      await axios.delete(getApiBaseUrl() + `/api/logs/archives/${archiveName}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      setNotification({ message: '归档删除成功', type: 'success' });
      await loadArchives();
    } catch (e: any) {
      setNotification({ message: e.response?.data?.error || '删除归档失败', type: 'error' });
    }
  };

  // 编辑元数据
  const openEdit = (log: { id: string }) => {
    const existing = allLogs.find(l => l.id === log.id);
    setEditingLog({ id: log.id });
    setEditFileName('');
    setEditNote('');
  };
  const handleEditSave = async () => {
    if (!editingLog) return;
    if (!editFileName && !editNote) {
      setNotification({ message: '请至少填写一个可修改字段', type: 'warning' });
      return;
    }
    try {
      await axios.put(getApiBaseUrl() + `/api/sharelog/${editingLog.id}`, {
        fileName: editFileName || undefined,
        note: editNote || undefined,
      }, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setNotification({ message: '保存成功', type: 'success' });
      setEditingLog(null);
      setEditFileName('');
      setEditNote('');
      await loadAllLogs();
    } catch (e: any) {
      setNotification({ message: e.response?.data?.error || '保存失败', type: 'error' });
    }
  };

  // 初始化时加载历史记录
  useEffect(() => {
    loadHistory();
  }, []);

  // 点击外部关闭导出菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.export-menu-container')) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  // 检查URL参数
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (id) {
      setQueryId(id);
      setAutoQueryId(id);
    }
  }, [location.search]);

  // 管理员校验后自动弹窗输入密码
  useEffect(() => {
    if (user && user.role === 'admin' && autoQueryId) {
      setShowPwdModal(true);
    }
  }, [user, autoQueryId]);

  // 自动查询
  const handleAutoQuery = async () => {
    setShowPwdModal(false);
    if (adminPassword && autoQueryId) {
      setQueryId(autoQueryId);
      await handleQuery();
      setAutoQueryId(null);
    }
  };

  useEffect(() => {
    if (uploadResult && uploadResult.link) {
      // 安全地复制到剪贴板，处理焦点问题
      navigator.clipboard.writeText(uploadResult.link).then(() => {
        setNotification({ message: '上传成功，链接已复制', type: 'success' });
      }).catch((error) => {
        console.log('剪贴板复制失败:', error);
        setNotification({ message: '上传成功，但链接复制失败', type: 'success' });
      });
    }
  }, [uploadResult, setNotification]);

  // 计算文本大小（UTF-8字节数）
  const getTextSizeInBytes = (text: string): number => {
    return new Blob([text]).size;
  };

  // 格式化文件大小显示
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
  };

  // 获取当前文本大小
  const currentTextSize = logContent ? getTextSizeInBytes(logContent) : 0;
  const maxSize = 10 * 1024 * 1024; // 10MB
  const isTextTooLarge = currentTextSize > maxSize;

  // 上传日志/文件
  const handleUpload = async () => {
    setError('');
    setSuccess('');
    setUploadResult(null);
    
    // 客户端文件大小验证
    if (file && file.size > 10 * 1024 * 1024) {
      setError(`文件过大！当前文件大小：${(file.size / 1024 / 1024).toFixed(2)}MB，最大支持10MB`);
      return;
    }
    
    // 客户端文本大小验证
    if (!file && logContent && isTextTooLarge) {
      setError(`文本内容过大！当前大小：${formatFileSize(currentTextSize)}，最大支持10MB`);
      return;
    }
    
    setLoading(true);
    try {
      let res;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('adminPassword', adminPassword);
        res = await axios.post(getApiBaseUrl() + '/api/sharelog', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // 兼容纯文本上传
        const blob = new Blob([logContent], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', blob, 'log.txt');
        formData.append('adminPassword', adminPassword);
        res = await axios.post(getApiBaseUrl() + '/api/sharelog', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      if (res.data.link) {
        setUploadResult({ link: res.data.link, ext: res.data.ext });
        setSuccess('上传成功！');
        
        // 保存到 IndexedDB
        const historyItem: LogShareHistory = {
          id: generateHistoryId(),
          type: 'upload',
          data: {
            link: res.data.link,
            ext: res.data.ext,
            time: new Date().toLocaleString()
          },
          createdAt: new Date().toISOString()
        };
        
        await saveHistoryToStorage(historyItem);
        await loadHistory(); // 重新加载历史记录
      } else {
        setError('上传失败');
      }
    } catch (e: any) {
      setError(e.response?.data?.error || '上传失败');
    } finally {
      setLoading(false);
    }
  };

  // 查询日志/文件
  const handleQuery = async () => {
    setError('');
    setSuccess('');
    setQueryResult(null);
    setLoading(true);
    
    console.log('🔓 [LogShare] 发送查询请求...');
    console.log('    查询ID:', queryId);
    console.log('    管理员密码长度:', adminPassword ? adminPassword.length : 0);
    console.log('    管理员密码预览:', adminPassword ? adminPassword.substring(0, 3) + '***' : 'undefined');
    
    try {
      const res = await axios.post(getApiBaseUrl() + `/api/sharelog/${queryId}`, {
        adminPassword,
        id: queryId
      });
      
      // 检查是否为加密数据
      if (res.data.data && res.data.iv) {
        console.log('🔓 [LogShare] 检测到加密数据，开始解密...');
        console.log('    数据类型:', typeof res.data);
        console.log('    数据字段:', Object.keys(res.data));
        
        if (!adminPassword) {
          throw new Error('管理员密码不存在，无法解密');
        }
        
        try {
          // 替换 CryptoJS.SHA256(adminPassword) 为 PBKDF2 派生
          const keyHash = CryptoJS.PBKDF2(adminPassword, 'logshare-salt', { keySize: 256/32, iterations: 10000, hasher: CryptoJS.algo.SHA512 }).toString(CryptoJS.enc.Hex);
          const key = CryptoJS.enc.Hex.parse(keyHash);
          const iv = CryptoJS.enc.Hex.parse(res.data.iv);
          const encryptedData = CryptoJS.enc.Hex.parse(res.data.data);
          
          const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: encryptedData },
            key,
            { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
          );
          
          console.log('🔓 [LogShare] CryptoJS解密结果:', decrypted);
          console.log('    解密结果类型:', typeof decrypted);
          console.log('    解密结果toString:', decrypted.toString());
          
          // 使用安全的解码函数
          const decryptedData = safeDecode(decrypted);
          
          console.log('🔓 [LogShare] 解密成功');
          console.log('    文件类型:', decryptedData.ext);
          
          setQueryResult(decryptedData);
        } catch (decryptError: any) {
          console.error('🔓 [LogShare] 解密失败:', decryptError);
          setError('数据解密失败: ' + (decryptError?.message || '未知错误'));
          return;
        }
      } else {
        // 未加密数据
        console.log('🔓 [LogShare] 未加密数据，直接使用');
        setQueryResult(res.data);
      }
      
      setSuccess('查询成功！');
      
      // 保存到 IndexedDB
      const ext = (res.data.data && res.data.iv) ? 
        (queryResult?.ext || 'unknown') : 
        (res.data.ext || 'unknown');
      
      const historyItem: LogShareHistory = {
        id: generateHistoryId(),
        type: 'query',
        data: {
          queryId: queryId,
          ext: ext,
          time: new Date().toLocaleString()
        },
        createdAt: new Date().toISOString()
      };
      
      await saveHistoryToStorage(historyItem);
      await loadHistory(); // 重新加载历史记录
    } catch (e: any) {
      setError(e.response?.data?.error || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取所有日志列表
  const loadAllLogs = async () => {
    setIsLoadingAllLogs(true);
    try {
      const res = await axios.get(getApiBaseUrl() + '/api/sharelog/all', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // 检查是否为加密数据
      if (res.data.data && res.data.iv) {
        console.log('🔓 [LogShare] 检测到加密数据，开始解密...');
        console.log('    数据类型:', typeof res.data);
        console.log('    数据字段:', Object.keys(res.data));
        
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Token不存在，无法解密');
        }
        
        try {
          // 替换 CryptoJS.SHA256(token) 为 PBKDF2 派生
          const keyHash = CryptoJS.PBKDF2(token, 'logshare-salt', { keySize: 256/32, iterations: 10000, hasher: CryptoJS.algo.SHA512 }).toString(CryptoJS.enc.Hex);
          const key = CryptoJS.enc.Hex.parse(keyHash);
          const iv = CryptoJS.enc.Hex.parse(res.data.iv);
          const encryptedData = CryptoJS.enc.Hex.parse(res.data.data);
          
          const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: encryptedData },
            key,
            { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
          );
          
          console.log('🔓 [LogShare] CryptoJS解密结果:', decrypted);
          console.log('    解密结果类型:', typeof decrypted);
          console.log('    解密结果toString:', decrypted.toString());
          
          // 使用安全的解码函数
          const decryptedData = safeDecode(decrypted);
          
          console.log('🔓 [LogShare] 解密成功');
          console.log('    日志数量:', decryptedData.logs?.length || 0);
          
          setAllLogs(decryptedData.logs || []);
        } catch (decryptError: any) {
          console.error('🔓 [LogShare] 解密失败:', decryptError);
          setNotification({ message: '数据解密失败: ' + (decryptError?.message || '未知错误'), type: 'error' });
          return;
        }
      } else {
        // 未加密数据
        console.log('🔓 [LogShare] 未加密数据，直接使用');
        setAllLogs(res.data.logs || []);
      }
      
      // 刷新列表后清空选择
      setSelectedIds([]);
      setNotification({ message: '日志列表加载成功', type: 'success' });
    } catch (e: any) {
      setNotification({ message: e.response?.data?.error || '加载日志列表失败', type: 'error' });
    } finally {
      setIsLoadingAllLogs(false);
    }
  };

  // 查看指定日志
  const viewLog = async (logId: string) => {
    setLoading(true);
    try {
      const res = await axios.post(getApiBaseUrl() + `/api/sharelog/${logId}`, {
        adminPassword,
        id: logId
      });
      
      // 检查是否为加密数据
      if (res.data.data && res.data.iv) {
        console.log('🔓 [LogShare] 检测到加密数据，开始解密...');
        console.log('    数据类型:', typeof res.data);
        console.log('    数据字段:', Object.keys(res.data));
        
        if (!adminPassword) {
          throw new Error('管理员密码不存在，无法解密');
        }
        
        try {
          // 替换 CryptoJS.SHA256(adminPassword) 为 PBKDF2 派生
          const keyHash = CryptoJS.PBKDF2(adminPassword, 'logshare-salt', { keySize: 256/32, iterations: 10000, hasher: CryptoJS.algo.SHA512 }).toString(CryptoJS.enc.Hex);
          const key = CryptoJS.enc.Hex.parse(keyHash);
          const iv = CryptoJS.enc.Hex.parse(res.data.iv);
          const encryptedData = CryptoJS.enc.Hex.parse(res.data.data);
          
          const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: encryptedData },
            key,
            { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
          );
          
          console.log('🔓 [LogShare] CryptoJS解密结果:', decrypted);
          console.log('    解密结果类型:', typeof decrypted);
          console.log('    解密结果toString:', decrypted.toString());
          
          // 使用安全的解码函数
          const decryptedData = safeDecode(decrypted);
          
          console.log('🔓 [LogShare] 解密成功');
          console.log('    文件类型:', decryptedData.ext);
          
          setQueryResult(decryptedData);
        } catch (decryptError: any) {
          console.error('🔓 [LogShare] 解密失败:', decryptError);
          setNotification({ message: '数据解密失败: ' + (decryptError?.message || '未知错误'), type: 'error' });
          return;
        }
      } else {
        // 未加密数据
        console.log('🔓 [LogShare] 未加密数据，直接使用');
        setQueryResult(res.data);
      }
      
      setQueryId(logId);
      setSuccess('查看成功！');
    } catch (e: any) {
      setNotification({ message: e.response?.data?.error || '查看日志失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 导出历史记录
  const handleExport = async () => {
    try {
      await exportHistoryData(exportType);
      setNotification({ message: '导出成功', type: 'success' });
      setShowExportMenu(false);
    } catch (error: any) {
      setNotification({ message: error.message, type: 'error' });
    }
  };

  // 导入历史记录
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const newCount = await importHistoryData(file);
      await loadHistory();
      setNotification({ message: `导入成功！新增 ${newCount} 条记录`, type: 'success' });
    } catch (error: any) {
      setNotification({ message: error.message, type: 'error' });
    }
    
    e.target.value = '';
  };

  // 清除所有历史记录
  const handleClear = async () => {
    if (window.confirm('确定要清空所有历史记录吗？此操作不可恢复！')) {
      try {
        await clearAllHistory();
        setUploadHistory([]);
        setQueryHistory([]);
        setNotification({ message: '历史记录已清空', type: 'success' });
      } catch (error: any) {
        setNotification({ message: '清空失败: ' + error.message, type: 'error' });
      }
    }
  };

  // 下载文件
  const handleDownload = () => {
    if (!queryResult) return;
    const { content, ext, encoding } = queryResult;
    let blob;
    if (encoding === 'base64') {
      // 修正：base64转Uint8Array再转Blob，避免undefined
      const binaryString = atob(content);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes]);
    } else {
      blob = new Blob([content], { type: 'text/plain' });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sharelog${ext || ''}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (error) {
      setNotification({ message: error, type: 'error' });
      setError('');
    }
  }, [error, setNotification]);

  useEffect(() => {
    if (success) {
      setNotification({ message: success, type: 'success' });
      setSuccess('');
    }
  }, [success, setNotification]);

  // 管理员校验
  if (!user || user.role !== 'admin') {
    return (
      <motion.div 
        className="space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div 
          className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-6 border border-red-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-2xl font-bold text-red-700 mb-3 flex items-center gap-2">
            🤡
            访问被拒绝
          </h2>
          <div className="text-gray-600 space-y-2">
            <p>你不是管理员，禁止访问！请用管理员账号登录后再来。</p>
            <div className="text-sm text-red-500 italic">
              LogShare 仅限管理员使用
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <>
      {/* 全屏密码弹窗 */}
      <AnimatePresence>
        {showPwdModal && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-[9999]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-xs relative"
              initial={{ scale: 0.95, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 40 }}
              transition={{ duration: 0.25 }}
            >
              <h3 className="text-lg font-bold mb-4 text-center">请输入管理员密码</h3>
              <input
                type="password"
                className="w-full border-2 border-green-200 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-green-400 transition-all"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                autoFocus
                placeholder="管理员密码"
                onKeyDown={e => { if (e.key === 'Enter') handleAutoQuery(); }}
              />
              <div className="flex gap-2">
                <button
                  className="flex-1 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition"
                  onClick={handleAutoQuery}
                  disabled={!adminPassword}
                >查询日志</button>
                <button
                  className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                  onClick={() => setShowPwdModal(false)}
                >取消</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* 主体内容 */}
      <motion.div 
        className="space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* 标题和说明 */}
        <motion.div 
          className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-2xl font-bold text-blue-700 mb-3 flex items-center gap-2">
            <FaClipboard className="text-2xl text-blue-600" />
            日志/文件剪贴板上传 & 查询
          </h2>
          <div className="text-gray-600 space-y-2">
            <p>支持文本、日志、json等类型，单文件最大10MB。仅管理员可操作。</p>
            <div className="flex items-start gap-2 text-sm">
              <div>
                <p className="font-semibold text-blue-700">功能说明：</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>支持文件上传和文本粘贴</li>
                  <li>自动生成分享链接</li>
                  <li>支持加密存储和查询</li>
                  <li>提供历史记录管理</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* 上传区块 */}
        <motion.div 
          className="bg-blue-50 rounded-xl p-6 shadow-sm border border-gray-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FaUpload className="text-lg text-blue-500" />
              上传日志/文件
            </h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block mb-2 font-semibold text-gray-700">
                管理员密码
              </label>
              <input 
                type="password" 
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all" 
                value={adminPassword} 
                onChange={e => setAdminPassword(e.target.value)} 
                autoComplete="off"
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-semibold text-gray-700">
                  日志内容（粘贴或输入）或选择文件
                </label>
                {logContent && (
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    isTextTooLarge 
                      ? 'bg-red-100 text-red-700 border border-red-200' 
                      : currentTextSize > maxSize * 0.8 
                        ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                        : 'bg-green-100 text-green-700 border border-green-200'
                  }`}>
                    {formatFileSize(currentTextSize)} / 10MB
                  </div>
                )}
              </div>
              <textarea 
                className={`w-full border-2 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-all ${
                  isTextTooLarge 
                    ? 'border-red-300 focus:ring-red-400 bg-red-50' 
                    : currentTextSize > maxSize * 0.8
                      ? 'border-yellow-300 focus:ring-yellow-400 bg-yellow-50'
                      : 'border-gray-200 focus:ring-blue-400'
                }`}
                rows={6} 
                value={logContent} 
                onChange={e => setLogContent(e.target.value)} 
                disabled={!!file} 
                placeholder="可直接粘贴日志内容，或选择文件上传"
              />
              {isTextTooLarge && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span>⚠️ 文本内容超出10MB限制，请删减内容或使用文件上传</span>
                </div>
              )}
              {!isTextTooLarge && currentTextSize > maxSize * 0.8 && (
                <div className="mt-2 text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg p-2 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>💡 文本内容接近10MB限制，建议考虑使用文件上传</span>
                </div>
              )}
            </div>
            
            <div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="mb-2" 
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                <div className="text-sm text-blue-800 font-medium mb-1">📁 文件上传说明</div>
                <div className="text-xs text-blue-600 space-y-1">
                  <div>• <strong>支持格式：</strong>.txt, .log, .json, .md, .xml, .csv</div>
                  <div>• <strong>文件大小：</strong>最大支持 10MB</div>
                  <div>• <strong>上传方式：</strong>可直接拖拽文件或点击选择</div>
                </div>
              </div>
            </div>
            
            <AnimatePresence>
              {file && (
                <motion.div 
                  className="text-sm text-gray-600 mb-2"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  已选择文件: {file.name} 
                  <button 
                    className="ml-2 text-red-500 hover:underline" 
                    onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  >
                    移除
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            
            <motion.button 
              className={`px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 font-medium flex items-center gap-2`} 
              onClick={handleUpload} 
              disabled={loading || !adminPassword || (!logContent && !file)}
              whileTap={{ scale: 0.95 }}
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
              {loading ? '上传中...' : '上传日志/文件'}
            </motion.button>
            
            <AnimatePresence>
              {uploadResult && uploadResult.link && (
                <motion.div 
                  className="mt-3 text-green-600 font-semibold flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3"
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.4, type: "spring", stiffness: 100 }}
                >
                  上传成功，访问链接：
                  <a href={uploadResult.link} className="underline" target="_blank" rel="noopener noreferrer">
                    {uploadResult.link}
                  </a> 
                  <span className="text-gray-500">({uploadResult.ext})</span>
                  <AnimatePresence>
                    {copied && (
                      <motion.span 
                        className="ml-2 text-green-500 text-sm"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                      >
                        已自动复制
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        
        {/* 查询区块 */}
        <motion.div 
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              🔍
              查询日志/文件内容
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <motion.button
                onClick={loadAllLogs}
                disabled={isLoadingAllLogs}
                className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium flex items-center gap-2 w-full sm:w-auto"
                whileTap={{ scale: 0.95 }}
              >
                {isLoadingAllLogs ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                {isLoadingAllLogs ? '加载中...' : '查看所有日志'}
              </motion.button>

              {/* 批量操作 */}
              {allLogs.length > 0 && (
                <div className="flex gap-2 flex-1 sm:flex-none">
                  <motion.button
                    onClick={handleBatchDelete}
                    className="px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 text-sm font-medium flex items-center gap-2 w-full sm:w-auto"
                    whileTap={{ scale: 0.95 }}
                  >
                    批量删除
                  </motion.button>
                  <motion.button
                    onClick={handleDeleteAll}
                    className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all duration-200 text-sm font-medium flex items-center gap-2 w-full sm:w-auto"
                    whileTap={{ scale: 0.95 }}
                  >
                    清空所有
                  </motion.button>
                </div>
              )}
            </div>

            {/* 所有日志列表 */}
            {allLogs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4"
              >
                <h4 className="text-sm font-semibold text-gray-700 mb-2">所有日志列表 ({allLogs.length})</h4>
                <div className="max-h-[60vh] overflow-y-auto border border-gray-200 rounded-lg">
                  {/* 选择全选 */}
                  <div className="flex items-center gap-2 p-3 border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
                    <input type="checkbox" checked={selectedIds.length === allLogs.length && allLogs.length > 0} onChange={selectAll} />
                    <span className="text-sm text-gray-600">全选（已选 {selectedIds.length}）</span>
                  </div>
                  {allLogs.map((log, index) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                        selectedLogIndex === index ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-start gap-3">
                        <input className="mt-1.5 shrink-0" type="checkbox" checked={selectedIds.includes(log.id)} onChange={() => toggleSelect(log.id)} />
                        <div className="flex-1 min-w-0" >
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-gray-900 truncate max-w-[60vw] sm:max-w-none cursor-pointer" onClick={() => { setSelectedLogIndex(index); viewLog(log.id); }}>{log.id}</div>
                            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{log.ext || '未知'}</span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                            <span>{new Date(log.uploadTime).toLocaleString()}</span>
                            <span>{(log.size / 1024).toFixed(1)}KB</span>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-2">
                            <button className="col-span-1 px-3 py-2 text-xs bg-blue-500 text-white rounded active:scale-[0.98]" onClick={() => viewLog(log.id)} aria-label="查看">查看</button>
                            <button className="col-span-1 px-3 py-2 text-xs bg-yellow-500 text-white rounded active:scale-[0.98]" onClick={() => openEdit(log)} aria-label="编辑">编辑</button>
                            <button className="col-span-1 px-3 py-2 text-xs bg-red-500 text-white rounded active:scale-[0.98]" onClick={() => handleDeleteOne(log.id)} aria-label="删除">删除</button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
            
            <div>
              <label className="block mb-2 font-semibold text-gray-700">
                日志/文件ID
              </label>
              <input 
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all" 
                value={queryId} 
                onChange={e => setQueryId(e.target.value)} 
                placeholder="请输入上传后返回的ID"
              />
            </div>
            
            <div>
              <label className="block mb-2 font-semibold text-gray-700">
                管理员密码
              </label>
              <input 
                type="password" 
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all" 
                value={adminPassword} 
                onChange={e => setAdminPassword(e.target.value)} 
                autoComplete="off"
              />
            </div>
            
            <motion.button 
              className={`px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 font-medium flex items-center gap-2`} 
              onClick={handleQuery} 
              disabled={loading || !adminPassword || !queryId}
              whileTap={{ scale: 0.95 }}
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              {loading ? '查询中...' : '查询日志/文件'}
            </motion.button>
            
            <AnimatePresence>
              {queryResult && (
                <motion.div 
                  className="mt-4"
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  transition={{ duration: 0.4, type: "spring", stiffness: 100 }}
                >
                  <div className="mb-2 text-gray-600">
                    类型: {queryResult.ext ? queryResult.ext : '未知'} {queryResult.encoding && <span>({queryResult.encoding})</span>}
                  </div>
                  {isTextExt(queryResult.ext) ? (
                    <div>
                      <div className="mb-2 text-yellow-700">
                        文本文件预览：
                      </div>
                      <pre className="bg-gray-100 p-2 rounded text-sm whitespace-pre-wrap max-h-64 overflow-auto border border-gray-200 mb-3">
                        {queryResult.content}
                      </pre>
                      <motion.button 
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200 flex items-center gap-2" 
                        onClick={handleDownload}
                        whileTap={{ scale: 0.95 }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        下载文本文件
                      </motion.button>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-2 text-yellow-700">
                        二进制/非文本文件，点击下载：
                      </div>
                      <motion.button 
                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all duration-200 flex items-center gap-2" 
                        onClick={handleDownload}
                        whileTap={{ scale: 0.95 }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        下载文件
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        
        {/* 历史记录 */}
        <motion.div 
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FaClipboard className="text-lg text-blue-500" />
              历史记录
            </h3>
            <div className="flex items-center gap-2">
              {/* 导入按钮 */}
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                  id="import-file-input"
                />
                <motion.button
                  className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm font-medium flex items-center gap-2 cursor-pointer"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => document.getElementById('import-file-input')?.click()}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  导入
                </motion.button>
              </div>
              
              {/* 导出菜单 */}
              <div className="relative export-menu-container">
                <motion.button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium flex items-center gap-2"
                  whileTap={{ scale: 0.95 }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  导出
                </motion.button>
                
                <AnimatePresence>
                  {showExportMenu && (
                    <motion.div
                      className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[200px]"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <div className="p-2">
                        <label className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                          <input
                            type="radio"
                            value="plain"
                            checked={exportType === 'plain'}
                            onChange={(e) => setExportType(e.target.value as any)}
                          />
                          <span className="text-sm">明文导出</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                          <input
                            type="radio"
                            value="base64"
                            checked={exportType === 'base64'}
                            onChange={(e) => setExportType(e.target.value as any)}
                          />
                          <span className="text-sm">Base64编码</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                          <input
                            type="radio"
                            value="aes256"
                            checked={exportType === 'aes256'}
                            onChange={(e) => setExportType(e.target.value as any)}
                          />
                          <span className="text-sm">AES-256加密</span>
                        </label>
                        <button
                          onClick={handleExport}
                          className="w-full mt-2 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm"
                        >
                          确认导出
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* 清除按钮 */}
              <motion.button
                onClick={handleClear}
                className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium flex items-center gap-2"
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                清除
              </motion.button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 上传历史 */}
            <div>
              <h4 className="text-md font-semibold text-blue-700 mb-3">上传历史</h4>
              <div className="space-y-2">
                {uploadHistory.length === 0 && (
                  <div className="text-gray-400 text-sm">暂无上传记录</div>
                )}
                {uploadHistory.map((item, idx) => (
                  <motion.div 
                    key={idx} 
                    className="text-sm flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 * idx }}
                    whileHover={{ scale: 1.02, x: 5 }}
                  >
                    <a 
                      href={item.link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="underline text-blue-600 truncate flex-1"
                    >
                      {item.link}
                    </a>
                    <span className="text-gray-500 text-xs">({item.ext})</span>
                    <span className="text-gray-400 text-xs">{item.time}</span>
                  </motion.div>
                ))}
              </div>
            </div>
            
            {/* 查询历史 */}
            <div>
              <h4 className="text-md font-semibold text-green-700 mb-3">查询历史</h4>
              <div className="space-y-2">
                {queryHistory.length === 0 && (
                  <div className="text-gray-400 text-sm">暂无查询记录</div>
                )}
                {queryHistory.map((item, idx) => (
                  <motion.div 
                    key={idx} 
                    className="text-sm flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 * idx }}
                    whileHover={{ scale: 1.02, x: -5 }}
                  >
                    <button 
                      className="underline text-green-600 truncate flex-1 text-left" 
                      onClick={() => { setQueryId(item.id); setQueryResult(null); setSuccess(''); setError(''); }}
                    >
                      {item.id}
                    </button>
                    <span className="text-gray-500 text-xs">{item.ext ? `(${item.ext})` : ''}</span>
                    <span className="text-gray-400 text-xs">{item.time}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* 日志归档管理区块 */}
        <motion.div 
          className="bg-purple-50 rounded-xl p-6 shadow-sm border border-gray-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FaArchive className="text-lg text-purple-500" />
              日志归档管理
            </h3>
            <div className="flex items-center gap-2">
              <input 
                type="password" 
                className="border-2 border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all w-40" 
                value={adminPassword} 
                onChange={e => setAdminPassword(e.target.value)} 
                placeholder="管理员密码"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="flex gap-2 mb-4">
            <motion.button
              onClick={() => setShowArchiveModal(true)}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-medium flex items-center gap-2 disabled:opacity-50"
              whileTap={{ scale: 0.95 }}
              disabled={!adminPassword}
            >
              <FaCompress className="text-sm" />
              创建归档
            </motion.button>
            <motion.button
              onClick={loadArchives}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-medium flex items-center gap-2"
              whileTap={{ scale: 0.95 }}
              disabled={isLoadingArchives}
            >
              <FaSync className={`text-sm ${isLoadingArchives ? 'animate-spin' : ''}`} />
              刷新列表
            </motion.button>
          </div>
          
          <div className="bg-purple-100 border border-purple-200 rounded-lg p-3 mb-4">
            <div className="text-sm text-purple-800 font-medium mb-1">📦 归档功能说明</div>
            <div className="text-xs text-purple-600 space-y-1">
              <div>• <strong>压缩存储：</strong>自动使用gzip压缩，节省存储空间</div>
              <div>• <strong>IPFS上传：</strong>压缩文件自动上传到IPFS分布式存储</div>
              <div>• <strong>本地清理：</strong>上传成功后自动删除本地压缩文件</div>
              <div>• <strong>模式匹配：</strong>支持正则表达式过滤文件</div>
            </div>
          </div>

          {/* 归档列表 */}
          <div className="space-y-3">
            {isLoadingArchives ? (
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-2 text-gray-600">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  加载归档列表中...
                </div>
              </div>
            ) : archives.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                暂无归档记录
              </div>
            ) : (
              archives.map((archive, idx) => (
                <motion.div
                  key={archive.archiveName}
                  className="bg-white border border-gray-200 rounded-lg p-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 * idx }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FaArchive className="text-purple-500" />
                        <span className="font-semibold text-gray-800">{archive.archiveName}</span>
                        {archive.ipfsUpload?.enabled && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                            <FaCloud className="text-xs" />
                            IPFS已上传
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">创建时间</span>
                          <span className="text-sm text-gray-600">{new Date(archive.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">创建者</span>
                          <span className="text-sm text-gray-600">{archive.createdBy}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">文件数量</span>
                          <span className="text-sm text-gray-600">{archive.totalFiles}</span>
                        </div>
                        {archive.databaseLogsIncluded !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">数据库日志</span>
                            <span className="text-sm text-blue-600">{archive.databaseLogsIncluded}</span>
                          </div>
                        )}
                        {archive.fileSystemLogsIncluded !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">文件系统日志</span>
                            <span className="text-sm text-purple-600">{archive.fileSystemLogsIncluded}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">原始大小</span>
                          <span className="text-sm text-gray-600">{formatFileSize(archive.originalTotalSize)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">压缩后大小</span>
                          <span className="text-sm text-gray-600">{formatFileSize(archive.compressedTotalSize)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">压缩率</span>
                          <span className="text-sm text-green-600 font-medium">{archive.overallCompressionRatio}</span>
                        </div>
                        {archive.ipfsUpload && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">IPFS上传</span>
                              <span className={`text-sm font-medium ${archive.ipfsUpload.uploadedFiles > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {archive.ipfsUpload.uploadedFiles}/{archive.ipfsUpload.totalFiles}
                              </span>
                            </div>
                            {archive.ipfsUpload.uploadResults && archive.ipfsUpload.uploadResults.length > 0 && archive.ipfsUpload.uploadResults[0].uploadSuccess && (
                              <>
                                <div className="pt-2 border-t border-gray-200">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-700">IPFS CID</span>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(archive.ipfsUpload.uploadResults[0].ipfsCid)}
                                      className="text-xs text-blue-600 hover:text-blue-800 font-mono bg-blue-50 px-2 py-1 rounded"
                                      title="点击复制CID"
                                    >
                                      {archive.ipfsUpload.uploadResults[0].ipfsCid?.substring(0, 20)}...
                                    </button>
                                  </div>
                                  <div className="flex flex-col space-y-1">
                                    <a
                                      href={archive.ipfsUpload.uploadResults[0].web2Url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-green-600 hover:text-green-800 underline flex items-center gap-1"
                                    >
                                      <FaCloud className="w-3 h-3" />
                                      Web2 下载链接
                                    </a>
                                    <a
                                      href={archive.ipfsUpload.uploadResults[0].ipfsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-purple-600 hover:text-purple-800 underline flex items-center gap-1"
                                    >
                                      <FaLink className="w-3 h-3" />
                                      IPFS 协议链接
                                    </a>
                                  </div>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <motion.button
                      onClick={() => handleDeleteArchive(archive.archiveName)}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm"
                      whileTap={{ scale: 0.95 }}
                    >
                      <FaTrash className="text-xs" />
                    </motion.button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* 创建归档弹窗 */}
        <AnimatePresence>
          {showArchiveModal && (
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white w-full max-w-lg rounded-xl shadow-xl p-6 border border-gray-200"
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <FaArchive className="text-purple-500" />
                    创建日志归档
                  </h3>
                  <button 
                    className="text-gray-400 hover:text-gray-600" 
                    onClick={() => setShowArchiveModal(false)}
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      归档名称（可选）
                    </label>
                    <input
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                      placeholder="留空将自动生成时间戳名称"
                      value={archiveName}
                      onChange={(e) => setArchiveName(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      包含模式（正则表达式，可选）
                    </label>
                    <input
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                      placeholder="例如: \.log$ 只包含.log文件"
                      value={includePattern}
                      onChange={(e) => setIncludePattern(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      排除模式（正则表达式，可选）
                    </label>
                    <input
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                      placeholder="例如: temp 排除包含temp的文件"
                      value={excludePattern}
                      onChange={(e) => setExcludePattern(e.target.value)}
                    />
                  </div>
                  
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="text-sm text-purple-800 font-medium mb-1">🔄 归档流程</div>
                    <div className="text-xs text-purple-600 space-y-1">
                      <div>1. 扫描日志目录中的文件</div>
                      <div>2. 根据模式过滤文件</div>
                      <div>3. 使用gzip压缩文件</div>
                      <div>4. 上传压缩文件到IPFS</div>
                      <div>5. 删除本地压缩文件</div>
                      <div>6. 保存归档元数据</div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowArchiveModal(false)}
                    disabled={archiveLoading}
                  >
                    取消
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50"
                    onClick={handleCreateArchive}
                    disabled={archiveLoading || !adminPassword}
                  >
                    {archiveLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        创建中...
                      </>
                    ) : (
                      <>
                        <FaCompress className="text-sm" />
                        创建归档
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 编辑元数据弹窗 */}
        <AnimatePresence>
          {editingLog && (
            <motion.div 
              className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div 
                className="bg-white w-full max-w-lg rounded-xl shadow-xl p-6 border border-gray-200"
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">编辑日志元数据</h3>
                  <button className="text-gray-400 hover:text-gray-600" onClick={() => { setEditingLog(null); setEditFileName(''); setEditNote(''); }}>✕</button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">文件名（可选）</label>
                    <input 
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                      placeholder="例如：error-2025-08-10.txt"
                      value={editFileName}
                      onChange={(e) => setEditFileName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">备注（可选）</label>
                    <textarea 
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all min-h-[100px]"
                      placeholder="补充说明、标签等"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-end gap-3">
                  <button 
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                    onClick={() => { setEditingLog(null); setEditFileName(''); setEditNote(''); }}
                  >
                    取消
                  </button>
                  <button 
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    onClick={handleEditSave}
                  >
                    保存
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 全局提示 */}
        {/* 所有提示已用 setNotification 全局弹窗替换 */}
      </motion.div>
    </>
  );
};

export default LogShare;
