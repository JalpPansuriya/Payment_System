# PayFlow - Payment System

PayFlow is a fully automated subscription billing system powered by Razorpay, n8n, and Supabase.

## Technologies Used
- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express (Express 5.2.1)
- **Payment Gateway**: Razorpay Checkout & Webhooks
- **Automation**: n8n
- **Database**: Supabase (PostgreSQL)

## Features
- **Subscription Billing**: Automatically manage subscriptions and tiered pricing (Basic, Pro, Enterprise).
- **Checkout Integration**: Processes payments securely using Razorpay Orders API.
- **Webhook Processing**: Real-time integration of Razorpay webhook events.
- **n8n Relay**: Reliable webhook forwarding to n8n for background automation (emails, account updates).

## Setup Instructions

### 1. Backend Server Setup
To install dependencies and start the local Express.js server:
```bash
npm install
node server.js
```
The server will start at `http://localhost:3000`.

### 2. Frontend
You can open `index.html` in your browser. The frontend interacts directly with the local Express server on `http://localhost:3000/api/create-order`.

### 3. Environment Config
Ensure you have set the Razorpay Key ID and Secret in:
- `server.js` (for backend order creation and signature validation)
- `main.js` (for frontend Checkout SDK initialization)

For webhook validation, configure the Razorpay Dashboard to send webhooks to your server endpoint:
`POST http://localhost:3000/api/razorpay-webhook`

*(Note: Use a tunneling service like ngrok/localtunnel if testing webhooks locally).*

### 4. Supabase Schema
Run the SQL script from `supabase_schema.sql` on your Supabase project to initialize the required tables.
