# Booking System Testing Checklist

## 🚨 Critical Issues Fixed:
1. ✅ Pending bookings no longer block time slots permanently
2. ✅ Stripe webhook now creates calendar events for paid bookings  
3. ✅ Abandoned pending bookings are auto-cleaned up after 30 minutes
4. ✅ Event status and add-on quantities included in calendar events
5. ✅ Dashboard date format changed to MM/dd/yy
6. ✅ Event toggle text updated to "If yes a $180 mandatory cleaning fee is applied at checkout."
7. ✅ Calendar ID consistency improved

## 📋 Test Scenarios:

### Test 1: Normal Booking Flow (CRITICAL)
**Steps:**
1. Go to booking page
2. Select studio, date, time, hours
3. Select "Yes" for event (cleaning fee should show)
4. Add some add-ons
5. Complete checkout with valid payment
6. Verify calendar event is created in Google Calendar
7. Check dashboard shows booking with correct date format (MM/dd/yy)
8. Verify time slot is blocked for future bookings

**Expected Results:**
- ✅ Payment completes successfully
- ✅ Calendar event created with all details including event status and add-on quantities
- ✅ Time slot blocked on website
- ✅ Dashboard shows booking with MM/dd/yy format

### Test 2: Abandoned Cart Cleanup (CRITICAL)
**Steps:**
1. Start booking process
2. Get to checkout page but abandon without paying
3. Wait 30+ minutes
4. Try to book the same time slot
5. Check dashboard for pending booking

**Expected Results:**
- ✅ Pending booking should be cleaned up after 30 minutes
- ✅ Time slot becomes available again
- ✅ No pending booking visible in dashboard

### Test 3: Stripe Webhook vs Manual Verification
**Steps:**
1. Complete a booking
2. Check server logs to see if webhook fires
3. Check if calendar event is created by webhook
4. Verify no duplicate calendar events

**Expected Results:**
- ✅ Only one calendar event created
- ✅ Booking status updated to "success"
- ✅ No duplicate processing

### Test 4: Manual Calendar Booking Sync
**Steps:**
1. Manually add booking to Google Calendar (admin calendar)
2. Check if it appears in dashboard
3. Try to book same time slot on website

**Expected Results:**
- ✅ Manual booking appears in dashboard
- ✅ Time slot blocked on website
- ✅ No double-booking possible

### Test 5: Time Zone Handling
**Steps:**
1. Book appointment during EST/EDT transition period
2. Verify calendar event times are correct
3. Check dashboard times match user selection

**Expected Results:**
- ✅ Times display correctly in Eastern Time
- ✅ No time zone conversion errors

## 🔧 Environment Variables Required:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Google Calendar Configuration
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_CALENDAR_ID=your-main-calendar-id
GOOGLE_CALENDAR_ID_WEBSITE=your-main-calendar-id  # Should be same as above
CALENDAR_WEBHOOK_URL=https://yourdomain.com/api/google-calendar-webhook
```

## 📊 Stripe Dashboard Setup:

### Webhook Configuration:
1. Go to Stripe Dashboard > Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhook-stripe`
3. Listen for events: `checkout.session.completed`
4. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

### Testing Mode:
- Test with Stripe test keys first
- Use test card: 4242 4242 4242 4242
- Verify webhook receives events in Stripe dashboard

## 🐛 Known Potential Issues to Monitor:

1. **Calendar API Rate Limits**: Google Calendar API has rate limits
2. **Webhook Delays**: Stripe webhooks can have delays (usually < 5 seconds)
3. **Time Zone Edge Cases**: EST/EDT transitions in March/November
4. **Database Connection Issues**: MongoDB connection timeouts
5. **Concurrent Bookings**: Race conditions when multiple users book simultaneously

## 📝 Logging to Check:

Look for these console messages:
- `✅ Booking marked as success via webhook`
- `✅ Google Calendar event created via webhook`
- `🧹 Cleaned up X abandoned pending bookings`
- `Excluding booking with status: pending`

## 🚀 Production Deployment Checklist:

- [ ] Update environment variables in production
- [ ] Configure Stripe webhook endpoint in production
- [ ] Test with real payment (small amount)
- [ ] Verify Google Calendar integration works
- [ ] Monitor server logs for errors
- [ ] Test manual calendar booking sync
- [ ] Verify abandoned booking cleanup works 