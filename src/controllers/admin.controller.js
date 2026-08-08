import User from "../models/User.js";
import Deposit from "../models/Deposit.js";
import Withdrawal from "../models/Withdrawal.js";
import Investment from "../models/Investment.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// =====================================================
// ADMIN AUTHENTICATION FUNCTIONS
// =====================================================

export const registerAdmin = async (req, res) => {
  try {
    const { adminName, email, password } = req.body;

    console.log('📝 [ADMIN REGISTER] Attempting registration');
    console.log('Email:', email);
    console.log('Admin Name:', adminName);

    const existingAdmin = await User.findOne({ 
      email: email.toLowerCase().trim(),
      isAdmin: true 
    });
    
    if (existingAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: 'Admin already exists with this email' 
      });
    }

    if (password.length < 12) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 12 characters'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const admin = await User.create({
      fullName: adminName,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      isAdmin: true,
      isVerified: true,
      verifiedAt: new Date()
    });

    console.log('✅ Admin created:', admin.email);

    const token = jwt.sign(
      { id: admin._id, isAdmin: true, email: admin.email },
      process.env.JWT_SECRET || 'eraX_secret_key_2024',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        isAdmin: admin.isAdmin
      },
      token
    });

  } catch (error) {
    console.error('❌ ADMIN REGISTER ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register admin',
      error: error.message
    });
  }
};

export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔑 [ADMIN LOGIN] Email:', email);

    const admin = await User.findOne({ 
      email: email.toLowerCase().trim(),
      isAdmin: true 
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials - admin not found'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials - wrong password'
      });
    }

    admin.lastLoginAt = new Date();
    admin.lastIp = req.ip || req.connection.remoteAddress;
    await admin.save();

    const token = jwt.sign(
      { id: admin._id, isAdmin: true, email: admin.email },
      process.env.JWT_SECRET || 'eraX_secret_key_2024',
      { expiresIn: '30d' }
    );

    console.log('✅ Admin logged in:', admin.email);

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        isAdmin: admin.isAdmin,
        lastLoginAt: admin.lastLoginAt
      },
      token
    });

  } catch (error) {
    console.error('❌ ADMIN LOGIN ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to login',
      error: error.message
    });
  }
};

// =====================================================
// USER MANAGEMENT CRUD FUNCTIONS
// =====================================================

export const createUserByAdmin = async (req, res) => {
  try {
    const { email, password, fullName, isAdmin = false, isVerified = true } = req.body;

    console.log('\n' + '='.repeat(60));
    console.log('👤 [ADMIN CREATE USER] Starting user creation');
    console.log('Email:', email);
    console.log('Full Name:', fullName);
    console.log('='.repeat(60));

    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and full name are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      console.log('⚠️ User already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
        code: 'EMAIL_EXISTS'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let userReferralCode = `ERAX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    let referralCodeExists = await User.findOne({ referralCode: userReferralCode });
    while (referralCodeExists) {
      userReferralCode = `ERAX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      referralCodeExists = await User.findOne({ referralCode: userReferralCode });
    }

    const user = await User.create({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      fullName: fullName.trim(),
      isAdmin: isAdmin,
      isVerified: isVerified,
      authProvider: 'email',
      referralCode: userReferralCode,
      verifiedAt: isVerified ? new Date() : null,
      balances: {
        availableLiquidity: 0,
        lockedInvestment: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        netProfitLoss: 0,
        totalInvested: 0,
        currentInvestmentValue: 0,
        referralCount: 0,
        referralEarnings: 0
      }
    });

    console.log('✅ User created successfully');
    console.log('User ID:', user._id);
    console.log('Email:', user.email);
    console.log('Admin:', user.isAdmin);
    console.log('Verified:', user.isVerified);
    console.log('Referral Code:', user.referralCode);
    console.log('='.repeat(60) + '\n');

    res.status(201).json({
      success: true,
      message: 'User created successfully by admin',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        isAdmin: user.isAdmin,
        isVerified: user.isVerified,
        referralCode: user.referralCode
      }
    });

  } catch (error) {
    console.error('\n❌ CREATE USER ERROR:', error);
    console.error('Error stack:', error.stack);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate field detected',
        code: 'DUPLICATE_KEY'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
};

// ✅ SIMPLIFIED: Direct investment update using updateOne
export const updateUserByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { balances } = req.body;

    console.log('\n' + '='.repeat(60));
    console.log('✏️ [ADMIN UPDATE USER] ID:', id);
    console.log('Request body balances:', balances);

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update balances
    if (balances && typeof balances === 'object') {
      const balanceFields = ['availableLiquidity', 'lockedInvestment', 'totalDeposited', 'totalWithdrawn', 'netProfitLoss', 'totalInvested', 'currentInvestmentValue'];
      
      balanceFields.forEach(field => {
        if (balances[field] !== undefined) {
          const newValue = parseFloat(balances[field]) || 0;
          user.balances[field] = newValue;
          console.log(`✅ Updated ${field} to $${newValue}`);
        }
      });
    }

    await user.save();
    console.log('✅ User saved');

    // ✅ DIRECT INVESTMENT UPDATE - No query, just update by user ID
    if (balances && balances.lockedInvestment !== undefined) {
      const newAmount = parseFloat(balances.lockedInvestment) || 0;
      
      console.log('🔄 Updating investment for user:', user._id);
      console.log('   New amount:', newAmount);
      
      // Direct update - find ALL investments for this user and update the active one
      const result = await Investment.updateOne(
        { 
          user: user._id,
          status: 'active'
        },
        { 
          $set: { 
            amount: newAmount,
            interestAmount: newAmount,
            currentValue: newAmount * 1.267, // Approximate based on days completed
            totalInterestEarned: newAmount * 0.267
          }
        }
      );
      
      console.log('✅ Investment update result:', result);
      if (result.modifiedCount > 0) {
        console.log('✅ Successfully updated investment!');
      } else {
        console.log('⚠️ No investment was updated');
      }
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: { id: user._id, email: user.email, balances: user.balances }
    });

  } catch (error) {
    console.error('❌ UPDATE ERROR:', error);
    res.status(500).json({ success: false, message: 'Failed to update user', error: error.message });
  }
};

export const deleteUserByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('\n' + '='.repeat(60));
    console.log('🗑️ [ADMIN DELETE USER] ID:', id);
    console.log('='.repeat(60));

    const user = await User.findById(id);
    if (!user) {
      console.log('❌ User not found:', id);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (req.admin && req.admin.id === id) {
      console.log('️ Admin attempted to delete themselves');
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const userInfo = {
      id: user._id,
      email: user.email,
      fullName: user.fullName
    };

    console.log('🔄 Deleting related data...');
    
    const [deletedInvestments, deletedDeposits, deletedWithdrawals] = await Promise.all([
      Investment.deleteMany({ user: id }),
      Deposit.deleteMany({ user: id }),
      Withdrawal.deleteMany({ user: id })
    ]);

    console.log('✅ Deleted investments:', deletedInvestments.deletedCount);
    console.log('✅ Deleted deposits:', deletedDeposits.deletedCount);
    console.log('✅ Deleted withdrawals:', deletedWithdrawals.deletedCount);

    await User.findByIdAndDelete(id);

    console.log('✅ User deleted successfully');
    console.log('Deleted user:', userInfo.email);
    console.log('='.repeat(60) + '\n');

    res.status(200).json({
      success: true,
      message: 'User and all related data deleted successfully',
      user: userInfo,
      deletedData: {
        investments: deletedInvestments.deletedCount,
        deposits: deletedDeposits.deletedCount,
        withdrawals: deletedWithdrawals.deletedCount
      }
    });

  } catch (error) {
    console.error('\n❌ DELETE USER ERROR:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
};

// =====================================================
// DASHBOARD FUNCTIONS
// =====================================================

export const getDashboardStats = async (req, res) => {
  try {
    console.log("📊 Fetching dashboard stats...");

    const [
      totalUsers,
      activeUsers,
      pendingVerifications,
      pendingDeposits,
      pendingWithdrawals,
      totalDeposits,
      totalWithdrawals,
      totalInvestments
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ isVerified: false }),
      Deposit.countDocuments({ status: 'pending' }),
      Withdrawal.countDocuments({ status: 'pending' }),
      Deposit.aggregate([
        { $match: { status: { $in: ['confirmed', 'completed'] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Withdrawal.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Investment.countDocuments({ status: { $in: ['active', 'claimed', 'auto_renewed'] } })
    ]);

    const totalDepositVolume = totalDeposits[0]?.total || 0;
    const totalWithdrawalVolume = totalWithdrawals[0]?.total || 0;

    const stats = {
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      pendingVerifications: pendingVerifications || 0,
      pendingDeposits: pendingDeposits || 0,
      pendingWithdrawals: pendingWithdrawals || 0,
      totalVolume: totalDepositVolume || 0,
      totalDeposits: totalDepositVolume || 0,
      totalWithdrawals: totalWithdrawalVolume || 0,
      totalInvestments: totalInvestments || 0
    };

    console.log("✅ Stats calculated:", stats);

    res.status(200).json({
      success: true,
      stats,
      timestamp: new Date()
    });

  } catch (error) {
    console.error("❌ GET STATS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: error.message
    });
  }
};

export const getPendingActions = async (req, res) => {
  try {
    console.log(" Fetching pending actions...");

    const [pendingDeposits, pendingWithdrawals, pendingVerifications] = await Promise.all([
      Deposit.find({ status: 'pending' })
        .populate('user', 'email fullName')
        .sort({ createdAt: -1 })
        .limit(50),
      
      Withdrawal.find({ status: 'pending' })
        .populate('user', 'email fullName')
        .sort({ createdAt: -1 })
        .limit(50),
      
      User.find({ isVerified: false })
        .select('email fullName createdAt')
        .sort({ createdAt: -1 })
        .limit(50)
    ]);

    const pending = [
      ...pendingDeposits.map(d => ({
        id: d._id,
        type: 'deposit',
        user: d.user || { email: d.email, fullName: 'Unknown' },
        amount: d.amount,
        currency: d.currency,
        network: d.network,
        status: d.status,
        createdAt: d.createdAt || d.requestedAt,
        details: {
          transactionId: d.transactionId || d.txHash,
          paymentMethod: d.paymentMethod,
          email: d.email,
          screenshotPath: d.screenshotPath
        }
      })),
      ...pendingWithdrawals.map(w => ({
        id: w._id,
        type: 'withdrawal',
        user: w.user,
        amount: w.amount,
        currency: w.cryptocurrency || w.currency,
        status: w.status,
        createdAt: w.requestedAt || w.createdAt,
        details: {
          transactionId: w.transactionId,
          bankName: w.bankName,
          accountNumber: w.accountNumber,
          walletAddress: w.walletAddress
        }
      })),
      ...pendingVerifications.map(u => ({
        id: u._id,
        type: 'verification',
        user: { email: u.email, fullName: u.fullName },
        amount: null,
        status: 'pending',
        createdAt: u.createdAt,
        details: {}
      }))
    ];

    pending.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`✅ Found ${pending.length} pending actions`);
    console.log(`   - Deposits: ${pendingDeposits.length}`);
    console.log(`   - Withdrawals: ${pendingWithdrawals.length}`);
    console.log(`   - Verifications: ${pendingVerifications.length}`);

    res.status(200).json({
      success: true,
      pending,
      count: pending.length,
      timestamp: new Date()
    });

  } catch (error) {
    console.error("❌ GET PENDING ACTIONS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending actions",
      error: error.message
    });
  }
};

export const getRecentActivities = async (req, res) => {
  try {
    console.log("📜 Fetching recent activities...");

    const [recentDeposits, recentWithdrawals, recentUsers] = await Promise.all([
      Deposit.find({})
        .populate('user', 'email fullName')
        .sort({ createdAt: -1 })
        .limit(20),
      Withdrawal.find({})
        .populate('user', 'email fullName')
        .sort({ createdAt: -1 })
        .limit(20),
      User.find({})
        .select('email fullName createdAt isVerified')
        .sort({ createdAt: -1 })
        .limit(20)
    ]);

    const activities = [
      ...recentDeposits.map(d => ({
        id: d._id,
        action: d.status === 'completed' || d.status === 'confirmed' 
          ? 'deposit_approved' 
          : d.status === 'rejected' 
            ? 'deposit_rejected' 
            : 'deposit_pending',
        user: d.user || { email: d.email, fullName: 'Unknown' },
        details: { amount: d.amount, currency: d.currency, email: d.email },
        timestamp: d.updatedAt || d.completedAt || d.createdAt,
        success: d.status === 'completed' || d.status === 'confirmed'
      })),
      ...recentWithdrawals.map(w => ({
        id: w._id,
        action: w.status === 'completed' 
          ? 'withdrawal_approved' 
          : w.status === 'rejected' 
            ? 'withdrawal_rejected' 
            : 'withdrawal_pending',
        user: w.user,
        details: { amount: w.amount, currency: w.cryptocurrency || w.currency },
        timestamp: w.updatedAt || w.completedAt || w.createdAt,
        success: w.status === 'completed'
      })),
      ...recentUsers.map(u => ({
        id: u._id,
        action: u.isVerified ? 'user_verified' : 'user_registered',
        user: { email: u.email, fullName: u.fullName },
        details: { email: u.email },
        timestamp: u.createdAt,
        success: true
      }))
    ];

    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    console.log(`✅ Found ${activities.length} activities`);

    res.status(200).json({
      success: true,
      activities: activities.slice(0, 50),
      count: activities.length,
      timestamp: new Date()
    });

  } catch (error) {
    console.error("❌ GET ACTIVITIES ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch activities",
      error: error.message
    });
  }
};

// =====================================================
// USER MANAGEMENT FUNCTIONS
// =====================================================

export const getAllUsers = async (req, res) => {
  try {
    console.log("👥 Fetching all users...");

    const { page = 1, limit = 50, search = '' } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      query = {
        $or: [
          { email: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -otp -otpExpires')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    const enrichedUsers = await Promise.all(users.map(async (user) => {
      const [deposits, withdrawals, investments] = await Promise.all([
        Deposit.find({ user: user._id }),
        Withdrawal.find({ user: user._id }),
        Investment.find({ user: user._id })
      ]);

      const completedDeposits = deposits.filter(d => d.status === 'completed' || d.status === 'confirmed');
      const completedWithdrawals = withdrawals.filter(w => w.status === 'completed');
      const activeInvestments = investments.filter(i => i.status === 'active' || i.status === 'auto_renewed');

      return {
        ...user.toObject(),
        stats: {
          totalPortfolio: user.balances?.totalInvested || 0,
          totalInvestments: activeInvestments.length,
          totalInvested: user.balances?.totalInvested || 0,
          totalDeposits: completedDeposits.length,
          totalDeposited: completedDeposits.reduce((sum, d) => sum + d.amount, 0),
          totalWithdrawals: completedWithdrawals.length,
          totalWithdrawn: completedWithdrawals.reduce((sum, w) => sum + w.amount, 0)
        },
        deposits: deposits.slice(0, 5),
        withdrawals: withdrawals.slice(0, 5),
        investments: investments.slice(0, 5)
      };
    }));

    console.log(`✅ Found ${users.length} users (page ${page})`);

    res.status(200).json({
      success: true,
      users: enrichedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      timestamp: new Date()
    });

  } catch (error) {
    console.error("❌ GET USERS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message
    });
  }
};

export const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`👤 [GET USER DETAILS] ID: ${id}`);

    const user = await User.findById(id).select('-password -otp -otpExpires');
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const [deposits, withdrawals, investments] = await Promise.all([
      Deposit.find({ user: id }).sort({ createdAt: -1 }).limit(10),
      Withdrawal.find({ user: id }).sort({ createdAt: -1 }).limit(10),
      Investment.find({ user: id }).sort({ investedAt: -1 }).limit(10)
    ]);

    const completedDeposits = deposits.filter(d => d.status === 'completed' || d.status === 'confirmed');
    const completedWithdrawals = withdrawals.filter(w => w.status === 'completed');
    const activeInvestments = investments.filter(i => i.status === 'active' || i.status === 'auto_renewed');

    const enrichedUser = {
      ...user.toObject(),
      stats: {
        totalPortfolio: user.balances?.totalInvested || 0,
        totalInvestments: activeInvestments.length,
        totalInvested: user.balances?.totalInvested || 0,
        totalDeposits: completedDeposits.length,
        deposits: {
          completed: completedDeposits.reduce((sum, d) => sum + d.amount, 0)
        },
        totalWithdrawals: completedWithdrawals.length,
        withdrawals: {
          completed: completedWithdrawals.reduce((sum, w) => sum + w.amount, 0)
        },
        investments: {
          total: activeInvestments.reduce((sum, i) => sum + i.amount, 0),
          currentValue: activeInvestments.reduce((sum, i) => sum + i.amount + i.interestAmount, 0)
        }
      },
      deposits,
      withdrawals,
      investments
    };

    console.log(`✅ User details fetched: ${user.email}`);

    res.status(200).json({
      success: true,
      user: enrichedUser,
      timestamp: new Date()
    });

  } catch (error) {
    console.error("❌ GET USER DETAILS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
      error: error.message
    });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, isVerified, isAdmin } = req.body;

    console.log(`👤 [TOGGLE USER] ID: ${id}`);

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (status !== undefined) {
      user.status = status;
    }

    if (isVerified !== undefined) {
      user.isVerified = isVerified;
      user.verifiedAt = isVerified ? new Date() : null;
    }

    if (isAdmin !== undefined) {
      user.isAdmin = isAdmin;
    }

    await user.save();

    console.log(`✅ User updated: ${user.email}`);

    res.status(200).json({
      success: true,
      message: "User status updated successfully",
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
        status: user.status
      }
    });

  } catch (error) {
    console.error("❌ TOGGLE USER ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user status",
      error: error.message
    });
  }
};

// =====================================================
// DEPOSIT & WITHDRAWAL FUNCTIONS
// =====================================================

export const handleDepositAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    console.log(`💰 [DEPOSIT ${action?.toUpperCase()}] ID: ${id}`);

    const deposit = await Deposit.findById(id).populate('user', 'email fullName');
    if (!deposit) {
      return res.status(404).json({ success: false, message: "Deposit not found" });
    }

    if (deposit.status !== 'pending' && deposit.status !== 'confirming') {
      return res.status(400).json({ 
        success: false, 
        message: `Deposit already processed (status: ${deposit.status})` 
      });
    }

    if (action === 'approve' || action === 'confirm') {
      const user = await User.findById(deposit.user._id || deposit.user);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      user.balances.lockedInvestment = (user.balances.lockedInvestment || 0) + deposit.amount;
      user.balances.totalDeposited = (user.balances.totalDeposited || 0) + deposit.amount;
      user.balances.totalInvested = (user.balances.totalInvested || 0) + deposit.amount;
      user.balances.currentInvestmentValue = (user.balances.currentInvestmentValue || 0) + deposit.amount;
      await user.save();

      deposit.status = 'completed';
      deposit.completedAt = new Date();
      deposit.confirmedAt = new Date();
      await deposit.save();

      const activeInvestment = await Investment.findOne({ user: user._id, status: 'active' });

      if (activeInvestment) {
        activeInvestment.amount = (activeInvestment.amount || 0) + deposit.amount;
        activeInvestment.interestAmount = (activeInvestment.interestAmount || 0) + deposit.amount;
        activeInvestment.currentValue = (activeInvestment.currentValue || activeInvestment.amount) + deposit.amount;
        await activeInvestment.save();

        deposit.autoInvested = true;
        deposit.investmentId = activeInvestment._id;
        await deposit.save();
      } else {
        const startDate = new Date();
        const expectedEndDate = new Date(startDate);
        
        const TESTING_MODE = process.env.NODE_ENV !== 'production';
        if (TESTING_MODE) {
          expectedEndDate.setSeconds(expectedEndDate.getSeconds() + (30 * 20));
        } else {
          expectedEndDate.setDate(expectedEndDate.getDate() + 30);
        }

        const investment = await Investment.create({
          user: user._id,
          email: user.email,
          assetClass: 'stocks',
          symbol: 'STOCKS',
          name: 'Stocks Investment',
          amount: deposit.amount,
          interestAmount: deposit.amount,
          startDate: startDate,
          expectedEndDate: expectedEndDate,
          actualEndDate: expectedEndDate,
          totalDays: 30,
          completedDays: 0,
          missedDays: 0,
          extensionDays: 0,
          isComplete: false,
          dailyTasks: [],
          interestStatus: 'pending',
          status: 'active',
          transactionId: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          investedAt: startDate,
          cycleNumber: 1,
          parentInvestment: null,
          isAutoRenewed: false,
          profitPaidOut: 0,
          currentValue: deposit.amount,
          totalInterestEarned: 0
        });

        deposit.autoInvested = true;
        deposit.investmentId = investment._id;
        await deposit.save();
      }

      console.log(`✅ Deposit approved & Investment updated: $${deposit.amount} for ${user.email}`);

      res.status(200).json({
        success: true,
        message: `Deposit of $${deposit.amount} approved and investment updated`,
        deposit: {
          id: deposit._id,
          status: deposit.status,
          amount: deposit.amount,
          completedAt: deposit.completedAt
        },
        investment: {
          id: deposit.investmentId,
          amount: deposit.amount,
          expectedEndDate: deposit.expectedEndDate
        },
        userBalance: {
          lockedInvestment: user.balances.lockedInvestment,
          totalInvested: user.balances.totalInvested,
          currentInvestmentValue: user.balances.currentInvestmentValue
        }
      });

    } else if (action === 'reject') {
      deposit.status = 'rejected';
      deposit.rejectionReason = reason || 'Rejected by admin';
      deposit.rejectedAt = new Date();
      await deposit.save();

      console.log(`❌ Deposit rejected: $${deposit.amount}`);

      res.status(200).json({
        success: true,
        message: `Deposit rejected successfully`,
        deposit: {
          id: deposit._id,
          status: deposit.status,
          amount: deposit.amount,
          rejectionReason: deposit.rejectionReason
        }
      });

    } else {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid action. Use 'approve' or 'reject'" 
      });
    }

  } catch (error) {
    console.error("❌ DEPOSIT ACTION ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process deposit",
      error: error.message
    });
  }
};

export const handleWithdrawalAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    console.log(`💸 [WITHDRAWAL ${action?.toUpperCase()}] ID: ${id}`);

    const withdrawal = await Withdrawal.findById(id).populate('user', 'email fullName');
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: "Withdrawal not found" });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: `Withdrawal already processed (status: ${withdrawal.status})` 
      });
    }

    if (action === 'approve') {
      const user = await User.findById(withdrawal.user._id || withdrawal.user);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      if ((user.balances.availableLiquidity || 0) < withdrawal.amount) {
        return res.status(400).json({ 
          success: false, 
          message: "Insufficient user balance" 
        });
      }

      user.balances.availableLiquidity -= withdrawal.amount;
      user.balances.totalWithdrawn = (user.balances.totalWithdrawn || 0) + withdrawal.amount;
      await user.save();

      withdrawal.status = 'completed';
      withdrawal.completedAt = new Date();
      await withdrawal.save();

      console.log(`✅ Withdrawal approved: $${withdrawal.amount}`);

      res.status(200).json({
        success: true,
        message: `Withdrawal of $${withdrawal.amount} approved successfully`,
        withdrawal: {
          id: withdrawal._id,
          status: withdrawal.status,
          amount: withdrawal.amount,
          completedAt: withdrawal.completedAt
        },
        userBalance: user.balances.availableLiquidity
      });

    } else if (action === 'reject') {
      withdrawal.status = 'rejected';
      withdrawal.rejectionReason = reason || 'Rejected by admin';
      await withdrawal.save();

      console.log(` Withdrawal rejected: $${withdrawal.amount}`);

      res.status(200).json({
        success: true,
        message: `Withdrawal rejected successfully`,
        withdrawal: {
          id: withdrawal._id,
          status: withdrawal.status,
          amount: withdrawal.amount,
          rejectionReason: withdrawal.rejectionReason
        }
      });

    } else {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid action. Use 'approve' or 'reject'" 
      });
    }

  } catch (error) {
    console.error("❌ WITHDRAWAL ACTION ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process withdrawal",
      error: error.message
    });
  }
};

export const verifyUser = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`✅ [USER VERIFY] ID: ${id}`);

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.isVerified = true;
    user.verifiedAt = new Date();
    await user.save();

    console.log(`✅ User verified: ${user.email}`);

    res.status(200).json({
      success: true,
      message: "User verified successfully",
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error(" VERIFY USER ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify user",
      error: error.message
    });
  }
};

// =====================================================
// EXPORT FUNCTIONS
// =====================================================

export const exportUsersCSV = async (req, res) => {
  try {
    console.log("📤 Exporting users as CSV...");

    const users = await User.find({})
      .select('email fullName isVerified isAdmin createdAt lastLoginAt balances')
      .sort({ createdAt: -1 });

    const headers = ['Email', 'Full Name', 'Verified', 'Admin', 'Available Balance', 'Locked Investment', 'Total Invested', 'Created At', 'Last Login'];
    const rows = users.map(u => [
      u.email,
      u.fullName || '',
      u.isVerified ? 'Yes' : 'No',
      u.isAdmin ? 'Yes' : 'No',
      `$${(u.balances?.availableLiquidity || 0).toFixed(2)}`,
      `$${(u.balances?.lockedInvestment || 0).toFixed(2)}`,
      `$${(u.balances?.totalInvested || 0).toFixed(2)}`,
      u.createdAt?.toISOString() || '',
      u.lastLoginAt?.toISOString() || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.status(200).send(csv);

  } catch (error) {
    console.error("❌ EXPORT CSV ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export users",
      error: error.message
    });
  }
};