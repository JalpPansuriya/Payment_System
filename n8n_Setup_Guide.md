# n8n Razorpay Integration Setup Guide

Follow this guide to build the three main workflows in your n8n instance.

## Workflow 1: Main Razorpay Webhook Processor

This workflow listens for incoming webhooks, verifies them, and handles the logic based on event type.

### Step 1: Webhook Trigger Node
- **Node Type:** Webhook
- **HTTP Method:** `POST`
- **Path:** `razorpay-webhook`
- **Respond:** `Respond to Webhook` (respond immediately with status `200` to prevent timeouts).

### Step 2: Idempotency Postgres Node
- **Node Type:** Postgres (Execute Query)
- **Query:** 
  ```sql
  SELECT * FROM webhook_events WHERE provider_event_id = '{{$json["body"]["payload"]["payment"]["entity"]["id"]}}' 
  ```
  *(Note: Adjust the JSON path `{{$json...}}` based on the exact Razorpay event header/id)*

### Step 3: IF Node (Duplicate Check)
- **Node Type:** IF
- **Condition:** If the previous Postgres node returned `0` rows (it's new), proceed. If >0, Stop.

### Step 4: Postgres Node (Log Event)
- **Node Type:** Postgres (Insert)
- **Table:** `webhook_events`
- **Fields to Set:** 
  - `provider_event_id`: Unique ID from the event payload.
  - `event_type`: `{{$json["body"]["event"]}}`

### Step 5: Switch Node (Event Router)
- **Node Type:** Switch
- **Route By:** `{{$json["body"]["event"]}}`
- **Outputs:**
  - `subscription.activated` -> Branch 1
  - `subscription.charged` -> Branch 2
  - `payment.failed` -> Branch 3
  - `subscription.pending` -> Branch 4
  - `subscription.halted` -> Branch 5
  - `subscription.cancelled` -> Branch 6

---

## Workflow 2: Retry Failed Events
This workflow runs automatically to pick up any failed webhook processing logic.

### Step 1: Cron / Schedule Trigger Node
- **Node Type:** Schedule Trigger
- **Interval:** Every 10 Minutes

### Step 2: Postgres Node (Fetch Failed)
- **Node Type:** Postgres (Execute Query)
- **Query:** 
  ```sql
  SELECT * FROM webhook_events WHERE processing_status = 'failed' LIMIT 10;
  ```

### Step 3: Loop Node & Sub-Workflow
- Send each failed event back through the specific branches of Workflow 1 or call the exact same nodes again. If successful, update the `processing_status` to `'completed'`. If it fails over 5 times, update to `'permanently_failed'`.

---

## Workflow 3: Daily Reconciliation
This syncs your database with Razorpay.

### Step 1: Cron / Schedule Trigger Node
- **Node Type:** Schedule Trigger
- **Interval:** Every Day (e.g., 2:00 AM)

### Step 2: Postgres Node (Fetch Active Subscriptions)
- **Node Type:** Postgres (Execute Query)
- **Query:** 
  ```sql
  SELECT provider_subscription_id FROM subscriptions WHERE status IN ('active', 'pending')
  ```

### Step 3: HTTP Request Node (Call Razorpay)
- **Node Type:** HTTP Request
- **URL:** `https://api.razorpay.com/v1/subscriptions/{{$json["provider_subscription_id"]}}`
- **Method:** GET
- **Authentication:** Basic Auth (Razorpay Key ID and Key Secret)

### Step 4: IF Node (Compare Status)
- Compare the returned `status` from Razorpay with your database row status.

### Step 5: Postgres Node (Update DB)
- **Node Type:** Postgres (Execute Query)
- Upate the `subscriptions` table if the status deviates.
