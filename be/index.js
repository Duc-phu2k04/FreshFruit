// index.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

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

// nếu chạy sau proxy (nginx, fly, render, heroku...) để req.protocol/host đúng
app.set("trust proxy", 1);

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

// 404 chung
app.use((req, res) => res.status(404).json({ ok: false, message: "Not Found" }));

/* ===================== Mongo & Server ===================== */
async function start() {
  try {
    await mongoose.connect(MONGO_URI, DB_NAME ? { dbName: DB_NAME } : undefined);
    console.log("Connected to MongoDB");
    app.listen(PORT, () =>
      console.log(`Server is running at http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}
start();
