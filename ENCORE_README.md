# Hyperliquid Screener - Encore Edition

This project has been restructured for direct import into [Leap.new](https://leap.new), which is built on the [Encore](https://encore.dev) framework.

## 🚀 Quick Start with Encore

### Prerequisites

1. **Install Encore CLI**:

   **macOS**:
   ```bash
   brew install encoredev/tap/encore
   ```

   **Windows**:
   ```powershell
   iwr -useb https://encore.dev/install/windows | iex
   ```

   **Linux**:
   ```bash
   curl -L https://encore.dev/install/linux | bash
   ```

2. **Set up your Hydromancer API Key**:
   ```bash
   encore secret set --type local HydromancerApiKey
   ```
   When prompted, enter your Hydromancer API key: `sk_nNhuLkdGdW5sxnYec33C2FBPzLjXBnEd`

### Running Locally

1. **Start the Encore backend**:
   ```bash
   encore run
   ```
   This will start all backend services on `http://localhost:4000`

2. **Start the Next.js frontend** (in a separate terminal):
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:3000`

### Project Structure

```
hyperliquid-screener/
├── encore.app                    # Encore app configuration
├── backend/                      # Encore backend services
│   ├── chart-cache/
│   │   └── encore.service.ts    # Historical chart data service
│   ├── analytics/
│   │   └── encore.service.ts    # Analytics and smart money tracking
│   └── perp-snapshot/
│       └── encore.service.ts    # Perpetual positions snapshot
├── src/                          # Next.js frontend
│   ├── app/                      # Next.js app router
│   ├── components/               # React components
│   ├── contexts/                 # WebSocket and state management
│   └── lib/                      # Utility functions
└── public/                       # Static assets
```

## 📡 Backend Services

### 1. Chart Cache Service
**Endpoint**: `POST /chart-cache`

Provides historical price data with intelligent caching.

**Request**:
```json
{
  "symbols": ["BTC", "ETH", "SOL"],
  "range": "1D"
}
```

**Response**:
```json
{
  "data": {
    "BTC": [45000, 45100, 45200, ...],
    "ETH": [2500, 2510, 2520, ...]
  },
  "meta": {
    "range": "1D",
    "symbolCount": 2,
    "generatedAt": 1699999999999
  }
}
```

### 2. Analytics Service
**Endpoint**: `POST /analytics`

Fetches smart money positions, account data, and trading analytics.

**Request**:
```json
{
  "type": "clearinghouseState",
  "user": "0x..."
}
```

### 3. Perp Snapshot Service
**Endpoint**: `POST /perp-snapshot`

Retrieves perpetual positions snapshots (binary data).

**Request**:
```json
{
  "type": "perpSnapshot",
  "market_names": ["BTC", "ETH"]
}
```

## 🌐 Deploying to Leap.new

### Option 1: Direct Import

1. Go to [Leap.new](https://leap.new)
2. Click "Import Project"
3. Connect your GitHub repository: `https://github.com/luckshury/hyperliquid-screener.git`
4. Leap will automatically detect the Encore structure and set up your infrastructure

### Option 2: Deploy via Encore Cloud

1. **Create an Encore app**:
   ```bash
   encore app create hyperliquid-screener
   ```

2. **Link your local project**:
   ```bash
   encore app link hyperliquid-screener
   ```

3. **Set production secrets**:
   ```bash
   encore secret set --type production HydromancerApiKey
   ```

4. **Deploy**:
   ```bash
   git push encore main
   ```

## 🔐 Environment Variables

### Backend (Encore Secrets)
- `HydromancerApiKey` - Your Hydromancer API key for accessing Hyperliquid data

### Frontend (.env.local)
```bash
NEXT_PUBLIC_HYDROMANCER_API_KEY=sk_nNhuLkdGdW5sxnYec33C2FBPzLjXBnEd
NEXT_PUBLIC_HYDROMANCER_URL=https://api.hydromancer.xyz
```

## 🛠️ Development

### Testing Backend Services

Encore provides a built-in API explorer:

```bash
encore run
```

Then visit `http://localhost:9400` to test your APIs interactively.

### Viewing Traces

Encore automatically captures distributed traces:

```bash
encore run
```

Visit the local dashboard at `http://localhost:9400` to view request traces, logs, and performance metrics.

## 📦 Key Features

- **Real-time WebSocket feeds** for live price updates
- **Historical chart caching** with 30s refresh intervals
- **Smart money tracking** and analytics
- **Perpetual positions monitoring**
- **Network graph visualization**
- **Fills terminal** for tracking all trades
- **Multi-view screener** (grid, list, simple, hybrid modes)

## 🔗 API Documentation

Once deployed, Encore automatically generates API documentation available at:
- Local: `http://localhost:9400`
- Production: `https://your-app.encore.app`

## 🚨 Migration Notes

### Changes from Next.js API Routes

1. **API Routes → Encore Services**: All `/api/*` routes have been refactored into Encore services in the `backend/` directory
2. **Environment Variables → Secrets**: Sensitive keys are now managed via Encore secrets
3. **Type Safety**: Encore provides end-to-end type safety between frontend and backend

### Frontend Integration

The frontend still uses Next.js but now calls Encore backend services. When running locally:
- Encore backend: `http://localhost:4000`
- Next.js frontend: `http://localhost:3000`

In production, Encore handles routing automatically.

## 📚 Resources

- [Encore Documentation](https://encore.dev/docs)
- [Leap.new Documentation](https://docs.leap.new)
- [Hyperliquid API Docs](https://hyperliquid.gitbook.io)
- [Hydromancer API Docs](https://docs.hydromancer.xyz)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `encore run`
5. Submit a pull request

## 📄 License

MIT License - feel free to use this project for your own trading tools!

---

Built with ❤️ using [Encore](https://encore.dev) and [Next.js](https://nextjs.org)

