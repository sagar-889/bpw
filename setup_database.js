// Setup database tables
const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
    try {
        // Connect without database first
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        console.log('Connected to MySQL server');

        // Create database
        await connection.query('CREATE DATABASE IF NOT EXISTS buzzpay_db');
        console.log('✓ Database buzzpay_db created/verified');

        await connection.query('USE buzzpay_db');

        // Create users table (matching BuzzPay app schema)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                user_id VARCHAR(50) UNIQUE NOT NULL,
                username VARCHAR(7) UNIQUE NOT NULL,
                
                full_name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone_number VARCHAR(15) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                
                avatar_url VARCHAR(500) DEFAULT NULL,
                
                is_email_verified BOOLEAN DEFAULT FALSE,
                is_phone_verified BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                
                kyc_status ENUM('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED') DEFAULT 'NOT_SUBMITTED',
                kyc_document_type VARCHAR(50) DEFAULT NULL,
                kyc_document_number VARCHAR(100) DEFAULT NULL,
                kyc_document_url VARCHAR(500) DEFAULT NULL,
                kyc_submitted_at TIMESTAMP NULL DEFAULT NULL,
                
                referral_code VARCHAR(20) UNIQUE NOT NULL,
                referred_by_id BIGINT DEFAULT NULL,
                total_referrals INT DEFAULT 0,
                
                last_login_at TIMESTAMP NULL DEFAULT NULL,
                login_attempts INT DEFAULT 0,
                lock_until TIMESTAMP NULL DEFAULT NULL,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_email (email),
                INDEX idx_phone (phone_number),
                INDEX idx_user_id (user_id),
                INDEX idx_username (username),
                INDEX idx_referral_code (referral_code),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✓ Users table created');

        // Create wallets table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS wallets (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                user_id BIGINT UNIQUE NOT NULL,
                
                total_balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
                available_for_withdrawal DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
                locked_in_orders DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
                
                total_earnings DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
                total_deposited DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
                total_withdrawn DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
                
                total_bonus_received DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
                referral_bonus DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
                
                total_orders INT DEFAULT 0,
                completed_orders INT DEFAULT 0,
                
                last_transaction_at TIMESTAMP NULL DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                
                INDEX idx_user_id (user_id),
                INDEX idx_total_balance (total_balance),
                INDEX idx_updated_at (updated_at),
                
                CHECK (total_balance >= 0),
                CHECK (available_for_withdrawal >= 0),
                CHECK (locked_in_orders >= 0)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✓ Wallets table created');

        // Create otp_verification table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS otp_verification (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                phone VARCHAR(15) NOT NULL,
                email VARCHAR(255) NOT NULL,
                otp_code VARCHAR(6) NOT NULL,
                is_verified BOOLEAN DEFAULT FALSE,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_phone (phone),
                INDEX idx_email (email),
                INDEX idx_expires_at (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✓ OTP verification table created');

        console.log('\n✅ Database setup complete!');
        console.log('Database is now compatible with BuzzPay app schema');
        console.log('You can now start your server with: npm start');

        await connection.end();
    } catch (error) {
        console.error('❌ Error setting up database:', error.message);
        process.exit(1);
    }
}

setupDatabase();
