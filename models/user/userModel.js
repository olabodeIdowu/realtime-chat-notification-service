const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    // Personal Information
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
      required: [true, "A user must provide a first name"],
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
      required: [true, "A user must provide a last name"],
    },
    name: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, "Please provide a valid email"],
      required: [true, "A user must provide a email"],
    },

    phone: {
      type: String,
      unique: true,
      trim: true,
      required: [true, "A user must provide a phone number"],
    },

    photo: {
      type: String,
      default: "https://i.imghippo.com/files/nBZ5038joU.png",
    },

    // Authentication
    role: {
      type: String,
      enum: ["host", "client", "admin", "superAdmin"], // Remove permssion for creating admin, suoerAdmin
      default: "client",
      required: true,
    },

    password: {
      type: String,
      minlength: 8,
      select: false,
    },

    provider: {
      type: String,
      enum: ["email", "google", "apple", "facebook"],
      default: "email",
    },
    providerId: String,

    // Verification
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },

    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "failed"],
      default: "pending",
    },

    // OTP Fields
    otp: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    phoneOTP: { type: String, select: false },
    phoneOTPExpires: { type: Date, select: false },

    // Security
    passwordChangedAt: Date,
    isLocked: { type: Boolean, default: false },
    active: {
      type: Boolean,
      default: true,
      select: false,
    },

    // Timestamps
    loggedInAt: Date,
    loggedOutAt: Date,

    // Documents
    documentType: {
      type: String,
      enum: ["ID Card", "NIN", "Passport", null],
      default: null,
    },
    documentNumber: String,
    verificationDate: Date,

    // Push Notifications
    oneSignalPlayerId: String,
    fcmToken: {
      type: String,
      default: null,
    }, // Store the FCM Push Token here

    // Favorites (embedded for better performance)
    favorites: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "Car",
      },
    ],
  },
  {
    timestamps: true, // Auto createdAt & updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ==================== INDEXES ====================
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ verificationStatus: 1 });

// ==================== MIDDLEWARE ====================

// Hash password before save
userSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date(Date.now() - 1000);
  this.confirmPassword = undefined; // Remove confirm field
  next();
});

// Hide inactive users
userSchema.pre(/^find/, function(next) {
  this.find({ active: { $ne: false } });
  next();
});

// Populate favorites & bookings
userSchema.pre(/^find/, function(next) {
  this.populate("favorites");
  next();
});

// ==================== INSTANCE METHODS ====================

userSchema.methods.correctPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateOTP = function() {
  const OTP = crypto.randomInt(100000, 999999).toString(); // 6 digit OTP

  this.otp = crypto
    .createHash("sha256")
    .update(OTP)
    .digest("hex");
  this.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  return OTP;
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// ==================== VIRTUALS ====================
userSchema.virtual("bookings", {
  ref: "Booking",
  foreignField: "client",
  localField: "_id",
});

userSchema.virtual("fullName").get(function() {
  return `${this.firstName || ""} ${this.lastName || ""}`.trim();
});

const User = mongoose.model("User", userSchema);

module.exports = User;
