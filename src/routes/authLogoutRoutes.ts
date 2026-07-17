import { Router } from "express";
import { logoutHandler } from "../controllers/authController";
import { createLimiter } from "../middleware/routeLimiters";

const router = Router();

const codeqlAuthLimiter = createLimiter({
  name: "codeqlAuthLimiter",
  profile: "auth",
  category: "auth",
  message: "请求过于频繁，请稍后再试",
});


router.post("/", logoutHandler);

export default router;

