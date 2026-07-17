import express from "express";
import type { NextFunction, Request, Response } from "express";
import { ticketController } from "../controllers/ticketController";
import { authenticateToken } from "../middleware/authenticateToken";
import { ticketAdminLimiter, ticketReadLimiter, ticketWriteLimiter } from "../middleware/routeLimiters";
import { createLimiter } from "../middleware/routeLimiters";

const router = express.Router();

const codeqlAuthLimiter = createLimiter({
  name: "codeqlAuthLimiter",
  profile: "auth",
  category: "auth",
  message: "请求过于频繁，请稍后再试",
});


// 所有工单接口都需要登录
router.use(authenticateToken);

// 管理员接口 (在 controller 内部已有角色检查，但为了安全建议在此处也加上)
const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ error: "需要管理员权限" });
  }
};

router.get("/admin/all", ticketAdminLimiter, adminOnly, ticketController.getAllTickets);
router.patch("/admin/:id/status", ticketAdminLimiter, adminOnly, ticketController.updateTicketStatus);
router.put("/admin/:id/messages/:messageIndex", ticketAdminLimiter, adminOnly, ticketController.adminEditMessage);
router.delete("/admin/:id/messages/:messageIndex", ticketAdminLimiter, adminOnly, ticketController.adminDeleteMessage);

// 用户接口
router.post("/", ticketWriteLimiter, ticketController.createTicket);
router.get("/", ticketReadLimiter, ticketController.getUserTickets);
router.get("/:id", ticketReadLimiter, ticketController.getTicketById);
router.post("/:id/messages", ticketWriteLimiter, ticketController.replyToTicket);

export default router;
