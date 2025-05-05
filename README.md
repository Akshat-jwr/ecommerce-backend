# Customized Gifts E-commerce Backend

A comprehensive backend API for a customized gifts e-commerce platform built with the MERN stack.

## Features

- User authentication and profile management
- Product catalog with customization options
- Shopping cart and wishlist functionality
- Order management system
- Reviews and ratings
- Coupon system
- Admin panel for product, order, and user management
- Activity logging for admin actions

## Tech Stack

- Node.js with Express
- MongoDB with Mongoose
- JWT authentication
- Bcrypt for password hashing

## Database Schema

The database includes the following collections:

- Users
- Products
- Categories
- Orders
- Reviews
- Coupons
- Admin Activity Logs

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

3. Create a `.env` file based on `.env.sample`:
```bash
cp .env.sample .env
```
Then edit the `.env` file with your actual configuration values.

4. Start the development server:
```bash
npm run dev
```

## API Endpoints

The API will include endpoints for:

- Authentication (register, login, refresh token)
- User management
- Product CRUD operations
- Category management
- Cart operations
- Order processing
- Payment integration
- Reviews and ratings
- Coupon management
- Admin operations

## License

ISC
