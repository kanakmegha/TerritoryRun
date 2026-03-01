import { verifyToken } from "@clerk/backend";
import User from "../models/User.js";

export const clerkAuth = async (req, res, next) => {
  try {
    // 1. Read Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      console.log("[AUTH] No Authorization header");
      return res.status(401).json({ message: "No auth header" });
    }

    const token = authHeader.replace("Bearer ", "");

    // 2. Verify Clerk token
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    const clerkId = payload.sub;
    const email = payload.email;
    const username = payload.username;

    console.log("[AUTH] Clerk ID:", clerkId);
    console.log("[AUTH] Email:", email);
    console.log("[AUTH] Username:", username);

    // 3. Try to find user already linked to Clerk
    let user = await User.findOne({ clerkId });

    // 4. If not found → try matching by email (ACCOUNT LINKING STEP)
    if (!user && email) {
      console.log("[AUTH] No clerkId match. Trying email match...");
      user = await User.findOne({ email });

      if (user) {
        console.log("[AUTH] Existing user found. Linking Clerk account...");
        user.clerkId = clerkId;
        await user.save();
      }
    }

    // 5. If still no user → create new one
    if (!user) {
      console.log("[AUTH] Creating brand new user from Clerk login");

      user = new User({
        clerkId,
        username: username || `Agent_${clerkId.slice(-5)}`,
        email: email || `user_${clerkId.slice(-5)}@clerk.local`,
        color: "#00FA9A",
        stats: {
          distance: 0,
          territories: 0,
          conquests: 0,
          defenses: 0,
        },
      });

      await user.save();
    }

    // 6. Attach to request
    req.user = user;

    next();
  } catch (err) {
    console.log("AUTH ERROR:", err.message);
    return res.status(401).json({ message: "Unauthorized" });
  }
};