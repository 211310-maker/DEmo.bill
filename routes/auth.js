const express = require("express");
const router = express.Router();

const {
  loginUser,
  createUserWithOtp,
  blockUnblockUser,
  registerUserWithEmailPassword,
  getAllUsers,
  deleteUser,
  addMoreStateToAccess,
  webIndex,
  getPageAccessLink,
  getAccess,
  verifyOtp,
} = require("../controller/auth");

const { protect, adminOnly } = require("../middleware/auth");

//@desc    webindex
//@route   POST /auth/webindex
//@access  private
router.post("/webindex", protect, webIndex);

//@desc    get all members
//@route   GET /auth/admin/get-users
//@access  Private - admin
router.get("/admin/get-users", protect, adminOnly, getAllUsers);

//@desc    generate page access link
//@route   GET /auth/admin/page-access-link
//@access  Private - admin
router.get("/admin/page-access-link", protect, adminOnly, getPageAccessLink);

//@desc    get access for registration
//@route   GET /auth/get-access/:token
//@access  Public
router.get("/get-access/:token", getAccess);

//@desc    verify otp and create user
//@route   POST /auth/admin/verify-otp
//@access  Public
router.post("/admin/verify-otp", verifyOtp);

//@desc    add more state to accessState
//@route   POST /auth/admin/add-state-access
//@access  Private - admin
router.post("/admin/add-state-access", protect, adminOnly, addMoreStateToAccess);

//@desc    create user (admin only)
//@route   POST /auth/admin/create-user
//@access  Private - admin
router.post("/admin/create-user", protect, adminOnly, createUserWithOtp);

//@desc    registration disabled (kept for backwards compatibility)
//@route   POST /auth/register-user-with-email-password
//@access  Private - admin (returns 403)
router.post(
  "/register-user-email-password",
  protect,
  adminOnly,
  registerUserWithEmailPassword
);

//@desc    login user
//@route   POST /auth/login
//@access  public
router.post("/login", loginUser);

//@desc    block user
//@route   POST /auth/admin/block-unblock-user
//@access  private - admin
router.post("/admin/block-unblock-user", protect, adminOnly, blockUnblockUser);

//@desc    delete user
//@route   DELETE /auth/admin/delete-user/:id
//@access  private - admin
router.delete("/admin/delete-user/:userId", protect, adminOnly, deleteUser);

module.exports = router;
