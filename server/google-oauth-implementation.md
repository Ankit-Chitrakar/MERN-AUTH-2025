# Google OAuth Implementation Guide

## 1. Setup Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Set up the OAuth consent screen
6. Create OAuth client ID (Web application)
7. Add authorized redirect URIs: `http://localhost:4000/auth/google/callback` (for development)
8. Note your Client ID and Client Secret

## 2. Environment Variables

Add these to your `.env` file:

```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
FRONTEND_BASE_URL=http://localhost:3000
```

## 3. Update Your User Model

Add Google-specific fields to your user model:

```javascript
// userModel.js
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      // Not required for OAuth users
      required: function() {
        return !this.googleId;
      },
      trim: true,
    },
    googleId: {
      type: String,
      default: null,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    // Keep your existing fields
    verifyOtp: {
      type: String,
      default: "",
    },
    verifyOtpExpireAt: {
      type: Number,
      default: 0,
    },
    isAccountVerified: {
      type: Boolean,
      default: false,
    },
    resetToken: {
      type: String,
      default: "",
    },
    resetTokenExpireAt: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);
```

## 4. Create OAuth Utility Functions

Create a new file `utils/oauth.js`:

```javascript
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
dotenv.config();

// Set secure cookie with JWT token (reuse your existing code style)
export const setAuthCookie = (res, user) => {
  // Create a token
  const token = jwt.sign(
    {
      user: {
        userId: user._id,
        name: user.name,
        email: user.email,
        isAccountVerified: user.isAccountVerified,
      },
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );

  // Set the token in cookie
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });

  return token;
};

// Validate access token middleware
export const validateAccessToken = (req, res, next) => {
  if (!req.cookies.token) {
    return res.status(401).json({ error: 'Access Denied!' });
  }
  next();
};
```

## 5. Create Google OAuth Controller

Create a new file `controller/googleAuthController.js`:

```javascript
import axios from "axios";
import userModel from "../models/userModel.js";
import { setAuthCookie } from "../utils/oauth.js";

// Initiate Google OAuth flow
export const initiateGoogleAuth = (req, res) => {
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=http://localhost:4000/auth/google/callback&response_type=code&scope=profile+email`;
  
  res.redirect(googleAuthUrl);
};

// Handle Google OAuth callback
export const handleGoogleCallback = async (req, res) => {
  const { code } = req.query;
  
  try {
    if (!code) {
      return res.status(400).json({ success: false, message: "Authorization code was not provided" });
    }

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token", 
      {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: "http://localhost:4000/auth/google/callback",
        grant_type: "authorization_code"
      },
      { 
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Get user profile from Google
    const googleUserResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo", 
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const { id: googleId, email, name, picture } = googleUserResponse.data;

    // Find or create user
    let user = await userModel.findOne({ email });

    if (user) {
      // Update existing user with Google ID if not already set
      if (!user.googleId) {
        user.googleId = googleId;
        user.profilePicture = picture;
        await user.save();
      }
    } else {
      // Create new user
      user = await userModel.create({
        name,
        email,
        googleId,
        profilePicture: picture,
        isAccountVerified: true, // Auto-verify Google users
      });
    }

    // Set authentication cookie
    setAuthCookie(res, user);

    // Redirect to frontend
    res.redirect(`${process.env.FRONTEND_BASE_URL}/profile`);
  } catch (err) {
    console.error("Google OAuth Error:", err.message);
    res.status(500).json({ 
      success: false, 
      message: `Error during Google authentication: ${err.message}` 
    });
  }
};

// Get Google user profile (already authenticated)
export const getGoogleUserProfile = async (req, res) => {
  try {
    // User is already authenticated via JWT token
    const { userId } = req.user;
    
    const user = await userModel.findById(userId).select("-password -verifyOtp -verifyOtpExpireAt -resetToken -resetTokenExpireAt");
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ 
      success: true, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        isAccountVerified: user.isAccountVerified
      }
    });
  } catch (err) {
    console.error("Error fetching Google user profile:", err.message);
    res.status(500).json({ 
      success: false, 
      message: `Could not fetch user profile: ${err.message}`
    });
  }
};
```

## 6. Create OAuth Routes

Create a new file `routes/googleAuthRoutes.js`:

```javascript
import express from "express";
import { 
  initiateGoogleAuth, 
  handleGoogleCallback, 
  getGoogleUserProfile 
} from "../controller/googleAuthController.js";
import isLoggedIn from "../middleware/userAuthMiddleware.js";

const googleAuthRouter = express.Router();

googleAuthRouter.get("/google", initiateGoogleAuth);
googleAuthRouter.get("/google/callback", handleGoogleCallback);
googleAuthRouter.get("/user/profile/google", isLoggedIn, getGoogleUserProfile);

export default googleAuthRouter;
```

## 7. Update Your Main App File

```javascript
import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRouter from "./routes/authRoutes.js";
import googleAuthRouter from "./routes/googleAuthRoutes.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use("/auth", authRouter);
app.use("/auth", googleAuthRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
```

## 8. Frontend Integration

In your frontend application:

```javascript
// Google OAuth Login Button Component
const GoogleLoginButton = () => {
  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:4000/auth/google";
  };

  return (
    <button onClick={handleGoogleLogin} className="google-login-btn">
      Sign in with Google
    </button>
  );
};
```

## Best Practices for OAuth Implementation

1. **Security First:**
   - Always use HTTPS in production
   - Store tokens in HTTP-only cookies
   - Implement CSRF protection
   - Validate all state parameters

2. **User Experience:**
   - Handle both new and returning users seamlessly
   - Auto-verify email for OAuth users
   - Provide clear error messages

3. **Error Handling:**
   - Handle denied permissions gracefully
   - Provide fallback authentication methods
   - Log authentication failures for monitoring

4. **Token Management:**
   - Store only necessary tokens
   - Implement token refresh mechanism for long sessions
   - Clear tokens properly on logout

5. **Privacy Considerations:**
   - Request only needed scopes (minimize data collection)
   - Have clear privacy policies
   - Allow users to disconnect/revoke OAuth access
