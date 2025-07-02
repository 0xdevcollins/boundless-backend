# Boundless Backend

A comprehensive backend system for the Boundless project with a robust authentication system.

## Features

- Email/Password Authentication
  - User registration with email verification
  - Secure login with JWT tokens
  - Password reset functionality
  - Email verification with OTP

- Social Authentication
  - Google OAuth integration
  - GitHub OAuth integration

- Security Features
  - JWT-based authentication
  - Role-based access control
  - Rate limiting
  - CORS protection
  - Helmet security headers

## Prerequisites

- Node.js >= 14.0.0
- MongoDB
- SMTP server (for email functionality)
- Google OAuth credentials
- GitHub OAuth credentials

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/boundless-backend.git
cd boundless-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
# Server Configuration
PORT=3000
MONGO_URI=mongodb://localhost:27017/boundless

# JWT Configuration
JWT_ACCESS_TOKEN_SECRET=your-access-token-secret
JWT_REFRESH_TOKEN_SECRET=your-refresh-token-secret
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_FROM=noreply@boundless.com

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:3000/auth/github/callback

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

4. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/google` - Google OAuth login
- `POST /api/auth/github` - GitHub OAuth login
- `GET /api/auth/me` - Get current user profile

### Campaigns

- `POST /api/campaigns` - Create a new campaign (creator only)
  - **Request Body:**
    ```json
    {
      "projectId": "<projectObjectId>",
      "goalAmount": 10000,
      "deadline": "2024-12-31T23:59:59.000Z",
      "milestones": [
        { "title": "M1", "description": "First milestone" },
        { "title": "M2", "description": "Second milestone" }
      ]
    }
    ```
  - **Response:**
    - 201 Created, campaign and milestones created, status set to `pending_approval`.

- `PATCH /api/campaigns/:campaignId/approve` - Approve and deploy a campaign (admin only)
  - **Response:**
    - 200 OK, campaign status set to `live`, `smartContractAddress` set (placeholder for Soroban deployment).

#### Campaign Workflow
1. Project creator submits a campaign (status: `pending_approval`).
2. Admin reviews and approves the campaign (status: `live`, deployed to Soroban).
3. Campaign and milestones are now active for funding and progress tracking.

## Security

The authentication system includes several security features:

- Password hashing with bcrypt
- JWT token-based authentication
- Rate limiting to prevent brute force attacks
  - CORS protection
- Helmet security headers
- Input validation
- Email verification
- Secure password reset flow

## Testing

Run the test suite:
```bash
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
