import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    this.transporter = this.createTransporter();
  }

  createTransporter() {
    const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'EMAIL_FROM', 'EMAIL_PASSWORD'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.EMAIL_SECURE === 'true', // true for 465,
      auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async sendVerificationEmail(email, username, verificationOTP) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Verify Your Email Address',
        html: this.getVerificationEmailTemplate(username, verificationOTP),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Verification email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }

getVerificationEmailTemplate(username, verificationOTP) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification - Kaluuba</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1a3d2e 0%, #254d3d 50%, #1a3d2e 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 300; letter-spacing: 1px;">
            Kaluuba
          </h1>
          <p style="color: #d4e8df; margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">
            Secure Email Verification
          </p>
        </div>

        <!-- Main Content -->
        <div style="padding: 40px 30px;">
          
          <!-- Greeting -->
          <h2 style="color: #1a3d2e; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">
            Hello ${username}! 👋
          </h2>
          
          <p style="color: #4a5568; line-height: 1.6; margin: 0 0 25px 0; font-size: 16px;">
            Welcome to <strong style="color: #1a3d2e;">Kaluuba</strong>! To complete your account setup and ensure the security of your account, please verify your email address using the verification code below.
          </p>

          <!-- OTP Section -->
          <div style="background: linear-gradient(135deg, #2a5d4a 0%, #1f4d3c 50%, #2a5d4a 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; box-shadow: 0 4px 15px rgba(26, 61, 46, 0.15);">
            <p style="color: #e8f4ed; margin: 0 0 15px 0; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">
              Your Verification Code
            </p>
            
            <!-- OTP Display -->
            <div style="background: linear-gradient(135deg, #0f2419 0%, #1a3d2e 50%, #0f2419 100%); border: 2px solid #3a7d5f; border-radius: 8px; padding: 20px; margin: 15px 0; display: inline-block; min-width: 200px; box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.3);">
              <div style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; color: #ffffff; letter-spacing: 8px; margin: 0; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);">
                ${verificationOTP}
              </div>
            </div>
            
            <p style="color: #d4e8df; margin: 15px 0 0 0; font-size: 14px;">
              Enter this code in the verification form to activate your account
            </p>
          </div>

          <!-- Instructions -->
          <div style="background-color: #fef5f0; border-left: 4px solid #f59e5b; padding: 15px 20px; margin: 25px 0; border-radius: 4px;">
            <p style="color: #c05621; margin: 0; font-size: 14px; font-weight: 600;">
              ⏰ Important: This code expires in 15 minutes
            </p>
            <p style="color: #8b3a1a; margin: 5px 0 0 0; font-size: 13px;">
              For security reasons, please complete the verification process promptly.
            </p>
          </div>

          <!-- Additional Info -->
          <div style="margin: 30px 0;">
            <h3 style="color: #1a3d2e; font-size: 18px; margin: 0 0 15px 0;">
              What's next?
            </h3>
            <ul style="color: #4a5568; line-height: 1.6; padding-left: 20px; margin: 0;">
              <li style="margin-bottom: 8px;">Go back to the verification page</li>
              <li style="margin-bottom: 8px;">Enter the 6-digit code above</li>
              <li style="margin-bottom: 8px;">Start exploring Kaluuba!</li>
            </ul>
          </div>

          <!-- Troubleshooting -->
          <div style="background-color: #e8f4ed; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #c8e6d7;">
            <h4 style="color: #1a3d2e; margin: 0 0 10px 0; font-size: 16px;">
              Didn't request this?
            </h4>
            <p style="color: #4a5568; margin: 0; font-size: 14px; line-height: 1.5;">
              If you didn't create an account with Kaluuba, you can safely ignore this email. Your email address may have been entered by mistake.
            </p>
          </div>

          <!-- CTA for new code -->
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #718096; font-size: 14px; margin: 0 0 15px 0;">
              Need a new code?
            </p>
            <p style="color: #4a5568; font-size: 13px; margin: 0;">
              You can request a new verification code from the verification page if this one expires.
            </p>
          </div>

        </div>

        <!-- Footer -->
        <div style="background: linear-gradient(135deg, #f0f7f3 0%, #e8f4ed 100%); padding: 25px 30px; border-top: 2px solid #c8e6d7;">
          <div style="text-align: center;">
            <p style="color: #5a7968; font-size: 12px; margin: 0 0 8px 0; line-height: 1.4;">
              This is an automated message from Kaluuba. Please do not reply to this email.
            </p>
            <p style="color: #5a7968; font-size: 12px; margin: 0; line-height: 1.4;">
              © ${new Date().getFullYear()} Kaluuba. All rights reserved.
            </p>
          </div>
          
          <!-- Security note -->
          <div style="margin-top: 20px; padding: 15px; background-color: #ffffff; border-radius: 6px; border: 1px solid #c8e6d7;">
            <p style="color: #4a5568; font-size: 11px; margin: 0; text-align: center; line-height: 1.4;">
              🔒 <strong style="color: #1a3d2e;">Security Tip:</strong> Kaluuba will never ask for your password via email. 
              If you receive suspicious emails, please contact our support team.
            </p>
          </div>
        </div>

      </div>
      
      <!-- Mobile Responsiveness -->
      <style>
        @media only screen and (max-width: 600px) {
          .container {
            width: 100% !important;
            padding: 0 !important;
          }
          .content {
            padding: 20px !important;
          }
          .otp-code {
            font-size: 28px !important;
            letter-spacing: 6px !important;
          }
        }
      </style>
    </body>
    </html>
  `;
}

  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('SMTP connection failed:', error);
      return false;
    }
  }
}

export default new EmailService();