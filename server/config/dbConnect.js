import mongoose from "mongoose";
const connectDB = async () => {
	try {
		await mongoose.connect(`${process.env.MONGODB_URI}/${process.env.DB_NAME}`);
		console.log(
			`✅ ${
				process.env.DB_NAME
			} Database connected successfully ==> ${new Date().toLocaleString()}`
		);
	} catch (err) {
		console.error(`❌ Database connection failed: ${err.message}`);
		process.exit(1);
	}
};

export default connectDB;
