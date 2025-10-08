# 🚀 Deployment Guide - Step by Step

## Overview
We'll deploy using a **split architecture**:
- **Frontend**: Vercel (free)
- **Backend**: Railway (free $5 credit)

## 📋 Prerequisites
- GitHub account
- Vercel account
- Railway account
- Your Google OAuth credentials

---

## 🎯 Step 1: Prepare Your Code

### 1.1 Update API URLs for Production

**File: `client/src/config/api.js`**
```javascript
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://your-backend-name.railway.app'  // ⚠️ Update this after Railway deployment
  : 'http://localhost:8000';
```

### 1.2 Push to GitHub
```bash
git add .
git commit -m "feat: Add production-ready auth system"
git push origin feature/authentication

# Merge to main
git checkout main
git merge feature/authentication
git push origin main
```

---

## 🚂 Step 2: Deploy Backend to Railway

### 2.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Connect your GitHub account

### 2.2 Deploy Backend
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your `cloud-ide` repository
4. Railway will auto-detect it's a Node.js project

### 2.3 Configure Environment Variables
In Railway dashboard, go to **Variables** tab and add:

```env
GOOGLE_CLIENT_ID=680058122069-iu33bjlco9ab0u1g4min1bfbes4u3gub.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
JWT_SECRET=4cdd9b2b591f5483d5460b2cf904390b5572e9f846973f782379a3d1d1c76bc3982e49e8df28d2a2f859346cb7f8cac9ba9db048a1b708e7ff9f210f108aed27
SESSION_SECRET=33d9fbc787290e007273817f3ad851fada41bcd3c29b1d52a944768d4fd027fbc6f859c4843f36f27564614ecd2bcd7666a59bee80d8b4227487c149044f1a94
NODE_ENV=production
CLIENT_URL=https://your-frontend-name.vercel.app
SERVER_URL=https://your-backend-name.railway.app
```

### 2.4 Configure Build Settings
Railway should auto-detect, but if needed:
- **Root Directory**: `/server`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 2.5 Get Your Backend URL
After deployment, Railway will give you a URL like:
`https://your-backend-name.railway.app`

**📝 Copy this URL - you'll need it for the frontend!**

---

## ⚡ Step 3: Deploy Frontend to Vercel

### 3.1 Update API Configuration
**File: `client/src/config/api.js`**
```javascript
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://your-backend-name.railway.app'  // ✅ Use your actual Railway URL
  : 'http://localhost:8000';
```

### 3.2 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub

### 3.3 Deploy Frontend
1. Click **"New Project"**
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 3.4 Get Your Frontend URL
Vercel will give you a URL like:
`https://your-frontend-name.vercel.app`

---

## 🔧 Step 4: Update Google OAuth Settings

### 4.1 Go to Google Cloud Console
1. Visit [console.cloud.google.com](https://console.cloud.google.com)
2. Go to your project
3. Navigate to **APIs & Services** > **Credentials**

### 4.2 Update OAuth Settings
Edit your OAuth 2.0 Client ID and add:

**Authorized JavaScript origins:**
- `https://your-frontend-name.vercel.app`

**Authorized redirect URIs:**
- `https://your-backend-name.railway.app/auth/google/callback`

---

## 🔄 Step 5: Update Environment Variables

### 5.1 Update Railway Backend
In Railway dashboard, update:
```env
CLIENT_URL=https://your-frontend-name.vercel.app
```

### 5.2 Update Frontend API Config
**File: `client/src/config/api.js`**
```javascript
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://your-actual-backend-url.railway.app'  // ✅ Your real URL
  : 'http://localhost:8000';
```

Commit and push:
```bash
git add client/src/config/api.js
git commit -m "Update production API URL"
git push origin main
```

Vercel will auto-deploy the update.

---

## ✅ Step 6: Test Your Deployment

### 6.1 Test Authentication
1. Visit your Vercel URL
2. Click "Continue with Google"
3. Should redirect to Google, then back to your app
4. You should see the IDE interface

### 6.2 Test Terminal & Files
1. Try creating files
2. Test the terminal
3. Check if everything works

---

## 🎉 You're Live!

Your Cloud IDE is now deployed:
- **Frontend**: `https://your-frontend-name.vercel.app`
- **Backend**: `https://your-backend-name.railway.app`

## 💰 Cost Breakdown
- **Vercel**: Free (hobby plan)
- **Railway**: $5/month credit (usually enough for small projects)
- **Total**: ~$0-5/month

## 🔧 Troubleshooting

### Common Issues:
1. **CORS errors**: Check CLIENT_URL in Railway matches your Vercel URL
2. **Auth redirect errors**: Verify Google OAuth URLs are correct
3. **API not found**: Ensure API_BASE_URL in frontend matches Railway URL

### Logs:
- **Railway**: Check logs in Railway dashboard
- **Vercel**: Check function logs in Vercel dashboard

---

## 🚀 Next Steps
- Set up custom domain
- Add SSL certificate (automatic on Vercel/Railway)
- Monitor usage and scale as needed
- Add more features!

**Need help?** Check the logs in Railway/Vercel dashboards for error details.