const generateOTP = (digit = 6) => {
	// check if digit is valid or nt
	if (typeof digit !== "number" || digit < 4 || digit > 10) {
		throw new Error("Digit must be a number between 4 and 10");
	}

	// generate OTP
	const min = 10 ** (digit - 1);
	const max = 10 ** digit - 1;
	const otp = Math.floor(Math.random() * (max - min + 1)) + min;

	return String(otp);
};

export default generateOTP;
