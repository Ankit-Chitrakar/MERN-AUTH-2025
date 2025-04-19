import axios from "axios";
import userModel from "../models/userModel.js";
import setAuthCookie from "../utils/setAuthCookie.js";

// Initialize Google OAuth flow
const initiateGoogleAuth = (req, res) => {
	const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=profile+email`;

	// when hit the initiateGoogleAuth endpoint, redirect to google auth url where user will be asked to login and give permission to access their profile and email
	// after that google will redirect to the redirect uri with a code in the query params
	// and then we will use this code to get the access token and user details
	res.redirect(googleAuthUrl);
};

// Handle Google OAuth callback
const handleGoogleCallback = async (req, res) => {
	try {
		const { code } = req.query;

		// check the code is present or not
		if (!code) {
			return res.status(400).json({
				success: false,
				message: "Authorization code was not provided",
			});
		}

		// exchange the code for access token
		const tokenResponse = await axios.post(
			"https://oauth2.googleapis.com/token",
			{
				code: code,
				client_id: process.env.GOOGLE_CLIENT_ID,
				client_secret: process.env.GOOGLE_CLIENT_SECRET,
				redirect_uri: process.env.GOOGLE_REDIRECT_URI,
				grant_type: "authorization_code",
			},
			{
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
			}
		);

		const { access_token } = tokenResponse.data;
		// check the access token is present or not
		if (!access_token) {
			res.status(400).json({
				success: false,
				message: "Access token was not provided",
			});
		}

		// fetch user details using the access token
		const googleUserResponse = await axios.get(
			"https://www.googleapis.com/oauth2/v1/userinfo",
			{
				headers: {
					Authorization: `Bearer ${access_token}`,
				},
			}
		);

		const { id, email, name, picture } = googleUserResponse.data;

		// check if user already exists in the database
		let user = await userModel.findOne({ email });

		if (!user) {
			// Create new user if not found
			user = await userModel.create({
				name,
				email,
				googleId: id,
				profilePicture: picture,
				isAccountVerified: true,
			});
		} else {
			// If user exists but is not linked to Google, update their record with googleId
			if (!user.googleId) {
				user.googleId = id;
				user.profilePicture = picture;
				user.isAccountVerified = true;
				await user.save();
			} else {
				// Already linked with Google, just update the profile picture and verified status
				user = await userModel.findByIdAndUpdate(
					user._id,
					{
						profilePicture: picture,
						isAccountVerified: true,
					},
					{ new: true }
				);
			}
		}

		// set the auth cookie with the user details
		setAuthCookie(res, user);

		// redirect to the frontend with success message
		res.redirect(`${process.env.CLIENT_URL}/profile`);
	} catch (err) {
		console.error("Google OAuth Error:", err.message);
		return res.status(500).json({
			success: false,
			message: `Error during Google authentication, ${err.message}`,
		});
	}
};

// if user is already logged in, then redirect to the profile page
const getGoogleUserProfile = async (req, res) => {
	try {
		// user is alreday authenticated via jwt and later came up with google login
		const { userId } = req.user;

		// find the user in the database
		const user = await userModel
			.findById(userId)
			.select(
				"-password -verifyOtp -verifyOtpExpireAt -resetToken -resetTokenExpireAt"
			);

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}
		res.status(200).json({
			success: true,
			message: "User profile fetched successfully",
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				profilePicture: user.profilePicture,
				isAccountVerified: user.isAccountVerified,
			},
		});
	} catch (err) {
		console.error("Google OAuth Error:", err.message);
		return res.status(500).json({
			success: false,
			message: `Error during Google authentication, ${err.message}`,
		});
	}
};

export { initiateGoogleAuth, handleGoogleCallback, getGoogleUserProfile };
