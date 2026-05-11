import { useCallback, useState } from 'react';
import {
  CAPTCHA_BYPASS_TOKEN,
  getCaptchaValidationError,
  getCaptchaValidationTitle,
  getInitialCaptchaStatus,
} from '@/shared/lib/captcha';

export const useCaptchaGate = () => {
  const [captchaToken, setCaptchaToken] = useState(CAPTCHA_BYPASS_TOKEN);
  const [captchaStatus, setCaptchaStatus] = useState(() => getInitialCaptchaStatus());
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(CAPTCHA_BYPASS_TOKEN);
    setCaptchaStatus(getInitialCaptchaStatus());
    setCaptchaResetKey((prev) => prev + 1);
  }, []);

  const getCaptchaError = useCallback(
    () => getCaptchaValidationError(captchaToken, captchaStatus),
    [captchaStatus, captchaToken]
  );
  const getCaptchaErrorTitle = useCallback(
    () => getCaptchaValidationTitle(captchaStatus),
    [captchaStatus]
  );

  return {
    captchaToken,
    setCaptchaToken,
    captchaStatus,
    setCaptchaStatus,
    captchaResetKey,
    resetCaptcha,
    getCaptchaError,
    getCaptchaErrorTitle,
  };
};
