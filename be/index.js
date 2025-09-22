// index.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// ===== Routes =====
import authRoutes from "./src/routes/auth.route.js";
import productRoutes from "./src/routes/product.route.js";
import categoryRoutes from "./src/routes/category.route.js";
import locationRoute from "./src/routes/location.route.js";
import cartRoute from "./src/routes/cart.route.js";
import orderRoute from "./src/routes/order.route.js";
import reviewRoute from "./src/routes/review.route.js";
import voucherRoutes from "./src/routes/voucher.route.js";
import momoRoutes from "./src/routes/momo.route.js";
import uploadRoute from "./src/routes/upload.route.js";
import addressRoute from "./src/routes/address.route.js";
import shippingRoutes from "./src/routes/shipping.routes.js";
import { fruitbotRouter } from "./src/routes/fruitbot.route.js";
import preorderRouter from "./src/routes/preorder.route.js";
import momoPreorderRoutes from "./src/routes/momoPreorder.route.js";
// ✅ NEW (staging)
import statisticsRoute from "./src/routes/statistics.route.js";


dotenv.config();

const app = express();

/* ===================== Base Config ===================== */
const PORT = Number(process.env.PORT || 3000);
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/freshfruit";
const DB_NAME = process.env.DB_NAME || undefined;
const BODY_LIMIT = process.env.BODY_LIMIT || "25mb";
const LOG_ERRORS_TO_FILE = String(process.env.LOG_ERRORS_TO_FILE || "0") === "1";

// nếu chạy sau proxy (nginx, fly, render, heroku...) để req.protocol/host đúng
app.set("trust proxy", 1);

/* ===================== Logger Helpers ===================== */
function ensureLogsDir() {
  const dir = path.resolve(process.cwd(), "logs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function logErrorToFile(errObj) {
  try {
    if (!LOG_ERRORS_TO_FILE) return;
    const dir = ensureLogsDir();
    const file = path.join(dir, `errors-${new Date().toISOString().slice(0, 10)}.log`);
    fs.appendFileSync(file, JSON.stringify(errObj) + "\n");
  } catch (e) {
    // nếu ghi file lỗi, bỏ qua để không ảnh hưởng luồng
    console.warn("[LOG][file-append-failed]", e?.message || e);
  }
}

/* ===================== Simple Request Logger ===================== */
// Không dùng morgan để tránh thêm dependency
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  const rid = Math.random().toString(36).slice(2, 10);
  req.id = rid;

  res.on("finish", () => {
    try {
      const end = process.hrtime.bigint();
      const ms = Number(end - start) / 1e6;
      const logLine = {
        ts: new Date().toISOString(),
        reqId: rid,
        method: req.method,
        url: req.originalUrl || req.url,
        status: res.statusCode,
        ms: Math.round(ms),
        ip:
          (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
          req.socket?.remoteAddress ||
          "",
      };
      console.log("[REQ]", JSON.stringify(logLine));
    } catch {}
  });

  next();
});

/* ===================== CORS ===================== */
// Cho phép FE gọi kèm Authorization header
const ALLOW_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Nếu không set CORS_ORIGINS, mặc định: cho tất cả (giống behavior cũ)
app.use(
  cors({
    origin: ALLOW_ORIGINS.length ? ALLOW_ORIGINS : true,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86400,
  })
);

/* ===================== Body Parsers ===================== */
// NỚI GIỚI HẠN BODY để tránh 413 khi gửi ảnh base64 (đổi qua ENV nếu muốn)
app.use(express.json({ limit: BODY_LIMIT }));
app.use(
  express.urlencoded({
    extended: true,
    limit: BODY_LIMIT,
    parameterLimit: 100000,
  })
);

// Handler gọn cho lỗi entity too large (đặt sau body parsers)
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    const info = {
      ts: new Date().toISOString(),
      reqId: req.id,
      route: req.originalUrl || req.url,
      msg: `Payload quá lớn`,
      limit: BODY_LIMIT,
    };
    console.error("[BODY_LIMIT]", info);
    logErrorToFile({ level: "warn", ...info });
    return res.status(413).json({
      ok: false,
      message: `Payload quá lớn. Vui lòng giảm dung lượng ảnh hoặc tăng BODY_LIMIT (hiện tại ${BODY_LIMIT}).`,
    });
  }
  return next(err);
});

/* ===================== Health Check ===================== */
app.get("/", (req, res) => {
  res.send("API is working");
});

/* ===================== Static Files ===================== */
/** Ảnh sản phẩm legacy trong public/images → GET /images/filename.jpg */
app.use("/images", express.static("public/images", { maxAge: "7d", etag: true }));

/** Uploads (đổi/trả, v.v.) trong ./uploads → GET /uploads/xxx */
const uploadsDir = path.resolve(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsDir, { maxAge: "7d", etag: true }));

/* ===================== Routes ===================== */
app.use("/auth", authRoutes);

// Giữ mount cũ (singular) để backward compatible + alias plural
app.use("/api/product", productRoutes);
app.use("/api/products", productRoutes);

app.use("/api/category", categoryRoutes);
app.use("/api/locations", locationRoute);
app.use("/api/cart", cartRoute);

// ✅ Đơn hàng: mount cả singular & plural để không vỡ luồng cũ
app.use("/api/order", orderRoute);   // legacy base
app.use("/api/orders", orderRoute);  // recommended base

app.use("/api/review", reviewRoute);
app.use("/api/voucher", voucherRoutes);
app.use("/api/momo", momoRoutes);
app.use("/api/upload", uploadRoute);
app.use("/api/address", addressRoute);
app.use("/api/momo-preorder", momoPreorderRoutes);

// Shipping
app.use("/api", shippingRoutes);

// Chatbot
app.use("/api/fruitbot", fruitbotRouter);

// Preorder
app.use("/api/preorders", preorderRouter);

// ✅ Statistics (từ staging)
app.use("/api/statistics", statisticsRoute);





/* ===================== 404 chung ===================== */
app.use((req, res) => {
  const info = {
    ts: new Date().toISOString(),
    reqId: req.id,
    method: req.method,
    url: req.originalUrl || req.url,
  };
  console.warn("[404]", info);
  res.status(404).json({ ok: false, message: "Not Found" });
});

/* ===================== Global Error Handler ===================== */
// Đặt cuối cùng để bắt mọi lỗi từ các route trước đó
app.use((err, req, res, _next) => {
  const payload = {
    ts: new Date().toISOString(),
    reqId: req?.id,
    method: req?.method,
    url: req?.originalUrl || req?.url,
    status: err?.status || 500,
    name: err?.name,
    message: err?.message,
    stack: process.env.NODE_ENV === "production" ? undefined : err?.stack,
    // log nhẹ body để debug (không log password/token)
    bodyKeys: req?.body ? Object.keys(req.body) : [],
    query: req?.query || {},
  };

  console.error("[ERROR]", payload);
  logErrorToFile({ level: "error", ...payload });

  res.status(payload.status).json({
    ok: false,
    message: payload.message || "Internal Server Error",
  });
});

/* ===================== Mongo & Server ===================== */
async function start() {
  try {
    // Log nhanh cấu hình VNPay để phát hiện lỗi thiếu env
    const vnpCfg = {
      VNP_TMNCODE: !!process.env.VNP_TMNCODE,
      VNP_HASHSECRET: !!process.env.VNP_HASHSECRET,
      VNP_URL: !!process.env.VNP_URL,
      VNP_RETURNURL: !!process.env.VNP_RETURNURL,
      VNP_IPNURL: !!process.env.VNP_IPNURL, // optional
    };
    console.log("[BOOT] VNPay config present:", vnpCfg);

    await mongoose.connect(MONGO_URI, DB_NAME ? { dbName: DB_NAME } : undefined);
    console.log("Connected to MongoDB");

    app.listen(PORT, () =>
      console.log(`Server is running at http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error("MongoDB connection error:", err);
    logErrorToFile({
      level: "fatal",
      ts: new Date().toISOString(),
      message: err?.message,
      stack: err?.stack,
    });
    process.exit(1);
  }
}

/* ===================== Process-level Safety Nets ===================== */
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  logErrorToFile({
    level: "fatal",
    ts: new Date().toISOString(),
    type: "uncaughtException",
    message: err?.message,
    stack: err?.stack,
  });
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
  logErrorToFile({
    level: "fatal",
    ts: new Date().toISOString(),
    type: "unhandledRejection",
    reason:
      reason instanceof Error
        ? { message: reason.message, stack: reason.stack }
        : reason,
  });
});

start();
