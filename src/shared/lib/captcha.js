export const TURNSTILE_SITE_KEY = '';
export const CAPTCHA_BYPASS_TOKEN = 'captcha_removed';

export const CAPTCHA_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  EXPIRED: 'expired',
  ERROR: 'error',
  TIMEOUT: 'timeout',
  UNAVAILABLE: 'unavailable',
  DEV_BYPASS: 'dev_bypass',
};

export const isCaptchaConfigured = () => Boolean(TURNSTILE_SITE_KEY);

export const isCaptchaDevBypass = () => true;

export const isCaptchaExplicitlyDisabled = () => true;

export const isCaptchaBypassed = () => true;

export const getCaptchaBypassMessage = () => '';

export const getInitialCaptchaStatus = () => {
  return CAPTCHA_STATUS.DEV_BYPASS;
};

export const getCaptchaValidationTitle = (status) => {
  return '';
};

export const getCaptchaStatusMessage = (status) => {
  return '';
};

export const canRetryCaptcha = (status) => {
  return false;
};

export const getCaptchaValidationError = (token, status) => {
  return '';
};
