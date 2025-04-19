export const up = async (db) => {
	const usersCollection = db.collection("users");

	try {
		const count = await usersCollection.countDocuments();
		console.log(`Found ${count} documents in users collection`);

		const updateResult = await usersCollection.updateMany(
			{},
			{
				$set: {
					is2faActive: false,
					twoFactorSecret: null,
					twoFactorSecretExpireAt: 0,
					twoFactorRecoveryCode: [],
				},
			}
		);

		console.log(
			`Updated ${updateResult.modifiedCount} documents with 2FA fields`
		);

		const sampleDoc = await usersCollection.findOne({});
		console.log("Sample document after migration:", sampleDoc);

		return { success: true };
	} catch (error) {
		console.error("Migration failed:", error);
		return { success: false, error: error.message };
	}
};

export const down = async (db) => {
	const usersCollection = db.collection("users");

	try {
		const result = await usersCollection.updateMany(
			{},
			{
				$unset: {
					is2faActive: "",
					twoFactorSecret: "",
					twoFactorSecretExpireAt: "",
					twoFactorRecoveryCode: "",
				},
			}
		);

		console.log(`Removed 2FA fields from ${result.modifiedCount} documents`);
		return { success: true };
	} catch (error) {
		console.error("Rollback failed:", error);
		return { success: false, error: error.message };
	}
};
