import React from "react";

const Home = () => {
	const handleGoogleLogin = () => {
		window.location.href = `http://localhost:3000/api/auth/google`; // triggers backend OAuth
	};

	return (
		<div className="flex flex-col items-center justify-center h-screen bg-[#121212] text-white">
			<h1 className="text-3xl font-bold mb-6">Login with Google</h1>

			<button
				onClick={handleGoogleLogin}
				style={{
					display: "flex",
					flexDirection: "row",
					alignItems: "center",
					gap: "12px",
					backgroundColor: "black",
					color: "white",
					padding: "10px 20px",
					border: "none",
					borderRadius: "6px",
					cursor: "pointer",
					transition: "background-color 0.2s ease-in-out",
				}}
				onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#1a1a1a")}
				onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "black")}>
				<span style={{ width: "20px", height: "20px" }}>
					<svg
						width="100%"
						height="100%"
						viewBox="0 0 533.5 544.3"
						xmlns="http://www.w3.org/2000/svg">
						<path
							fill="#4285F4"
							d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.3H272.1v95.2h146.9c-6.4 34.4-25.6 63.6-54.7 83.1v68h88.4c51.7-47.6 81.8-117.8 81.8-196z"
						/>
						<path
							fill="#34A853"
							d="M272.1 544.3c73.8 0 135.6-24.5 180.8-66.8l-88.4-68c-24.6 16.5-56.1 26.2-92.4 26.2-71 0-131.2-47.9-152.7-112.1H27.5v70.3c45.4 89.5 138.3 150.4 244.6 150.4z"
						/>
						<path
							fill="#FBBC05"
							d="M119.4 323.6c-10.3-30.1-10.3-62.7 0-92.8V160.5H27.5c-39.9 79.7-39.9 174.5 0 254.2l91.9-70.3z"
						/>
						<path
							fill="#EA4335"
							d="M272.1 107.7c39.9-.6 78.1 14 107.4 40.9l80.2-80.2C409.3 24.6 343.5-0.1 272.1 0 165.8 0 72.9 60.9 27.5 150.4l91.9 70.3c21.5-64.2 81.7-112.1 152.7-112.1z"
						/>
					</svg>
				</span>
				<span style={{ fontWeight: 500 }}>Sign in with Google</span>
			</button>
		</div>
	);
};

export default Home;
