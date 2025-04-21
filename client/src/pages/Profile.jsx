import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Profile = () => {
	const [user, setUser] = useState(null);
	const navigate = useNavigate();

	const fetchUser = async () => {
		try {
			const res = await fetch("/api/auth/user/profile/google", {
				credentials: "include", // important to send cookies
			});
			const data = await res.json();

			if (data.success) {
				setUser(data.user);
			} else {
				navigate("/");
			}
		} catch (err) {
			navigate("/");
		}
	};

	const handleLogout = async () => {
		await fetch("/api/auth/logout", {
			credentials: "include",
		});
		navigate("/");
	};

	useEffect(() => {
		fetchUser();
	}, []);

	if (!user) return <p style={{ textAlign: "center" }}>Loading...</p>;

	return (
		<div style={{ textAlign: "center", marginTop: "2rem" }}>
			<img
				src={user.profilePicture}
				alt="Profile"
				width={100}
				height={100}
				style={{ borderRadius: "50%" }}
			/>
			<h2>{user.name}</h2>
			<p>{user.email}</p>
			<button
				onClick={handleLogout}
				style={{ marginTop: "1rem", padding: "8px 16px" }}>
				Logout
			</button>
		</div>
	);
};

export default Profile;
