// server/services/momoPreorder.service.js
import crypto from "crypto";
import https from "https";
import Preorder from "../models/preorder.model.js";

/* =========================
 * CONFIG (ưu tiên .env nếu có)
 * ========================= */
const partnerCode = process.env.MOMO_PARTNER_CODE || "MOMO";
const accessKey   = process.env.MOMO_ACCESS_KEY   || "F8BBA842ECF85";
const secretKey   = process.env.MOMO_SECRET_KEY   || "K951B6PE1waDMi640xX08PD3vg6EkVlz";

/** FE sẽ về trang này sau khi user thanh toán xong (không quyết định đổi trạng thái).
 *  Trạng thái phải dựa vào IPN server→server.
 */
const redirectUrl =
  process.env.MOMO_PREORDER_REDIRECT_URL ||
  "http://localhost:5173/preorder-success";

/**  PHẢI KHỚP VỚI ROUTE:
 * server/routes/momoPreorder.route.js → router.post("/ipn", handlePreorderIPN)
 * và index.js mount: app.use("/api/momo-preorder", momoPreorderRoutes)
 * => IPN đầy đủ: http://localhost:3000/api/momo-preorder/ipn
 */
const ipnUrl =
  process.env.MOMO_PREORDER_IPN_URL ||
  "http://localhost:3000/api/momo-preorder/ipn";

/* =========================
 * Helpers
 * ========================= */
function b64(obj) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

/**
 * Ký request "create payment" (MoMo v2)
 * rawSignature format:
 * accessKey=...&amount=...&extraData=...&ipnUrl=...&orderId=...&orderInfo=...&partnerCode=...&redirectUrl=...&requestId=...&requestType=...
 */
function signCreate({ amount, extraData, orderId, orderInfo, requestId, requestType }) {
  const raw =
    `accessKey=${accessKey}` +
    `&amount=${amount}` +
    `&extraData=${extraData}` +
    `&ipnUrl=${ipnUrl}` +                 //  dùng đúng ipnUrl
    `&orderId=${orderId}` +
    `&orderInfo=${orderInfo}` +
    `&partnerCode=${partnerCode}` +
    `&redirectUrl=${redirectUrl}` +
    `&requestId=${requestId}` +
    `&requestType=${requestType}`;
  return crypto.createHmac("sha256", secretKey).update(raw).digest("hex");
}

/* =========================================================
 * 1) Tạo giao dịch MoMo cho PREORDER (deposit/remaining)
 * ========================================================= */
export async function createMomoPaymentForPreorder(preorder, kind = "deposit") {
  if (!preorder) throw new Error("Thiếu preorder");

  await preorder.populate({ path: "product", select: "name" });

  const amount =
    kind === "deposit"
      ? Math.max(0, Number(preorder.depositDue || 0) - Number(preorder.depositPaid || 0))
      : Math.max(0, Number(preorder.remainingDue || 0));

  if (!amount || amount <= 0) {
    throw new Error(kind === "deposit" ? "Không còn số tiền cọc cần thanh toán" : "Không còn số tiền cần thanh toán");
  }

  // Chặn theo trạng thái
  if (kind === "deposit") {
    const canDeposit = ["pending_payment", "reserved", "awaiting_stock", "payment_due", "ready_to_fulfill"].includes(preorder.status);
    if (!canDeposit) throw new Error("Trạng thái hiện tại không cho phép thanh toán cọc");
  } else {
    const canPayRemaining = ["ready_to_fulfill", "payment_due"].includes(preorder.status);
    if (!canPayRemaining) throw new Error("Chưa đến thời điểm thanh toán phần còn lại");
  }

  const requestId   = `${partnerCode}${Date.now()}`;
  const orderId     = `PREORDER-${preorder._id}-${Date.now()}`;
  const orderInfo   =
    kind === "deposit"
      ? `Thanh toán TIỀN CỌC preorder ${preorder.customId || preorder._id}`
      : `Thanh toán PHẦN CÒN LẠI preorder ${preorder.customId || preorder._id}`;
  const requestType = "payWithMethod";

  // extraData để IPN biết preorderId & loại thanh toán
  const extraData = b64({ preorderId: String(preorder._id), kind });

  const signature = signCreate({
    amount: String(amount),
    extraData,
    orderId,
    orderInfo,
    requestId,
    requestType,
  });

  const payload = JSON.stringify({
    partnerCode,
    partnerName: "MoMo Payment",
    storeId: "FreshFruitStore",
    requestId,
    amount: String(amount),
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,       //  chính xác
    lang: "vi",
    requestType,
    signature,
    extraData,
  });

  const options = {
    hostname: "test-payment.momo.vn",
    path: "/v2/gateway/api/create",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      res.setEncoding("utf8");
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (data && data.payUrl) {
            resolve({ payUrl: data.payUrl, amount });
          } else {
            reject(new Error(`MoMo không trả payUrl: ${body}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", (e) => reject(e));
    req.write(payload);
    req.end();
  });
}

/* =========================================================
 * 2) Verify chữ ký IPN (MoMo v2)
 * ========================================================= */
export function verifyMomoIpnSignature(payload) {
  const sig = payload?.signature;
  if (!sig) return false;

  const keys1 = [
    "accessKey","amount","extraData","message","orderId","orderInfo",
    "orderType","partnerCode","payType","requestId","responseTime","resultCode","transId",
  ];
  const raw1 = keys1
    .filter((k) => payload[k] !== undefined && payload[k] !== null)
    .map((k) => `${k}=${payload[k]}`)
    .join("&");
  const sign1 = crypto.createHmac("sha256", secretKey).update(raw1).digest("hex");
  if (sig === sign1) return true;

  const keys2 = [
    "accessKey","amount","extraData","orderId","orderInfo",
    "orderType","partnerCode","requestId","responseTime","resultCode","transId",
  ];
  const raw2 = keys2
    .filter((k) => payload[k] !== undefined && payload[k] !== null)
    .map((k) => `${k}=${payload[k]}`)
    .join("&");
  const sign2 = crypto.createHmac("sha256", secretKey).update(raw2).digest("hex");
  if (sig === sign2) return true;

  return false;
}

export default {
  createMomoPaymentForPreorder,
  verifyMomoIpnSignature,
};
