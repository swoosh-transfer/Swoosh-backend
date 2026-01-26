# Swoosh Backend - Setup Instructions

## 🚀 Quick Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Create a `.env` file in the root directory:

```bash
# Copy the example file
cp .env.example .env
```

Then edit `.env` with your MongoDB connection string:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/swoosh-analytics
NODE_ENV=development
```

### Step 3: Start MongoDB

**For Local Development:**
```bash
# Make sure MongoDB is installed and running
mongod --dbpath ./data/db
```

**For MongoDB Atlas (Cloud):**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get your connection string
4. Update `MONGODB_URI` in `.env`

### Step 4: Start the Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

### Step 5: Verify Installation
Open your browser or use curl:

```bash
# Check server health
curl http://localhost:5000/health

# Check analytics endpoint
curl http://localhost:5000/api/analytics/summary
```

Expected response from `/health`:
```json
{
  "status": "ok",
  "timestamp": "2026-01-26T...",
  "mongodb": "connected"
}
```

## 🎯 What Changed?

### ✅ New Features Added:
1. **MongoDB Integration** - Analytics database
2. **Analytics Tracking** - Automatic event tracking
3. **CORS Update** - Configured for `https://swoosh-transfer.vercel.app`
4. **API Endpoints** - 3 new analytics endpoints
5. **Error Logging** - Comprehensive error tracking

### ✅ What Stayed the Same:
- All existing signaling functionality
- Socket.io events (create-room, join-room, offer, answer, ice-candidate)
- Room management logic
- WebRTC connection flow

**Your existing frontend code will work without any changes!**

## 📊 Analytics Features

The server now automatically tracks:
- Room creation and joins
- User connections and disconnections  
- WebRTC signaling events
- Errors (room not found, room full)
- Daily and hourly statistics

## 🔗 Frontend Integration

See `FRONTEND_INTEGRATION_GUIDE.md` for:
- How to call analytics APIs
- Optional: Build an analytics dashboard
- Optional: Track file transfer metrics

## 🐛 Troubleshooting

### MongoDB Connection Error
```
Error: Could not connect to MongoDB
```
**Solution:** 
- Make sure MongoDB is running: `mongod --dbpath ./data/db`
- Or update `MONGODB_URI` in `.env` to use MongoDB Atlas

### CORS Error in Frontend
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution:**
- Check that your frontend URL is in the `allowedOrigins` array in `server.js`
- For local development, `http://localhost:5173` and `http://localhost:3000` are already allowed

### Port Already in Use
```
Error: listen EADDRINUSE :::5000
```
**Solution:**
- Change `PORT` in `.env` to a different port (e.g., 5001)
- Or kill the process using port 5000

## 📝 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Server port |
| `MONGODB_URI` | Yes | `mongodb://localhost:27017/swoosh-analytics` | MongoDB connection string |
| `NODE_ENV` | No | `development` | Environment mode |

## 🚢 Deployment

### Deploy to Vercel/Railway/Render:

1. Add environment variable:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/swoosh-analytics
   ```

2. Deploy:
   ```bash
   git push origin main
   ```

### MongoDB Atlas Setup:
1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Add your IP to whitelist (or allow from anywhere: `0.0.0.0/0`)
4. Create database user
5. Get connection string
6. Add to environment variables

## 📚 Documentation

- **API Endpoints:** See `README_BACKEND.md`
- **Frontend Guide:** See `FRONTEND_INTEGRATION_GUIDE.md`
- **Database Schema:** See `src/models/Analytics.js`

## 🆘 Need Help?

The server will run fine even if MongoDB is not connected - it will just log warnings. Analytics features require MongoDB, but signaling will work regardless.

---

**You're all set! Start the server and your Swoosh app will have analytics tracking! 🎉**
