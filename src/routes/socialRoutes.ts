import { Router } from "express";
import { SocialController } from "../controllers/socialController";
import { apiKeyAuth } from "../middleware/apiKeyAuth";
import { createLimiter } from "../middleware/routeLimiters";

const router = Router();

const codeqlAuthLimiter = createLimiter({
  name: "codeqlAuthLimiter",
  profile: "auth",
  category: "auth",
  message: "请求过于频繁，请稍后再试",
});


router.use(apiKeyAuth("social"));

/**
 * @route GET /api/social/weibo-hot
 * @desc 微博热搜
 * @access Public
 */
router.get("/weibo-hot", SocialController.weiboHot);

/**
 * @route GET /api/social/baidu-hot
 * @desc 百度热搜
 * @access Public
 */
router.get("/baidu-hot", SocialController.baiduHot);

export default router;
