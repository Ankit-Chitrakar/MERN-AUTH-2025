import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		// password: {
		// 	type: String,
		// 	required: true,
		// 	trim: true,
		// },
		password: {
			type: String,
			// Not required for OAuth users
			required: function () {
				return !this.googleId;
			},
			trim: true,
		},
		googleId: {
			type: String,
			default: null,
		},
		profilePicture: {
			type: String,
			default: null,
		},
		verifyOtp: {
			type: String,
			default: "",
		},
		verifyOtpExpireAt: {
			type: Number,
			default: 0,
		},
		isAccountVerified: {
			type: Boolean,
			default: false,
		},
		// resetOtp: {
		// 	type: String,
		// 	default: "",
		// },
		// resetOtpExpireAt: {
		// 	type: Number,
		// 	default: 0,
		// },
		resetToken: {
			type: String,
			default: "",
		},
		resetTokenExpireAt: {
			type: Number,
			default: 0,
		},
		// add 2fa
		is2faActive: {
			type: Boolean,
			default: false,
		},
		twoFactorSecret: {
			type: String,
			default: null,
		},
		twoFactorSecretExpireAt: {
			type: Number,
			default: 0,
		},
		twoFactorRecoveryCode: {
			type: [String],
			default: [],
		},
	},
	{
		timestamps: true,
	}
);

// initialize indexes for faster lookups
userSchema.index({ googleId: 1 }, { sparse: true });

const userModel = mongoose.models.user || mongoose.model("user", userSchema); // if the model is already created, use that model, otherwise create a new one

export default userModel;
