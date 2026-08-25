/**
 * BlackSquad Enterprise SMS Gateway Service
 * Handles live SMS delivery for OTP verification, driver invites, and trip updates.
 * Supports Twilio, Fast2SMS, MSG91, Custom Webhooks, and Dev Mock fallback.
 */

import { env } from '../config/env';

export interface SendSmsResult {
  success: boolean;
  provider: string;
  isLiveGateway: boolean;
  messageId?: string;
  error?: string;
}

class SmsService {
  /**
   * Dispatches a 6-digit OTP verification SMS to the recipient mobile number.
   */
  public async sendOtpSms(phoneNumber: string, otp: string): Promise<SendSmsResult> {
    const message = `Your BlackSquad security verification code is: ${otp}. Valid for 10 minutes. Do not share this code with anyone.`;
    return this.dispatchSms(phoneNumber, message, otp);
  }

  /**
   * Dispatches a Welcome & Onboarding SMS invite to a newly added Fleet Driver partner.
   */
  public async sendDriverInviteSms(
    phoneNumber: string,
    driverName: string,
    otp: string
  ): Promise<SendSmsResult> {
    const message = `Welcome to BlackSquad Fleet, ${driverName}! You have been registered by your Fleet Owner. Sign in using your phone number ${phoneNumber} and One-Time PIN: ${otp}.`;
    return this.dispatchSms(phoneNumber, message, otp);
  }

  /**
   * Internal dispatcher routing to configured SMS provider.
   */
  private async dispatchSms(phoneNumber: string, message: string, otpCode?: string): Promise<SendSmsResult> {
    const raw10 = phoneNumber.replace(/\D/g, '').slice(-10);
    const e164 = phoneNumber.startsWith('+') ? phoneNumber : `+91${raw10}`;

    // 1. Twilio SMS Gateway
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER) {
      try {
        const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', e164);
        params.append('From', env.TWILIO_PHONE_NUMBER);
        params.append('Body', message);

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          }
        );

        const data: any = await response.json();
        if (response.ok) {
          console.log(`📡 [TWILIO SMS SENT] To: ${e164} | SID: ${data.sid}`);
          return { success: true, provider: 'TWILIO', isLiveGateway: true, messageId: data.sid };
        } else {
          console.error(`❌ [TWILIO SMS ERROR] ${data.message || response.statusText}`);
        }
      } catch (err: any) {
        console.error(`❌ [TWILIO DISPATCH FAILED] ${err.message}`);
      }
    }

    // 2. Fast2SMS (Indian SMS Gateway - Free Tier & Pilot Ready)
    if (env.FAST2SMS_API_KEY) {
      try {
        // Attempt 1: Standard OTP route
        let response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: env.FAST2SMS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: otpCode || '000000',
            numbers: raw10,
          }),
        });

        let data: any = await response.json();
        if (data.return) {
          console.log(`📡 [FAST2SMS SENT (OTP ROUTE)] To: ${raw10} | ReqID: ${data.request_id}`);
          return { success: true, provider: 'FAST2SMS', isLiveGateway: true, messageId: data.request_id };
        }

        // Attempt 2: Quick SMS route fallback
        response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: env.FAST2SMS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'q',
            message: message,
            language: 'english',
            numbers: raw10,
          }),
        });

        data = await response.json();
        if (data.return) {
          console.log(`📡 [FAST2SMS SENT (QUICK ROUTE)] To: ${raw10} | ReqID: ${data.request_id}`);
          return { success: true, provider: 'FAST2SMS', isLiveGateway: true, messageId: data.request_id };
        } else {
          console.error(`❌ [FAST2SMS ERROR] ${Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Dispatch failed'}`);
        }
      } catch (err: any) {
        console.error(`❌ [FAST2SMS DISPATCH FAILED] ${err.message}`);
      }
    }

    // 3. MSG91 SMS Gateway
    if (env.MSG91_AUTH_KEY && env.MSG91_TEMPLATE_ID) {
      try {
        const response = await fetch('https://control.msg91.com/api/v5/otp', {
          method: 'POST',
          headers: {
            authkey: env.MSG91_AUTH_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            template_id: env.MSG91_TEMPLATE_ID,
            mobile: `91${raw10}`,
            otp: otpCode,
          }),
        });

        const data: any = await response.json();
        if (data.type === 'success') {
          console.log(`📡 [MSG91 SMS SENT] To: 91${raw10} | ReqID: ${data.request_id}`);
          return { success: true, provider: 'MSG91', isLiveGateway: true, messageId: data.request_id };
        }
      } catch (err: any) {
        console.error(`❌ [MSG91 DISPATCH FAILED] ${err.message}`);
      }
    }

    // 4. Custom HTTP Webhook Gateway
    if (env.CUSTOM_SMS_WEBHOOK_URL) {
      try {
        const response = await fetch(env.CUSTOM_SMS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: e164, rawPhone: raw10, message, otp: otpCode }),
        });
        if (response.ok) {
          console.log(`📡 [WEBHOOK SMS SENT] To: ${e164}`);
          return { success: true, provider: 'CUSTOM_WEBHOOK', isLiveGateway: true };
        }
      } catch (err: any) {
        console.error(`❌ [WEBHOOK SMS FAILED] ${err.message}`);
      }
    }

    // 5. Default Enterprise Mock Logger with Carrier Simulation
    console.log('\n======================================================');
    console.log('📱 [BLACKSQUAD SMS GATEWAY DISPATCH]');
    console.log(`   To: ${e164} (India Mobile)`);
    console.log(`   Carrier Route: OTP Transactional High-Priority`);
    console.log(`   Message Content: "${message}"`);
    if (otpCode) console.log(`   Security Token: ${otpCode}`);
    console.log('======================================================\n');

    return {
      success: true,
      provider: 'MOCK_GATEWAY',
      isLiveGateway: false,
      messageId: `MOCK-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    };
  }
}

export const smsService = new SmsService();
