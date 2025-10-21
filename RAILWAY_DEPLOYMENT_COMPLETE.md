# 🚀 Railway Deployment Guide - Complete Setup

## ✅ SERVICE 1: ML Backend (ALREADY DEPLOYED!)

**Status**: ✅ **LIVE AND WORKING!**
**URL**: `https://kyc-production-c9ad.up.railway.app`

Your ML backend is fully operational with:
- ✅ Face detection (YuNet)
- ✅ Face matching (InsightFace buffalo_l)
- ✅ OCR extraction (EasyOCR - en, de, es, pt)
- ✅ All models loaded successfully

---

## 📋 SERVICE 2: Node.js Proxy

### Step 1: Create New Railway Service

1. Go to your Railway project
2. Click **"+ New"** → **"GitHub Repo"**
3. Select your `kyc` repository
4. Railway will detect the repo

### Step 2: Configure the Proxy Service

**Root Directory**: `services/proxy`

Set this in Railway:
1. Go to **Settings** tab
2. Scroll to **"Root Directory"**
3. Set to: `services/proxy`

### Step 3: Set Environment Variables

In the Railway dashboard for this service, add:

```bash
ML_BACKEND_URL=https://kyc-production-c9ad.up.railway.app
PORT=${{PORT}}  # Railway auto-sets this
```

**How to add environment variables:**
1. Go to **Variables** tab
2. Click **"+ New Variable"**
3. Add `ML_BACKEND_URL` with value `https://kyc-production-c9ad.up.railway.app`

### Step 4: Deploy

Railway will automatically:
1. Detect the `Dockerfile` in `services/proxy/`
2. Build the Docker image
3. Deploy the service
4. Give you a URL like: `https://your-proxy-name.railway.app`

**Save this proxy URL** - you'll need it for the frontend!

---

## 🎨 SERVICE 3: Frontend

### Step 1: Update Frontend Configuration

Before deploying, update `services/frontend/index.html` line 18:

```javascript
const backendUrl = isProduction 
  ? 'https://YOUR-PROXY-URL.railway.app'  // Replace with your actual proxy URL
  : 'http://localhost:3001';
```

Replace `YOUR-PROXY-URL.railway.app` with the proxy URL from Service 2.

### Step 2: Create New Railway Service

1. In your Railway project, click **"+ New"** → **"GitHub Repo"**
2. Select the same `kyc` repository
3. Railway will create another service

### Step 3: Configure the Frontend Service

**Root Directory**: `services/frontend`

Set this in Railway:
1. Go to **Settings** tab
2. Set **"Root Directory"** to: `services/frontend`

### Step 4: Deploy

Railway will:
1. Use the `railway.json` config in `services/frontend/`
2. Start a Python HTTP server to serve static files
3. Give you a URL like: `https://your-frontend-name.railway.app`

---

## 🧪 Testing the Complete System

### 1. Test ML Backend Health

```bash
curl https://kyc-production-c9ad.up.railway.app/api/v1/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "models": {
    "face_detector": {"loaded": true, "name": "yunet"},
    "face_matcher": {"loaded": true, "name": "insightface"},
    "ocr_extractor": {"loaded": true, "name": "easyocr"}
  }
}
```

### 2. Test Proxy Health

```bash
curl https://your-proxy-url.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Proxy service is running",
  "ml_backend_url": "https://kyc-production-c9ad.up.railway.app"
}
```

### 3. Test Frontend

1. Open `https://your-frontend-url.railway.app` in a browser
2. The KYC flow should load
3. Try uploading an ID document and selfie
4. Verify the results show correctly (approved/rejected)

---

## 🔍 Troubleshooting

### Proxy can't reach ML backend

**Check**: Make sure `ML_BACKEND_URL` environment variable is set correctly in the proxy service.

**Fix**: 
1. Go to proxy service in Railway
2. Variables tab
3. Verify `ML_BACKEND_URL=https://kyc-production-c9ad.up.railway.app`
4. Redeploy if needed

### Frontend shows CORS errors

**Check**: The proxy's CORS configuration should allow Railway domains.

**Fix**: Already configured in `server.js` - allows all `railway.app` domains.

### Frontend can't connect to proxy

**Check**: Make sure you updated the proxy URL in `services/frontend/index.html` line 18.

**Fix**: 
1. Update the URL
2. Commit and push to GitHub
3. Railway will auto-redeploy

---

## 💰 Railway Pricing Notes

- **ML Backend**: Uses ~512MB RAM, minimal CPU
- **Proxy**: Uses ~100MB RAM, minimal CPU  
- **Frontend**: Uses ~50MB RAM, minimal CPU

Your $5/month subscription should cover all three services comfortably!

---

## 🎉 Success Checklist

- [x] ML Backend deployed and healthy
- [ ] Proxy deployed with correct ML_BACKEND_URL
- [ ] Frontend deployed with correct proxy URL
- [ ] End-to-end KYC flow works
- [ ] Face verification working correctly
- [ ] OCR extraction working correctly

---

## 📝 Service URLs (Fill in as you deploy)

| Service | URL | Status |
|---------|-----|--------|
| ML Backend | `https://kyc-production-c9ad.up.railway.app` | ✅ Live |
| Proxy | `https://_____.railway.app` | ⏳ Pending |
| Frontend | `https://_____.railway.app` | ⏳ Pending |

---

## 🚀 Quick Deploy Commands

After setting up services in Railway, push updates with:

```bash
# Make changes to any service
git add .
git commit -m "Update configuration"
git push origin main

# Railway auto-deploys from GitHub!
```

---

## 🎯 Next Steps

1. Deploy the **Proxy service** (Service 2)
2. Get the proxy URL from Railway
3. Update `services/frontend/index.html` with the proxy URL
4. Commit and push the change
5. Deploy the **Frontend service** (Service 3)
6. Test the complete flow!

**You're almost there!** The hardest part (ML backend) is done! 🎉

