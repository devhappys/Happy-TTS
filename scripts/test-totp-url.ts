import { TOTPService } from '../src/services/totpService';

/**
 * 测试TOTP otpauth URL格式
 */
function testOTPAuthURL() {
    console.log('🧪 测试TOTP otpauth URL格式...\n');

    const testCases = [
        { username: 'testuser', serviceName: 'Happy TTS' },
        { username: 'user_with_underscore', serviceName: 'Test Service' },
        { username: 'user@domain.com', serviceName: 'Service with Spaces' },
        { username: '中文用户', serviceName: '中文服务' }
    ];

    testCases.forEach((testCase, index) => {
        console.log(`📋 测试用例 ${index + 1}:`);
        console.log(`   用户名: ${testCase.username}`);
        console.log(`   服务名: ${testCase.serviceName}`);
        
        try {
            // 生成密钥
            const secret = TOTPService.generateSecret(testCase.username, testCase.serviceName);
            console.log(`   🔑 密钥: ${secret}`);
            
            // 生成otpauth URL
            const otpauthUrl = TOTPService.generateOTPAuthURL(secret, testCase.username, testCase.serviceName);
            console.log(`   🔗 otpauth URL: ${otpauthUrl}`);
            
            // 验证URL格式
            const urlPattern = /^otpauth:\/\/totp\/([^:]+):([^?]+)\?secret=([^&]+)&issuer=([^&]+)&algorithm=([^&]+)&digits=(\d+)&period=(\d+)$/;
            const match = otpauthUrl.match(urlPattern);
            
            if (match) {
                console.log(`   ✅ URL格式正确`);
                console.log(`      - 发行者: ${decodeURIComponent(match[1])}`);
                console.log(`      - 账户名: ${decodeURIComponent(match[2])}`);
                console.log(`      - 密钥: ${match[3]}`);
                console.log(`      - 发行者参数: ${decodeURIComponent(match[4])}`);
                console.log(`      - 算法: ${match[5]}`);
                console.log(`      - 位数: ${match[6]}`);
                console.log(`      - 周期: ${match[7]}秒`);
            } else {
                console.log(`   ❌ URL格式错误`);
                console.log(`   🔍 实际URL: ${otpauthUrl}`);
            }
            
            // 验证必要参数
            const requiredParams = ['secret', 'issuer', 'algorithm', 'digits', 'period'];
            const missingParams = requiredParams.filter(param => !otpauthUrl.includes(`${param}=`));
            
            if (missingParams.length === 0) {
                console.log(`   ✅ 包含所有必要参数`);
            } else {
                console.log(`   ❌ 缺少参数: ${missingParams.join(', ')}`);
            }
            
        } catch (error) {
            console.log(`   ❌ 生成失败: ${error}`);
        }
        
        console.log('');
    });

    console.log('🎯 测试完成！');
}

// 运行测试
testOTPAuthURL(); 