import { Request, Response } from "express";
import crypto from "crypto";
import User, { IUser } from "../models/user.model";
import Account from "../models/account.model";
import Session from "../models/session.model";
import { generateToken } from "../middleware/auth";
import axios from "axios";

// Register user with email and password
export const register = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, confirmPassword } = req.body;

  try {
    if (password !== confirmPassword) {
      res.status(400).json({ message: "Passwords do not match" });
      return;
    }

    const userExists = await User.findOne({ email: email?.toLowerCase() });

    if (userExists) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    const username = email.split("@")[0] + Math.floor(Math.random() * 1000);

    const user = await User.create({
      name,
      email: email?.toLowerCase(),
      password,
      username,
    });

    if (user) {
      const token = generateToken(user._id.toString());

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        token,
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Login user with email/username and password
export const login = async (req: Request, res: Response): Promise<void> => {
  const { emailOrUsername, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [
        { email: emailOrUsername?.toLowerCase() },
        { username: emailOrUsername },
      ],
    });

    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const token = generateToken(user._id.toString());

    // Create session
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + 7);

    await Session.create({
      sessionToken: crypto.randomBytes(32).toString("hex"),
      userId: user._id,
      expires: expiresDate,
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GitHub OAuth
export const githubAuth = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { code } = req.body;

  if (!code) {
    res.status(400).json({ message: "Authorization code is required" });
    return;
  }

  try {
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    const { access_token } = tokenResponse.data;

    if (!access_token) {
      res.status(400).json({ message: "Failed to get access token" });
      return;
    }

    // Get user data from GitHub
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `token ${access_token}`,
      },
    });

    const { id, login, name, avatar_url, email } = userResponse.data;

    let primaryEmail = email;
    if (!primaryEmail) {
      const emailsResponse = await axios.get(
        "https://api.github.com/user/emails",
        {
          headers: {
            Authorization: `token ${access_token}`,
          },
        },
      );

      const primaryEmailObj = emailsResponse.data.find((e: any) => e.primary);
      primaryEmail = primaryEmailObj ? primaryEmailObj.email : null;
    }

    let account = await Account.findOne({
      provider: "github",
      providerAccountId: id.toString(),
    });

    let user: IUser | null = null;

    if (account) {
      user = await User.findById(account.userId);
    } else {
      if (primaryEmail) {
        user = await User.findOne({ email: primaryEmail });
      }

      if (!user) {
        user = await User.create({
          name: name || login,
          email: primaryEmail,
          username: login,
          image: avatar_url,
        });
      }

      account = await Account.create({
        userId: user._id,
        type: "oauth",
        provider: "github",
        providerAccountId: id.toString(),
        access_token,
      });
    }

    if (!user) {
      res.status(500).json({ message: "Failed to create or find user" });
      return;
    }

    const token = generateToken(user._id.toString());

    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + 7);

    await Session.create({
      sessionToken: crypto.randomBytes(32).toString("hex"),
      userId: user._id,
      expires: expiresDate,
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      image: user.image,
      role: user.role,
      token,
    });
  } catch (error) {
    console.error("GitHub auth error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Google OAuth
export const googleAuth = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { code } = req.body;

  if (!code) {
    res.status(400).json({ message: "Authorization code is required" });
    return;
  }

  try {
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      },
    );

    const { access_token, id_token } = tokenResponse.data;

    if (!access_token) {
      res.status(400).json({ message: "Failed to get access token" });
      return;
    }

    const userResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      },
    );

    const { id, email, name, picture } = userResponse.data;

    let account = await Account.findOne({
      provider: "google",
      providerAccountId: id,
    });

    let user: IUser | null = null;

    if (account) {
      user = await User.findById(account.userId);
    } else {
      if (email) {
        user = await User.findOne({ email });
      }

      if (!user) {
        const username = email.split("@")[0] + Math.floor(Math.random() * 1000);

        user = await User.create({
          name,
          email,
          username,
          image: picture,
        });
      }

      account = await Account.create({
        userId: user._id,
        type: "oauth",
        provider: "google",
        providerAccountId: id,
        access_token,
        id_token,
      });
    }

    if (!user) {
      res.status(500).json({ message: "Failed to create or find user" });
      return;
    }

    const token = generateToken(user._id.toString());

    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + 7);

    await Session.create({
      sessionToken: crypto.randomBytes(32).toString("hex"),
      userId: user._id,
      expires: expiresDate,
    });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      image: user.image,
      role: user.role,
      token,
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get current user profile
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id).select("-password");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Logout
export const logout = async (req: Request, res: Response) => {
  try {
    if (req.user) {
      await Session.deleteMany({ userId: req.user._id });
    }
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
