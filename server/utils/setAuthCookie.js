import dotenv from "dotenv";
import jwt from "jsonwebtoken";
dotenv.config();

// set secure cookie with jwt token
const setAuthCookie = (res, user) => {
	const token = jwt.sign(
		{
			user: {
				userId: user._id,
				name: user.name,
				email: user.email,
				profilePicture: user?.profilePicture || null,
				isAccountVerified: user?.isAccountVerified || false,
			},
		},
		process.env.JWT_SECRET,
		{
			expiresIn: "1d",
		}
	);

	// set the token in cookie
	res.cookie("token", token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production", // for localhost (http) it will be false, for production it will be true
		sameSite: process.env.NODE_ENV === "production" ? "none" : "strict", // for localhost (http) it will be strict, for production it will be none
		maxAge: 24 * 60 * 60 * 1000, // 1 days
	});

	return token;
};

export default setAuthCookie;
