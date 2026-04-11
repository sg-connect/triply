# ✈️ Triply

**AI-powered travel planner that turns vacation days into unforgettable trips.**

Triply is a full-stack web app that helps you plan, track, and manage your travels. Tell the AI where you want to go — or let it surprise you — and it will generate destination suggestions, day-by-day itineraries, budget breakdowns, and trip insights, all running locally with Ollama.

![Dashboard Screenshot](docs/screenshot-dashboard.png)
<!-- Replace the path above with an actual screenshot -->

---

## Features

- **AI Trip Planner** — A step-by-step wizard that asks about your available days, travel style, and budget, then uses AI to suggest four tailored destinations with detailed plans.
- **Free-form Prompt Mode** — Describe your dream trip in plain text and let the AI (augmented with DuckDuckGo web context) find matching destinations.
- **Day-by-Day Itineraries** — Generate full trip plans with daily activities, local tips, nearby side-trip options, and per-category budget estimates.
- **Trip Management** — Create, edit, schedule, and track trips with statuses (planned, scheduled, ongoing, completed, cancelled).
- **Budget Tracking** — Log actual and predicted expenses across categories (transport, accommodation, food, activities, shopping) with SEK/USD support.
- **AI Trip Analysis** — Run AI analysis on any trip to get a summary, budget advice, highlights, and warnings.
- **Transport & Places** — Track flights, trains, buses, and ferries; maintain a wishlist of places to visit with ratings and notes.
- **Vacation Day Awareness** — Keeps track of your remaining vacation days and Swedish public holidays to help you maximize long weekends.
- **Dashboard** — At-a-glance stats: vacation days left, upcoming trips, total spend, and a quick-access trip grid.
- **Settings** — Configure home city, currency, travel style preferences, budget range, and preferred transport modes.

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Backend    | Node.js, Express, TypeScript        |
| Frontend   | Vanilla HTML/CSS/JS (no framework)  |
| Database   | MongoDB                             |
| AI         | Ollama (local LLM — Llama 3.2 default, custom Triply model supported) |
| Styling    | Custom dark theme, Inter font, Material Symbols icons |

## Prerequisites

- **Node.js** 18+
- **MongoDB** running locally on `mongodb://localhost:27017` (or set `MONGO_URI`)
- **Ollama** running locally on `http://localhost:11434` (or set `OLLAMA_URL`)
  - Pull a model: `ollama pull llama3.2`
  - Optionally create the custom travel model: `ollama create triply -f Modelfile`

## Getting Started

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start the server
npm start
```

The app runs at **http://localhost:3400**.

For development (build + start in one command):

```bash
npm run dev
```

## Environment Variables

| Variable    | Default                         | Description             |
|-------------|---------------------------------|-------------------------|
| `MONGO_URI` | `mongodb://localhost:27017`     | MongoDB connection URI  |
| `OLLAMA_URL`| `http://localhost:11434`        | Ollama API base URL     |

## Project Structure

```
triply/
├── src/
│   ├── server.ts          # Express server and API routes
│   ├── models.ts          # TypeScript interfaces and types
│   └── services/
│       ├── db.ts          # MongoDB connection and data access
│       └── ollama.ts      # Ollama AI integration
├── public/
│   ├── index.html         # Dashboard
│   ├── plan.html          # AI trip planner (wizard + prompt mode)
│   ├── trips.html         # Trip list and detail view
│   ├── settings.html      # User preferences
│   ├── styles.css         # Dark theme styles
│   └── *.js               # Frontend logic
├── Modelfile              # Custom Ollama model definition
├── tsconfig.json
└── package.json
```

## API Endpoints

| Method   | Path                   | Description                         |
|----------|------------------------|-------------------------------------|
| `GET`    | `/api/stats`           | Dashboard statistics                |
| `GET`    | `/api/trips`           | List all trips                      |
| `GET`    | `/api/trips/:id`       | Get a single trip                   |
| `POST`   | `/api/trips`           | Create a trip                       |
| `PUT`    | `/api/trips/:id`       | Update a trip                       |
| `DELETE` | `/api/trips/:id`       | Delete a trip                       |
| `POST`   | `/api/trips/:id/analyze` | AI-analyze a trip                |
| `GET`    | `/api/settings`        | Get user settings                   |
| `PUT`    | `/api/settings`        | Update user settings                |
| `POST`   | `/api/plan/suggest`    | AI destination suggestions (wizard) |
| `POST`   | `/api/plan/detail`     | AI detailed trip plan               |
| `POST`   | `/api/plan/from-prompt`| AI suggestions from free-text       |
| `GET`    | `/api/ollama/status`   | Check Ollama connectivity           |
| `POST`   | `/api/wipe`            | Reset all data to defaults          |

## License

MIT
