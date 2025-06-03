# Supabase Data Viewer

A web application for viewing and managing Supabase data with a secure backend proxy.

## Features

- Secure backend proxy to protect Supabase credentials
- User authentication
- Data viewing and editing capabilities
- Dark/light mode toggle
- Responsive design

## Structure

- `backend/`: Node.js proxy server that securely communicates with Supabase
- Frontend: HTML, CSS, and JavaScript for the client-side application

## Setup

1. Clone this repository
2. Set up the backend proxy (see backend/README.md)
3. Open index.html in your browser or deploy to a web server

## Security

This application uses a backend proxy to ensure that Supabase credentials are never exposed to the client. See SECURITY_GUIDE.md for more information.