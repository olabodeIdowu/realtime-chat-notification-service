const crypto = require("crypto");
const multer = require("multer");
const sharp = require("sharp");
const User = require("../../models/user/userModel");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const APIFeatures = require("../../utils/apiFeatures");
const Email = require("../../utils/email");

// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'public/img/users');
//   },
//   filename: (req, file, cb) => {
//     const ext = file.mimetype.split('/')[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   }
// });
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new AppError("Not an image! Please upload only images.", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadUserPhoto = upload.single("photo");

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(150, 150)
    .toFormat("jpeg")
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getAllUsers = catchAsync(async (req, res, next) => {
  // To allow for nested GET reviews on user (hack)
  let filter = {};
  if (req.params.userId) filter = { user: req.params.userId };

  const features = new APIFeatures(User.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  // const doc = await features.query.explain();
  const doc = await features.query;

  // SEND RESPONSE
  res.status(200).json({
    status: "success",
    results: doc.length,
    data: {
      doc,
    },
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  // console.log(req.params.userId);
  // 1) Update user document
  const user = await User.findById(req.params.userId);

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.confirmPassword) {
    return next(
      new AppError(
        "This route is not for password updates. Please use /updateMyPassword.",
        400,
      ),
    );
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, "firstName", "lastName", photo);

  if (req.file) filteredBody.photo = req.file.filename;
  // console.log(filteredBody);

  //  Update user document
  const updatedUser = await User.findByIdAndUpdate(
    req.params.userId,
    filteredBody,
    {
      new: true,
      runValidators: true,
    },
  );
  // console.log(updatedUser);

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
});

exports.updateMe = catchAsync(async (req, res, next) => {
  const { firstName, lastName, photo } = req.body;
  // console.log(firstName, lastName);

  // 1) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, "firstName", "lastName", "photo");

  // 2) Create error if user POSTs password data
  if (req.body.password || req.body.confirmPassword) {
    return next(new AppError("This route is not for password updates.", 400));
  }

  //  Update user document
  const updatedUser = await User.findByIdAndUpdate(
    req.params.userId,
    filteredBody,
    {
      new: true,
      runValidators: true,
    },
  );
  // console.log(updatedUser);

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
});

exports.updateEmail = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("There is no user with email address.", 404));
  }

  const otp = user.generateOTP();
  // console.log(otp);
  await user.save({ validateBeforeSave: false });
  console.log(otp);

  // send otp to user email address for verifcation
  await new Email(user, { otp }).sendEmailOTP();

  res.status(200).json({
    status: "success",
    message: "Token sent to email!",
  });
});

exports.resendEmailOTP = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("There is no user with email address.", 404));
  }

  const otp = user.generateOTP();
  // console.log(otp);
  await user.save({ validateBeforeSave: false });

  // send otp to user email address for verifcation
  await new Email(user, { otp }).sendEmailOTP();

  res.status(200).json({
    status: "success",
    message: "Token sent to email!",
  });
});

// ---------------------- reset password -------------------------

exports.resetEmail = catchAsync(async (req, res, next) => {
  const { otp, email } = req.body;
  if (!otp)
    return next(
      new AppError(
        "Unprocessable Entity - requested data contain invalid values.",
        422,
      ),
    );

  // 1) Get user based on the token
  const hashedToken = crypto.createHash("sha256").update(otp).digest("hex");

  const user = await User.findOne({
    otp: hashedToken,
    otpExpires: { $gt: new Date(Date.now()) },
  });

  // 2) If OTP has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError("OTP is invalid or has expired", 400));
  }

  user.email = email;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save({ validateBeforeSave: false });

  await new Email(user).sendEmailResetSuccess();
  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});

exports.updateEmailOTP = catchAsync(async (req, res, next) => {
  const { otp } = req.body;

  if (!otp)
    return next(
      new AppError(
        "Unprocessable Entity - requested data contain invalid values.",
        422,
      ),
    );

  // 1) Get user based on the token
  const hashedToken = crypto.createHash("sha256").update(otp).digest("hex");

  const user = await User.findOne({
    otp: hashedToken,
    otpExpires: { $gt: new Date(Date.now()) },
  });

  // 2) If OTP has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError("OTP is invalid or has expired", 400));
  }

  user.otp = undefined;
  user.otpExpires = undefined;
  user.emailVerified = true;

  await user.save({ validateBeforeSave: false });

  // console.log(updatedUser);

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});

exports.updatePhone = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs email, phone data
  if (!req.body.phone) {
    return next(new AppError("This route is for user phone updates.", 400));
  }

  if (req.body.password || req.body.confirmPassword) {
    return next(
      new AppError(
        "This route is not for password updates. Please use /updateMyPassword.",
        400,
      ),
    );
  }

  let { phone } = req.body;

  // 1. Format number for Nigeria (+234)
  if (!phone.startsWith("+")) {
    const stripped = phone.startsWith("0") ? phone.substring(1) : phone;
    phone = `+234${stripped}`;
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError("user not found", 404));
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, "phone");

  //  Update user document

  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  updatedUser.phoneVerified = false;
  await updatedUser.save({ validateBeforeSave: false });

  // console.log(updatedUser);

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(
    req.params.userId,
    { active: false },
    {
      new: true,
      runValidators: true,
    },
  ).select("+active");

  res.status(204).json({
    status: "success",
    data: null,
  });
});

// Controller to toggle or set isLocked status on a User
exports.toggleUserLockStatus = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const { isLocked, reason } = req.body;

  if (typeof isLocked !== "boolean") {
    return next(
      new AppError("Please provide a valid boolean 'isLocked' value", 400),
    );
  }

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  user.isLocked = isLocked;
  await user.save({ validateBeforeSave: false });

  const statusText = isLocked ? "locked" : "unlocked";
  const notificationBody = isLocked
    ? `Your account has been locked. Reason: ${
        reason || "Policy violation or late return"
      }. Contact support for help.`
    : "Your account has been unlocked. You may now resume using Exotiride services.";

  // Create notification for the user
  // await Notification.create({
  //   userId: user._id,
  //   title: `Account ${isLocked ? "Locked" : "Unlocked"}`,
  //   body: notificationBody,
  //   read: false,
  // });

  // Dispatch Push Notification
  // if (user?.fcmToken) {
  //   await sendFCMNotification(
  //     user.fcmToken,
  //     `Account ${isLocked ? "Locked" : "Unlocked"}`,
  //     notificationBody,
  //     { type: isLocked ? "ACCOUNT_LOCKED" : "ACCOUNT_UNLOCKED" },
  //   );
  // }

  return res.status(200).json({
    status: "success",
    message: `User account has been ${statusText} successfully`,
    data: {
      userId: user._id,
      isLocked: user.isLocked,
    },
  });
});
