import process from 'node:process';
import { verifyToken as clerkVerifyToken } from "@clerk/backend";
import User from "../models/User.js";

// Resolve Clerk signing keys lazily per request. The `clerkAuth` middleware is
// instantiated at module load time, but dotenv loads CLERK_SECRET_KEY later in
// server/index.js (after the import chain that builds this middleware). Reading
// process.env here keeps verification working regardless of import order and
// never logs the token or the secret key.
function resolveSigningKeys({ secretKey, jwtKey }) {
  return {
    secretKey: secretKey ?? process.env.CLERK_SECRET_KEY,
    jwtKey: jwtKey ?? process.env.CLERK_JWT_KEY,
  };
}

export function createClerkAuth({
  verifyToken = clerkVerifyToken,
  UserModel = User,
  secretKey,
  jwtKey,
} = {}) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const match = typeof authHeader === 'string' && authHeader.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
      console.log('[Auth] missing or malformed Authorization header');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = match[1];
    const { secretKey: resolvedSecretKey, jwtKey: resolvedJwtKey } = resolveSigningKeys({ secretKey, jwtKey });

    let payload;
    try {
      payload = await verifyToken(token, { secretKey: resolvedSecretKey, jwtKey: resolvedJwtKey });
    } catch (err) {
      const reason = err?.reason || err?.name || 'verification-error';
      console.warn('[Auth] token verification failed', { reason });
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const clerkId = payload.sub;
    const email = payload.email || '';
    const username = payload.username || `user_${clerkId.slice(-5)}`;

    try {
      let user = await UserModel.findOne({ clerkId });
      if (!user && email) {
        user = await UserModel.findOne({ email });
        if (user) {
          user.clerkId = clerkId;
          await user.save();
        }
      }
      if (!user) {
        user = new UserModel({
          clerkId,
          username,
          email: email || `user_${clerkId.slice(-5)}@clerk.local`,
          color: '#00FA9A',
          stats: { distance: 0, territories: 0, conquests: 0, defenses: 0 },
        });
        await user.save();
      }

      req.user = user;
      return next();
    } catch (err) {
      console.warn('[Auth] downstream profile lookup failed', { message: err?.message });
      return res.status(500).json({ message: 'Failed to fetch profile' });
    }
  };
}

export const clerkAuth = createClerkAuth();
