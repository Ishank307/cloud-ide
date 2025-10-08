# Testing Your Setup Locally

## 1. First, let's test without Google OAuth

Create a simple test route to make sure your server works:

```bash
# Start the server
cd server
npm run dev
```

Visit `http://localhost:8000` - you should see your app (even if auth doesn't work yet).

## 2. Set up Google OAuth (Development Only)

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create a new project** (or use existing)
3. **Enable APIs**: Search for "Google+ API" or "People API" and enable it
4. **Create Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Name it "Cloud IDE Dev"

5. **Add these URLs exactly**:
   - **Authorized JavaScript origins**: `http://localhost:5173`
   - **Authorized redirect URIs**: `http://localhost:8000/auth/google/callback`

6. **Copy your credentials** to `server/.env`:
   ```env
   GOOGLE_CLIENT_ID=your_actual_client_id_from_google
   GOOGLE_CLIENT_SECRET=your_actual_client_secret_from_google
   JWT_SECRET=any_long_random_string_here
   SESSION_SECRET=another_random_string_here
   CLIENT_URL=http://localhost:5173
   SERVER_URL=http://localhost:8000
   ```

## 3. Test the Full Flow

```bash
# Terminal 1: Start backend
cd server
npm run dev

# Terminal 2: Start frontend  
cd client
npm run dev
```

Visit `http://localhost:5173` and try logging in with Google.

## 4. What You Should See

1. **Login page** with Google button
2. **Redirect to Google** for permission
3. **Redirect back** to your app
4. **Your IDE interface** with your Google profile

## 5. Troubleshooting

- **"redirect_uri_mismatch"**: Check your Google Console URLs match exactly
- **"invalid_client"**: Check your Client ID/Secret in `.env`
- **CORS errors**: Make sure both servers are running on correct ports

## 6. When Ready to Deploy

You'll add production URLs to Google Console later:
- Frontend: `https://your-app.vercel.app` 
- Backend: `https://your-backend.railway.app/auth/google/callback`