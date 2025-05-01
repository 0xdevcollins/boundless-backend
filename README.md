# Boundless Backend

Boundless is a crowdfunding platform built on the **Stellar blockchain**, using **Soroban smart contracts** to facilitate transparent and decentralized project funding. This repository contains the backend implementation that powers the platform's core functionalities, smart contract interactions, and user management.

## 🚀 Features

- **Decentralized Crowdfunding**

  - Smart contract-based project funding
  - Transparent fund management
  - Milestone-based fund release
  - Automated escrow system

- **Multi-provider Authentication**

  - Email/Password login
  - Google OAuth integration
  - GitHub OAuth integration
  - Secure wallet connection
  - JWT-based session management
  - Secure logout functionality

- **Project Management**

  - Project creation and verification
  - Voting
  - Milestone tracking
  - Fund allocation
  - Progress reporting

- **Smart Contract Integration**

  - Direct integration with Soroban contracts
  - Automated fund distribution
  - Transparent transaction history
  - Smart contract event monitoring

- **Content Moderation**

  - Automated spam detection
  - Sensitive content filtering
  - Toxicity level checking
  - Comment reporting system
  - User-generated content moderation

- **Social Features**

  - Comment system with nested replies
  - Reaction system (likes/dislikes)
  - User activity tracking
  - Real-time notifications
  - User profile management

- **Additional Features**
  - Real-time Notifications
  - Cloud-based File Management
  - Blog System
  - Activity Tracking
  - Contribution Management

## 🛠 Tech Stack

- **Runtime Environment:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB
- **Blockchain:** Stellar/Soroban
- **Authentication:**
  - JWT
  - Passport.js (Google, GitHub OAuth)
  - Email/Password
- **File Storage:** Cloudinary
- **Real-time:** Socket.io
- **Email Service:** Nodemailer
- **Testing:** Jest
- **Documentation:** Swagger/OpenAPI

## 📚 API Documentation

### Authentication Endpoints

```typescript
POST / api / auth / register; // Register new user
POST / api / auth / login; // Login user
POST / api / auth / github; // GitHub OAuth authentication
POST / api / auth / google; // Google OAuth authentication
GET / api / auth / me; // Get current user profile
POST / api / auth / logout; // Logout user
```

### Comment System Endpoints

```typescript
POST   /api/projects/:id/comments                    // Create comment
GET    /api/projects/:id/comments                    // Get project comments
PUT    /api/projects/:id/comments/:commentId         // Update comment
DELETE /api/projects/:id/comments/:commentId         // Delete comment
POST   /api/projects/:id/comments/:commentId/report  // Report comment
```

### Reaction System Endpoints

```typescript
POST   /api/projects/:id/comments/:commentId/reactions  // Add reaction
DELETE /api/projects/:id/comments/:commentId/reactions  // Remove reaction
GET    /api/projects/:id/comments/:commentId/reactions  // Get reactions
```

## 🔒 Security Features

- **Content Moderation**

  - Spam Detection: Pattern-based detection for common spam content
  - Sensitive Content: Automatic filtering of inappropriate content
  - Toxicity Checking: Content scoring system for toxicity levels
  - Rate Limiting: Prevents abuse of API endpoints
  - Input Validation: Thorough validation of all user inputs

- **Authentication Security**
  - JWT-based authentication
  - Secure password hashing
  - OAuth2.0 integration
  - Session management
  - CORS protection
  - XSS prevention via Helmet

## 🚀 Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. Start the development server: `npm run dev`

## 🤝 Contributing

Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting any pull requests.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
