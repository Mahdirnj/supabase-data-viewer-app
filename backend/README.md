# Supabase Data Viewer - Backend Proxy

This is the backend proxy server for the Supabase Data Viewer application. It securely handles communication with Supabase without exposing credentials to the client.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file based on the `.env.example` template:
   ```
   cp .env.example .env
   ```

3. Edit the `.env` file with your Supabase credentials:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_anon_key
   ```

4. Start the server:
   ```
   npm start
   ```
   For development with auto-reload:
   ```
   npm run dev
   ```

## API Endpoints

### Authentication

- `POST /api/auth/login`: Authenticate a user
  - Body: `{ email, password }`
  - Returns: JWT token and user data

### Data Access

- `GET /api/data/:table`: Get all records from a table
- `GET /api/data/:table/:id`: Get a specific record by ID
- `POST /api/data/:table`: Create a new record
  - Body: Record data
- `PUT /api/data/:table/:id`: Update a record
  - Body: Updated record data
- `DELETE /api/data/:table/:id`: Delete a record

## Security

This backend proxy implements several security measures:

1. Supabase credentials are stored only on the server
2. JWT authentication for API endpoints
3. CORS protection
4. Request validation
5. Optional rate limiting

See the main [SECURITY_GUIDE.md](../SECURITY_GUIDE.md) for more details.