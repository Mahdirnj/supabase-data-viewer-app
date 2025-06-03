# Security Guide

This document outlines the security measures implemented in the Supabase Data Viewer application.

## Architecture

The application uses a backend proxy architecture to ensure that sensitive credentials are never exposed to the client:

1. The frontend makes requests to our backend proxy server
2. The backend proxy authenticates requests and forwards them to Supabase
3. Supabase credentials are stored only on the backend server

## Security Measures

### Backend Proxy

- **Credential Protection**: Supabase URL and API keys are stored only on the server in environment variables
- **Request Validation**: All incoming requests are validated before being processed
- **Authentication**: JWT-based authentication is used to secure API endpoints
- **CORS Protection**: Proper CORS headers are configured to prevent unauthorized cross-origin requests
- **Rate Limiting**: Optional rate limiting can be enabled to prevent abuse

### Frontend

- **No Exposed Credentials**: No sensitive API keys or credentials are stored in the frontend code
- **Secure Authentication**: User credentials are never stored in plain text
- **Session Management**: Secure session handling with proper token storage

## Best Practices for Deployment

1. Always use HTTPS in production
2. Keep all dependencies updated
3. Set up proper environment variables for the backend
4. Configure a strong JWT secret for the backend
5. Enable rate limiting in production environments
6. Regularly audit access logs

## Environment Variables

The backend requires the following environment variables:

```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
PORT=3000
# Optional but recommended for production
JWT_SECRET=your_secure_random_string
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## Reporting Security Issues

If you discover a security vulnerability, please create an issue detailing the problem and how to reproduce it.