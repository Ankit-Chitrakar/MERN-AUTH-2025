// 20250413150000-add-reset-token-fields.js
export const up = async (db) => {
	const usersCollection = db.collection("users");

	try {
		// Log the count of documents before making changes
		const count = await usersCollection.countDocuments();
		console.log(`Found ${count} documents in users collection`);

		// 1. Add resetToken and resetTokenExpireAt if they don't exist
		const updateTokenResult = await usersCollection.updateMany(
			{ resetToken: { $exists: false } },
			{ $set: { resetToken: "" } }
		);

		const updateTokenExpireResult = await usersCollection.updateMany(
			{ resetTokenExpireAt: { $exists: false } },
			{ $set: { resetTokenExpireAt: null } }
		);

		// 2. Rename resetOtp fields to resetToken if they exist
		const renameResult = await usersCollection.updateMany(
			{ resetOtp: { $exists: true } },
			{
				$rename: {
					resetOtp: "resetToken",
					resetOtpExpireAt: "resetTokenExpireAt",
				},
			}
		);

		// Log results for debugging
		console.log(
			`Added resetToken to ${updateTokenResult.modifiedCount} documents`
		);
		console.log(
			`Added resetTokenExpireAt to ${updateTokenExpireResult.modifiedCount} documents`
		);
		console.log(`Renamed fields in ${renameResult.modifiedCount} documents`);

		// Show a sample document after changes
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
		// Remove the added fields
		const result = await usersCollection.updateMany(
			{},
			{
				$unset: {
					resetToken: "",
					resetTokenExpireAt: "",
				},
			}
		);

		console.log(`Removed fields from ${result.modifiedCount} documents`);
		return { success: true };
	} catch (error) {
		console.error("Rollback failed:", error);
		return { success: false, error: error.message };
	}
};
