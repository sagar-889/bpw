// Configuration
const API_URL = 'http://localhost:3000/api'; // Update with your backend URL

// State management
let otpSent = false;
let otpVerified = false;

// Get form elements
const form = document.getElementById('registrationForm');
const phoneInput = document.getElementById('phone');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const otpInput = document.getElementById('otp');
const referralCodeInput = document.getElementById('referralCode');
const sendOtpBtn = document.getElementById('sendOtpBtn');
const messageDiv = document.getElementById('message');

// Phone number validation (Indian format)
phoneInput.addEventListener('input', function(e) {
    this.value = this.value.replace(/[^0-9]/g, '');
    validateSendButton();
});

// Email validation
emailInput.addEventListener('input', function(e) {
    validateSendButton();
});

// Validate send button state
function validateSendButton() {
    const phoneValid = phoneInput.value.length === 10;
    const emailValid = emailInput.value.includes('@') && emailInput.value.includes('.');
    sendOtpBtn.disabled = !(phoneValid && emailValid);
}

// Password validation
passwordInput.addEventListener('input', function(e) {
    const value = this.value;
    if (value.length < 6 || value.length > 20) {
        this.setCustomValidity('Password must be between 6 and 20 characters');
    } else {
        this.setCustomValidity('');
    }
});

// Send OTP
sendOtpBtn.addEventListener('click', async function() {
    const phone = phoneInput.value;
    const email = emailInput.value;
    
    if (phone.length !== 10) {
        showMessage('Please enter a valid 10-digit phone number', 'error');
        return;
    }

    if (!email || !email.includes('@')) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }

    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = 'Sending...';

    try {
        // API call to send OTP
        const response = await fetch(`${API_URL}/send-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                phone: '+91' + phone,
                email: email
            })
        });

        if (response.ok) {
            otpSent = true;
            showMessage('OTP sent successfully!', 'success');
            sendOtpBtn.textContent = 'Resend';
            
            // Enable resend after 30 seconds
            setTimeout(() => {
                sendOtpBtn.disabled = false;
            }, 30000);
        } else {
            throw new Error('Failed to send OTP');
        }
    } catch (error) {
        // For demo purposes, simulate successful OTP send
        console.log('Demo mode: Simulating OTP send');
        otpSent = true;
        showMessage('OTP sent successfully! (Demo: Use 123456)', 'success');
        sendOtpBtn.textContent = 'Resend';
        
        setTimeout(() => {
            sendOtpBtn.disabled = false;
        }, 30000);
    }
});

// OTP input validation with real-time verification
otpInput.addEventListener('input', async function(e) {
    this.value = this.value.replace(/[^0-9]/g, '');
    
    // Auto-verify when 6 digits are entered
    if (this.value.length === 6 && otpSent) {
        await verifyOTPRealtime(phoneInput.value, this.value);
    }
});

// Real-time OTP verification function
async function verifyOTPRealtime(phone, otp) {
    try {
        const response = await fetch(`${API_URL}/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                phone: '+91' + phone,
                otp: otp 
            })
        });

        if (response.ok) {
            otpVerified = true;
            otpInput.style.border = '2px solid #4CAF50';
            showMessage('✓ OTP verified successfully!', 'success');
        } else {
            otpVerified = false;
            otpInput.style.border = '2px solid #f44336';
            showMessage('✗ Invalid OTP code', 'error');
        }
    } catch (error) {
        console.log('Verification error:', error);
        // Fallback verification for demo
        if (otp === '123456') {
            otpVerified = true;
            otpInput.style.border = '2px solid #4CAF50';
            showMessage('✓ OTP verified successfully! (Demo)', 'success');
        } else {
            otpVerified = false;
            otpInput.style.border = '2px solid #f44336';
            showMessage('✗ Invalid OTP code', 'error');
        }
    }
}

// Form submission
form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const phone = phoneInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;
    const otp = otpInput.value;
    const referralCode = referralCodeInput.value;

    // Validation
    if (phone.length !== 10) {
        showMessage('Please enter a valid 10-digit phone number', 'error');
        return;
    }

    if (!email || !email.includes('@')) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }

    if (password.length < 6 || password.length > 20) {
        showMessage('Password must be between 6 and 20 characters', 'error');
        return;
    }

    if (!otpSent) {
        showMessage('Please send OTP first', 'error');
        return;
    }

    if (otp.length !== 6) {
        showMessage('Please enter a valid 6-digit OTP', 'error');
        return;
    }

    if (!otpVerified) {
        showMessage('Please enter a valid OTP. The code you entered is incorrect.', 'error');
        return;
    }

    try {
        // API call to register user
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: '+91' + phone,
                email: email,
                password: password,
                otp: otp,
                referralCode: referralCode
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Registration successful:', data);
            
            // Store user data in localStorage
            localStorage.setItem('buzzpay_token', data.token);
            localStorage.setItem('buzzpay_user', JSON.stringify(data.user));
            
            // Show success message with download option
            showRegistrationSuccess(data.user);
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage(error.message || 'Registration failed. Please try again.', 'error');
    }
});

// Helper function to show messages
function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';

    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Show registration success with APK download
function showRegistrationSuccess(user) {
    // Hide the form
    form.style.display = 'none';
    
    // Create success message with download button
    const successHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="color: #4CAF50; font-size: 48px; margin-bottom: 20px;">✓</div>
            <h2 style="color: white; margin-bottom: 10px;">Registration Successful!</h2>
            <p style="color: rgba(255, 255, 255, 0.9); margin-bottom: 20px;">
                Welcome to Buzzpay, ${user.phone}!<br>
                Your referral code: <strong>${user.referralCode}</strong>
            </p>
            <button onclick="downloadAPK()" class="download-btn" style="
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
                border: none;
                border-radius: 30px;
                padding: 18px 40px;
                font-size: 18px;
                font-weight: 600;
                cursor: pointer;
                margin: 20px 0;
                box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
                transition: all 0.3s;
            " onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 25px rgba(76, 175, 80, 0.5)';" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 6px 20px rgba(76, 175, 80, 0.4)';">
                📱 Download Buzzpay APK
            </button>
            <p style="color: rgba(255, 255, 255, 0.7); font-size: 14px; margin-top: 20px;">
                Install the app to start using Buzzpay on your mobile device
            </p>
        </div>
    `;
    
    messageDiv.innerHTML = successHTML;
    messageDiv.className = 'message success';
    messageDiv.style.display = 'block';
    messageDiv.style.padding = '30px';
}

// Download APK function
function downloadAPK() {
    // APK download URL - update with your actual APK file location
    const apkUrl = '/downloads/Buzz-pay.apk';
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = apkUrl;
    link.download = 'Buzz-pay.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showMessage('APK download started! Check your downloads folder.', 'success');
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    sendOtpBtn.disabled = true;
    
    // Check for referral code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
        referralCodeInput.value = refCode;
        referralCodeInput.readOnly = true;
    }
    
    console.log('Buzzpay Registration Page Loaded');
    console.log('Demo Mode: Use OTP 123456 for testing');
});
