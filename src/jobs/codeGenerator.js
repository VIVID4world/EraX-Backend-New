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
    console.log('🔍 [CODE GENERATOR] Starting check...');
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
    
    // ✅ Step 2: Filter in JavaScript (Much more reliable than MongoDB $exists queries)
    const investmentsNeedingCode = allActiveInvestments.filter(inv => {
      // If no claim code exists, it needs one
      const hasNoCode = !inv.claimCode || inv.claimCode === '';
      
      // If it has never been generated, OR the last generation was in the past, it needs a new one
      const needsNewCode = !inv.codeGeneratedAt || inv.codeGeneratedAt <= now;
      
      return hasNoCode && needsNewCode;
    });

    console.log(`\n🎯 Investments needing codes RIGHT NOW: ${investmentsNeedingCode.length}`);

    if (investmentsNeedingCode.length === 0) {
      console.log('\nℹ️  No investments need codes right now.');
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
        console.log(`   Day: ${investment.completedDays + 1}/30`);
        
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

        // Update investment
        investment.claimCode = claimCode;
        investment.codeGeneratedAt = now;
        investment.codeExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        investment.interestStatus = 'code_generated';
        
        await investment.save();

        console.log(`✅ Generated code: ${claimCode}`);
        console.log(`   Expires: ${investment.codeExpiresAt.toLocaleString()}`);

        // Send email
        const recipientEmail = investment.email || investment.user?.email;
        
        if (recipientEmail) {
          try {
            console.log(`\n📧 Attempting to send email to: ${recipientEmail}`);
            console.log(`   Type: daily_task`);
            console.log(`   Code: ${claimCode}`);
            
            const result = await sendOTPEmail(recipientEmail, claimCode, 'daily_task');
            
            console.log(`✅ Email sent successfully!`);
            console.log(`   Message ID: ${result.messageId}`);
            successCount++;
          } catch (emailError) {
            console.error(`\n❌ Email sending FAILED for ${recipientEmail}!`);
            console.error(`   Error Message: ${emailError.message}`);
            console.error(`   Full Error:`, emailError);
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
    console.error(`   Stack: ${error.stack}`);
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