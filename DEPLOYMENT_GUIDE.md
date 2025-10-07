# Deployment Guide - Split Architecture

## Architecture Overview

**Frontend (React)** → **Backend (Node.js + Docker)** → **Container Management**

## Option 1: Recommended Setup

### Frontend: Vercel
- Free tier with excellent performance
- Automatic deployments from Git
- Built-in CDN

### Backend: Railway
- $5/month free credit
- Docker support
- Easy environment variables
- Automatic deployments

## Step-by-Step Deployment

### 1. Prepare for Deployment

Update environment URLs in your code:

**Frontend (`client/src/components/Auth.jsx` and API calls):**
```javascript
// Replace localhost URLs with your backend URL
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend.railway.app' 
  : 'http://localhost:8000';
```

**Backend (`server/.env` for production):**
```env
CLIENT_URL=https://your-frontend.vercel.app
SERVER_URL=https://your-backend.railway.app
```

### 2. Deploy Backend to Railway

1. Push your code to GitHub
2. Go to [Railway](https://railway.app)
3. Connect your GitHub repo
4. Select the root directory
5. Add environment variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `JWT_SECRET`
   - `SESSION_SECRET`
   - `CLIENT_URL`
   - `SERVER_URL`
6. Railway will auto-detect and deploy

### 3. Deploy Frontend to Vercel

1. Go to [Vercel](https://vercel.com)
2. Import your GitHub repo
3. Set root directory to `client`
4. Add environment variables if needed
5. Deploy

### 4. Update Google OAuth Settings

In Google Cloud Console, add your production URLs:
- **Authorized origins:** `https://your-frontend.vercel.app`
- **Redirect URIs:** `https://your-backend.railway.app/auth/google/callback`

## Alternative Options

### Option 2: All-in-One (Fly.io)
- Deploy entire app as Docker container
- Free tier available
- More complex setup but single deployment

### Option 3: Backend on Render
- Similar to Railway
- Free tier (with limitations)
- Good Docker support

## Cost Breakdown (Monthly)

**Free Tier:**
- Vercel: Free (hobby projects)
- Railway: $5 credit (usually enough for small projects)
- **Total: ~$0-5/month**

**Paid Tier:**
- Vercel Pro: $20/month
- Railway Pro: $20/month
- **Total: ~$40/month**

## Performance Considerations

1. **Container Limits:** Set memory/CPU limits per user
2. **Auto-scaling:** Railway handles this automatically
3. **File Storage:** Consider persistent volumes for user data
4. **Session Management:** Use Redis for production (Railway add-on)

## Security Notes

- Always use HTTPS in production
- Set secure cookie flags
- Implement rate limiting
- Monitor container resource usage
- Regular security updates