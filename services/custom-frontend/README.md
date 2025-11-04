# Custom KYC Frontend

A fully customizable frontend for KYC verification flow, built from scratch for maximum flexibility and control.

## Features

- **Document Selection**: Choose between ID Card, Driver's License, or Passport
- **Document Capture**: High-quality front and back photo capture with automatic cropping
- **Selfie Capture**: Front-facing camera for selfie verification
- **Liveness Check**: Integration with liveness detection
- **Review Screens**: Review captured images before submission
- **Full Control**: Complete customization of UI, flow, and behavior

## Structure

- `index.html` - Main KYC flow interface
- `app.js` - Application logic and flow management
- `styles.css` - Custom styling
- `liveness.html` - Liveness check page
- `liveness.js` - Liveness detection logic
- `liveness.css` - Liveness page styling
- `Dockerfile` - Docker configuration for deployment

## Usage

### Quick Start (Python - Recommended)

```bash
cd services/custom-frontend
python -m http.server 3002
# or
python3 -m http.server 3002
```

Then open: **http://localhost:3002**

### Other Options

- **Node.js**: `npm install && npm start`
- **PHP**: `php -S localhost:3002`
- **Docker**: `docker build -t custom-kyc-frontend . && docker run -p 3002:80 custom-kyc-frontend`

See `RUNNING.md` for detailed instructions.

### Flow

1. The flow will guide users through document and selfie capture
2. After selfie, users are redirected to liveness check if not completed
3. After liveness, verification is submitted to backend
4. Make sure backend proxy is running on port 3001

## Backend Integration

The frontend connects to the backend proxy at:
- Production: `https://kyc-proxy-production.up.railway.app`
- Development: `http://localhost:3001`

Endpoint: `POST /v2/enduser/verify`

## Customization

All UI, flow, and behavior can be customized by editing:
- `styles.css` - Change colors, fonts, layout
- `app.js` - Modify flow logic, add/remove steps
- `index.html` - Add/remove screens, change structure

## Image Quality

- Document images are automatically cropped to center 80% x 70% for better OCR
- Images captured at 1280x720 resolution
- JPEG quality set to 95% for maximum quality

