// Stripe Recovery Script
// This script checks for Stripe checkout sessions without corresponding bookings

const mongoose = require('mongoose');
const fs = require('fs');

// Load environment variables manually
function loadEnv() {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const envVars = {};
    const lines = envContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#')) {
        const equalIndex = line.indexOf('=');
        if (equalIndex > 0) {
          const key = line.substring(0, equalIndex).trim();
          let value = line.substring(equalIndex + 1).trim();
          
          while (i + 1 < lines.length && !lines[i + 1].includes('=') && !lines[i + 1].startsWith('#')) {
            i++;
            value += lines[i].trim();
          }
          
          envVars[key] = value;
        }
      }
    }
    return envVars;
  } catch (error) {
    console.error('❌ Could not load .env file:', error.message);
    return {};
  }
}

const env = loadEnv();

// Check if we have Stripe module available
let stripe;
try {
  const Stripe = require('stripe');
  stripe = new Stripe(env.STRIPE_SECRET_KEY);
  console.log('✅ Stripe module loaded successfully');
} catch (error) {
  console.log('⚠️  Stripe module not available - install with: npm install stripe');
  console.log('You can still check Stripe dashboard manually');
}

// Booking Schema
const BookingSchema = new mongoose.Schema({
  studio: { type: String, required: true },
  startDate: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  items: { type: Array, default: [] },
  subtotal: { type: Number, default: 0 },
  studioCost: { type: Number, default: 0 },
  cleaningFee: { type: Number, default: 0 },
  estimatedTotal: { type: Number, default: 0 },
  paymentStatus: { type: String, default: "manual" },
  customerName: { type: String, default: "" },
  customerEmail: { type: String, default: "" },
  customerPhone: { type: String, default: "" },
  event: { type: Boolean, default: false },
  calendarEventId: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
});

const Booking = mongoose.model('Booking', BookingSchema);

async function checkStripeOrphanedSessions() {
  if (!stripe) {
    console.log('📊 MANUAL STRIPE DASHBOARD CHECK INSTRUCTIONS:');
    console.log('');
    console.log('1. Go to: https://dashboard.stripe.com/payments');
    console.log('2. Filter by: Last 7 days');
    console.log('3. Look for successful payments');
    console.log('4. Check if each payment has a corresponding booking in your dashboard');
    console.log('');
    console.log('Things to look for:');
    console.log('- Successful payments without bookings');
    console.log('- Checkout sessions that were created but not completed');
    console.log('- Payment intents with specific metadata');
    console.log('');
    return;
  }

  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('📊 Checking Stripe for orphaned sessions...');
    
    // Get recent checkout sessions from Stripe
    const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    
    const sessions = await stripe.checkout.sessions.list({
      created: { gte: sevenDaysAgo },
      limit: 100,
    });
    
    console.log(`\n💳 Found ${sessions.data.length} recent Stripe checkout sessions`);
    
    // Get all bookings from database
    const allBookings = await Booking.find({});
    const bookingsByStripeId = new Map();
    
    // Build a map of existing bookings
    allBookings.forEach(booking => {
      if (booking.stripeSessionId) {
        bookingsByStripeId.set(booking.stripeSessionId, booking);
      }
    });
    
    // Check each Stripe session
    let orphanedSessions = [];
    let successfulSessions = [];
    
    for (const session of sessions.data) {
      if (session.payment_status === 'paid') {
        successfulSessions.push(session);
        
        const bookingId = session.metadata?.bookingId;
        if (bookingId) {
          // Check if booking exists in database
          const booking = await Booking.findById(bookingId);
          if (!booking) {
            orphanedSessions.push({
              sessionId: session.id,
              bookingId: bookingId,
              customerEmail: session.customer_email,
              amount: session.amount_total / 100,
              created: new Date(session.created * 1000),
              reason: 'Booking not found in database'
            });
          }
        } else {
          orphanedSessions.push({
            sessionId: session.id,
            bookingId: null,
            customerEmail: session.customer_email,
            amount: session.amount_total / 100,
            created: new Date(session.created * 1000),
            reason: 'No bookingId in metadata'
          });
        }
      }
    }
    
    console.log(`\n✅ Successful Stripe sessions: ${successfulSessions.length}`);
    console.log(`⚠️  Orphaned sessions (payments without bookings): ${orphanedSessions.length}`);
    
    if (orphanedSessions.length > 0) {
      console.log('\n🚨 ORPHANED STRIPE SESSIONS FOUND:');
      console.log('These payments were successful but have no corresponding bookings:');
      console.log('');
      
      orphanedSessions.forEach((orphan, index) => {
        console.log(`${index + 1}. Session: ${orphan.sessionId}`);
        console.log(`   Customer: ${orphan.customerEmail}`);
        console.log(`   Amount: $${orphan.amount}`);
        console.log(`   Date: ${orphan.created.toISOString()}`);
        console.log(`   Booking ID: ${orphan.bookingId || 'Missing'}`);
        console.log(`   Issue: ${orphan.reason}`);
        console.log('');
      });
      
      console.log('🛠️  RECOVERY ACTIONS:');
      console.log('1. Contact these customers to recreate their bookings');
      console.log('2. Manually add bookings based on Stripe session data');
      console.log('3. Issue refunds if bookings cannot be recovered');
    }
    
  } catch (error) {
    console.error('❌ Error checking Stripe sessions:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

async function createBookingFromStripeSession(sessionId) {
  if (!stripe) {
    console.log('❌ Stripe module not available for automatic recovery');
    return;
  }
  
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    console.log('\n📋 STRIPE SESSION DETAILS:');
    console.log(`Session ID: ${session.id}`);
    console.log(`Customer Email: ${session.customer_email}`);
    console.log(`Amount: $${session.amount_total / 100}`);
    console.log(`Payment Status: ${session.payment_status}`);
    console.log(`Created: ${new Date(session.created * 1000).toISOString()}`);
    
    if (session.metadata) {
      console.log('Metadata:');
      Object.entries(session.metadata).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    // Here you could implement automatic booking recreation
    // based on the session data and metadata
    
  } catch (error) {
    console.error('❌ Error retrieving Stripe session:', error);
  }
}

async function main() {
  console.log('💳 STRIPE RECOVERY TOOL');
  console.log('========================');
  console.log('');
  
  await checkStripeOrphanedSessions();
  
  console.log('\n💡 NEXT STEPS:');
  console.log('1. Review any orphaned sessions listed above');
  console.log('2. Contact customers for missing bookings');
  console.log('3. Manually recreate bookings using the booking form');
  console.log('4. Consider implementing stronger webhook handling');
  console.log('');
  console.log('🔧 To recreate a booking from Stripe session:');
  console.log('   node stripe-recovery.js [session_id]');
}

// If session ID provided as argument, show details for that session
const sessionId = process.argv[2];
if (sessionId) {
  createBookingFromStripeSession(sessionId);
} else {
  main();
} 