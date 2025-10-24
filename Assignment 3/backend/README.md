# DockGen AI — Backend

Required environment variables (create a local `.env` in this folder):

- MONGODB_URI - MongoDB connection string (example: `mongodb://localhost:27017/dockgen-ai`)
- PORT - server port (default: 5000)
- GEMINI_API_KEY - your Google Gemini API key or short-lived access token
- LLM_PROVIDER - set to `gemini` to use Google Gemini

Optional variables:

- GEMINI_USE_KEY_QUERY - `true` to send the API key as `?key=...` (useful for some API key setups)
- GITHUB_PAT - personal access token for cloning private repositories (avoid committing this)
- SERVICE_ACCOUNT_PATH - path to a Google service-account JSON key (recommended for production)

Run the backend (development):

```powershell
cd backend
npm install
npm run dev
```

Run the backend (production build):

```powershell
cd backend
npm run build
npm start
```

Notes:
- For secure production usage, prefer service-account based OAuth tokens rather than long-lived API keys.
- Never commit real secrets to the repository. Add `backend/.env` to `.gitignore`.
