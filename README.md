# Swoosh Signaling Server with Analytics 💨

Backend signaling server for Swoosh P2P file transfer application with built-in analytics tracking.

## Features

- ✅ WebRTC signaling for peer-to-peer connections
- ✅ Room management (create, join, leave)
- ✅ MongoDB analytics tracking
- ✅ CORS configured for production frontend
- ✅ Analytics API endpoints
- ✅ Error logging and monitoring

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/swoosh-analytics
NODE_ENV=development
```

### 3. Start MongoDB (Development)

**Option A: Local MongoDB**
```bash
mongod --dbpath ./data/db
```

**Option B: MongoDB Atlas**
Use the connection string from your MongoDB Atlas cluster.

### 4. Run the Server
```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

Server will start on `http://localhost:5000`

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and MongoDB connection state.

### Analytics Summary
```
GET /api/analytics/summary?days=7
```
Get aggregated analytics for specified days (default: 7).

**Query Parameters:**
- `days` (optional): Number of days to fetch (default: 7)

**Response:**
```json
{
  "dailyStats": [...],
  "totalEvents": 156,
  "errors": [...],
  "period": "Last 7 days"
}
```

### Active Rooms
```
GET /api/analytics/active-rooms
```
Get current active rooms and their occupancy.

**Response:**
```json
{
  "activeRooms": 3,
  "rooms": [
    { "id": "ABC123", "userCount": 2 }
  ]
}
```

## Socket.io Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `create-room` | - | Create a new room |
| `join-room` | `roomId` | Join existing room |
| `offer` | `{ offer, roomId }` | Send WebRTC offer |
| `answer` | `{ answer, roomId }` | Send WebRTC answer |
| `ice-candidate` | `{ candidate, roomId }` | Send ICE candidate |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room-created` | `roomId` | Room successfully created |
| `room-joined` | `roomId` | Successfully joined room |
| `user-joined` | `socketId` | Peer joined the room |
| `user-left` | - | Peer left the room |
| `offer` | `{ offer }` | Received WebRTC offer |
| `answer` | `{ answer }` | Received WebRTC answer |
| `ice-candidate` | `{ candidate }` | Received ICE candidate |
| `error` | `errorMessage` | Error occurred |

## Analytics Tracking

The server automatically tracks:

- **Room Events**: Creation, joins, leaves, closures
- **User Metrics**: Connections, unique users, session duration
- **Transfer Sessions**: Initiated, completed, failed transfers
- **Signaling Events**: Offers, answers, ICE candidates
- **Errors**: Room not found, room full, connection failures
- **Daily Stats**: Aggregated daily and hourly metrics

## Database Schema

### Collections

1. **roomevents** - Individual room lifecycle events
2. **transfersessions** - File transfer tracking
3. **dailystats** - Aggregated daily statistics
4. **errorlogs** - Error tracking

See [src/models/Analytics.js](src/models/Analytics.js) for detailed schemas.

## Project Structure

```
src/
├── models/
│   └── Analytics.js        # MongoDB schemas
├── utils/
│   └── analytics.js        # Analytics tracking functions
└── server.js               # Main server file
```

## CORS Configuration

Allowed origins:
- `https://swoosh-transfer.vercel.app` (Production)
- `http://localhost:5173` (Vite dev)
- `http://localhost:3000` (Alternative dev port)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/swoosh-analytics` |
| `NODE_ENV` | Environment | `development` |

## Frontend Integration

See [FRONTEND_INTEGRATION_GUIDE.md](FRONTEND_INTEGRATION_GUIDE.md) for detailed instructions on integrating analytics into your frontend.

## Development

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Run production server
npm start
```

## Production Deployment

### Vercel / Railway / Render

1. Add environment variables:
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   
2. Deploy:
```bash
git push origin main
```

### MongoDB Atlas Setup

1. Create free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Get connection string
3. Add to environment variables

## Testing

### Test Health Endpoint
```bash
curl http://localhost:5000/health
```

### Test Analytics
```bash
curl http://localhost:5000/api/analytics/summary
curl http://localhost:5000/api/analytics/active-rooms
```

### Test WebSocket Connection
Use Socket.io client or the Swoosh frontend.

## License

ISC

## Author

Swoosh Team
