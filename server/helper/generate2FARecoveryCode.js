import crypto from "crypto";

const generate2FARecoveryCode = (length) => {
	return crypto.randomBytes(length).toString("hex");
};

export default generate2FARecoveryCode;
