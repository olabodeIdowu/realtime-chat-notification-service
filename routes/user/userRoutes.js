const express = require("express");

const {
  updateMe,
  deleteUser,
  getAllUsers,
  getUser,
  updateEmail,
  updateEmailOTP,
  updatePhone,
  uploadUserPhoto,
  resizeUserPhoto,
  verifyIdentity,
  verifyIdentity_v1,
  resendEmailOTP,
  resetEmail,
  updateFCMToken,
  toggleUserLockStatus,
} = require("../../controllers/user/userController");
const {
  signup,
  verifyOtp,
  login,
  protect,
  logout,
  forgotPassword,
  resetPassword,
  updatePassword,
  sendVerificationOtp,
  restrictTo,
  verifyToken,
  adminSignup,
  adminLogin,
  sendPhoneOTPByTwilo,
  verifyPhoneOTPByTwilo,
  otpLimiter,
} = require("../../controllers/auth/authController");

const {
  policyCancellation,
} = require("../../controllers/admin/adminController");
const {
  getAllLinkedAccounts,
  linkAccounts,
  unlinkAccounts,
} = require("../../controllers/linkedAccounts/linkedAccountsController");

const router = express.Router();

router.post("/register-admin", adminSignup);
router.post("/login-admin", adminLogin);
router.post("/register", signup);
router.post("/login", login);
router.post("/verify-otp", verifyOtp);
router.patch("/resend-email-otp", resendEmailOTP);
router.post("/verify-token", verifyToken);
router.post("/logout-user", protect, logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.patch("/change-user-email", protect, updateEmail);
router.patch("/reset-email", protect, resetEmail);
router.post("/update-password", protect, updatePassword);
router.post("/send-user-verification-otp", protect, sendVerificationOtp);

router.patch("/verify-email-otp", protect, updateEmailOTP);
router.patch("/change-user-phone", protect, updatePhone);
router.patch("/:userId/delete-user", protect, deleteUser);

router.post("/send-twilo-phone-otp", otpLimiter, sendPhoneOTPByTwilo);
router.post("/verify-twilo-phone-otp", verifyPhoneOTPByTwilo);
router.patch("/update-fcm-token", protect, updateFCMToken);

router.post(
  "/dispatch-twilo-phone-otp",
  protect,
  otpLimiter,
  sendPhoneOTPByTwilo,
);
router.post("/confirm-twilo-phone-otp", protect, verifyPhoneOTPByTwilo);

router.post("/verify-identity-v1", verifyIdentity_v1);
router.post("/verify-identity", verifyIdentity);
router.get("/policy/cancellation", protect, policyCancellation);

router.get("/linked-accounts", protect, getAllLinkedAccounts);
router.post("/link-account", protect, linkAccounts);
router.delete("/unlink-account/:id", protect, unlinkAccounts);
router.patch(
  "/:userId/unlock-user",
  protect,
  restrictTo("admin"),
  toggleUserLockStatus,
);

router.route("/").get(protect, getAllUsers);
router
  .route("/:userId")
  .get(protect, getUser)
  .patch(protect, updateMe);

module.exports = router;
