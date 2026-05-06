import { apiUrl } from '@/lib/apiBase';
import { validateStrongPassword } from '@/lib/passwordPolicy';

const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const postJson = async (path, payload, fallbackError) => {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(data?.error || fallbackError);
  }

  return data;
};

export const passwordResetApi = {
  checkEmailByRole: async (email, role) => {
    if (!email || !role) {
      throw new Error('Email and role are required');
    }

    return postJson(
      '/api/password-reset/verify-email',
      { email: email.toLowerCase().trim(), role },
      'Email not registered'
    );
  },

  requestOTP: async (email, options = {}) => {
    if (!email) {
      throw new Error('Email is required');
    }

    return postJson(
      '/api/otp/request',
      {
        email: email.toLowerCase().trim(),
        ...(options?.captcha_token ? { captcha_token: options.captcha_token } : {}),
        ...(options?.captcha_action ? { captcha_action: options.captcha_action } : {}),
      },
      'Failed to send OTP'
    );
  },

  verifyOTP: async (email, otpCode) => {
    if (!email || !otpCode) {
      throw new Error('Email and OTP are required');
    }

    return postJson(
      '/api/otp/verify',
      { email: email.toLowerCase().trim(), otp_code: otpCode },
      'Invalid or expired OTP'
    );
  },

  resendOTP: async (email, options = {}) => {
    if (!email) {
      throw new Error('Email is required');
    }

    return postJson(
      '/api/otp/resend',
      {
        email: email.toLowerCase().trim(),
        ...(options?.captcha_token ? { captcha_token: options.captcha_token } : {}),
        ...(options?.captcha_action ? { captcha_action: options.captcha_action } : {}),
      },
      'Failed to resend OTP'
    );
  },

  resetPassword: async (email, newPassword) => {
    if (!email || !newPassword) {
      throw new Error('Email and new password are required');
    }

    const validation = validateStrongPassword(newPassword);
    if (!validation.ok) {
      throw new Error(validation.error);
    }

    return postJson(
      '/api/password-reset',
      { email: email.toLowerCase().trim(), new_password: newPassword },
      'Failed to reset password'
    );
  },
};
