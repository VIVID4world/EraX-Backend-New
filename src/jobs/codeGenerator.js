import cron from 'node-cron';
import crypto from 'crypto';
import Investment from '../models/Investment.js';
import User from '../models/User.js';
import { sendOTPEmail } from '../config/email.js';

const generateClaimCode = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 8);
};

export const checkAndGenerateClaimCodes = async () => {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🔍 [CODE GENERATOR] Starting daily check...');
    console.log('📅 Current time:', new Date().toLocaleString());
    console.log('='.repeat(70));
    
    const now = new Date();
    
    // ✅ Step 1: Find ALL active investments under 30 days
    const allActiveInvestments = await Investment.find({
      status: 'active',
      completedDays: { $lt: 30 }
    }).populate('user', 'email fullName');
    
    console.log(`\n📊 Total active investments: ${allActiveInvestments.length}`);
    
    if (allActiveInvestments.length === 0) {
      console.log('ℹ️  No active investments found.');
      console.log('='.repeat(70) + '\n');
      return;
    }
    
    // ✅ Step 2: Bulletproof Filter (Handles new, completed, AND missed days)
    const investmentsNeedingCode = allActiveInvestments.filter(inv => {
      const hasNoCode = !inv.claimCode || inv.claimCode === '';
      
      // Check if the existing code has expired
      const isExpired = inv.codeExpiresAt && new Date(inv.codeExpiresAt) < now;
      
      // Needs a code if it has none, OR if the current one expired
      return hasNoCode || isExpired;
    });

    console.log(`\n🎯 Investments needing codes RIGHT NOW: ${investmentsNeedingCode.length}`);

    if (investmentsNeedingCode.length === 0) {
      console.log('\nℹ️  No investments need codes right now. All users are up to date.');
      console.log('='.repeat(70) + '\n');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    // ✅ Step 3: Process each investment
    for (const investment of investmentsNeedingCode) {
      try {
        console.log(`\n💰 Processing investment: ${investment._id}`);
        console.log(`   User Email: ${investment.email || investment.user?.email || 'MISSING'}`);
        console.log(`   Current Day: ${investment.completedDays}/30`);
        
        // Generate unique code
        let claimCode;
        let attempts = 0;
        do {
          claimCode = generateClaimCode();
          const existing = await Investment.findOne({ claimCode });
          if (!existing) break;
          attempts++;
        } while (attempts < 10);

        if (!claimCode) {
          console.error('❌ Failed to generate unique code after 10 attempts');
          failCount++;
          continue;
        }

        // Update investment with new code
        investment.claimCode = claimCode;
        investment.codeGeneratedAt = now;
        investment.codeExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Expires in 24 hours
        investment.interestStatus = 'code_generated';
        
        await investment.save();

        console.log(`✅ Generated new code: ${claimCode}`);
        console.log(`   Expires: ${investment.codeExpiresAt.toLocaleString()}`);

        // Send email
        const recipientEmail = investment.email || investment.user?.email;
        
        if (recipientEmail) {
          try {
            console.log(`\n📧 Attempting to send email to: ${recipientEmail}`);
            console.log(`   Type: daily_task`);
            
            const result = await sendOTPEmail(recipientEmail, claimCode, 'daily_task');
            
            console.log(`✅ Email sent successfully!`);
            console.log(`   Message ID: ${result.messageId}`);
            successCount++;
          } catch (emailError) {
            console.error(`\n❌ Email sending FAILED for ${recipientEmail}!`);
            console.error(`   Error Message: ${emailError.message}`);
            failCount++;
          }
        } else {
          console.error(`\n⚠️  No email address found for investment ${investment._id}`);
          failCount++;
        }

      } catch (error) {
        console.error(`\n❌ Error processing investment ${investment._id}:`);
        console.error(`   Error: ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`✅ [CODE GENERATOR] Completed`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Failed: ${failCount}`);
    console.log(`${'='.repeat(70)}\n`);
    
  } catch (error) {
    console.error('\n❌ [CODE GENERATOR] Critical error:');
    console.error(`   Error: ${error.message}`);
  }
};

export const startCodeGenerator = () => {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 [30-DAY CHALLENGE] Daily Code Generator starting...');
  console.log('='.repeat(70));
  
  // Production: Daily at 9:00 AM | Development: Every 20 seconds for testing
  const schedule = process.env.NODE_ENV === 'production' ? '0 9 * * *' : '*/20 * * * * *';
  
  cron.schedule(schedule, () => {
    console.log('\n⏰ [SCHEDULER] Running scheduled check...');
    checkAndGenerateClaimCodes();
  });
  
  console.log(`✅ Code generator scheduled: ${schedule}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(70));
  
  // Run immediately on startup (after 5 seconds)
  setTimeout(() => {
    console.log('\n🔥 Running initial code generation check...\n');
    checkAndGenerateClaimCodes();
  }, 5000);
};