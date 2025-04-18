import express from "express";
import {
	register,
	login,
	logout,
	sendEmailVerificationOtp,
	verifyEmail,
	getMyInfo,
	sendPasswordResetLink,
	resetPassword,
} from "../controller/userAuthController.js";
import isLoggedIn from "../middleware/userAuthMiddleware.js";
import {
	authRateLimit,
	otpRateLimit,
	resetPasswordRateLimit,
} from "../security/apiRateLimit.js";
import {
	getGoogleUserProfile,
	handleGoogleCallback,
	initiateGoogleAuth,
} from "../controller/oauthGoogleController.js";
import {
	setup2FA,
	verify2FA,
	LoginUsing2FA,
	disable2FA,
	generateRecoveryCodes,
} from "../controller/userAuth2FAController.js";

const authRouter = express.Router();

authRouter.post("/register", authRateLimit, register);
authRouter.post("/login", authRateLimit, login);
authRouter.get("/logout", logout);
authRouter.post(
	"/send-verification-email",
	isLoggedIn,
	otpRateLimit,
	sendEmailVerificationOtp
);
authRouter.post("/verify-email", isLoggedIn, otpRateLimit, verifyEmail);
authRouter.get("/my-info", isLoggedIn, getMyInfo);
authRouter.post(
	"/send-reset-password-link",
	resetPasswordRateLimit,
	sendPasswordResetLink
);
authRouter.post("/reset-password", resetPasswordRateLimit, resetPassword);
// oauth routes
authRouter.get("/google", initiateGoogleAuth); // automatically redirects to google/callback
authRouter.get("/google/callback", handleGoogleCallback); // automaticaly redirects to /profile frontend page where user deatils are shown
authRouter.get("/user/profile/google", isLoggedIn, getGoogleUserProfile); // if user is already logged in, then this api will called and it will return the user details (google oauth)

// 2FA
authRouter.post("/setup-2FA", isLoggedIn, otpRateLimit, setup2FA);
authRouter.post("/verify-2FA", isLoggedIn, otpRateLimit, verify2FA);
authRouter.post("/login-2FA", authRateLimit, LoginUsing2FA);
authRouter.post("/disable-2FA", isLoggedIn, disable2FA);
authRouter.post(
	"/recovery-code-2FA",
	isLoggedIn,
	authRateLimit,
	generateRecoveryCodes
);

export default authRouter;
