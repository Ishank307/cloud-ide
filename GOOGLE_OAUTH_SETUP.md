# Google OAuth Setup Guide

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API (or Google People API)

## Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Add these URLs:

**For Development (add these now):**

**Authorized JavaScript origins:**
- `http://localhost:5173`

**Authorized redirect URIs:**
- `http://localhost:8000/auth/google/callback`

**For Production (add these later when you deploy):**
- You'll add your actual domain URLs here after deployment
- Example: `https://your-app.vercel.app` and `https://your-backend.railway.app/auth/google/callback`

## Step 3: Update Environment Variables

Copy your Client ID and Client Secret to `server/.env`:

```env
GOOGLE_CLIENT_ID=your_actual_client_id_here
GOOGLE_CLIENT_SECRET=your_actual_client_secret_here
JWT_SECRET=generate_a_long_random_string_here
SESSION_SECRET=another_random_string_here
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:8000
```

## Step 4: Generate Secrets

For JWT_SECRET and SESSION_SECRET, you can use:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Step 5: Test the Setup

1. Start the backend: `npm run server`
2. Start the frontend: `npm run client`
3. Visit `http://localhost:5173`
4. Click "Continue with Google"

## Deployment Notes

For production deployment:
- Update the redirect URIs in Google Console
- Update CLIENT_URL and SERVER_URL in your production environment
- Use HTTPS for production (required by Google OAuth)