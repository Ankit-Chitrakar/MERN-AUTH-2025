import rateLimit from "express-rate-limit";

const createRateLimit = ({ windowMs, max, message }) =>
	rateLimit({
		windowMs: windowMs || 10 * 60 * 1000, // 5 minutes
		max: max || 10,
		message: message || "Too many requests, please try again later.",
		standardHeaders: true,
		legacyHeaders: false,
		skipFailedRequests: true, // skip failed requests
		skipSuccessfulRequests: false, // do not skip successful requests
		keyGenerator: (req, res) => req.ip, // use IP address as key
		handler: (req, res) => {
			res.status(429).json({
				success: false,
				message: message || "Too many requests, please try again later.",
			});
		},
	});

const authRateLimit = createRateLimit({
	windowMs: 10 * 60 * 1000, // 10 minutes
	max: 5, // limit each IP to 5 requests per windowMs
	message: "Too many auth attempts, please try again later.",
});

const resetPasswordRateLimit = createRateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 3, // limit each IP to 3 requests per windowMs
	message: "Too many password reset attempts, please try again later.",
});

const otpRateLimit = createRateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 3, // limit each IP to 3 requests per windowMs
	message: "Too many OTP requests, please try again later.",
});

export { authRateLimit, resetPasswordRateLimit, otpRateLimit };
