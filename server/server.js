import express from "express";
import cors from "cors";
import "dotenv/config";
import cookieParser from "cookie-parser";
import connectDB from "./config/dbConnect.js";
import authRouter from "./router/userAuthRouter.js";

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json()); // all the requests will be parse in json format
app.use(cookieParser()); // to parse cookies
app.use(express.urlencoded({ extended: true })); // to parse form data
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true })); // to allow cross-origin requests

// Connect the Database
connectDB();

// Routes
app.get("/", (req, res) => {
	res.status(200).json({ message: "Server is running" });
});

app.use("/api/auth", authRouter);

// server listens here
app.listen(PORT, () => {
	console.log(
		`✅ Server is running on PORT:${PORT} ==> ${new Date().toLocaleString()}`
	);
});
