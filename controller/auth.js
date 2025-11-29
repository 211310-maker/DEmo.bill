const User = require("../model/User");
const TempUser = require("../model/TempUser");
const TempAccess = require("../model/TempAccess");
const _ = require("lodash");
const asyncHandler = require("../middleware/asyncHandler");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validateLogin } = require("../utils/validation");
const ErrorResponse = require("../utils/errorResponse");
const logger = require("../logger");
const { generateOtp, hashOtp, compareOtp } = require("../utils/otp");
const { v4: uuidv4 } = require("uuid");
const { sendSms } = require("../utils/sms");

const ALL_STATES = [
  "BIHAR",
  "HARYANA",
  "PUNJAB",
  "UTTAR PRADESH",
  "UTTARAKHAND",
  "GUJRAT",
  "RAJASTHAN",
  "MADHYA PRADESH",
  "MAHARASHTRA",
  "HIMACHAL PRADESH",
  "KARNATAKA",
  "JHARKHAND",
  "CHHATTISGARH",
  "ODISHA",
  "TAMILNADU",
  "TELANGANA",
  "ASSAM",
  "PUDUCHERRY",
  "DAMAN AND DIU",
  "SIKKIM",
  "TRIPURA",
];

// =============================================
// GET PAGE ACCESS LINK
// =============================================
module.exports.getPageAccessLink = asyncHandler(async (req, res, next) => {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await TempAccess.create({
    token,
    expiresAt,
    createdBy: req.user?._id,
  });

  const link = process.env.APP_BASE_URL
    ? `${process.env.APP_BASE_URL}/app/register/${token}/get-access`
    : `/app/register/${token}/get-access`;

  res.status(200).send({
    success: true,
    link,
    token,
    expiresAt,
  });
});

// =============================================
// GET ACCESS
// =============================================
module.exports.getAccess = asyncHandler(async (req, res, next) => {
  const { token } = req.params;
  const tempAccess = await TempAccess.findOne({ token });

  if (!tempAccess) {
    return next(new ErrorResponse("Invalid link", 400, false));
  }

  if (tempAccess.used) {
    return next(new ErrorResponse("Link already used", 400, false));
  }

  if (tempAccess.expiresAt && tempAccess.expiresAt < new Date()) {
    return next(new ErrorResponse("Link expired", 400, false));
  }

  const otp = generateOtp();
  tempAccess.otpHash = await hashOtp(otp);
  if (req.query?.mobileNo || req.body?.mobileNo) {
    tempAccess.mobileNo = req.query.mobileNo || req.body.mobileNo;
  }
  if (req.query?.email || req.body?.email) {
    tempAccess.email = req.query.email || req.body.email;
  }
  await tempAccess.save();

  if (tempAccess.mobileNo) {
    await sendSms(tempAccess.mobileNo, `${otp} is your verification code.`);
  }

  res.status(200).send({
    success: true,
    token,
    otpSent: true,
    devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
  });
});

// =============================================
// ADMIN CREATE USER
// =============================================
module.exports.createUserWithOtp = asyncHandler(async (req, res, next) => {
  const { username, password, accessState, role } = req.body;

  if (!username || !password) {
    return next(new ErrorResponse("Username and password are required", 400, false));
  }

  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return next(new ErrorResponse("Username already exists", 400, false));
  }

  const user = new User({
    username,
    password,
    accessState,
    role: role || "member",
    isBlocked: false,
    completed: true,
    createdBy: req.user?._id,
  });

  await user.save();
  const token = user.generateAuthToken();

  logger.info(`new user is created with id ${user._id} by admin ${req.user?._id}`);

  res.status(201).send({
    success: true,
    status: 201,
    message: "User created successfully!",
    user: _.pick(user, [
      "_id",
      "username",
      "role",
      "isBlocked",
      "accessState",
      "createdAt",
      "updatedAt",
    ]),
    token,
  });
});

// =============================================
// VERIFY OTP AND CREATE USER (PUBLIC VIA TOKEN)
// =============================================
module.exports.verifyOtp = asyncHandler(async (req, res, next) => {
  const { token, otp, name, mobileNo, email, password } = req.body;
  let { role, accessState } = req.body;

  if (!token || !otp || !password) {
    return next(new ErrorResponse("token, otp and password are required", 400));
  }

  const tempAccess = await TempAccess.findOne({ token });

  if (!tempAccess) {
    return next(new ErrorResponse("Invalid link", 400, false));
  }

  if (tempAccess.used) {
    return next(new ErrorResponse("Link already used", 400, false));
  }

  if (tempAccess.expiresAt && tempAccess.expiresAt < new Date()) {
    return next(new ErrorResponse("Link expired", 400, false));
  }

  const otpValid = await compareOtp(otp, tempAccess.otpHash || "");
  if (!otpValid) {
    return next(new ErrorResponse("Invalid OTP", 400, false));
  }

  const normalizedRole = role === "admin" ? "admin" : role || "user";
  const finalMobileNo = mobileNo || tempAccess.mobileNo;
  const finalEmail = email || tempAccess.email;
  const username = finalMobileNo || finalEmail || name || token;
  accessState = Array.isArray(accessState) ? accessState : [];

  const user = new User({
    username,
    name,
    mobileNo: finalMobileNo,
    email: finalEmail,
    password,
    role: normalizedRole,
    accessState,
    isBlocked: false,
    completed: true,
    createdBy: tempAccess.createdBy,
  });

  await user.save();

  tempAccess.used = true;
  await tempAccess.save();

  const authToken = jwt.sign(
    { _id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );

  res.status(200).send({
    success: true,
    user: _.pick(user, [
      "_id",
      "username",
      "role",
      "accessState",
      "name",
      "mobileNo",
      "email",
    ]),
    token: authToken,
  });
});

// =============================================
// ADD MORE STATE ACCESS
// =============================================
module.exports.addMoreStateToAccess = asyncHandler(async (req, res, next) => {
  const { accessState, id } = req.body;

  const user = await User.findByIdAndUpdate(
    id,
    { accessState },
    { runValidators: true }
  );

  if (!user) {
    return next(new ErrorResponse("User not found with this id", 404, false));
  }

  res.status(200).send({
    success: true,
    status: 200,
    message: "More state added successfully!",
  });
});

// =============================================
// BLOCK / UNBLOCK USER
// =============================================
module.exports.blockUnblockUser = asyncHandler(async (req, res, next) => {
  const { id } = req.body;

  const user = await User.findById(id);
  if (!user) {
    return next(new ErrorResponse("User not found with the provided id", 404));
  }

  user.isBlocked = !user.isBlocked;
  await user.save();

  res.status(201).send({
    success: true,
    status: 200,
    message: "User status changed!",
  });
});

// =============================================
// GET ALL USERS
// =============================================
module.exports.getAllUsers = asyncHandler(async (req, res, next) => {
  let filter = {};
  if (req.query) filter = { ...req.query };

  let users = await User.find(filter).populate("createdBy");

  res.status(201).send({
    success: true,
    status: 200,
    count: users.length,
    users: users.filter((e) => e.username !== req.user.username),
  });
});

// =============================================
// REGISTER USER WITH EMAIL & PASSWORD
// =============================================
module.exports.registerUserWithEmailPassword = asyncHandler(
  async (req, res, next) => {
    return next(
      new ErrorResponse("Public registration is disabled. Ask an admin to add you.", 403)
    );
  }
);

// =============================================
// LOGIN USER (PRODUCTION STYLE)
// =============================================
module.exports.loginUser = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return next(new ErrorResponse("Username & password required", 400));
    }

    const user = await User.findOne({ username });

    if (!user) {
      return next(new ErrorResponse("Invalid credentials", 400));
    }

    if (user.isBlocked) {
      return next(new ErrorResponse("You are blocked", 400));
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return next(new ErrorResponse("Invalid credentials", 400));
    }

    if (user.role === "admin") {
      user.accessState = ALL_STATES;
    }

    const token = jwt.sign(
      { _id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    await user.save();

    return res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        role: user.role,
        name: user.username,
        username: user.username,
        email: user.username,
        mobile: user.username,
        allowedStates: user.accessState || [],
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return next(new ErrorResponse("Something went wrong", 500));
  }
};


// =============================================
// WEB INDEX (FIXED)
// =============================================
module.exports.webIndex = asyncHandler(async (req, res, next) => {
  const { authToken } = req.body;

  if (!authToken) {
    return next(new ErrorResponse("Please add auth token", 400));
  }

  const decoded = jwt.verify(authToken, process.env.JWT_SECRET);

  if (decoded.exp < (new Date().getTime() + 1) / 1000) {
    return next(
      new ErrorResponse("Session Expired, Please Login again", 401)
    );
  }

  const user = await User.findById(decoded._id);
  if (!user) {
    return next(
      new ErrorResponse("Invalid token / Access Denied", 401)
    );
  }

  if (user.isBlocked) {
    return next(new ErrorResponse("You are blocked", 400));
  }

  // ⭐ FIXED: safe optional chaining
  if (req.headers.referer?.includes("/admin/login")) {
    if (user.role !== "admin") {
      return next(new ErrorResponse("Invalid Credentials", 400));
    }
  }

  const token = user.generateAuthToken();

  if (user.role === "admin") {
    user.accessState = ALL_STATES;
  }

  await user.save();
  user.token = token;

  res.status(200).send({
    success: true,
    code: 200,
    user: _.pick(user, [
      "role",
      "_id",
      "username",
      "createdAt",
      "updatedAt",
      "token",
      "accessState",
      "__v",
    ]),
  });
});

// =============================================
// DELETE USER
// =============================================
module.exports.deleteUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  let user = await User.findById(userId);
  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  if (user.username === req.user.username) {
    return next(new ErrorResponse("Cannot delete yourself!", 422));
  }

  await User.findByIdAndRemove(userId);

  res.status(200).send({
    success: true,
    code: 200,
    message: "User deleted successfully!",
  });
});