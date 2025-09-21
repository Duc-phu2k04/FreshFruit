// index.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

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

// Shipping routes
import shippingRoutes from "./src/routes/shipping.routes.js";

// Chatbot (HYBRID)
import { fruitbotRouter } from "./src/routes/fruitbot.route.js";

// Preorder routes
import preorderRouter from "./src/routes/preorder.route.js";
import momoPreorderRoutes from "./src/routes/momoPreorder.route.js";

// ✅ NEW from staging: Statistics routes
import statisticsRoute from "./src/routes/statistics.route.js";

dotenv.config();

const app = express();

// ====== Middlewares ======
app.use(cors());

// Tăng giới hạn body để tránh 413 khi upload ảnh base64 (có thể chỉnh qua ENV)
const BODY_LIMIT = process.env.BODY_LIMIT || "25mb";
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT, parameterLimit: 100000 }));

// (Tuỳ chọn) handler gọn cho lỗi entity too large
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      ok: false,
      message: `Payload quá lớn. Vui lòng giảm dung lượng ảnh hoặc tăng BODY_LIMIT (hiện tại ${BODY_LIMIT}).`,
    });
  }
  next(err);
});

// ====== Test route ======
app.get("/", (req, res) => {
  res.send("API is working");
});

// ====== Routes ======
app.use("/auth", authRoutes);

// Giữ mount cũ (singular) để backward compatible
app.use("/api/product", productRoutes);

// Thêm alias plural để FE gọi /api/products ...
app.use("/api/products", productRoutes);

app.use("/api/category", categoryRoutes);
app.use("/api/locations", locationRoute);
app.use("/api/cart", cartRoute);
app.use("/api/orders", orderRoute);
app.use("/api/review", reviewRoute);
app.use("/api/voucher", voucherRoutes);
app.use("/api/momo", momoRoutes);
app.use("/api/upload", uploadRoute);
app.use("/api/address", addressRoute);
app.use("/api/momo-preorder", momoPreorderRoutes); // đơn đặt trước

// Shipping
app.use("/api", shippingRoutes);

// Chatbot
app.use("/api/fruitbot", fruitbotRouter);

// Preorder
app.use("/api/preorders", preorderRouter);

// ✅ Statistics (mới từ staging)
app.use("/api/statistics", statisticsRoute);

// Static file route
app.use("/images", express.static("public/images"));

// (Tuỳ chọn) 404 chung
app.use((req, res) => res.status(404).json({ ok: false, message: "Not Found" }));

// ====== Mongo & Server ======
const PORT = Number(process.env.PORT || 3000);
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/freshfruit";
const DB_NAME = process.env.DB_NAME || undefined;

async function start() {
  try {
    await mongoose.connect(MONGO_URI, DB_NAME ? { dbName: DB_NAME } : undefined);
    console.log("Connected to MongoDB");
    app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

start();
