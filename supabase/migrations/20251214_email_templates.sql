-- Update Supabase Auth Email Templates
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- NOTE: Supabase email templates are configured in the Dashboard, not via SQL.
-- Go to: Authentication > Email Templates
-- 
-- Below are the HTML templates you can copy/paste into each template field:

-- ============================================
-- CONFIRMATION EMAIL (Confirm signup)
-- ============================================
-- Subject: Welcome to PatriotPledge NFTs - Please Confirm Your Email
--
-- Body (HTML):
/*
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; }
    .logo { text-align: center; margin-bottom: 30px; font-size: 32px; }
    h1 { color: #fff; font-size: 24px; margin: 0 0 20px 0; text-align: center; }
    p { color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #fff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; }
    .btn-container { text-align: center; margin: 30px 0; }
    .features { background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 20px 0; }
    .feature { display: flex; align-items: center; gap: 12px; margin: 12px 0; color: #94a3b8; font-size: 14px; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); }
    .footer p { font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">🎖️</div>
      <h1>Welcome to PatriotPledge NFTs!</h1>
      
      <p>Thank you for joining our community dedicated to supporting veterans and charitable causes through blockchain transparency.</p>
      
      <p>Please confirm your email address to activate your account and start making a difference:</p>
      
      <div class="btn-container">
        <a href="{{ .ConfirmationURL }}" class="btn">Confirm My Email</a>
      </div>
      
      <div class="features">
        <p style="color: #fff; font-weight: 600; margin-bottom: 15px;">With your account, you can:</p>
        <div class="feature">🛒 Purchase NFTs to support veterans and charitable campaigns</div>
        <div class="feature">💬 Join community discussions and connect with creators</div>
        <div class="feature">📊 Track your donations with full blockchain transparency</div>
        <div class="feature">🎖️ Build your collection of meaningful NFTs</div>
      </div>
      
      <p style="font-size: 14px; color: #64748b;">If you didn't create an account with PatriotPledge NFTs, you can safely ignore this email.</p>
      
      <div class="footer">
        <p>PatriotPledge NFTs - Transparent Giving on the Blockchain</p>
        <p>© 2024 Vets Helping Vets. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
*/

-- ============================================
-- MAGIC LINK EMAIL (Passwordless login)
-- ============================================
-- Subject: Your PatriotPledge NFTs Login Link
--
-- Body (HTML):
/*
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; }
    .logo { text-align: center; margin-bottom: 30px; font-size: 32px; }
    h1 { color: #fff; font-size: 24px; margin: 0 0 20px 0; text-align: center; }
    p { color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #fff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; }
    .btn-container { text-align: center; margin: 30px 0; }
    .warning { background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 15px; margin: 20px 0; }
    .warning p { color: #fbbf24; font-size: 14px; margin: 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); }
    .footer p { font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">🔐</div>
      <h1>Your Login Link</h1>
      
      <p>Click the button below to securely sign in to your PatriotPledge NFTs account:</p>
      
      <div class="btn-container">
        <a href="{{ .ConfirmationURL }}" class="btn">Sign In to My Account</a>
      </div>
      
      <div class="warning">
        <p>⚠️ This link expires in 24 hours and can only be used once.</p>
      </div>
      
      <p style="font-size: 14px; color: #64748b;">If you didn't request this login link, you can safely ignore this email. Someone may have entered your email by mistake.</p>
      
      <div class="footer">
        <p>PatriotPledge NFTs - Transparent Giving on the Blockchain</p>
        <p>© 2024 Vets Helping Vets. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
*/

-- ============================================
-- PASSWORD RESET EMAIL
-- ============================================
-- Subject: Reset Your PatriotPledge NFTs Password
--
-- Body (HTML):
/*
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; }
    .logo { text-align: center; margin-bottom: 30px; font-size: 32px; }
    h1 { color: #fff; font-size: 24px; margin: 0 0 20px 0; text-align: center; }
    p { color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #fff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; }
    .btn-container { text-align: center; margin: 30px 0; }
    .warning { background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 15px; margin: 20px 0; }
    .warning p { color: #fbbf24; font-size: 14px; margin: 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); }
    .footer p { font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">🔑</div>
      <h1>Reset Your Password</h1>
      
      <p>We received a request to reset the password for your PatriotPledge NFTs account.</p>
      
      <p>Click the button below to create a new password:</p>
      
      <div class="btn-container">
        <a href="{{ .ConfirmationURL }}" class="btn">Reset My Password</a>
      </div>
      
      <div class="warning">
        <p>⚠️ This link expires in 24 hours. If you didn't request a password reset, please ignore this email or contact support if you're concerned.</p>
      </div>
      
      <div class="footer">
        <p>PatriotPledge NFTs - Transparent Giving on the Blockchain</p>
        <p>© 2024 Vets Helping Vets. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
*/

-- ============================================
-- EMAIL CHANGE CONFIRMATION
-- ============================================
-- Subject: Confirm Your New Email Address - PatriotPledge NFTs
--
-- Body (HTML):
/*
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; }
    .logo { text-align: center; margin-bottom: 30px; font-size: 32px; }
    h1 { color: #fff; font-size: 24px; margin: 0 0 20px 0; text-align: center; }
    p { color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #fff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; }
    .btn-container { text-align: center; margin: 30px 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); }
    .footer p { font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">📧</div>
      <h1>Confirm Your New Email</h1>
      
      <p>You requested to change the email address associated with your PatriotPledge NFTs account.</p>
      
      <p>Click the button below to confirm this new email address:</p>
      
      <div class="btn-container">
        <a href="{{ .ConfirmationURL }}" class="btn">Confirm New Email</a>
      </div>
      
      <p style="font-size: 14px; color: #64748b;">If you didn't request this change, please contact support immediately.</p>
      
      <div class="footer">
        <p>PatriotPledge NFTs - Transparent Giving on the Blockchain</p>
        <p>© 2024 Vets Helping Vets. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
*/
