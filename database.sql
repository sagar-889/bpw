-- Buzzpay Registration Database Schema
-- Database: buzzpay_db

-- Create database
CREATE DATABASE IF NOT EXISTS buzzpay_db;
USE buzzpay_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    referred_by VARCHAR(20),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_email (email),
    INDEX idx_referral_code (referral_code),
    FOREIGN KEY (referred_by) REFERENCES users(referral_code) ON DELETE SET NULL
);

-- OTP verification table
CREATE TABLE IF NOT EXISTS otp_verification (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(15) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_expires_at (expires_at)
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_session_token (session_token),
    INDEX idx_user_id (user_id)
);

-- Referral tracking table
CREATE TABLE IF NOT EXISTS referrals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    referrer_id INT NOT NULL,
    referred_user_id INT NOT NULL,
    referral_code VARCHAR(20) NOT NULL,
    bonus_amount DECIMAL(10, 2) DEFAULT 0.00,
    status ENUM('pending', 'completed', 'expired') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_referrer_id (referrer_id),
    INDEX idx_referred_user_id (referred_user_id)
);

-- Transaction logs table
CREATE TABLE IF NOT EXISTS transaction_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    transaction_type ENUM('registration', 'referral_bonus', 'deposit', 'withdrawal') NOT NULL,
    amount DECIMAL(10, 2) DEFAULT 0.00,
    description TEXT,
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_transaction_type (transaction_type),
    INDEX idx_created_at (created_at)
);

-- Insert a default referral code for testing
INSERT INTO users (phone, password_hash, referral_code, is_verified)
VALUES ('+919999999999', '$2b$10$dummy.hash.for.testing', '1002qbg6re', TRUE)
ON DUPLICATE KEY UPDATE phone = phone;

-- Create stored procedure for user registration
DELIMITER //

CREATE PROCEDURE RegisterUser(
    IN p_phone VARCHAR(15),
    IN p_password_hash VARCHAR(255),
    IN p_referral_code VARCHAR(20),
    IN p_referred_by VARCHAR(20)
)
BEGIN
    DECLARE new_user_id INT;
    DECLARE referrer_id INT;
    
    -- Start transaction
    START TRANSACTION;
    
    -- Insert new user
    INSERT INTO users (phone, password_hash, referral_code, referred_by, is_verified)
    VALUES (p_phone, p_password_hash, p_referral_code, p_referred_by, TRUE);
    
    SET new_user_id = LAST_INSERT_ID();
    
    -- If user was referred, create referral record
    IF p_referred_by IS NOT NULL THEN
        SELECT id INTO referrer_id FROM users WHERE referral_code = p_referred_by LIMIT 1;
        
        IF referrer_id IS NOT NULL THEN
            INSERT INTO referrals (referrer_id, referred_user_id, referral_code, bonus_amount, status)
            VALUES (referrer_id, new_user_id, p_referred_by, 50.00, 'completed');
            
            -- Log referral bonus transaction
            INSERT INTO transaction_logs (user_id, transaction_type, amount, description, status)
            VALUES (referrer_id, 'referral_bonus', 50.00, 'Referral bonus for new user registration', 'completed');
        END IF;
    END IF;
    
    -- Log registration transaction
    INSERT INTO transaction_logs (user_id, transaction_type, amount, description, status)
    VALUES (new_user_id, 'registration', 0.00, 'New user registration', 'completed');
    
    COMMIT;
    
    SELECT new_user_id AS user_id, p_referral_code AS referral_code;
END //

DELIMITER ;

-- Create stored procedure for OTP verification
DELIMITER //

CREATE PROCEDURE VerifyOTP(
    IN p_phone VARCHAR(15),
    IN p_otp_code VARCHAR(6)
)
BEGIN
    DECLARE is_valid BOOLEAN DEFAULT FALSE;
    
    SELECT COUNT(*) > 0 INTO is_valid
    FROM otp_verification
    WHERE phone = p_phone
        AND otp_code = p_otp_code
        AND is_verified = FALSE
        AND expires_at > NOW()
    LIMIT 1;
    
    IF is_valid THEN
        UPDATE otp_verification
        SET is_verified = TRUE
        WHERE phone = p_phone AND otp_code = p_otp_code;
        
        SELECT TRUE AS verified, 'OTP verified successfully' AS message;
    ELSE
        SELECT FALSE AS verified, 'Invalid or expired OTP' AS message;
    END IF;
END //

DELIMITER ;

-- Create function to generate unique referral code
DELIMITER //

CREATE FUNCTION GenerateReferralCode() RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
    DECLARE new_code VARCHAR(20);
    DECLARE code_exists INT;
    
    REPEAT
        SET new_code = CONCAT(
            FLOOR(1000 + RAND() * 9000),
            SUBSTRING('abcdefghijklmnopqrstuvwxyz', FLOOR(1 + RAND() * 26), 1),
            SUBSTRING('abcdefghijklmnopqrstuvwxyz', FLOOR(1 + RAND() * 26), 1),
            SUBSTRING('abcdefghijklmnopqrstuvwxyz', FLOOR(1 + RAND() * 26), 1),
            FLOOR(RAND() * 10),
            SUBSTRING('abcdefghijklmnopqrstuvwxyz', FLOOR(1 + RAND() * 26), 1),
            SUBSTRING('abcdefghijklmnopqrstuvwxyz', FLOOR(1 + RAND() * 26), 1)
        );
        
        SELECT COUNT(*) INTO code_exists FROM users WHERE referral_code = new_code;
    UNTIL code_exists = 0
    END REPEAT;
    
    RETURN new_code;
END //

DELIMITER ;

-- Create view for user statistics
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
    u.id,
    u.phone,
    u.referral_code,
    u.created_at,
    COUNT(DISTINCT r.id) AS total_referrals,
    COALESCE(SUM(r.bonus_amount), 0) AS total_referral_earnings,
    COUNT(DISTINCT t.id) AS total_transactions
FROM users u
LEFT JOIN referrals r ON u.id = r.referrer_id AND r.status = 'completed'
LEFT JOIN transaction_logs t ON u.id = t.user_id
GROUP BY u.id, u.phone, u.referral_code, u.created_at;

-- Create indexes for better performance
CREATE INDEX idx_otp_phone_expires ON otp_verification(phone, expires_at);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_referrals_status ON referrals(status);

-- Clean up expired OTPs (run periodically)
CREATE EVENT IF NOT EXISTS cleanup_expired_otps
ON SCHEDULE EVERY 1 HOUR
DO
    DELETE FROM otp_verification 
    WHERE expires_at < NOW() - INTERVAL 24 HOUR;

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON buzzpay_db.* TO 'buzzpay_user'@'localhost';
-- FLUSH PRIVILEGES;
