const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const User = require('../models/User');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.SERVER_URL}/auth/google/callback`,
    scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
            // Check if user exists with the same email
            user = await User.findOne({ email: profile.emails[0].value });
            
            if (user) {
                // Link Google ID to existing user
                user.googleId = profile.id;
                user.picture = profile.photos[0]?.value;
                await user.save();
            } else {
                // Create new user
                user = await User.create({
                    username: profile.displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000),
                    email: profile.emails[0].value,
                    googleId: profile.id,
                    picture: profile.photos[0]?.value
                });
            }
        }

        return done(null, {
            id: user._id.toString(),
            email: user.email,
            name: user.username,
            picture: user.picture
        });
    } catch (error) {
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

module.exports = passport;