const User = require("../model/User");
const TempUser = require("../model/TempUser");
const _ = require("lodash");
const asyncHandler = require("../middleware/asyncHandler");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validateLogin } = require("../utils/validation");
const ErrorResponse = require("../utils/errorResponse");
const logger = require("../logger");
const { randomNumber } = require("../utils/helper");

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
  let user = new TempUser({ isBlocked: true });
  await user.save();

  const token = jwt.sign({ id: user._id }, "page-access", { expiresIn: "1d" });

  res.status(200).send({
    success: true,
    code: 200,
    url: `/app/register/${token}/get-access`,
    tempUser: user,
  });
});

// =============================================
// GET ACCESS
// =============================================
module.exports.getAccess = asyncHandler(async (req, res, next) => {
  const { token } = req.params;
  const decoded = jwt.verify(token, "page-access");

  if (decoded.exp < (new Date().getTime() + 1) / 1000) {
    return res.status(400).send({
      success: false,
      code: 400,
      message: "link expired",
    });
  }

  let user = await TempUser.findById(decoded.id);
  let otp = randomNumber(6);
  user.otp = otp;
  await user.save();

  const pageAccessToken = jwt.sign(
    { id: decoded.id },
    "valid-page-access-token"
  );

  res.status(200).send({
    success: true,
    code: 200,
    pageAccessToken,
    otp,
  });
});

// =============================================
// VERIFY OTP
// =============================================
module.exports.verifyOtp = asyncHandler(async (req, res, next) => {
  const { otp, password, username, tempUserId, accessState } = req.body;

  const tempUser = await TempUser.findOne({ _id: tempUserId, otp });
  if (!tempUser) {
    return next(
      new ErrorResponse("Invalid Otp please start registering again", 400, false)
    );
  }

  let user = await User.findOne({ username });
  if (user) {
    return next(new ErrorResponse("Username already exists", 400, false));
  }

  user = new User({
    username,
    accessState,
    isBlocked: false,
    completed: true,
    password,
  });

  await user.save();
  await TempUser.findByIdAndDelete(tempUserId);

  logger.info(`new user is created with id ${user._id}`);

  res.status(201).send({
    success: true,
    status: 201,
    message: "User created successfully!",
    user: _.pick(user, ["username", "role", "__v"]),
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
    const { username, password } = req.body;

    const isUserNameExist = await User.find({ username });
    if (isUserNameExist.length > 0) {
      return next(new ErrorResponse("Username already exist", 400));
    }

    if (!username) {
      return next(new ErrorResponse("Please add username", 400));
    }

    let user = new User({
      isBlocked: true,
      username,
      password,
    });

    const token = user.generateAuthToken();
    await user.save();
    user.token = token;

    logger.info(`user registered with direct email & password`);

    res.status(200).send({
      success: true,
      code: 200,
      user: _.pick(user, [
        "username",
        "role",
        "isBlocked",
        "createdAt",
        "updatedAt",
        "token",
        "__v",
      ]),
    });
  }
);

// =============================================
// LOGIN USER (FIXED)
// =============================================
module.exports.loginUser = asyncHandler(async (req, res, next) => {
  const { username, password } = req.body;

  console.log("LOGIN REQUEST BODY:", req.body);

  // 1. Check required fields
  if (!username || !password) {
    return next(new ErrorResponse("Username & password required", 400));
  }

  // 2. Find user by username only
  let user = await User.findOne({ username });

  if (!user) {
    return next(new ErrorResponse("Invalid Credentials", 400));
  }

  // 3. Compare password (plain text — same as your system)
  if (user.password !== password) {
    return next(new ErrorResponse("Invalid Credentials", 400));
  }

  // 4. Check block
  if (user.isBlocked) {
    return next(new ErrorResponse("You are blocked", 400));
  }

  // 5. Admin login route protection (referer may be undefined)
  if (req.headers.referer?.includes("/admin/login")) {
    if (user.role !== "admin") {
      return next(new ErrorResponse("Invalid Credentials", 400));
    }
  }

  // 6. Create token
  const token = user.generateAuthToken();

  if (user.role === "admin") {
    user.accessState = ALL_STATES;
  }

  await user.save();
  user.token = token;

  return res.status(200).json({
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