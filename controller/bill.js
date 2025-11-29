const Bill = require("../model/Bill");
const _ = require("lodash");
const asyncHandler = require("../middleware/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");
const qrCode = require("qrcode");
const logger = require("../logger");
const {
  receiptNoGenerator,
  inWords,
  formatDate,
  getAheadTimeWithDate,
} = require("../utils/helper");
const ejs = require("ejs");
const path = require("path");
const ip = require("ip");
const axios = require("axios");

/**
 * Map DB `state` field to the correct EJS template prefix.
 * e.g. "telangana" => "ts"  ->  tsPdf.ejs / tsPage.ejs
 */
function resolveStateTemplateKey(state) {
  if (!state) return "ts"; // safe default

  const s = state.toLowerCase().trim();

  const map = {
    telangana: "ts",
    ts: "ts",

    up: "up",
    "uttar pradesh": "up",

    uk: "uk",
    uttarakhand: "uk",

    rajasthan: "rajasthan",
    punjab: "punjab",
    bihar: "bihar",
    haryana: "haryana",
    jharkhand: "jharkhand",
    maharashtra: "maharashtra",
    tamilnadu: "tamilnadu",
    "tamil nadu": "tamilnadu",
    karnataka: "karnataka",
    "himachal pradesh": "himachalPradesh",
    himachalpradesh: "himachalPradesh",

    as: "as",
    chhattisgarh: "chhattisgarh",
    dd: "dd",
    py: "py",
    sk: "sk",
    tr: "tr",
  };

  return map[s] || "ts";
}

/**
 * Helper for SMS date formatting (same as original logic)
 */
const formatDateMsg = (date, state, type) => {
  if (date) {
    let x = null;
    let time = null;
    time = new Date(date);

    if (["up", "uk", "rajasthan"].includes(state)) {
      if (type !== "createdAt") {
        time.setHours(12);
        time.setMinutes(0);
      }
      time = time.toLocaleTimeString();
      if (type !== "createdAt") {
        if (time.includes("pm")) {
          time = time.replace("pm", "am");
        } else {
          time = time.replace("PM", "AM");
        }
      }
      time = time.replace(/(.*)\D\d+/, "$1").toUpperCase();
      x = `${new Date(date).getDate()}-${new Date(date)
        .toLocaleDateString("default", {
          month: "short",
        })
        .toUpperCase()}-${new Date(date).getFullYear()} ${time}`;
    } else {
      if (type == "to") {
        time.setMinutes(time.getMinutes() - 1);
      }
      time = time.toLocaleTimeString();
      time = time.replace(/(.*)\D\d+/, "$1").toUpperCase();
      x = `${new Date(date).getDate()}-${new Date(date)
        .toLocaleDateString("default", {
          month: "short",
        })
        .toUpperCase()}-${new Date(date).getFullYear()} ${time}`;
    }
    return x;
  } else {
    // fallback current date
    return `${new Date().getDate()}-${new Date().toLocaleDateString("default", {
      month: "short",
    })}-${new Date().getFullYear()} ${new Date().toLocaleTimeString()}`;
  }
};

/**
 * @desc    Get details
 * @route   GET /bill/get-details?vehicleNo=...&state=...
 * (original route comment mentions /:state but your code uses query)
 * @access  Public / protected depending on router
 */
exports.getDetails = asyncHandler(async (req, res, next) => {
  logger.info(
    `member asked detail for ${req.query.vehicleNo} from ${req.params.state} form`
  );
  const detail = await Bill.findOne({ ...req.query }).sort({ createdAt: "-1" });
  if (!detail) {
    return res.status(404).send({
      success: false,
      code: 404,
      message: "No detail found",
    });
  }

  return res.status(200).send({
    success: true,
    code: 200,
    detail,
  });
});

/**
 * @desc    Get PDF
 * @route   GET /bill/:id/pdf
 * @access  Public
 *
 * Layout is kept exactly like original:
 *  - same data keys
 *  - same use of cssFix, host, etc.
 * Only change: QR now encodes a CLEAN /page link, not 192.168... + query params.
 */
exports.getBillInPdfFormat = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const bill = await Bill.findById(id);
  if (!bill) {
    logger.info(`bill not found with this id ${id}`);
    res.status(404);
    return res.render("not-found");
  }
  logger.info(`bill found with this id ${id}`);

  // ✅ Base URL for QR – set APP_BASE_URL to your ngrok/domain.
  // If not set, fallback to LAN IP.
  const baseUrl =
    process.env.APP_BASE_URL ||
    `http://${ip.address()}:${process.env.PORT || 5000}`;

  // ✅ New QR target: clean /bill/:id/page (no params, no raw IP if APP_BASE_URL set)
  const pdfData = `${baseUrl}/bill/${id}/page`;

  qrCode.toDataURL(pdfData, (err, src) => {
    if (err) {
      logger.error(`Unable to generate pdf package callback error`, err);
      return next(
        new ErrorResponse(
          "Unbale to generate pdf, try again later",
          400,
          false,
          null
        )
      );
    }
    logger.error(`Qr code generated`);

    const templateKey = resolveStateTemplateKey(bill.state);

    // ⚠️ This object is intentionally kept same as ORIGINAL
    const data = {
      ...bill._doc,
      src,
      host: process.env.APP_BASE_URL, // same as original; templates expect this
      cssFix: process.env.NODE_ENV === "production",
      taxFrom: formatDate(bill.taxFromDate, true),
      receiptDate: getAheadTimeWithDate(bill.paymentDate),
      taxTo: formatDate(bill.taxUptoDate, true),
      taxFrom_up: formatDate(bill.taxFromDate, false),
      taxTo_up: formatDate(bill.taxUptoDate, false),
      taxFrom_raj: formatDate(bill.taxFromDate, false),
      taxTo_raj: formatDate(bill.taxUptoDate, false),
      taxFrom_uk: formatDate(bill.taxFromDate, true),
      taxTo_uk: formatDate(bill.taxUptoDate, true),
      taxFrom_jh: formatDate(bill.taxFromDate, false),
      taxTo_jh: formatDate(bill.taxUptoDate, false),
      permitFrom: formatDate(bill.permitFrom, false),
      permitUpto: formatDate(bill.permitUpto, false),
      totalAmountInWord: inWords(bill.totalAmount).toUpperCase(),
      paymentDate: formatDate(bill.paymentDate, true),
      upPaymentDate: formatDate(bill.paymentDate, false),
      upBankRefNo: "IGANXUHFSS",
      rjBankRefNo: "1KBVoBVBSMGg",
    };

    ejs.renderFile(
      // 🔑 use mapped key, so "telangana" -> tsPdf.ejs
      path.join(__dirname, `../views/${templateKey}Pdf.ejs`),
      { data },
      function (err, htmlContent) {
        logger.error(`Html content generated`);
        if (err) {
          logger.error("Error rendering PDF template", err);
          return res.status(500).send("An error occurred");
        }
        // render on success (same as original)
        if (htmlContent) {
          res.setHeader("Content-Type", "application/pdf");
          res.pdfFromHTML({
            filename: `${bill.vehicleNo}.pdf`,
            htmlContent,
            options: {
              format: "Letter",
              orientation: "portrait",
              type: "pdf",
              quality: "75",
            },
          });
        } else {
          res.status(500).send("An error occurred");
        }
      }
    );
  });
});

/**
 * @desc    Get all bills
 * @route   GET /bill
 * @access  Private
 *
 * Slightly improved: still supports filters (?createdBy=&state=),
 * but response shape matches original (success, code, bills, count)
 */
exports.getAllBills = asyncHandler(async (req, res, next) => {
  const bills = await Bill.find({ ...req.query }).sort({ createdAt: "-1" });
  res
    .status(200)
    .send({ success: true, code: 200, bills, count: bills.length });
});

/**
 * @desc    Get bill page (HTML)
 * @route   GET /bill/:id/page
 * @access  Public
 *
 * Layout is identical to original, but uses resolveStateTemplateKey
 * so "telangana" -> tsPage.ejs etc.
 */
exports.getBillOnPageFormat = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const bill = await Bill.findById(id);
  if (!bill) {
    logger.info(`bill not found with this id ${id}`);
    res.status(404);
    return res.render("not-found");
  }

  const templateKey = resolveStateTemplateKey(bill.state);

  const data = {
    ...bill._doc,
    host: process.env.APP_BASE_URL,
    cssFix: process.env.NODE_ENV === "production",
    taxFrom: formatDate(bill.taxFromDate, true),
    taxTo: formatDate(bill.taxUptoDate, true),
    taxFrom_up: formatDate(bill.taxFromDate, false),
    taxTo_up: formatDate(bill.taxUptoDate, false),
    taxFrom_raj: formatDate(bill.taxFromDate, true),
    taxTo_raj: formatDate(bill.taxUptoDate, true),
    taxFrom_uk: formatDate(bill.taxFromDate, true),
    taxTo_uk: formatDate(bill.taxUptoDate, true),
    permitFrom: formatDate(bill.permitFrom, false),
    permitUpto: formatDate(bill.permitUpto, false),
    totalAmountInWord: inWords(bill.totalAmount).toUpperCase(),
    paymentDate: formatDate(bill.paymentDate, true),
    upPaymentDate: formatDate(bill.paymentDate, false),
    upBankRefNo: "IGANXUHFSS",
    rjBankRefNo: "1KBVoBVBSMGg",
  };

  ejs.renderFile(
    path.join(__dirname, `../views/pages/${templateKey}Page.ejs`),
    { data },
    function (err, htmlContent) {
      if (err) {
        logger.error("Error rendering PAGE template", err);
        return res.status(500).send("An error occurred");
      }
      if (htmlContent) {
        res.send(htmlContent);
      } else {
        res.status(500).send("An error occurred");
      }
    }
  );
});

/**
 * @desc    Create bill
 * @route   POST /bill
 * @access  Private (any logged-in user)
 *
 * 🔁 Changed from original:
 *   - Removed PAYMENT_USERNAME / PAYMENT_PASSWORD check
 *   - Uses req.user from protect middleware (so any logged-in user can generate)
 */
exports.createBill = asyncHandler(async (req, res, next) => {
  const user = req.user; // set by protect middleware

  const bill = new Bill({ ...req.body });
  bill.createdBy = user._id;
  bill.receiptNo = receiptNoGenerator(req.body.state);

  let time = new Date(req.body.taxFromDate);
  time.setSeconds(new Date().getSeconds());
  bill.paymentDate = time;

  // save to db
  await bill.save();

  // send SMS (same as original)
  const data = JSON.stringify({});

  const config = {
    method: "get",
    maxBodyLength: Infinity,
    url: `http://login.redsms.in/api/smsapi?key=c2c84407ebb090fc094fc169192f9cc8&route=2&sender=UVAHAN&number=${
      bill.mobileNo
    }&sms=Your tax of Rs. ${bill.totalAmount}/- has been paid for Vehicle No. ${
      bill.vehicleNo
    }, valid from ${formatDateMsg(
      bill.taxFromDate,
      bill.state,
      "from"
    )} to ${formatDateMsg(
      bill.taxUptoDate,
      bill.state,
      "to"
    )} paid on ${formatDateMsg(
      bill.createdAt,
      bill.state,
      "createdAt"
    )}. UVAHAN&templateid=1207163490769304299`,
    headers: {
      "Content-Type": "application/json",
    },
    data: data,
  };

  axios(config)
    .then(function (response) {
      console.log(JSON.stringify(response.data));
    })
    .catch(function (error) {
      console.log(error);
    });

  logger.info(
    `new bill generated with this id ${bill._id} and create by ${user._id}`
  );

  // pdf URL like before, but you should set APP_BASE_URL to ngrok/domain
  const pdfUrl = `${process.env.APP_BASE_URL}/bill/${bill._id}/pdf`;

  res.status(201).send({
    success: true,
    code: 201,
    bill,
    pdfUrl,
  });
});
