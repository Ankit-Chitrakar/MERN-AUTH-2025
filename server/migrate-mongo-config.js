import dotenv from "dotenv";

dotenv.config();

const config = {
	mongodb: {
		url: process.env.MONGODB_URI || "mongodb://localhost:27017",
		databaseName: process.env.DB_NAME || "mern-auth",
	},
	migrationsDir: "migrations",
	changelogCollectionName: "changelog",
	migrationFileExtension: ".js",
};

export default config;
