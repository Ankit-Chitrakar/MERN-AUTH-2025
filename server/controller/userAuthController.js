import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import handlebars from "handlebars";
import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import { dirname } from "path";
import dotenv from "dotenv";

import userModel from "../models/userModel.js";
import validatePassword from "../validation/passwordValidation.js";
import validateEmail from "../validation/emailValidation.js";
import transporter from "../config/mailTransporter.js";
import generateOTP from "../helper/generateOTP.js";
import generateToken from "../helper/generateToken.js";
import setAuthCookie from "../utils/setAuthCookie.js";

// for load mail template
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();

const register = async (req, res) => {
	try {
		const { name, email, password } = req.body;

		// field Validation
		if (!name || !email || !password) {
			return res.status(400).json({
				success: false,
				message: "Please provide all the fields (Name, Email, Password)*",
			});
		}

		// check email validation
		if (!validateEmail(email)) {
			return res.status(400).json({
				success: false,
				message: "Please provide a valid email address like xyz@example.com",
			});
		}

		// check if user already exists
		const existingUser = await userModel.findOne({ email });

		if (existingUser) {
			return res.status(400).json({
				success: false,
				message: "User already exists with this email address",
			});
		}

		// Check password validations
		if (validatePassword(password) === false) {
			return res.status(400).json({
				success: false,
				message:
					"Password must be 6-20 characters long, include uppercase, lowercase, number, and special character",
			});
		}

		// if password meets the criteria, hash the password
		const hashedPassword = await bcrypt.hash(password, 10);

		// create a new user
		const newUser = await userModel.create({
			name,
			email,
			password: hashedPassword,
		});

		// save the user in the db
		await newUser.save();

		setAuthCookie(res, newUser); // set the auth cookie with the user details

		// load the mailer template
		const source = fs.readFileSync(
			path.join(__dirname, "../template/registrationMail.html"),
			"utf-8"
		);
		const template = handlebars.compile(source);
		const htmlToSend = template({
			name: newUser.name,
			clientUrl: process.env.CLIENT_URL,
			year: new Date().getFullYear(),
		});

		// send welcome mail
		const mailOptions = {
			from: process.env.SENDER_EMAIL,
			to: newUser.email,
			subject: `🎉 Welcome Onboard, ${newUser.name}!`,
			html: htmlToSend,
		};

		// send the mail using nodemailer
		transporter.sendMail(mailOptions, (error, info) => {
			if (error) console.error("Error sending email:", error);
			else console.log("Email sent:", info.response);
		});

		// send the response
		return res.status(201).json({
			success: true,
			message: "User registered successfully",
			user: {
				id: newUser._id,
				name: newUser.name,
				email: newUser.email,
			},
		});
	} catch (err) {
		console.error(err.message);
		return res.status(500).json({
			success: false,
			message: `Internal Server Error, ${err.message}`,
		});
	}
};

const login = async (req, res) => {
	try {
		const { email, password } = req.body;

		// field Validation
		if (!email || !password) {
			return res.status(400).json({
				success: false,
				message: "Please provide all the fields (Email, Password)*",
			});
		}

		// check email validation
		if (!validateEmail(email)) {
			return res.status(400).json({
				success: false,
				message: "Please provide a valid email address like xyz@example.com",
			});
		}

		// check email is present in the db or not
		const user = await userModel.findOne({ email });
		if (!user) {
			return res.status(400).json({
				success: false,
				message: "No user found with this email address",
			});
		}

		// check password is correct or not
		const isPasswordMatched = await bcrypt.compare(password, user.password);
		if (!isPasswordMatched) {
			return res.status(400).json({
				success: false,
				message: "Invalid credentials",
			});
		}

		if (user.is2faActive) {
			return res.status(200).json({
				success: true,
				message:
					"Two-Factor Authentication (2FA) is enabled for your account. Please provide the TOTP code from your authenticator app to complete the login process.",
				userId: user._id,
			});
		}

		setAuthCookie(res, user); // set the auth cookie with the user details

		// send the response
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
		console.error(err.message);
		return res.status(500).json({
			success: false,
			message: `Internal Server Error, ${err.message}`,
		});
	}
};

const logout = async (req, res) => {
	try {
		// clear the cookie
		res.clearCookie("token", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
		});

		return res.status(200).json({
			success: true,
			message: "User logged out successfully",
		});
	} catch (err) {
		console.error(err.message);
		return res.status(500).json({
			success: false,
			message: `Internal Server Error, ${err.message}`,
		});
	}
};

const sendEmailVerificationOtp = async (req, res) => {
	try {
		const { userId, email, isAccountVerified } = req.user; // userId and email and isAccountVerified are coming from the token

		// field Validation
		if (!userId || !email) {
			return res.status(400).json({
				success: false,
				message: "Unauthorized, please login first",
			});
		}

		// check if user is alaready verified or not
		if (isAccountVerified) {
			return res.status(400).json({
				success: false,
				message: "Your email is already verified",
			});
		}

		// generate otp for email verification
		const otp = generateOTP(6);
		const otpExpireAt = Date.now() + 5 * 60 * 1000; // 5 minutes

		// hash the otp for security
		const hashedOtp = await bcrypt.hash(otp, 10);

		// update the user
		await userModel.findByIdAndUpdate(
			userId,
			{
				$set: {
					verifyOtp: hashedOtp,
					verifyOtpExpireAt: otpExpireAt,
				},
			},
			{
				new: true,
			}
		);

		// send the otp to the user email
		const mailOptions = {
			from: process.env.SENDER_EMAIL,
			to: email,
			subject: `🔑 Email Verification OTP`,
			text: `Your OTP for email verification is ${otp}. It is valid for 5 minutes.`,
		};

		// send the mail using nodemailer
		transporter.sendMail(mailOptions, (error, info) => {
			if (error) console.error("Error sending email:", error);
			else console.log("Email sent:", info.response);
		});

		// send the response
		return res.status(200).json({
			success: true,
			message: "OTP sent to your email address",
		});
	} catch (err) {
		console.error(err.message);
		return res.status(500).json({
			success: false,
			message: `Internal Server Error, ${err.message}`,
		});
	}
};

const verifyEmail = async (req, res) => {
	try {
		const { userId, isAccountVerified } = req.user; // userId and email and isAccountVerified are coming from the token
		const { otp } = req.body; // otp is coming from the request body

		if (isAccountVerified) {
			return res.status(400).json({
				success: false,
				message: "Your email is already verified",
			});
		}

		// field validation
		if (!otp || typeof otp !== "string") {
			return res.status(400).json({
				success: false,
				message: "Please provide a valid otp",
			});
		}

		// check the otp with hashed db otp and also check for the otp expiration
		const userDetails = await userModel.findById(userId);
		if (!userDetails) {
			return res.status(400).json({
				success: false,
				message: "User not found",
			});
		}

		const { otpExpireAt, verifyOtp } = userDetails;

		// check for time expiration for otp
		if (otpExpireAt < Date.now()) {
			return res.status(400).json({
				success: false,
				message: "OTP expired, please resend the OTP",
			});
		}

		// match the otp with the hashed otp
		const isOtpMatched = await bcrypt.compare(otp, verifyOtp);

		if (!isOtpMatched) {
			return res.status(400).json({
				success: false,
				message: "Invalid OTP",
			});
		}

		// otp matched please update in the db that account is verified
		const updatedUser = await userModel.findByIdAndUpdate(
			userId,
			{
				$set: {
					isAccountVerified: true,
					verifyOtp: "",
					verifyOtpExpireAt: 0,
				},
			},
			{
				new: true, // return the updated user
			}
		);

		if (!updatedUser) {
			return res.status(400).json({
				success: false,
				message: "Unable to verify your email",
			});
		}

		setAuthCookie(res, updatedUser); // set the auth cookie with the user details

		// send mail
		const mailOptions = {
			from: process.env.SENDER_EMAIL,
			to: updatedUser.email,
			subject: `✅ Email Verified Successfully`,
			text: `${userDetails.name}, your email has been verified successfully. Welcome aboard!`,
		};

		transporter.sendMail(mailOptions, (error, info) => {
			if (error) console.error("Error sending email:", error);
			else console.log("Email sent:", info.response);
		});

		// send the response
		return res.status(200).json({
			success: true,
			message: "Email verified successfully",
		});
	} catch (err) {
		console.error(err.message);
		return res.status(500).json({
			success: false,
			message: `Internal Server Error, ${err.message}`,
		});
	}
};

const getMyInfo = async (req, res) => {
	try {
		const { userId } = req.user; // userId is coming from the token

		// field validation
		if (!userId) {
			return res.status(400).json({
				success: false,
				message: "Unauthorized, please login first",
			});
		}

		// get the user details from the db
		const userDetails = await userModel
			.findById(userId)
			.select(
				"-password -verifyOtp -verifyOtpExpireAt -resetOtp -resetOtpExpireAt"
			); // exlude this fields for security

		res.status(200).json({
			success: true,
			message: "My user details",
			user: {
				id: userDetails._id,
				name: userDetails.name,
				email: userDetails.email,
				profilePicture: userDetails.profilePicture,
				isAccountVerified: userDetails.isAccountVerified,
				is2faActive: userDetails.is2faActive,
				createdAt: `${Date(userDetails.createdAt).toLocaleString()}`,
			},
		});
	} catch (err) {
		console.error(err.message);
		return res.status(500).json({
			success: false,
			message: `Internal Server Error, ${err.message}`,
		});
	}
};

const sendPasswordResetLink = async (req, res) => {
	try {
		const { email } = req.body;

		// field validation
		if (!email) {
			return res.status(400).json({
				success: false,
				message: "Please provide email address",
			});
		}
		// check email validation
		if (!validateEmail(email)) {
			return res.status(400).json({
				success: false,
				message: "Please provide a valid email address like xyz@example.com",
			});
		}

		// check if user exists in the db
		const user = await userModel.findOne({ email });
		if (!user) {
			return res.status(400).json({
				success: false,
				message: "No user found with this email address",
			});
		}

		// generate password reset link (token)
		const resetToken = generateToken();
		const resetTokenExpireAt = Date.now() + 5 * 60 * 1000; // 5 minutes

		// update this in the db
		const updatedUser = await userModel.findByIdAndUpdate(
			user._id,
			{
				$set: {
					resetToken,
					resetTokenExpireAt,
				},
			},
			{
				new: true,
			}
		);

		if (!updatedUser) {
			return res.status(400).json({
				success: false,
				message: "Unable to send reset link",
			});
		}

		// send the reset link to the user email
		// Load Handlebars template
		const source = fs.readFileSync(
			path.join(__dirname, "../template/passwordResetMail.html"),
			"utf-8"
		);
		const template = handlebars.compile(source);
		const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
		const htmlToSend = template({
			name: user.name,
			resetLink,
			year: new Date().getFullYear(),
		});

		// Send reset link email
		const mailOptions = {
			from: process.env.SENDER_EMAIL,
			to: email,
			subject: `🔑 Reset Your Password`,
			html: htmlToSend,
		};

		transporter.sendMail(mailOptions, (error, info) => {
			if (error) {
				console.error("Error sending email:", error);
			} else {
				console.log("Email sent:", info.response);
			}
		});

		// send the response
		return res.status(200).json({
			success: true,
			message: "Password reset link sent to your email address",
		});
	} catch (err) {
		console.error(err.message);
		return res.status(500).json({
			success: false,
			message: `Internal Server Error, ${err.message}`,
		});
	}
};

const resetPassword = async (req, res) => {
	try {
		const { token, newPassword } = req.body;

		// field validation
		if (!token || !newPassword) {
			return res.status(400).json({
				success: false,
				message: "Please provide token and new password",
			});
		}

		// check password validations
		if (validatePassword(newPassword) === false) {
			return res.status(400).json({
				success: false,
				message:
					"Password must be 6-20 characters long, include uppercase, lowercase, number, and special character",
			});
		}

		// check if user exists in the db
		const user = await userModel.findOne({ resetToken: token });
		if (!user) {
			return res.status(400).json({
				success: false,
				message: "Invalid or expired token",
			});
		}

		// check for token expiration
		if (user.resetTokenExpireAt < Date.now()) {
			return res.status(400).json({
				success: false,
				message: "Token expired, please resend the reset link",
			});
		}

		// hash the new password
		const hashedNewPassword = await bcrypt.hash(newPassword, 10);

		// update the password in the db
		const updatedUser = await userModel.findByIdAndUpdate(
			user._id,
			{
				$set: {
					password: hashedNewPassword,
					resetToken: "",
					resetTokenExpireAt: 0,
				},
			},
			{
				new: true,
			}
		);

		if (!updatedUser) {
			return res.status(400).json({
				success: false,
				message: "Unable to reset password",
			});
		}

		// send the response
		return res.status(200).json({
			success: true,
			message: "Password reset successfully",
		});
	} catch (err) {
		console.error(err.message);
		return res.status(500).json({
			success: false,
			message: `Internal Server Error, ${err.message}`,
		});
	}
};

export {
	register,
	login,
	logout,
	sendEmailVerificationOtp,
	verifyEmail,
	getMyInfo,
	sendPasswordResetLink,
	resetPassword,
};
