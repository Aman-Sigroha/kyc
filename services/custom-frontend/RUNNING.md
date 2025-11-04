# How to Run the Custom Frontend

## Quick Start Options

### Option 1: Python HTTP Server (Easiest)

**Windows:**
```bash
cd services/custom-frontend
python -m http.server 3002
```

**Mac/Linux:**
```bash
cd services/custom-frontend
python3 -m http.server 3002
```

Then open: **http://localhost:3002**

---

### Option 2: Using Node.js (if you have npm)

```bash
cd services/custom-frontend
npm install
npm start
```

Then open: **http://localhost:3002**

---

### Option 3: Using PHP (if you have PHP installed)

```bash
cd services/custom-frontend
php -S localhost:3002
```

Then open: **http://localhost:3002**

---

### Option 4: Using Docker

```bash
cd services/custom-frontend
docker build -t custom-kyc-frontend .
docker run -p 3002:80 custom-kyc-frontend
```

Then open: **http://localhost:3002**

---

### Option 5: Using VS Code Live Server Extension

1. Install "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"
   - Note: You may need to configure Live Server to use port 3002

---

## Notes

- The frontend will connect to the backend at:
  - **Development**: `http://localhost:3001` (make sure proxy is running)
  - **Production**: Automatically detects Railway deployment

- Make sure your backend proxy is running on port 3001 before testing the full flow

- Camera access requires HTTPS in production (or localhost for development)

---

## Troubleshooting

**CORS Errors:**
- Make sure the backend proxy has CORS enabled
- Use `npm run dev` instead of `npm start` for CORS headers

**Camera Not Working:**
- Make sure you're using HTTPS or localhost
- Check browser permissions for camera access
- Some browsers require user interaction before accessing camera

**Backend Connection Failed:**
- Verify proxy is running: `http://localhost:3001/health`
- Check browser console for error messages

