import { useEffect } from 'react';
import { CAPTCHA_BYPASS_TOKEN, CAPTCHA_STATUS } from '@/shared/lib/captcha';

const TurnstileField = ({ onTokenChange, onStatusChange, onWidgetReady }) => {
  useEffect(() => {
    onTokenChange?.(CAPTCHA_BYPASS_TOKEN);
    onStatusChange?.(CAPTCHA_STATUS.DEV_BYPASS);
    onWidgetReady?.(null);
  }, [onStatusChange, onTokenChange, onWidgetReady]);

  return null;
};

export default TurnstileField;
