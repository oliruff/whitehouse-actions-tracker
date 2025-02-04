# White House Presidential Actions Tracker

The **White House Presidential Actions Tracker** is a full-stack web application designed to track and display the latest executive orders, memoranda, and proclamations issued by the White House. The application fetches data from the official White House website and provides a user-friendly interface for browsing and searching through presidential actions.

## Features

- **Real-time Updates**: Fetches the latest presidential actions directly from the White House website.
- **Search Functionality**: Allows users to search for specific actions by keywords.
- **Caching**: Implements caching to reduce API calls and improve performance.
- **Rate Limiting**: Protects the server from abuse by limiting the number of requests per user.
- **Responsive Design**: Optimized for both desktop and mobile devices.

---

## Project Structure

The project is divided into two main components:

1. **Client**: A front-end application built with HTML, CSS, and JavaScript, served using Parcel.
2. **Server**: A Node.js-based proxy server that handles API requests, caching, and rate limiting.

### Directory Layout

```
whitehouse-actions-tracker/
├── client/
│   ├── public/
│   │   ├── index.html
│   │   ├── style.css
│   ├── src/
│   │   ├── js/
│   │   │   ├── main.js
│   ├── package.json
├── server/
│   ├── src/
│   │   ├── server.js
│   ├── package.json
├── .env
├── README.md
```

---

## Setup Instructions

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (Node Package Manager)
- **Redis** (for caching and rate limiting)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/oliruff/whitehouse-actions-tracker.git
   cd whitehouse-actions-tracker
   ```

2. Install dependencies for both the client and server:
   ```bash
   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

3. Set up the `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=3000

   # Redis Configuration
   REDIS_URL=redis://localhost:6379

   # Cache Settings
   CACHE_TTL=300000

   # Security Configurations
   RATE_LIMIT_POINTS=100
   RATE_LIMIT_DURATION=60
   RATE_LIMIT_BLOCK=300

   # CORS Configuration
   ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

   # User Agent
   USER_AGENT=WhiteHouseActionsTracker/1.0
   ```

---

## Running the Application

### Development Mode

1. Start the server:
   ```bash
   cd server
   npm run dev
   ```

2. Start the client:
   ```bash
   cd ../client
   npm run start
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:1234
   ```

### Production Mode

1. Build the client:
   ```bash
   cd client
   npm run build
   ```

2. Start the server in production mode:
   ```bash
   cd ../server
   npm run start
   ```

3. Serve the built client files using a static file server or CDN.

---

## Deployment Guidelines

### Server Deployment

1. Deploy the server to a cloud provider (e.g., AWS, Heroku, Render).
2. Ensure Redis is properly configured and accessible.
3. Set the `NODE_ENV` environment variable to `production`.

### Client Deployment

1. Build the client using:
   ```bash
   npm run build
   ```
2. Deploy the `dist/` folder to a static hosting service (e.g., Netlify, Vercel).

---

## Environment Variables

The application uses the following environment variables:

| Variable              | Description                                      | Default Value               |
|-----------------------|--------------------------------------------------|-----------------------------|
| `PORT`               | Port for the server                              | `3000`                      |
| `REDIS_URL`          | Redis connection URL                             | `redis://localhost:6379`    |
| `CACHE_TTL`          | Cache time-to-live in milliseconds               | `300000` (5 minutes)        |
| `RATE_LIMIT_POINTS`  | Maximum number of requests allowed per duration  | `100`                       |
| `RATE_LIMIT_DURATION`| Time window for rate limiting in seconds         | `60`                        |
| `RATE_LIMIT_BLOCK`   | Block duration after exceeding rate limit (sec)  | `300`                       |
| `ALLOWED_ORIGINS`    | Comma-separated list of allowed CORS origins     | `http://localhost:3000`     |
| `USER_AGENT`         | User agent string for API requests               | `WhiteHouseActionsTracker/1.0` |

---

## Testing

The project includes unit tests for the server. To run the tests:

1. Navigate to the `server` directory:
   ```bash
   cd server
   ```

2. Run the tests:
   ```bash
   npm test
   ```

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your message here"
   ```
4. Push to your branch:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Open a pull request.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Data sourced from the official [White House Presidential Actions](https://www.whitehouse.gov/presidential-actions/) website.
- Built with ❤️ by [oliruff](https://github.com/oliruff).
