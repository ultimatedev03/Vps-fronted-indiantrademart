import { supabase } from '@/lib/customSupabaseClient';
import { apiUrl } from '@/lib/apiBase';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';

const OTP_LENGTH = 6;
const OTP_API_BASE = '/api/otp';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const isValidEmail = (email) => {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const postOtp = async (action, payload, fallbackMessage) => {
  const response = await fetchWithCsrf(apiUrl(`${OTP_API_BASE}/${action}`), {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafe(response);
  if (!response.ok) {
    const error = new Error(data?.error || fallbackMessage);
    error.status = response.status;
    throw error;
  }

  if (import.meta.env.DEV && data?.debug_otp) {
    // Local fallback visibility for register/verify flows when SMTP auth is unavailable.
    // Never returned in production mode.
    // eslint-disable-next-line no-console
    console.info('[OTP][DEV_FALLBACK] debug_otp:', data.debug_otp);
  }

  return data;
};

export const otpService = {
  requestOtp: async (email, options = {}) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw new Error('Email is required');
    if (!isValidEmail(normalizedEmail)) throw new Error('Invalid email format');

    return postOtp(
      'request',
      {
        email: normalizedEmail,
        ...(options?.captcha_token ? { captcha_token: options.captcha_token } : {}),
        ...(options?.captcha_action ? { captcha_action: options.captcha_action } : {}),
      },
      'Failed to send OTP'
    );
  },

  verifyOtp: async (email, otpCode) => {
    const normalizedEmail = normalizeEmail(email);
    const normalizedOtp = String(otpCode || '').trim();

    if (!normalizedEmail || !normalizedOtp) {
      throw new Error('Email and OTP code are required');
    }

    if (normalizedOtp.length !== OTP_LENGTH) {
      throw new Error(`OTP must be ${OTP_LENGTH} digits`);
    }

    return postOtp(
      'verify',
      { email: normalizedEmail, otp_code: normalizedOtp },
      'Invalid or expired OTP code'
    );
  },

  resendOtp: async (email, options = {}) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw new Error('Email is required');
    if (!isValidEmail(normalizedEmail)) throw new Error('Invalid email format');

    return postOtp(
      'resend',
      {
        email: normalizedEmail,
        ...(options?.captcha_token ? { captcha_token: options.captcha_token } : {}),
        ...(options?.captcha_action ? { captcha_action: options.captcha_action } : {}),
      },
      'Failed to resend OTP'
    );
  },

  createAuthUser: async (email, password, userData = {}) => {
    if (!email || !password) throw new Error('Email and password are required');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          ...userData,
          role: userData.role || 'VENDOR',
          email_verified: true,
        },
      },
    });

    if (error) throw error;
    return data;
  },
};
