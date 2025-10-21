# Railway Deployment Guide - KYC Verification System

## 📋 Overview

This monorepo contains a complete KYC verification system with:
- **Python ML Backend** - Face detection, matching, and OCR extraction
- **Node.js Proxy** - API gateway and request transformation
- **Frontend** - Ballerine Web SDK for document capture

## 🚀 Quick Deploy to Railway

### Prerequisites
1. Railway account (sign up at [railway.app](https://railway.app))
2. GitHub repository with this code
3. Railway CLI (optional): `npm i -g @railway/cli`

---

## 📦 Service 1: Python ML Backend

### Configuration
- **Root Directory**: `/` (repository root)
- **Build Command**: Automatic (Nixpacks)
- **Start Command**: `uvicorn api.api:app --host 0.0.0.0 --port $PORT`
- **Config File**: `railway.json` (in root)

### Environment Variables
No environment variables required (uses defaults)

### Deployment Steps
1. Create new project in Railway
2. Click "New" → "GitHub Repo"
3. Select your repository
4. Railway will auto-detect `railway.json` and deploy
5. Copy the public URL (e.g., `https://your-backend.railway.app`)

### Health Check
- Endpoint: `/api/v1/health`
- Expected: `{"status": "healthy", "timestamp": "..."}`

---

## 📦 Service 2: Node.js Proxy

### Configuration
- **Root Directory**: `services/proxy`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Config File**: `services/proxy/railway.json`

### Environment Variables
```bash
ML_BACKEND_URL=https://your-backend.railway.app  # From Service 1
PORT=$PORT  # Auto-provided by Railway
NODE_ENV=production
```

### Deployment Steps
1. In your Railway project, click "New" → "Service"
2. Select same GitHub repository
3. Set **Root Directory** to `services/proxy`
4. Add environment variable `ML_BACKEND_URL` with your backend URL
5. Deploy
6. Copy the public URL (e.g., `https://your-proxy.railway.app`)

### Health Check
- Endpoint: `/health`
- Expected: `{"status": "ok", "timestamp": "...", "ml_backend": "..."}`

---

## 📦 Service 3: Frontend (Static Site)

### Configuration
- **Root Directory**: `services/frontend`
- **Build Command**: None (static files)
- **Start Command**: `python -m http.server $PORT`
- **Config File**: `services/frontend/railway.json`

### Pre-Deployment: Update Backend URL
Edit `services/frontend/index.html` (line 18):
```javascript
const backendUrl = isProduction 
  ? 'https://your-proxy.railway.app'  // ← Replace with your proxy URL
  : 'http://localhost:3001';
```

### Deployment Steps
1. Update the proxy URL in `index.html` (see above)
2. Commit the change
3. In Railway project, click "New" → "Service"
4. Select same GitHub repository
5. Set **Root Directory** to `services/frontend`
6. Deploy
7. Access your frontend at the public URL

---

## 🔗 Service Dependencies

```
Frontend → Proxy → ML Backend
  (3)       (2)       (1)
```

**Deploy in this order:**
1. ML Backend first
2. Proxy second (needs ML Backend URL)
3. Frontend last (needs Proxy URL)

---

## ✅ Post-Deployment Verification

### 1. Test ML Backend
```bash
curl https://your-backend.railway.app/api/v1/health
```
Expected: `{"status": "healthy", ...}`

### 2. Test Proxy
```bash
curl https://your-proxy.railway.app/health
```
Expected: `{"status": "ok", "ml_backend": "healthy", ...}`

### 3. Test Frontend
Open `https://your-frontend.railway.app` in browser
- Should see KYC welcome screen
- Click through to test document capture
- Submit test verification

---

## 🔧 Configuration Files Summary

### Root `railway.json` (ML Backend)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn api.api:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/api/v1/health",
    "healthcheckTimeout": 300
  }
}
```

### `services/proxy/railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 60
  }
}
```

### `services/frontend/railway.json`
   ```json
   {
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "python -m http.server $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
   }
   ```

---

## 🐛 Troubleshooting

### ML Backend Issues

**Problem**: Models not loading
- **Solution**: Check logs, models should download on first startup
- **Note**: First deployment may take 3-5 minutes for model downloads

**Problem**: Out of memory
- **Solution**: Upgrade Railway plan or optimize model loading

### Proxy Issues

**Problem**: Cannot connect to ML backend
- **Solution**: Verify `ML_BACKEND_URL` environment variable is set correctly
- **Check**: ML backend is healthy (`/api/v1/health`)

**Problem**: CORS errors
- **Solution**: CORS is configured, check browser console for exact error

### Frontend Issues

**Problem**: "Cannot send files" error
- **Solution**: Verify proxy URL in `index.html` is correct
- **Check**: Proxy is accessible from browser

**Problem**: Shows "Success" for rejected verifications
- **Solution**: This was fixed - proxy now returns HTTP 422 for rejections
- **Check**: Proxy logs should show "HTTP 422" for rejected verifications

---

## 📊 Expected Performance

- **ML Backend**: 
  - Cold start: ~30 seconds (model loading)
  - Verification: 5-10 seconds per request
  - Face detection: ~1 second
  - Face matching: ~2-3 seconds
  - OCR extraction: ~3-5 seconds

- **Proxy**: 
  - Response time: <100ms (plus ML backend time)

- **Frontend**:
  - Static serving: <50ms

---

## 💰 Cost Estimation

Railway Pricing (as of 2024):
- **Hobby Plan**: $5/month
  - 512MB RAM per service
  - Good for testing/development

- **Pro Plan**: $20/month + usage
  - 8GB RAM per service
  - Better for production

**Recommended**: Start with Hobby plan, upgrade if needed.

---

## 🔐 Security Notes

1. **No API Keys Required**: System uses public endpoints
2. **CORS**: Configured for cross-origin requests
3. **HTTPS**: Automatic via Railway
4. **Environment Variables**: Store sensitive data in Railway secrets

---

## 📝 Important Files

### Must Keep
- `railway.json` - Backend deployment config
- `nixpacks.toml` - Build configuration
- `requirements.txt` - Python dependencies
- `services/proxy/package.json` - Proxy dependencies
- `services/proxy/railway.json` - Proxy config
- `services/frontend/railway.json` - Frontend config
- `services/frontend/index.html` - Frontend entry point
- `services/frontend/ballerine-sdk.umd.js` - Web SDK

### Can Remove (Already in .gitignore)
- `client/` folder (1.6 GB)
- `tests/outputs/` folder
- `*.bat` files
- `__pycache__/` folders
- `node_modules/` folders

---

## 🎯 Next Steps

1. ✅ Code is tested and working locally
2. ✅ All services start correctly
3. ✅ KYC flow works (approved/rejected)
4. 🔲 Push to GitHub
5. 🔲 Deploy to Railway (3 services)
6. 🔲 Update frontend with proxy URL
7. 🔲 Test production deployment

---

## 📞 Support

If you encounter issues:
1. Check Railway logs for each service
2. Verify all environment variables are set
3. Test each service health endpoint
4. Check this guide's troubleshooting section

---

**Last Updated**: October 18, 2025  
**Status**: ✅ Ready for Railway Deployment
