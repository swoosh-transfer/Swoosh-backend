# Ping Endpoint - Keep Render App Alive

## Overview

The `/ping` endpoint is designed to keep your application alive on Render's free plan by responding to periodic keep-alive requests. This endpoint has **relaxed CORS settings** to allow requests from cron job services and monitoring tools.

---

## Endpoint Details

### URL
```
GET /ping
```

### Response
```json
{
  "status": "pong",
  "timestamp": "2026-03-01T10:30:45.123Z",
  "uptime": 3600.45,
  "mongodb": "connected"
}
```

### Properties
- `status` - Always returns `"pong"` when available
- `timestamp` - Server's current timestamp (ISO 8601 format)
- `uptime` - Server uptime in seconds
- `mongodb` - MongoDB connection status (`"connected"` or `"disconnected"`)

---

## CORS Configuration

### Default Behavior
By default, the `/ping` endpoint allows requests from **any origin**. This means:
- ✅ Requests from cron job services
- ✅ Requests from monitoring tools
- ✅ Direct HTTP requests (curl, wget, etc.)
- ✅ No `Origin` header requirement

### Custom Allowed Origins
To restrict the ping endpoint to specific origins, set the `PING_ALLOWED_ORIGINS` environment variable:

```env
PING_ALLOWED_ORIGINS=https://cron-service.example.com,https://monitoring.example.com
```

If not set or empty, all origins are allowed.

---

## Setting Up Keep-Alive on Render

### Option 1: Using an External Cron Service

#### Services you can use:
- **EasyCron** (https://www.easycron.com)
- **IFTTT** (https://ifttt.com)
- **Uptime Robot** (https://uptimerobot.com)
- **Cronitor** (https://cronitor.io)

#### Steps:
1. Go to your chosen cron service
2. Create a new scheduled task
3. Set the URL to: `https://your-app-url.onrender.com/ping`
4. Set frequency to **Every 14 minutes** (or less)
5. Save and activate

### Option 2: Using GitHub Actions (Free)

Create `.github/workflows/keep-alive.yml`:

```yaml
name: Keep Alive

on:
  schedule:
    - cron: '*/14 * * * *'  # Every 14 minutes
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Render App
        run: curl -H "User-Agent: GitHub-Actions" https://your-app-url.onrender.com/ping
```

Replace `https://your-app-url.onrender.com` with your actual Render app URL.

### Option 3: Using Node-Cron (Self-hosted)

You can also use a separate internal cron service or a dedicated app to ping your server periodically.

---

## Testing the Ping Endpoint

### Using cURL
```bash
curl https://your-app-url.onrender.com/ping
```

### Using Node.js
```javascript
fetch('https://your-app-url.onrender.com/ping')
  .then(res => res.json())
  .then(data => console.log(data));
```

### Using Python
```python
import requests

response = requests.get('https://your-app-url.onrender.com/ping')
print(response.json())
```

---

## Why This Endpoint Exists

Render's free plan puts apps to sleep after **15 minutes of inactivity**. To prevent this:
1. The app needs to receive HTTP requests frequently
2. This endpoint is lightweight and doesn't require authentication
3. CORS is relaxed to work with external cron services

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PING_ALLOWED_ORIGINS` | `*` (all origins) | Comma-separated list of allowed origins for ping requests |
| `PORT` | `5000` | Server port |
| `NODE_ENV` | `production` | Environment mode |

---

## Comparison with `/health` Endpoint

| Feature | `/ping` | `/health` |
|---------|--------|----------|
| **CORS** | Permissive (all origins) | Restricted (ALLOWED_ORIGINS only) |
| **Use Case** | Keep-alive requests, monitoring | Internal/frontend health checks |
| **Authentication** | None | None |
| **Response Time** | Fast | Fast |

---

## Monitoring & Alerts

Set up alerts in your cron service to notify you if the `/ping` endpoint fails:
- Check status code is `200`
- Check `mongodb` field returns `"connected"`
- Check server is responding within acceptable time

---

## Troubleshooting

**Issue:** Getting CORS errors when calling `/ping`
- **Solution:** This shouldn't happen as `/ping` allows all origins. Check that you're using the correct URL.

**Issue:** MongoDB shows `"disconnected"` in response
- **Solution:** Check your `MONGODB_URI` environment variable and MongoDB Atlas connection.

**Issue:** App still going to sleep
- **Solution:** Ensure your cron job is running every **10-14 minutes** (Render puts apps to sleep after 15 minutes of inactivity).

---

## Best Practices

✅ Set cron frequency to **10-14 minutes** (faster than Render's 15-minute timeout)  
✅ Monitor the endpoint's response status  
✅ Use a reliable cron service with uptime guarantees  
✅ Include error notifications if the service becomes unavailable  
✅ Check MongoDB connection status in responses  

---

**Last Updated:** March 1, 2026  
**Endpoint Version:** 1.0
