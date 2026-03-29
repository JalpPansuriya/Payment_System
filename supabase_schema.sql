-- supabase_schema.sql
-- Run this in your Supabase SQL Editor

-- 1. users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    provider_customer_id TEXT UNIQUE,
    current_tier INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. plans table
CREATE TABLE plans (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    provider_plan_id TEXT UNIQUE,
    tier_level INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    billing_interval TEXT DEFAULT 'monthly'
);

-- 3. subscriptions table
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES plans(id),
    provider_subscription_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. webhook_events table
CREATE TABLE webhook_events (
    id SERIAL PRIMARY KEY,
    provider_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    processing_status TEXT DEFAULT 'received',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. payment_history table
CREATE TABLE payment_history (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES subscriptions(id),
    provider_payment_id TEXT UNIQUE,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT NOT NULL,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. notifications_log table
CREATE TABLE notifications_log (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. Seed Data for Plans
-- (Replace 'plan_xyz_...' with your actual Razorpay Plan IDs)
INSERT INTO plans (name, provider_plan_id, tier_level, price_cents, billing_interval)
VALUES 
('Basic', 'plan_xyz_basic', 1, 900, 'monthly'),
('Pro', 'plan_xyz_pro', 2, 2900, 'monthly'),
('Enterprise', 'plan_xyz_enterprise', 3, 9900, 'monthly');
