import { Router, Request, Response } from 'express';
import { TOTPController } from '../controllers/totpController';

const router = Router();

// 生成TOTP设置信息
router.post('/generate-setup', async (req: Request, res: Response) => {
  await TOTPController.generateSetup(req, res);
});

// 验证并启用TOTP
router.post('/verify-and-enable', async (req: Request, res: Response) => {
  await TOTPController.verifyAndEnable(req, res);
});

// 验证TOTP令牌
router.post('/verify-token', async (req: Request, res: Response) => {
  await TOTPController.verifyToken(req, res);
});

// 禁用TOTP
router.post('/disable', async (req: Request, res: Response) => {
  await TOTPController.disable(req, res);
});

// 获取TOTP状态
router.get('/status', async (req: Request, res: Response) => {
  await TOTPController.getStatus(req, res);
});

// 获取备用恢复码
router.get('/backup-codes', async (req: Request, res: Response) => {
  await TOTPController.getBackupCodes(req, res);
});

// 重新生成备用恢复码
router.post('/regenerate-backup-codes', async (req: Request, res: Response) => {
  await TOTPController.regenerateBackupCodes(req, res);
});

export default router; 