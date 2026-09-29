const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const twilio = require("twilio");

// Initialize Firebase Admin SDK
const serviceAccount = require("./../../serviceAccount.json");
const Email = require("../../utils/email");
const Email2 = require("../../utils/sendSupportEmail");
const User = require("../../models/user/userModel");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");

exports.admin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Twilo configuration
const client = twilio(
  process.env.TWILO_ACCOUNT_SID,
  process.env.TWILO_AUTH_TOKEN,
);

const filterObj = function(obj, ...allowedFields) {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

const signUserToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const signUserRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, req, res) => {
  const userToken = signUserToken(user._id);
  const userRefreshToken = signUserRefreshToken(user._id);
  // If everything ok, send token to client
  res.cookie("userToken", userToken, {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
  });

  res.cookie("userRefreshToken", userRefreshToken, {
    expires: new Date(
      Date.now() +
        process.env.JWT_REFRESH_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
  });

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    userToken,
    userRefreshToken,
    data: {
      user,
    },
  });
};

exports.otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    status: "fail",
    message:
      "Too many OTP requests from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// // Register user (email or social)
// router.post("/register", async (req, res) => {
//   const { email, password, name, idToken } = req.body;

//   try {
//     let user,
//       providerId,
//       provider = "email";

//     if (idToken) {
//       // Social login
//       const decodedToken = await admin.auth().verifyIdToken(idToken);
//       email = decodedToken.email;
//       providerId = decodedToken.uid;
//       provider = decodedToken.firebase.sign_in_provider.split(".")[0]; // e.g., 'google'

//       user = await User.findOne({ email });
//       if (user) {
//         return res.status(400).json({ error: "User already exists" });
//       }

//       user = new User({ email, name, provider, providerId });
//     } else {
//       // Email/password
//       user = await User.findOne({ email });
//       if (user) {
//         return res.status(400).json({ error: "User already exists" });
//       }

//       const hashedPassword = await bcrypt.hash(password, 10);
//       user = new User({ email, password: hashedPassword, name });
//     }

//     await user.save();
//     const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
//       expiresIn: "1h",
//     });
//     res.json({ token, userId: user._id });
//   } catch (error) {
//     console.error("Error registering user:", error);
//     res.status(500).json({ error: "Failed to register user" });
//   }
// });

// // Login user (email or social)
// router.post("/login", async (req, res) => {
//   const { email, password, idToken } = req.body;

//   try {
//     let user;

//     if (idToken) {
//       // Social login
//       const decodedToken = await admin.auth().verifyIdToken(idToken);
//       user = await User.findOne({
//         email: decodedToken.email,
//         providerId: decodedToken.uid,
//       });
//       if (!user) {
//         return res
//           .status(404)
//           .json({ error: "User not found. Please register." });
//       }
//     } else {
//       // Email/password
//       user = await User.findOne({ email });
//       if (!user || !(await bcrypt.compare(password, user.password))) {
//         return res.status(401).json({ error: "Invalid credentials" });
//       }
//     }

//     const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
//       expiresIn: "1h",
//     });
//     res.json({ token, userId: user._id });
//   } catch (error) {
//     console.error("Error logging in:", error);
//     res.status(500).json({ error: "Failed to login" });
//   }
// });

// ---------------------- signup -------------------------
exports.signup = catchAsync(async (req, res, next) => {
  // 1) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(
    req.body,
    "email",
    "name",
    "firstName",
    "lastName",
    "password",
    "confirmPassword",
    "photo",
    "role",
    "phone",
  );

  let user,
    providerId,
    email,
    provider = "email";

  if (req.body.idToken) {
    // Social login
    const decodedToken = await admin.auth().verifyIdToken(req.body.idToken);
    email = decodedToken.email;
    providerId = decodedToken.uid;
    provider = decodedToken.firebase.sign_in_provider.split(".")[0]; // e.g., 'google'

    user = await User.findOne({ email });
    if (user) {
      return next(new AppError("User already exists", 400));
    }

    filteredBody.provider = provider;
    filteredBody.providerId = providerId;

    user = await User.create(filteredBody);
    user.phoneVerified = true;
  } else {
    // Email/password
    const {
      email,
      firstName,
      lastName,
      password,
      confirmPassword,
      photo,
      role,
      phone,
    } = req.body;

    if (
      !email ||
      !firstName ||
      !lastName ||
      !password ||
      !confirmPassword ||
      !photo ||
      !role ||
      !phone
    ) {
      return next(new AppError("make sure you fill the required options", 400));
    }

    user = await User.findOne({ email });
    if (user) {
      console.log("user already existed====>", user);
      return next(new AppError("User already exists", 400));
    }

    user = await User.create({
      email,
      firstName,
      lastName,
      password,
      confirmPassword,
      photo,
      role,
      phone,
    });
  }

  user.phoneVerified = true;

  const url = undefined;
  // get email OTP
  const otp = user.generateOTP();
  // send welcome email to user email address
  await new Email(user, url).sendWelcome();
  // console.log(user, otp);
  await user.save();

  // send otp to user email address for verifcation
  if (process.env.NODE_ENV !== "production") {
    setTimeout(async () => {
      await new Email(user, { url, otp }).sendEmailOTP();
    }, 2000); // remove timeout during prod
  } else {
    await new Email(user, { url, otp }).sendEmailOTP();
  }
  // send token to user
  createSendToken(user, 201, req, res);
});

exports.adminSignup = catchAsync(async (req, res, next) => {
  // 1) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(
    req.body,
    "email",
    "name",
    "firstName",
    "lastName",
    "phone",
    "password",
    "confirmPassword",
    "photo",
  );

  const user = await User.findOne({ email: req.body.email });
  if (user) {
    return next(new AppError("User already exists", 400));
  }
  filteredBody.role = "admin";
  user = await User.create(filteredBody);

  const url = undefined;
  // get email OTP
  const otp = user.generateOTP();
  // send welcome email to user email address
  await new Email(user, { url }).sendWelcome();

  // console.log(user, otp);
  await user.save();

  // send otp to user email address for verifcation
  if (process.env.NODE_ENV !== "production") {
    setTimeout(async () => {
      await new Email(user, { url, otp }).sendEmailOTP();
    }, 2000); // remove timeout during prod
  } else {
    await new Email(user, { url, otp }).sendEmailOTP();
  }

  // send token to user
  createSendToken(user, 201, req, res);
});

// ---------------------- verify token -------------------------

exports.verifyToken = catchAsync(async (req, res, next) => {
  const { token, userId } = req.body;

  // Validate input
  if (!token || !userId) {
    return next(new AppError("Token and userId are required.", 400));
  }

  // Verify JWT token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Check if userId matches token payload
  if (decoded.id !== userId) {
    return next(new AppError("Invalid token: User ID mismatch.", 401));
  }

  // Verify user exists
  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found.", 404));
  }

  // Token is valid
  res.status(200).json({
    valid: true,
    message: "Token verified successfully.",
    data: {
      user,
    },
  });
});

// ---------------------- verify otp -------------------------

exports.verifyOtp = catchAsync(async (req, res, next) => {
  // check if req.body contains otp
  const { otp } = req.body;
  if (!otp)
    return next(
      new AppError(
        "Unprocessable Entity - requested data contain invalid values.",
        422,
      ),
    );
  console.log("OTP from verift otp endpoint===>", otp);
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
  console.log(hashedToken);
  const user = await User.findOne({
    otp: hashedToken,
    otpExpires: { $gt: new Date(Date.now()) },
  });

  if (!user) {
    return next(new AppError("OTP is invalid or has expired", 400));
  }

  // 2) If OTP has not expired, and there is user, set the new password
  user.otp = undefined;
  user.otpExpires = undefined;
  user.emailVerified = true;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    data: user,
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password, idToken, fcmToken } = req.body;
  let user;

  if (idToken) {
    // Social login
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    user = await User.findOne({
      email: decodedToken.email,
      providerId: decodedToken.uid,
    }).select("+password");
    if (!user) {
      return next(new AppError("User not found. Please register.", 404));
    }
  } else {
    // Email/password
    const { email, password, fcmToken } = req.body;

    if (!email || !password) {
      return next(new AppError("Please provide email and password", 400));
    }
    user = await User.findOne({ email: email }).select("+password");
    if (!user || !(await user.correctPassword(password, user.password))) {
      return next(new AppError("Incorrect email or password", 401));
    }
  }

  // Save or update FCM token if provided in request payload
  if (fcmToken) {
    user.fcmToken = fcmToken;
  } else {
    return next(new AppError("Provide a FCM Token", 400));
  }

  user.loggedInAt = new Date(Date.now());
  user.loggedIn = true;
  await user.save({ validateBeforeSave: false });
  createSendToken(user, 200, req, res);
});

exports.adminLogin = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password)
    return next(
      new AppError(
        "Unprocessable Entity - requested data contain invalid values.",
        422,
      ),
    );

  // Email/password
  const user = await User.findOne({ email: email }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  user.loggedInAt = new Date(Date.now());
  user.loggedIn = true;
  await user.save({ validateBeforeSave: false });
  createSendToken(user, 200, req, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.userToken) {
    token = req.cookies.userToken;
  }

  if (!token) {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401),
    );
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(
      new AppError(
        "The user belonging to this token does no longer exist.",
        401,
      ),
    );
  }

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! Please log in again.", 401),
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;

  next();
});

// ---------------------- logged In -------------------------
exports.isLoggedIn = catchAsync(async (req, res, next) => {
  if (req.cookies.userToken) {
    // 1) verify token
    const decoded = await promisify(jwt.verify)(
      req.cookies.userToken,
      process.env.JWT_SECRET,
    );

    // 2) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(
        new AppError(
          "The user belonging to this token does no longer exist.",
          401,
        ),
      );
    }

    // 3) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError(
          "User recently changed password! Please log in again.",
          401,
        ),
      );
    }

    // THERE IS A LOGGED IN USER
    res.locals.user = currentUser;
    return next();
  }
  next();
});

// ---------------------- restrict to -------------------------

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403),
      );
    }

    next();
  };
};

// ---------------------- logout -------------------------

exports.logout = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401),
    );
  }

  res.cookie("userToken", "loggedout", {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true,
  });

  user.loggedOutAt = new Date(Date.now());
  user.loggedOut = true;

  await user.save({ validateBeforeSave: false });

  res
    .status(200)
    .json({ status: "success", message: "user succesfully logged out" });
});

// ---------------------- forgot password -------------------------

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("There is no user with email address.", 404));
  }

  const otp = user.generateOTP();
  // console.log(otp);
  await user.save({ validateBeforeSave: false });

  // send url and otp
  const resetUrl = `${req.protocol}://${req.get("host")}/reset-password`;

  await new Email(user, { resetUrl, otp }).sendEmailOTP();

  res.status(200).json({
    status: "success",
    message: "Token sent to email!",
  });
});

// ---------------------- reset password -------------------------

exports.resetPassword = catchAsync(async (req, res, next) => {
  const { otp, password, confirmPassword } = req.body;
  if (!otp)
    return next(
      new AppError(
        "Unprocessable Entity - requested data contain invalid values.",
        422,
      ),
    );

  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");

  const user = await User.findOne({
    otp: hashedToken,
    otpExpires: { $gt: new Date(Date.now()) },
  });

  // 2) If OTP has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError("OTP is invalid or has expired", 400));
  }

  user.password = password;
  user.confirmPassword = confirmPassword;
  user.passwordChangedAt = new Date(Date.now());
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  const url = undefined;

  await new Email(user, { url, otp }).sendPasswordResetSuccess();
  createSendToken(user, 200, req, res);
});

// ---------------------- update password -------------------------

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select("+password");

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.currentPassword, user.password))) {
    return next(new AppError("Your current password is wrong.", 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  user.passwordChangedAt = new Date(Date.now());
  await user.save();

  // User.findByIdAndUpdate will NOT work as intended!
  const url = undefined;

  await new Email(user).sendPasswordResetSuccess();
  // 4) Log user in, send JWT
  createSendToken(user, 200, req, res);
});

exports.sendVerificationOtp = catchAsync(async (req, res, next) => {
  const newUser = await User.findOne({ email: req.user.email });

  if (!newUser) {
    return next(new AppError("you are not logged in!", 422));
  }

  const url = undefined;

  // get email OTP
  const otp = newUser.generateOTP();
  // console.log(otp);
  await newUser.save({ validateBeforeSave: false });

  // send email message to confirm user email address
  await new Email(newUser, { url, otp }).sendEmailOTP();

  res.status(200).json({
    status: "success",
    message:
      "email containing your otp as successfully been sent to your email.",
  });
});

// router.post('/send-twilo-phone-otp', async (req, res) => {
exports.sendPhoneOTPByTwilo = catchAsync(async (req, res, next) => {
  let { phoneNumber } = req.body;
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // 1. Format number for Nigeria (+234)
  if (!phoneNumber.startsWith("+")) {
    const stripped = phoneNumber.startsWith("0")
      ? phoneNumber.substring(1)
      : phoneNumber;
    phoneNumber = `+234${stripped}`;
  }

  // 2. Save OTP to User (finding by the phone number they provided)
  const user = await User.findOneAndUpdate(
    { id: req.user.id },
    {
      phoneOTP: code,
      phoneOTPExpires: Date.now() + 10 * 60 * 1000, // 10 minutes expiry
    },
  );

  if (!user)
    return next(new AppError("No user found with that phone number", 404));

  // 3. Send SMS via Twilio
  await client.messages.create({
    body: `Your Exotiride verification code is ${code}`,
    from: process.env.TWILIO_NUMBER,
    to: phoneNumber,
  });

  // 4. Send generic success response (Safe)
  res.status(200).json({ status: "success", message: "OTP sent to phone!" });
});

// router.post('/verify-twilo-phone-otp', (req, res) => {
exports.verifyPhoneOTPByTwilo = catchAsync(async (req, res, next) => {
  const { phoneNumber, otp } = req.body;

  // Find user with matching phone and valid (unexpired) OTP
  const user = await User.findOne({
    id: req.user.id,
    phoneOTP: otp,
    phoneOTPExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError("Invalid or expired OTP", 400));
  }

  // Clear OTP fields and mark as verified
  user.phoneOTP = undefined;
  user.phoneOTPExpires = undefined;
  user.isPhoneVerified = true;
  user.phone = phoneNumber;
  await user.save({ validateBeforeSave: false });

  res
    .status(200)
    .json({ status: "success", message: "Phone verified successfully!" });
});
