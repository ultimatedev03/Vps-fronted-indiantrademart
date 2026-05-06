import { useCallback, useState } from 'react';
import {
  getCaptchaValidationError,
  getCaptchaValidationTitle,
  getInitialCaptchaStatus,
} from '@/shared/lib/captcha';

export const useCaptchaGate = () => {
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaStatus, setCaptchaStatus] = useState(() => getInitialCaptchaStatus());
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const resetCaptcha = useCallback(() => {
    setCaptchaToken('');
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
