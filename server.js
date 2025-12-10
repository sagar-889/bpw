// Backend Server with Node.js, Express, and MySQL
// Install dependencies: npm install express mysql2 bcrypt jsonwebtoken dotenv cors body-parser nodemailer

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Email transporter configuration
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files
app.use('/downloads', express.static('downloads')); // Serve APK files

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'buzzpay_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Helper function to generate random OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to generate user_id (format: BP + timestamp + random)
function generateUserId() {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `BP${timestamp}${random}`;
}

// Helper function to generate username (7 characters: BP + 5 random)
function generateUsername() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let username = 'BP';
    for (let i = 0; i < 5; i++) {
        username += chars[Math.floor(Math.random() * chars.length)];
    }
    return username;
}

// Helper function to generate referral code
function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// API Routes

// Send OTP
app.post('/api/send-otp', async (req, res) => {
    const { phone, email } = req.body;

    if (!phone || !/^\+91\d{10}$/.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone number' });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
    }

    try {
        const connection = await pool.getConnection();
        
        // Generate OTP
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store OTP in database
        await connection.query(
            'INSERT INTO otp_verification (phone, email, otp_code, expires_at) VALUES (?, ?, ?, ?)',
            [phone, email, otp, expiresAt]
        );

        connection.release();

        // Send OTP via email
        try {
            const mailOptions = {
                from: `"Buzzpay" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: 'Buzzpay Registration - OTP Verification',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #4169E1;">Buzzpay Registration</h2>
                        <p>Your OTP for phone number <strong>${phone}</strong> is:</p>
                        <h1 style="color: #4169E1; font-size: 36px; letter-spacing: 5px;">${otp}</h1>
                        <p>This OTP is valid for 10 minutes.</p>
                        <p style="color: #999; font-size: 12px;">If you didn't request this OTP, please ignore this email.</p>
                    </div>
                `
            };

            console.log(`Attempting to send email to: ${email}`);
            const info = await emailTransporter.sendMail(mailOptions);
            console.log(`✓ OTP email sent successfully to ${email} (MessageID: ${info.messageId})`);
            console.log(`OTP for ${phone}: ${otp}`);
        } catch (emailError) {
            console.error('❌ Email sending error:', emailError.message);
            console.error('Full error:', emailError);
            // Still log OTP to console for testing
            console.log(`⚠️ Email failed, but OTP generated for ${phone}: ${otp}`);
        }

        res.json({ 
            success: true, 
            message: 'OTP sent successfully to your email',
            // Remove in production:
            otp: process.env.NODE_ENV === 'development' ? otp : undefined
        });
    } catch (error) {
        console.error('❌ Error sending OTP:', error.message);
        console.error('Full error:', error);
        res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }
});

// Verify OTP
app.post('/api/verify-otp', async (req, res) => {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
        return res.status(400).json({ error: 'Phone and OTP are required' });
    }

    try {
        const connection = await pool.getConnection();
        
        const [rows] = await connection.query(
            'SELECT * FROM otp_verification WHERE phone = ? AND otp_code = ? AND is_verified = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [phone, otp]
        );

        if (rows.length === 0) {
            connection.release();
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // Mark OTP as verified
        await connection.query(
            'UPDATE otp_verification SET is_verified = TRUE WHERE id = ?',
            [rows[0].id]
        );

        connection.release();

        res.json({ 
            success: true, 
            message: 'OTP verified successfully' 
        });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});

// Register user
app.post('/api/register', async (req, res) => {
    const { phone, email, password, otp, referralCode } = req.body;

    // Validation
    if (!phone || !email || !password || !otp) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (!/^\+91\d{10}$/.test(phone)) {
        return res.status(400).json({ error: 'Invalid phone number' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
    }

    if (password.length < 6 || password.length > 20) {
        return res.status(400).json({ error: 'Password must be between 6 and 20 characters' });
    }

    try {
        const connection = await pool.getConnection();

        // Verify OTP first (check both verified and unverified OTPs since real-time verification marks them)
        const [otpRows] = await connection.query(
            'SELECT * FROM otp_verification WHERE phone = ? AND otp_code = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [phone, otp]
        );

        if (otpRows.length === 0) {
            connection.release();
            console.log(`❌ OTP verification failed for ${phone}: No valid OTP found`);
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        console.log(`✓ OTP verified for ${phone}`);

        // Check if user already exists
        const [existingUsers] = await connection.query(
            'SELECT id FROM users WHERE phone_number = ? OR email = ?',
            [phone, email]
        );

        if (existingUsers.length > 0) {
            connection.release();
            return res.status(400).json({ error: 'User already exists with this phone or email' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Generate unique identifiers
        let newUserId, newUsername, newReferralCode;
        let userIdExists = true, usernameExists = true, codeExists = true;
        
        // Generate unique user_id
        while (userIdExists) {
            newUserId = generateUserId();
            const [check] = await connection.query('SELECT id FROM users WHERE user_id = ?', [newUserId]);
            userIdExists = check.length > 0;
        }
        
        // Generate unique username
        while (usernameExists) {
            newUsername = generateUsername();
            const [check] = await connection.query('SELECT id FROM users WHERE username = ?', [newUsername]);
            usernameExists = check.length > 0;
        }
        
        // Generate unique referral code
        while (codeExists) {
            newReferralCode = generateReferralCode();
            const [check] = await connection.query('SELECT id FROM users WHERE referral_code = ?', [newReferralCode]);
            codeExists = check.length > 0;
        }

        // Get referrer_id if referral code provided
        let referredById = null;
        if (referralCode) {
            const [referrer] = await connection.query(
                'SELECT id FROM users WHERE referral_code = ?',
                [referralCode]
            );
            if (referrer.length > 0) {
                referredById = referrer[0].id;
            }
        }

        // Insert user with BuzzPay app schema
        const [result] = await connection.query(
            `INSERT INTO users (
                user_id, username, full_name, email, phone_number, password_hash, 
                referral_code, referred_by_id, is_email_verified, is_phone_verified, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE, TRUE)`,
            [newUserId, newUsername, email.split('@')[0], email, phone, passwordHash, newReferralCode, referredById]
        );

        const userId = result.insertId;
        console.log(`✓ New user registered: ID=${userId}, UserID=${newUserId}, Username=${newUsername}, Phone=${phone}, Email=${email}, ReferralCode=${newReferralCode}`);

        // Create wallet for the new user
        await connection.query(
            'INSERT INTO wallets (user_id) VALUES (?)',
            [userId]
        );
        console.log(`✓ Wallet created for user ${userId}`);

        // Mark OTP as verified
        await connection.query(
            'UPDATE otp_verification SET is_verified = TRUE WHERE id = ?',
            [otpRows[0].id]
        );

        // Update referrer's total_referrals if applicable
        if (referredById) {
            await connection.query(
                'UPDATE users SET total_referrals = total_referrals + 1 WHERE id = ?',
                [referredById]
            );
            console.log(`✓ Updated referrer ${referredById} referral count`);
        }

        // Handle referral if provided
        if (referredById) {
            // Add referral bonus to referrer's wallet
            const referralBonus = 50.00;
            await connection.query(
                `UPDATE wallets SET 
                    total_balance = total_balance + ?,
                    available_for_withdrawal = available_for_withdrawal + ?,
                    referral_bonus = referral_bonus + ?,
                    total_bonus_received = total_bonus_received + ?
                WHERE user_id = ?`,
                [referralBonus, referralBonus, referralBonus, referralBonus, referredById]
            );
            console.log(`✓ Referral bonus of ${referralBonus} added to user ${referredById}`);
        }

        // Create session token
        const token = jwt.sign(
            { userId, user_id: newUserId, phone, email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        connection.release();

        console.log(`✓ Registration complete for user ${userId}`);
        
        res.json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: userId,
                user_id: newUserId,
                username: newUsername,
                phone,
                email,
                referralCode: newReferralCode
            }
        });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login endpoint (for BuzzPay app)
app.post('/api/login', async (req, res) => {
    const { phone, email, password } = req.body;

    if ((!phone && !email) || !password) {
        return res.status(400).json({ error: 'Phone/Email and password are required' });
    }

    try {
        const connection = await pool.getConnection();
        
        // Support login with either phone or email
        let query, params;
        if (phone) {
            query = `SELECT u.*, w.total_balance, w.available_for_withdrawal 
                     FROM users u 
                     LEFT JOIN wallets w ON u.id = w.user_id 
                     WHERE u.phone_number = ? AND u.is_active = TRUE`;
            params = [phone];
        } else {
            query = `SELECT u.*, w.total_balance, w.available_for_withdrawal 
                     FROM users u 
                     LEFT JOIN wallets w ON u.id = w.user_id 
                     WHERE u.email = ? AND u.is_active = TRUE`;
            params = [email];
        }
        
        const [users] = await connection.query(query, params);

        if (users.length === 0) {
            connection.release();
            return res.status(401).json({ error: 'User not found or account inactive' });
        }

        const user = users[0];
        
        // Check if account is locked
        if (user.lock_until && new Date(user.lock_until) > new Date()) {
            connection.release();
            return res.status(403).json({ error: 'Account is temporarily locked. Please try again later.' });
        }
        
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            // Increment login attempts
            await connection.query(
                'UPDATE users SET login_attempts = login_attempts + 1 WHERE id = ?',
                [user.id]
            );
            
            connection.release();
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Reset login attempts and update last login
        await connection.query(
            'UPDATE users SET login_attempts = 0, last_login_at = NOW() WHERE id = ?',
            [user.id]
        );

        const token = jwt.sign(
            { 
                userId: user.id, 
                user_id: user.user_id,
                phone: user.phone_number,
                email: user.email 
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        connection.release();

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                user_id: user.user_id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone_number,
                referralCode: user.referral_code,
                totalBalance: user.total_balance || 0,
                availableForWithdrawal: user.available_for_withdrawal || 0,
                isEmailVerified: user.is_email_verified,
                isPhoneVerified: user.is_phone_verified,
                kycStatus: user.kyc_status
            }
        });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Test database connection
app.get('/api/health', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.query('SELECT 1');
        connection.release();
        res.json({ status: 'healthy', database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Database configuration:', {
        host: dbConfig.host,
        database: dbConfig.database,
        user: dbConfig.user
    });
});

module.exports = app;
