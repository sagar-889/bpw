// Fix OTP verification table to add email column
const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixOTPTable() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'buzzpay_db'
        });

        console.log('Connected to database');

        // Check if email column exists
        const [columns] = await connection.query(`
            SHOW COLUMNS FROM otp_verification LIKE 'email'
        `);

        if (columns.length === 0) {
            // Add email column to otp_verification table
            await connection.query(`
                ALTER TABLE otp_verification 
                ADD COLUMN email VARCHAR(255) NOT NULL AFTER phone
            `);
            console.log('✓ Email column added to otp_verification table');

            // Add index on email
            await connection.query(`
                ALTER TABLE otp_verification 
                ADD INDEX idx_email (email)
            `);
            console.log('✓ Index added on email column');
        } else {
            console.log('✓ Email column already exists');
        }

        console.log('\n✅ OTP table fixed successfully!');
        await connection.end();
    } catch (error) {
        console.error('❌ Error fixing table:', error.message);
        process.exit(1);
    }
}

fixOTPTable();
