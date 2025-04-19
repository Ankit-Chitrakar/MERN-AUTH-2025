import qrcode from "qrcode";
import speakeasy from "speakeasy";

import userModel from "../models/userModel.js";
import transporter from "../config/mailTransporter.js";
import setAuthCookie from "../utils/setAuthCookie.js";
import generate2FARecoveryCode from "../helper/generate2FARecoveryCode.js";

const setup2FA = async (req, res) => {
	try {
		const { userId } = req.user;

		// Check if userId is provided
		if (!userId) {
			return res.status(400).json({
				success: false,
				message: "You are not authenticate!! Please login first",
			});
		}

		// Find the user in the database
		const user = await userModel.findById(userId);
		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		// Check if 2FA is already enabled
		if (user.is2faActive) {
			return res.status(400).json({
				success: false,
				message: "Two-factor authentication is already enabled",
			});
		}

		/// Generate a secret key with appropriate issuer and label
		const secret = speakeasy.generateSecret({
			length: 32, // Increased strength
			name: `${user.email}`, // Format: issuer:account
			issuer: `${user.name}`, // Application name
		});

		// generate recovery codes (one time use backup codes)
		const recoveryCodes = [];
		for (let i = 0; i < 8; i++) {
			recoveryCodes.push(generate2FARecoveryCode(10));
		}

		// generate a QR code for the user to scan with their authenticator app
		const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url); // otpauth_url used for qr code generation fro secret

		user.twoFactorSecret = secret.base32;
		user.twoFactorRecoveryCode = recoveryCodes;
		user.twoFactorSecretExpireAt = Date.now() + 10 * 60 * 1000; // 10 minutes

		await user.save();

		// Add this after generating the QR code and recovery codes
		const mailOptions = {
			from: process.env.SENDER_EMAIL,
			to: user.email,
			subject: "Two-Factor Authentication (2FA) Setup Initialized",
			text: `Hello ${user.name},\n\nYour 2FA setup has been initialized. Please scan the QR code using an authenticator app and securely store the recovery codes provided.\n\nIf you did not initiate this, please contact support immediately.\n\nThank you.`,
		};

		// Send the email
		transporter.sendMail(mailOptions, (error, info) => {
			if (error) {
				console.error("Error sending 2FA setup email:", error);
			} else {
				console.log("2FA setup email sent:", info.response);
			}
		});

		return res.status(200).json({
			success: true,
			message:
				"2FA setup initialized. Please save the recovery codes in a secure location. Each code can be used only once and will expire after use.",
			data: {
				qrCodeUrl,
				secret: secret.base32,
				recoveryCodes,
			},
		});
	} catch (err) {
		console.error("Error during 2FA setup:", err.message);
		return res.status(500).json({
			success: false,
			message: `Error during 2FA setup, ${err.message}`,
		});
	}
};

const verify2FA = async (req, res) => {
	try {
		const { userId } = req.user;
		const { token } = req.body;

		// field validations
		if (!userId || !token) {
			return res.status(400).json({
				success: false,
				message: "Missing User-id or Authentication code",
			});
		}

		// fetch the user
		const user = await userModel.findById(userId);

		// chcek user in prsesnt in the db
		if (!user) {
			return res.status(400).json({
				success: false,
				message: "User not found",
			});
		}

		// check 2fa already enabled or not
		if (user.is2faActive) {
			return res.status(400).json({
				success: false,
				message: "Two-factor authentication is already enabled",
			});
		}

		// check that 2fasecret was there saved in the db
		if (!user.twoFactorSecret) {
			res.status(400).json({
				success: false,
				message: "2FA not initialized. Please restart the setup process",
			});
		}

		// check if the 2fa setup has expired
		if (user.twoFactorSecretExpireAt < Date.now()) {
			user.twoFactorSecretExpireAt = 0;
			user.twoFactorSecret = null;
			await user.save();

			return res.status(400).json({
				success: false,
				message: "2FA setup has expired. Please restart the setup process.",
			});
		}

		// verify using totp
		const isVerified = speakeasy.totp.verify({
			secret: user.twoFactorSecret,
			encoding: "base32",
			token: token,
			window: 1,
		});

		// why window is used
		/*
			[-1 step]  [0 step]  [+1 step]
			(30s)     (now)     (30s)


		If a user’s phone is a bit slow or fast compared to your server’s clock, this ensures the OTP still works.

		Without a window, the OTP must match the exact current 30s window, which might cause false failures if there's even a small time sync issue.
		*/

		if (!isVerified) {
			return res.status(400).json({
				success: false,
				message: "Invalid authentication code. Please try again.",
			});
		}

		// make changes in db and store it
		user.is2faActive = true;
		user.twoFactorSecretExpireAt = 0;

		await user.save();

		const mailOptions = {
			from: process.env.SENDER_EMAIL,
			to: user.email,
			subject: "Two-Factor Authentication (2FA) Enabled Successfully",
			text: `Hello ${user.name},
				Your Two-Factor Authentication (2FA) has been successfully enabled for your account. This adds an extra layer of security to help protect your personal information.

				Please make sure to securely store your recovery codes in a safe location. These codes can be used to access your account in case you lose access to your authenticator device.

				If you did not perform this action, please contact our support team immediately.

				Thank you`,
		};

		transporter.sendMail(mailOptions, (error, info) => {
			if (error) {
				console.error("Error verifying 2FA in your email:", error);
			} else {
				console.log("2FA verifying success email sent:", info.response);
			}
		});
		return res.status(200).json({
			success: true,
			message: "Two-factor authentication enabled successfully",
		});
	} catch (err) {
		console.error("Error during 2FA verification:", err.message);
		return res.status(500).json({
			success: false,
			message: `Error during 2FA verification, ${err.message}`,
		});
	}
};

const LoginUsing2FA = async (req, res) => {
	try {
		const { userId, token, isRecoveryToken = false } = req.body; // if isRecoveryToken false menas the token is totp else recovery code

		// field validation
		if (!userId || !token) {
			return res.status(400).json({
				success: false,
				message: "Missing User-id or Authentication code",
			});
		}

		// fetch the user
		const user = await userModel.findById(userId);

		// chcek user in prsesnt in the db
		if (!user) {
			return res.status(400).json({
				success: false,
				message: "User not found",
			});
		}

		let isVerified = false;

		// if the token is a recovery token then
		if (isRecoveryToken) {
			// check if this recoveryToken is present in the user.twoFactorRecoveryCode
			const recoveryCodeIndex = user.twoFactorRecoveryCode.indexOf(token);
			if (recoveryCodeIndex !== -1) {
				user.twoFactorRecoveryCode.splice(recoveryCodeIndex, 1); // delete used token from recoveryCode
				await user.save();
				isVerified = true;
			}
		} else {
			// here means token is a totp
			isVerified = speakeasy.totp.verify({
				secret: user.twoFactorSecret,
				encoding: "base32",
				token: token,
				window: 1,
			});
		}

		if (!isVerified) {
			return res.status(401).json({
				success: false,
				message: "Invalid 2FA token.",
			});
		}

		// set the updated cookie after sucessful login
		setAuthCookie(res, user);

		return res.status(200).json({
			success: true,
			message: "User logged in successfully",
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				googleId: user.googleId,
				profilePicture: user.profilePicture,
				isAccountVerified: user.isAccountVerified,
				is2faActive: user.is2faActive,
			},
		});
	} catch (err) {
		console.error("Error during 2FA validation:", err.message);
		return res.status(500).json({
			success: false,
			message: `Error during 2FA validation, ${err.message}`,
		});
	}
};

const disable2FA = async (req, res) => {
	try {
		const { userId } = req.user;
		const { token } = req.body;

		// field validation
		if (!userId || !token) {
			return res.status(400).json({
				success: false,
				message: "Missing User-id or Authentication code",
			});
		}

		// fetch the user
		const user = await userModel.findById(userId);

		// chcek user in prsesnt in the db
		if (!user) {
			return res.status(400).json({
				success: false,
				message: "User not found",
			});
		}

		// check if 2fa is not enabled
		if (!user.is2faActive) {
			return res.status(400).json({
				success: false,
				message: "Two-factor authentication is not enabled",
			});
		}

		// verify the token
		const isVerified = speakeasy.totp.verify({
			secret: user.twoFactorSecret,
			encoding: "base32",
			token: token,
			window: 1,
		});

		if (!isVerified) {
			return res.status(401).json({
				success: false,
				message: "Invalid 2FA token.",
			});
		}

		// disable 2fa
		user.is2faActive = false;
		user.twoFactorSecret = null;
		user.twoFactorRecoveryCode = [];
		user.twoFactorSecretExpireAt = 0;

		await user.save();

		setAuthCookie(res, user);

		const mailOptions = {
			from: process.env.SENDER_EMAIL,
			to: user.email,
			subject: "Two-Factor Authentication (2FA) Disabled",
			text: `Hello ${user.name},
			Your Two-Factor Authentication (2FA) has been successfully disabled for your account.

			Please be aware that disabling 2FA reduces the security of your account. If you did not perform this action, we strongly recommend contacting our support team immediately.

			Thank you`,
		};

		transporter.sendMail(mailOptions, (error, info) => {
			if (error) {
				console.error("Error sending 2FA disable email:", error);
			} else {
				console.log("2FA disable notification email sent:", info.response);
			}
		});

		return res.status(200).json({
			success: true,
			message: "Two-factor authentication disabled successfully",
		});
	} catch (err) {
		console.error("Error during disable 2FA:", err.message);
		return res.status(500).json({
			success: false,
			message: `Error during disable 2FA, ${err.message}`,
		});
	}
};

const generateRecoveryCodes = async (req, res) => {
	try {
		const { userId } = req.user;
		const { token } = req.body;

		if (!userId || !token) {
			return res.status(400).json({
				success: false,
				message: "Missing User-id or Authentication code",
			});
		}

		const user = await userModel.findById(userId);
		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		if (!user.is2faActive) {
			return res.status(404).json({
				success: false,
				message: "Two-factor authentication is not enabled",
			});
		}

		// Verify current token before generating new codes
		const isVerified = speakeasy.totp.verify({
			secret: user.twoFactorSecret,
			encoding: "base32",
			token: token,
			window: 1,
		});

		if (!isVerified) {
			return res.status(400).json({
				success: false,
				message: "Invalid authentication code",
			});
		}

		// Generate new recovery codes
		const recoveryCodes = [];
		for (let i = 0; i < 8; i++) {
			recoveryCodes.push(generate2FARecoveryCode(10));
		}

		user.twoFactorRecoveryCode = recoveryCodes;
		await user.save();

		return res.status(200).json({
			success: true,
			message:
				"New recovery codes generated successfully. Please save the recovery codes in a secure location. Each code can be used only once and will expire after use.",
			data: {
				recoveryCodes,
			},
		});
	} catch (err) {
		console.error("Error generating recovery codes:", err);
		return res.status(500).json({
			success: false,
			message: "Internal server error while generating recovery codes",
		});
	}
};

export {
	setup2FA,
	verify2FA,
	LoginUsing2FA,
	disable2FA,
	generateRecoveryCodes,
};
