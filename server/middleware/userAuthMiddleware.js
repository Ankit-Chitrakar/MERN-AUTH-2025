import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const isLoggedIn = (req, res, next) => {
	try {
		const { token } = req.cookies;
		if (!token) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized, please login first",
			});
		}

		// verify the token
		const tokenDetails = jwt.verify(token, process.env.JWT_SECRET);

		// check if the token is valid
		if (!tokenDetails || !tokenDetails.user) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized, please login first",
			});
		}

		// add this toekn details to req.user
		req.user = tokenDetails.user;

		next();
	} catch (err) {
		console.error(err.message);
		return res.status(500).json({
			success: false,
			message: `Internal Server Error, ${err.message}`,
		});
	}
};

export default isLoggedIn;
