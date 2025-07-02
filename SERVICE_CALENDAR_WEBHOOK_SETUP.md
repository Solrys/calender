# Service Calendar Webhook Setup

This document explains the new service calendar webhook system that automatically syncs events from `GOOGLE_CALENDAR_ID_WEBSITE_SERVICE` to the Service Dashboard.

## Overview

The service calendar webhook system consists of three main components:

1. **Service Calendar Event Handler** (`src/utils/serviceCalendarEventHandler.js`)
2. **Service Calendar Webhook** (`src/pages/api/service-calendar-webhook.js`)
3. **Service Calendar Watch Registration** (`src/pages/api/registerServiceCalendarWatch.js`)

## How It Works

1. When a new event is created in the `GOOGLE_CALENDAR_ID_WEBSITE_SERVICE` calendar
2. Google Calendar sends a push notification to your service webhook endpoint
3. The webhook processes the event and extracts service booking information
4. A new service booking is created in the ServiceBooking collection
5. The booking appears automatically in the Service Dashboard

## Setup Instructions

### Step 1: Environment Variables

Make sure you have the following environment variable set:

```bash
GOOGLE_CALENDAR_ID_WEBSITE_SERVICE=your-service-calendar-id@group.calendar.google.com
```

Optionally, you can also set:

```bash
SERVICE_CALENDAR_WEBHOOK_URL=https://yourdomain.com/api/service-calendar-webhook
```

(If not set, it will default to `${NEXTAUTH_URL}/api/service-calendar-webhook`)

### Step 2: Register the Service Calendar Watch

Call the registration endpoint to start monitoring the service calendar:

```bash
GET /api/registerServiceCalendarWatch
```

This will:

- Register a webhook with Google Calendar for your service calendar
- Create a `service-calendar-watch-info.json` file to track the watch status
- Return watch details and expiration information

### Step 3: Verify Setup

Check that the watch is active:

```bash
GET /api/checkServiceCalendarWatch
```

This will show:

- Whether a service calendar watch is registered
- How many hours until it expires
- Watch details and status

## API Endpoints

### Register Service Calendar Watch

- **Endpoint**: `GET /api/registerServiceCalendarWatch`
- **Purpose**: Register a new webhook for the service calendar
- **Response**: Watch details, expiration time, and registration status

### Check Service Calendar Watch Status

- **Endpoint**: `GET /api/checkServiceCalendarWatch`
- **Purpose**: Check if the service calendar watch is active and valid
- **Response**: Watch status, remaining time, and recommendations

### Service Calendar Webhook (Internal)

- **Endpoint**: `POST /api/service-calendar-webhook`
- **Purpose**: Receives push notifications from Google Calendar
- **Note**: This is called automatically by Google Calendar, not manually

## Event Processing

### Event Format Expected

The service calendar webhook expects events with descriptions in this format:

```
Customer Name: John Doe
Customer Email: john@example.com
Customer Phone: (555) 123-4567
Date: 2025-01-15
Start Time: 10:00 AM
End Time: 12:00 PM
Services Booked:
- Hair Styling (Qty: 1)
- Makeup Application (Qty: 1)
Subtotal: $150
Total: $165
```

### Database Fields Created

Each processed event creates a ServiceBooking with:

- `startDate`: Date of the service
- `startTime` / `endTime`: Time range in 12-hour format
- `customerName` / `customerEmail` / `customerPhone`: Contact information
- `services`: Array of selected services with quantities
- `subtotal` / `estimatedTotal`: Pricing information
- `paymentStatus`: Set to "success" (assuming payment completed if event exists)
- `calendarEventId`: Links to the original calendar event
- `syncVersion`: "v3.4-service-calendar-synced"
- `bookingType`: "service"

## Features

### Duplicate Prevention

- Checks for existing bookings with the same `calendarEventId`
- Rate limiting to prevent processing the same event multiple times
- Event-level caching with cooldown periods

### Error Handling

- Graceful handling of malformed event descriptions
- Continues processing other events if one fails
- Detailed logging for debugging

### HTML Cleanup

- Automatically removes HTML tags from customer names
- Cleans up encoded entities from event descriptions

## Maintenance

### Watch Renewal

Google Calendar watches expire after 24 hours. The system:

- Automatically checks for expired watches before registering new ones
- Stops expired watches before creating replacements
- Logs detailed information about watch status

### Monitoring

Check the service logs for:

- `🔔 Received Service Calendar push notification` - Webhook received
- `✅ SERVICE BOOKING CREATED` - New booking processed successfully
- `⚠️ SERVICE DUPLICATE DETECTED` - Prevented duplicate booking
- `🚫 RATE LIMITED` - Request was rate limited (normal behavior)

## Troubleshooting

### No Events Being Processed

1. Check if `GOOGLE_CALENDAR_ID_WEBSITE_SERVICE` is set correctly
2. Verify the watch is registered: `GET /api/checkServiceCalendarWatch`
3. Re-register if expired: `GET /api/registerServiceCalendarWatch`

### Events Not Appearing in Dashboard

1. Check if events have the expected description format
2. Verify events have `dateTime` (not all-day events)
3. Look for error logs in the webhook processing

### Duplicate Bookings

The system prevents duplicates, but if you see any:

1. Check the `calendarEventId` field in the database
2. Look for rate limiting logs
3. Verify the webhook processing cache is working

## Integration with Existing System

This service calendar webhook system works alongside the existing:

- Studio booking calendar webhook (`google-calendar-webhook.js`)
- Service booking creation via Stripe payments
- Manual service booking management

All service bookings (webhook-created and payment-created) appear together in the Service Dashboard.
