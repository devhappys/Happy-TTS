import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { reportFingerprintOnce } from '../../src/utils/fingerprint';

// 获取API基础URL
const getApiBaseUrl = () => {
    // 检查是否为开发环境
    const isDev = process.env.NODE_ENV === 'development' || 
                  window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1' ||
                  window.location.port === '6000' ||
                  window.location.port === '3001';
    
    if (isDev) {
        // 在开发环境下，根据当前访问的URL自动切换后端地址
        const currentHost = window.location.hostname;
        const currentPort = window.location.port;
        
        // 如果访问的是文档站点端口，后端地址指向API服务器
        if (currentHost === '192.168.10.7' && (currentPort === '6000' || currentPort === '3001')) {
            return 'http://192.168.10.7:3000';
        }
        
        // 如果是本地文档站点，指向本地API服务器
        if ((currentHost === 'localhost' || currentHost === '127.0.0.1') && 
            (currentPort === '6000' || currentPort === '3001')) {
            return 'http://localhost:3000';
        }
        
        // 默认本地开发地址
        return 'http://localhost:3000';
    }
    
    // 生产环境
    const apiUrl = process.env.VITE_API_URL || 
                   (typeof window !== 'undefined' && (window as any).VITE_API_URL);
    
    return apiUrl || 'https://api.hapxs.com';
};

// 延迟函数
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// 重试配置
const RETRY_DELAY = 2000; // 2秒
const MAX_RETRIES = 1; // 最多重试1次（总共尝试2次）

// 创建 axios 实例
export const api: AxiosInstance = axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // 发送跨域凭据（Cookie），用于管理员会话与游客 Cookie
});

// 请求拦截器：添加 token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// 响应拦截器：处理错误和重试
api.interceptors.response.use(
    (response) => {
        try {
            const flag = response.headers?.['x-require-fingerprint'] || response.headers?.['X-Require-Fingerprint'];
            if (flag === '1') {
                // 异步触发上报（不阻塞当前请求）
                reportFingerprintOnce();
            }
        } catch { }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        
        try {
            const flag = error?.response?.headers?.['x-require-fingerprint'] || error?.response?.headers?.['X-Require-Fingerprint'];
            if (flag === '1') {
                reportFingerprintOnce();
            }
        } catch { }

        // 处理 401 错误（未授权）
        if (error.response?.status === 401) {
            // 检查当前是否在 /librechat 路由下
            // 避免在 /welcome 路由下重复重定向
            if (
                !window.location.pathname.startsWith('/librechat') &&
                window.location.pathname !== '/welcome'
            ) {
                localStorage.removeItem('token');
                window.location.href = '/welcome';
            }
            // /librechat 或 /welcome 路由下不做跳转
            return Promise.reject(error);
        }

        // 重试逻辑：只对网络错误或服务器错误进行重试
        const shouldRetry = (
            // 网络错误（没有响应）
            !error.response ||
            // 服务器错误（5xx）
            (error.response.status >= 500 && error.response.status < 600) ||
            // 请求超时
            error.code === 'ECONNABORTED' ||
            // 网络错误
            error.code === 'NETWORK_ERROR' ||
            error.message === 'Network Error'
        );

        // 检查是否应该重试且还没有重试过
        if (shouldRetry && !originalRequest._retry && !originalRequest._retryCount) {
            originalRequest._retry = true;
            originalRequest._retryCount = 1;

            console.log(`🔄 API请求失败，${RETRY_DELAY / 1000}秒后重试:`, {
                url: originalRequest.url,
                method: originalRequest.method,
                error: error.message,
                status: error.response?.status,
                attempt: 1
            });

            try {
                // 等待指定时间后重试
                await delay(RETRY_DELAY);
                
                console.log(`🔄 开始重试API请求:`, {
                    url: originalRequest.url,
                    method: originalRequest.method,
                    attempt: 2
                });

                // 重新发送请求
                return api(originalRequest);
            } catch (retryError) {
                console.error(`❌ API请求重试失败，不再尝试:`, {
                    url: originalRequest.url,
                    method: originalRequest.method,
                    originalError: error.message,
                    retryError: retryError instanceof Error ? retryError.message : retryError,
                    totalAttempts: 2
                });
                
                // 重试失败，返回原始错误
                return Promise.reject(error);
            }
        }

        // 不符合重试条件或已经重试过，直接返回错误
        if (originalRequest._retryCount) {
            console.error(`❌ API请求最终失败:`, {
                url: originalRequest.url,
                method: originalRequest.method,
                error: error.message,
                status: error.response?.status,
                totalAttempts: originalRequest._retryCount + 1
            });
        }

        return Promise.reject(error);
    }
);

// 创建带有重试功能的 API 方法
export const apiWithRetry = {
    get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
        return api.get<T>(url, config);
    },
    
    post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
        return api.post<T>(url, data, config);
    },
    
    put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
        return api.put<T>(url, data, config);
    },
    
    delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
        return api.delete<T>(url, config);
    },
    
    patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
        return api.patch<T>(url, data, config);
    }
};

// 获取认证token
export const getAuthToken = (): string | null => {
    return localStorage.getItem('token');
};

export { getApiBaseUrl };
export default api;