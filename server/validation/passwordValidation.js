const validatePassword = (password) => {
	// Check if password is empty
	if (!password) {
		return false;
	}

	// Password must be 6-20 characters long, include uppercase, lowercase, number, and special character
	const strongPasswordRegex =
		/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+[\]{};':"\\|,.<>/?]).{6,20}$/;

	if (!strongPasswordRegex.test(password)) {
		return false;
	}
	return true;
};
export default validatePassword;
