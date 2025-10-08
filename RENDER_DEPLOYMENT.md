# 🚀 Render Deployment Guide

## Step-by-Step Backend Deployment on Render

### 1. Prepare Your Repository

Make sure your code is pushed to GitHub:
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Connect your GitHub account

### 3. Deploy Backend Service

#### 3.1 Create New Web Service
1. Click **"New +"** button
2. Select **"Web Service"**
3. Connect your GitHub repository
4. Select your `cloud-ide` repository

#### 3.2 Configure Service Settings
- **Name**: `cloud-ide-backend` (or your preferred name)
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: `server`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

#### 3.3 Set Environment Variables
Click **"Advanced"** and add these environment variables:

```env
GOOGLE_CLIENT_ID=680058122069-iu33bjlco9ab0u1g4min1bfbes4u3gub.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
JWT_SECRET=4cdd9b2b591f5483d5460b2cf904390b5572e9f846973f782379a3d1d1c76bc3982e49e8df28d2a2f859346cb7f8cac9ba9db048a1b708e7ff9f210f108aed27
SESSION_SECRET=33d9fbc787290e007273817f3ad851fada41bcd3c29b1d52a944768d4fd027fbc6f859c4843f36f27564614ecd2bcd7666a59bee80d8b4227487c149044f1a94
NODE_ENV=production
CLIENT_URL=https://your-app.vercel.app
PORT=10000
```

**Note**: Leave `CLIENT_URL` as placeholder for now - update after Vercel deployment

#### 3.4 Choose Plan
- **Free Plan**: $0/month (sleeps after 15 min inactivity)
- **Starter Plan**: $7/month (always on)

Click **"Create Web Service"**

### 4. Get Your Backend URL

After deployment completes (5-10 minutes), you'll get a URL like:
`https://cloud-ide-backend.onrender.com`

**📝 Copy this URL - you need it for frontend configuration!**

### 5. Update Frontend Configuration

Update your API configuration with the Render URL:

**File: `client/src/config/api.js`**
```javascript
const API_BASE_URL = import.meta.env.PROD
  ? 'https://cloud-ide-backend.onrender.com'  // Your actual Render URL
  : 'http://localhost:8000';
```

### 6. Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 7. Update Environment Variables

#### 7.1 Update Render Backend
Go back to Render dashboard → Your service → Environment:
```env
CLIENT_URL=https://your-actual-app.vercel.app
```

#### 7.2 Update Google OAuth
In Google Cloud Console, add:
- **Authorized origins**: `https://your-app.vercel.app`
- **Redirect URIs**: `https://cloud-ide-backend.onrender.com/auth/google/callback`

### 8. Test Your Deployment

1. Visit your Vercel URL
2. Try Google authentication
3. Test terminal and file operations

## 🔧 Render-Specific Configuration

### Auto-Deploy Setup
Render automatically deploys when you push to your connected branch:
```bash
git add .
git commit -m "Update for production"
git push origin main
# Render will auto-deploy
```

### Monitoring
- **Logs**: Available in Render dashboard
- **Metrics**: CPU, memory usage tracking
- **Health Checks**: Automatic endpoint monitoring

### Free Tier Limitations
- **Sleep**: Service sleeps after 15 minutes of inactivity
- **Cold Start**: 30-60 seconds to wake up
- **Memory**: 512MB RAM limit
- **Build Time**: 15 minutes max

### Upgrading to Paid Plan
For production use, consider upgrading to:
- **Starter**: $7/month (always on, 1GB RAM)
- **Standard**: $25/month (4GB RAM, better performance)

## 🚨 Troubleshooting

### Common Issues:

1. **Build Fails**
   - Check `server/package.json` has correct scripts
   - Ensure all dependencies are in `dependencies`, not `devDependencies`

2. **Service Won't Start**
   - Verify `PORT` environment variable is set to `10000`
   - Check start command is `npm start`

3. **CORS Errors**
   - Ensure `CLIENT_URL` matches your Vercel URL exactly
   - Check Google OAuth redirect URLs

4. **Authentication Fails**
   - Verify Google OAuth credentials are correct
   - Check redirect URIs include your Render domain

### Checking Logs
1. Go to Render dashboard
2. Select your service
3. Click **"Logs"** tab
4. Look for error messages

## 💰 Cost Comparison

| Plan | Price | Features |
|------|-------|----------|
| Free | $0 | Sleeps after 15min, 512MB RAM |
| Starter | $7/month | Always on, 1GB RAM |
| Standard | $25/month | 4GB RAM, better performance |

## 🎉 You're Live!

Your Cloud IDE is now deployed:
- **Backend**: `https://cloud-ide-backend.onrender.com`
- **Frontend**: `https://your-app.vercel.app`

**Total Cost**: $0-7/month (depending on plan choice)