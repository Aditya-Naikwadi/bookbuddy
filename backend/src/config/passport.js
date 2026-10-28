const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const crypto = require('crypto');

const env = require('./env');
const User = require('../models/User');
const College = require('../models/College');
const logger = require('../utils/logger');

// Helper to resolve or create a default active college for OAuth users
const getDefaultCollege = async () => {
  let defaultCollege = await College.findOne({ isActive: true });
  if (!defaultCollege) {
    defaultCollege = await College.create({
      name: 'Main Campus',
      code: 'MAIN',
      isActive: true,
      status: 'active',
    });
  }
  return defaultCollege;
};

// Helper to resolve college using tenant context from verified OAuth state
const resolveCollegeFromState = async (req) => {
  const state = req?.verifiedOAuthState;
  if (state?.collegeId) {
    const college = await College.findOne({ _id: state.collegeId, isActive: true });
    if (college) return college;
  }
  if (state?.collegeSlug) {
    const college = await College.findOne({ slug: state.collegeSlug, isActive: true });
    if (college) return college;
  }
  return getDefaultCollege();
};

// ---------------------------------------------------------------------------
// Google OAuth Strategy
// ---------------------------------------------------------------------------
const googleClientId = env.GOOGLE_CLIENT_ID || 'placeholder_google_client_id';
const googleClientSecret = env.GOOGLE_CLIENT_SECRET || 'placeholder_google_client_secret';
const googleCallbackUrl =
  env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/google/callback';

passport.use(
  new GoogleStrategy(
    {
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: googleCallbackUrl,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email =
          profile.emails && profile.emails[0] ? profile.emails[0].value.toLowerCase() : null;
        const name = profile.displayName || profile.username || 'Google User';
        const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : '';

        if (!email) {
          return done(new Error('No email associated with Google account'), null);
        }

        let user = await User.findOne({
          $or: [{ googleId }, { email }],
        });

        if (user) {
          let updated = false;
          if (!user.googleId) {
            user.googleId = googleId;
            updated = true;
          }
          if (avatar && !user.avatar) {
            user.avatar = avatar;
            updated = true;
          }
          if (!user.isEmailVerified) {
            user.isEmailVerified = true;
            updated = true;
          }
          if (updated) {
            await user.save();
          }
        } else {
          const targetCollege = await resolveCollegeFromState(req);
          const studentId = `G-${crypto.randomInt(100000, 999999)}`;

          user = await User.create({
            googleId,
            authProvider: 'google',
            studentId,
            name,
            email,
            avatar,
            collegeId: targetCollege._id,
            role: 'student',
            isEmailVerified: true,
            membershipStatus: 'active',
            status: 'active',
          });
        }

        return done(null, user);
      } catch (err) {
        logger.error(`Google Passport OAuth error: ${err.message}`);
        return done(err, null);
      }
    }
  )
);

// ---------------------------------------------------------------------------
// GitHub OAuth Strategy
// ---------------------------------------------------------------------------
const githubClientId = env.GITHUB_CLIENT_ID || 'placeholder_github_client_id';
const githubClientSecret = env.GITHUB_CLIENT_SECRET || 'placeholder_github_client_secret';
const githubCallbackUrl =
  env.GITHUB_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/github/callback';

passport.use(
  new GitHubStrategy(
    {
      clientID: githubClientId,
      clientSecret: githubClientSecret,
      callbackURL: githubCallbackUrl,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const githubId = profile.id;
        const email =
          profile.emails && profile.emails[0]
            ? profile.emails[0].value.toLowerCase()
            : `${profile.username || githubId}@github.user`;
        const name = profile.displayName || profile.username || 'GitHub User';
        const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : '';

        let user = await User.findOne({
          $or: [{ githubId }, { email }],
        });

        if (user) {
          let updated = false;
          if (!user.githubId) {
            user.githubId = githubId;
            updated = true;
          }
          if (avatar && !user.avatar) {
            user.avatar = avatar;
            updated = true;
          }
          if (!user.isEmailVerified) {
            user.isEmailVerified = true;
            updated = true;
          }
          if (updated) {
            await user.save();
          }
        } else {
          const targetCollege = await resolveCollegeFromState(req);
          const studentId = `GH-${crypto.randomInt(100000, 999999)}`;

          user = await User.create({
            githubId,
            authProvider: 'github',
            studentId,
            name,
            email,
            avatar,
            collegeId: targetCollege._id,
            role: 'student',
            isEmailVerified: true,
            membershipStatus: 'active',
            status: 'active',
          });
        }

        return done(null, user);
      } catch (err) {
        logger.error(`GitHub Passport OAuth error: ${err.message}`);
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
