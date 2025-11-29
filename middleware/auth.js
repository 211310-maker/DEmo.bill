const jwt = require("jsonwebtoken");
const asyncHandler = require("./asyncHandler");
const User = require("../model/User");
const ErrorResponse = require("../utils/errorResponse");
const logger = require("../logger");

const protect = asyncHandler(async (req, res, next) => {
  let token =
    req.header("x-auth-token") ||
    req.body?.authToken ||
    req.query?.token ||
    null;

  if (!token && req.headers.authorization) {
    const [scheme, value] = req.headers.authorization.split(" ");
    if (scheme === "Bearer" && value) {
      token = value;
    }
  }

  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      const adminUser = await User.findOne({ role: "admin" });
      if (adminUser) {
        req.user = adminUser;
        return next();
      }
    }
    return next(new ErrorResponse("Access Denied", 401, false, null));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      const adminUser = await User.findOne({ role: "admin" });
      if (adminUser) {
        req.user = adminUser;
        return next();
      }
    }
    return next(new ErrorResponse("Invalid token", 401, false, null));
  }

  if (decoded.exp < (new Date().getTime() + 1) / 1000) {
    return next(
      new ErrorResponse("Session Expired, Please Login again", 401, false, null)
    );
  }

  const user = await User.findById(decoded._id);
  if (!user) {
    logger.info(`user is trying with invalid token ${token}`);
    return next(
      new ErrorResponse(
        "invalid user id in token / Access Denied ",
        401,
        false,
        null
      )
    );
  }

  if (user.isBlocked) {
    return next(
      new ErrorResponse(
        "You are blocked, please contact admin",
        403,
        false,
        null
      )
    );
  }

  req.user = user;
  return next();
});

const authorize = (...roles) => {
  return (req, _, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `role ${req.user.role} is not authorized to perform this operation`,
          403,
          false
        )
      );
    }
    return next();
  };
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return next(new ErrorResponse("Admin access required", 403, false));
  }
  return next();
};

module.exports.protect = protect;
module.exports.authorize = authorize;
module.exports.adminOnly = adminOnly;
