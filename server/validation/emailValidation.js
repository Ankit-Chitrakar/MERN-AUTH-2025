const validateEmail = (email) => {
	if (!email || typeof email !== "string") {
		return false;
	}

	// email regex
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email.trim())) {
		return false;
	}

	return true;
};

export default validateEmail;
