# E-Commerce Backend API

A full-featured e-commerce backend API with authentication, product management, order processing, and more.

## Live API

The API is live at: [https://ecommerce-backend-pbeq.onrender.com](https://ecommerce-backend-pbeq.onrender.com)

API Documentation: [https://ecommerce-backend-pbeq.onrender.com/api-docs](https://ecommerce-backend-pbeq.onrender.com/api-docs)

## Features

- User authentication (email/password and Google OAuth)
- Email verification with OTP
- Product management
- Order processing
- RESTful API design
- Swagger API documentation

## API Documentation

Once running, the API documentation is available at:
- Local: http://localhost:8000/api-docs
- Production: https://ecommerce-backend-pbeq.onrender.com/api-docs

## Tech Stack

- Node.js with Express
- MongoDB with Mongoose
- JWT authentication
- Email verification with OTP
- Google OAuth integration
- Swagger for API documentation
- Deployed on Render

## Getting Started

### Prerequisites

- Node.js (v16+)
- MongoDB

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Akshat-jwr/ecommerce-backend.git
cd ecommerce-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```
Then edit the `.env` file with your actual configuration values.

4. Start the development server:
```bash
npm run dev
```

## API Routes

### Authentication
- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/verify-email` - Verify email with OTP
- `POST /api/v1/auth/resend-otp` - Resend verification OTP
- `POST /api/v1/auth/login` - Login with email/password
- `POST /api/v1/auth/google` - Login/register with Google
- `POST /api/v1/auth/refresh-token` - Refresh access token
- `POST /api/v1/auth/logout` - Logout (requires authentication)

### Other API Routes
- More routes will be added as the application grows

## License

ISC
