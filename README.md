# Camel Website Health Check

Automated monitoring dashboard for https://camel.apache.org/

## Features

- Checks website status every 4 hours
- Monitors HTTP status, response time, and SSL certificate validity
- Stores 90-day historical data
- Beautiful GitHub Pages dashboard with:
  - Real-time status indicator
  - Uptime statistics (24h, 7d, 30d, all-time)
  - Response time trend chart
  - Recent check history

## How It Works

1. **GitHub Actions** runs a scheduled workflow every 4 hours
2. **Health check script** validates the website and collects metrics
3. **Data files** are stored in the `gh-pages` branch
4. **Dashboard** automatically updates via GitHub Pages

## Dashboard

View the live dashboard at: `https://[username].github.io/camel-website-health-check/`

## Setup

1. Enable GitHub Pages in repository settings:
   - Go to Settings → Pages
   - Set Source to: `gh-pages` branch, root directory
   - Save

2. Trigger the first check:
   - Go to Actions tab
   - Select "Health Check" workflow
   - Click "Run workflow"

3. After the first run, the dashboard will be available at the GitHub Pages URL

## Manual Testing

To test the health check locally:

```bash
node scripts/health-check.js
```

## Data Retention

- Historical data is kept for 90 days
- Older data is automatically pruned to keep the repository size manageable

## License

MIT
