// 20250416130000-add-google-oauth-fields.js
export const up = async (db) => {
	const usersCollection = db.collection("users");

	try {
		// Log the count of documents before making changes
		const count = await usersCollection.countDocuments();
		console.log(`Found ${count} documents in users collection`);

		// 1. Add googleId field if it doesn't exist
		const addGoogleIdResult = await usersCollection.updateMany(
			{ googleId: { $exists: false } },
			{ $set: { googleId: null } }
		);

		// 2. Add profilePicture field if it doesn't exist
		const addProfilePictureResult = await usersCollection.updateMany(
			{ profilePicture: { $exists: false } },
			{ $set: { profilePicture: null } }
		);

		// 3. Update password field's required status (this is handled in schema logic, not in the DB itself)

		// Log results for debugging
		console.log(
			`Added googleId to ${addGoogleIdResult.modifiedCount} documents`
		);
		console.log(
			`Added profilePicture to ${addProfilePictureResult.modifiedCount} documents`
		);

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
					googleId: "",
					profilePicture: "",
				},
			}
		);

		console.log(
			`Removed Google OAuth fields from ${result.modifiedCount} documents`
		);
		return { success: true };
	} catch (error) {
		console.error("Rollback failed:", error);
		return { success: false, error: error.message };
	}
};
