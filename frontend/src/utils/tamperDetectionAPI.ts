/**
 * 篡改检测系统前端API
 * 提供简单易用的接口供开发者和用户手动触发篡改检测
 */

import { integrityChecker } from './integrityCheck';
import { getApiBaseUrl } from '../api/api';

// 将API挂载到全局window对象，方便在控制台中使用
declare global {
  interface Window {
    TamperDetection: typeof TamperDetectionAPI;
  }
}

export class TamperDetectionAPI {
  /**
   * 手动触发完整性检查
   * @param options 检查选项
   * @returns Promise<检查结果>
   * 
   * @example
   * // 检查所有内容
   * await TamperDetection.check();
   * 
   * // 只检查DOM
   * await TamperDetection.check({ type: 'dom' });
   * 
   * // 检查特定元素
   * await TamperDetection.check({ type: 'dom', elementId: 'app-header' });
   * 
   * // 强制检查（忽略豁免状态）
   * await TamperDetection.check({ force: true });
   */
  static async check(options: {
    type?: 'all' | 'dom' | 'network' | 'text' | 'baseline';
    elementId?: string;
    force?: boolean;
  } = {}) {
    const { type = 'all', elementId, force = false } = options;
    
    console.log('🔍 开始完整性检查...', options);
    
    const result = await integrityChecker.manualCheck({
      checkType: type,
      elementId,
      forceCheck: force
    });
    
    console.log('✅ 完整性检查完成:', result);
    return result;
  }

  /**
   * 手动报告篡改事件
   * @param eventData 篡改事件数据
   * @returns Promise<报告结果>
   * 
   * @example
   * // 报告DOM篡改
   * await TamperDetection.report({
   *   type: 'dom_modification',
   *   elementId: 'app-header',
   *   original: 'Happy TTS',
   *   tampered: 'Modified Content'
   * });
   * 
   * // 报告网络篡改
   * await TamperDetection.report({
   *   type: 'network_tampering',
   *   original: 'Original Response',
   *   tampered: 'Modified Response'
   * });
   */
  static async report(eventData: {
    type: string;
    elementId?: string;
    original?: string;
    tampered?: string;
    tamperType?: 'dom' | 'network' | 'proxy' | 'injection';
    method?: string;
    info?: Record<string, any>;
  }) {
    console.log('📤 报告篡改事件...', eventData);
    
    const result = await integrityChecker.manualReportTampering({
      eventType: eventData.type,
      elementId: eventData.elementId,
      originalContent: eventData.original,
      tamperContent: eventData.tampered,
      tamperType: eventData.tamperType,
      detectionMethod: eventData.method,
      additionalInfo: eventData.info
    });
    
    console.log(result.success ? '✅ 报告成功:' : '❌ 报告失败:', result.message);
    return result;
  }

  /**
   * 手动触发恢复模式
   * @param options 恢复选项
   * @returns 恢复结果
   * 
   * @example
   * // 软恢复
   * TamperDetection.recover();
   * 
   * // 紧急恢复
   * TamperDetection.recover({ type: 'emergency' });
   * 
   * // 重新捕获基准
   * TamperDetection.recover({ type: 'baseline' });
   */
  static recover(options: {
    type?: 'emergency' | 'soft' | 'baseline';
    showWarning?: boolean;
  } = {}) {
    const { type = 'soft', showWarning = true } = options;
    
    console.log('🔄 触发恢复模式...', options);
    
    const result = integrityChecker.manualRecovery({
      recoveryType: type,
      showWarning
    });
    
    console.log(result.success ? '✅ 恢复成功:' : '❌ 恢复失败:', result.message);
    return result;
  }

  /**
   * 模拟篡改事件（测试用）
   * @param options 模拟选项
   * @returns 模拟结果
   * 
   * @example
   * // 模拟DOM篡改
   * TamperDetection.simulate({ type: 'dom' });
   * 
   * // 模拟网络篡改
   * TamperDetection.simulate({ type: 'network' });
   * 
   * // 模拟代理篡改
   * TamperDetection.simulate({ type: 'proxy' });
   */
  static simulate(options: {
    type: 'dom' | 'network' | 'proxy' | 'injection';
    elementId?: string;
    content?: string;
  }) {
    console.log('🧪 模拟篡改事件...', options);
    
    const result = integrityChecker.simulateTampering({
      tamperType: options.type,
      elementId: options.elementId,
      testContent: options.content
    });
    
    console.log(result.success ? '✅ 模拟成功:' : '❌ 模拟失败:', result.message);
    return result;
  }

  /**
   * 获取系统状态
   * @returns 系统状态信息
   * 
   * @example
   * const status = TamperDetection.status();
   * console.log('系统状态:', status);
   */
  static status() {
    const debugInfo = integrityChecker.getDebugInfo();
    const errorStatus = integrityChecker.getErrorStatus();
    const exemptStatus = integrityChecker.checkExemptStatus();
    
    const status = {
      initialized: debugInfo.isInitialized,
      disabled: integrityChecker.isDisabled(),
      recoveryMode: debugInfo.isInRecoveryMode,
      proxyDetection: debugInfo.proxyDetectionEnabled,
      falsePositives: debugInfo.falsePositiveCount,
      errors: errorStatus,
      exempt: exemptStatus,
      baseline: {
        captured: debugInfo.baselineChecksum !== '',
        checksum: debugInfo.baselineChecksum.substring(0, 16) + '...',
        originalLength: debugInfo.originalContentLength,
        currentLength: debugInfo.currentContentLength
      },
      monitoring: {
        integrityMap: debugInfo.integrityMapSize,
        networkMap: debugInfo.networkIntegrityMapSize
      }
    };
    
    console.log('📊 篡改检测系统状态:', status);
    return status;
  }

  /**
   * 启用调试模式
   * @example
   * TamperDetection.debug(true);  // 启用
   * TamperDetection.debug(false); // 禁用
   */
  static debug(enable: boolean = true) {
    if (enable) {
      integrityChecker.enableDebugMode();
      console.log('🔍 调试模式已启用');
    } else {
      integrityChecker.disableDebugMode();
      console.log('🔍 调试模式已禁用');
    }
  }

  /**
   * 控制系统运行状态
   * @param action 操作类型
   * 
   * @example
   * TamperDetection.control('pause');    // 暂停
   * TamperDetection.control('resume');   // 恢复
   * TamperDetection.control('disable');  // 禁用
   * TamperDetection.control('reset');    // 重置
   */
  static control(action: 'pause' | 'resume' | 'disable' | 'reset' | 'reinit') {
    console.log(`🎛️ 执行系统控制: ${action}`);
    
    switch (action) {
      case 'pause':
        integrityChecker.pause();
        console.log('⏸️ 系统已暂停');
        break;
      case 'resume':
        integrityChecker.resume();
        console.log('▶️ 系统已恢复');
        break;
      case 'disable':
        integrityChecker.disable();
        console.log('🚫 系统已禁用');
        break;
      case 'reset':
        integrityChecker.resetErrors();
        console.log('🔄 错误计数已重置');
        break;
      case 'reinit':
        integrityChecker.reinitialize();
        console.log('🔄 系统已重新初始化');
        break;
      default:
        console.log('❌ 未知操作:', action);
    }
  }

  /**
   * 重新捕获基准内容
   * @example
   * TamperDetection.captureBaseline();
   */
  static captureBaseline() {
    console.log('📸 重新捕获基准内容...');
    integrityChecker.captureBaseline();
    console.log('✅ 基准内容已更新');
  }

  /**
   * 显示帮助信息
   */
  static help() {
    console.log(`
🛡️ 篡改检测系统 API 帮助

📋 基本操作:
  TamperDetection.check()                    - 执行完整性检查
  TamperDetection.status()                   - 查看系统状态
  TamperDetection.debug(true/false)          - 启用/禁用调试模式

🔍 检查功能:
  TamperDetection.check({ type: 'dom' })     - 检查DOM完整性
  TamperDetection.check({ type: 'text' })    - 检查关键文本
  TamperDetection.check({ type: 'network' }) - 检查网络完整性
  TamperDetection.check({ force: true })     - 强制检查

📤 报告功能:
  TamperDetection.report({
    type: 'dom_modification',
    elementId: 'app-header',
    original: 'Happy TTS',
    tampered: 'Modified'
  })

🔄 恢复功能:
  TamperDetection.recover()                  - 软恢复
  TamperDetection.recover({ type: 'emergency' }) - 紧急恢复
  TamperDetection.captureBaseline()          - 重新捕获基准

🧪 测试功能:
  TamperDetection.simulate({ type: 'dom' })  - 模拟DOM篡改
  TamperDetection.simulate({ type: 'proxy' }) - 模拟代理篡改

🎛️ 系统控制:
  TamperDetection.control('pause')           - 暂停系统
  TamperDetection.control('resume')          - 恢复系统
  TamperDetection.control('disable')         - 禁用系统
  TamperDetection.control('reinit')          - 重新初始化

更多信息请查看源码或联系开发者。
    `);
  }
}

// 自动挂载到全局对象
if (typeof window !== 'undefined') {
  window.TamperDetection = TamperDetectionAPI;
  
  // 在控制台显示欢迎信息
  setTimeout(() => {
    if (integrityChecker.getDebugInfo().isInitialized) {
      console.log(`
🛡️ 篡改检测系统已就绪！

快速开始:
  TamperDetection.help()     - 查看帮助
  TamperDetection.status()   - 查看状态
  TamperDetection.check()    - 执行检查

输入 TamperDetection.help() 查看完整API文档。
      `);
    }
  }, 3000);
}

export default TamperDetectionAPI;
