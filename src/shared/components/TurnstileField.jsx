import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CAPTCHA_BYPASS_TOKEN,
  CAPTCHA_STATUS,
  TURNSTILE_SITE_KEY,
  canRetryCaptcha,
  getCaptchaBypassMessage,
  getCaptchaStatusMessage,
  getInitialCaptchaStatus,
  isCaptchaBypassed,
  isCaptchaConfigured,
  getCaptchaValidationTitle,
} from '@/shared/lib/captcha';

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_SCRIPT_SELECTOR = 'script[data-turnstile-script="true"]';
const TURNSTILE_LOAD_TIMEOUT_MS = 10000;

let turnstileScriptPromise = null;

const findTurnstileScript = () =>
  document.querySelector(
    `${TURNSTILE_SCRIPT_SELECTOR}, script[src="${TURNSTILE_SCRIPT_SRC}"]`
  );

const waitForTurnstile = (timeoutMs = TURNSTILE_LOAD_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    if (window.turnstile?.render) {
      resolve(window.turnstile);
      return;
    }

    const startedAt = Date.now();

    const check = () => {
      if (window.turnstile?.render) {
        resolve(window.turnstile);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('Turnstile did not initialize.'));
        return;
      }

      window.setTimeout(check, 100);
    };

    check();
  });

const loadTurnstileScript = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile can only load in the browser.'));
  }

  if (window.turnstile?.render) {
    return Promise.resolve(window.turnstile);
  }

  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      let existingScript = findTurnstileScript();

      const fail = (error) => {
        turnstileScriptPromise = null;
        reject(error);
      };

      if (!existingScript) {
        const script = document.createElement('script');
        script.src = TURNSTILE_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.dataset.turnstileScript = 'true';

        try {
          document.head.appendChild(script);
          existingScript = script;
        } catch (error) {
          fail(new Error('Captcha script was blocked before it could load.'));
          return;
        }
      }

      const handleError = () => fail(new Error('Failed to load Turnstile.'));
      existingScript.addEventListener('error', handleError, { once: true });

      waitForTurnstile()
        .then((turnstile) => {
          existingScript?.removeEventListener('error', handleError);
          resolve(turnstile);
        })
        .catch((error) => {
          existingScript?.removeEventListener('error', handleError);
          fail(error instanceof Error ? error : new Error('Failed to load Turnstile.'));
        });
    });
  }

  return turnstileScriptPromise;
};

const TurnstileField = ({
  action = 'submit',
  appearance = 'always',
  className,
  execution = 'render',
  onTokenChange,
  onStatusChange,
  onWidgetReady,
  refreshExpired = 'auto',
  refreshTimeout = 'auto',
  resetKey = 0,
  retry = 'auto',
}) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const canAcceptTokenRef = useRef(execution !== 'execute');
  const [status, setStatus] = useState(() => getInitialCaptchaStatus());
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useEffect(() => {
    if (isCaptchaBypassed()) {
      onTokenChange?.(CAPTCHA_BYPASS_TOKEN);
      onWidgetReady?.(null);
      setStatus(CAPTCHA_STATUS.DEV_BYPASS);
      return undefined;
    }

    if (!isCaptchaConfigured()) {
      onTokenChange?.('');
      onWidgetReady?.(null);
      setStatus(CAPTCHA_STATUS.UNAVAILABLE);
      return undefined;
    }

    let active = true;
    const nextStatusAfterRender = CAPTCHA_STATUS.IDLE;

    const renderWidget = async () => {
      canAcceptTokenRef.current = execution !== 'execute';
      onTokenChange?.('');
      setStatus(CAPTCHA_STATUS.LOADING);

      try {
        const turnstile = await loadTurnstileScript();
        if (!active || !containerRef.current) return;

        containerRef.current.replaceChildren();
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          appearance,
          execution,
          retry,
          'refresh-expired': refreshExpired,
          'refresh-timeout': refreshTimeout,
          callback: (token) => {
            if (!active) return;
            if (execution === 'execute' && !canAcceptTokenRef.current) {
              setStatus(CAPTCHA_STATUS.IDLE);
              onTokenChange?.('');
              return;
            }
            canAcceptTokenRef.current = execution !== 'execute';
            setStatus(CAPTCHA_STATUS.READY);
            onTokenChange?.(token || '');
          },
          'expired-callback': () => {
            if (!active) return;
            canAcceptTokenRef.current = execution !== 'execute';
            setStatus(CAPTCHA_STATUS.EXPIRED);
            onTokenChange?.('');
          },
          'error-callback': () => {
            if (!active) return;
            canAcceptTokenRef.current = execution !== 'execute';
            setStatus(CAPTCHA_STATUS.ERROR);
            onTokenChange?.('');
          },
          'timeout-callback': () => {
            if (!active) return;
            canAcceptTokenRef.current = execution !== 'execute';
            setStatus(CAPTCHA_STATUS.TIMEOUT);
            onTokenChange?.('');
          },
        });

        onWidgetReady?.({
          execute: async () => {
            if (widgetIdRef.current === null || !window.turnstile?.execute) return false;
            canAcceptTokenRef.current = true;
            onTokenChange?.('');
            setStatus(CAPTCHA_STATUS.LOADING);
            if (window.turnstile?.reset) {
              window.turnstile.reset(widgetIdRef.current);
            }
            window.turnstile.execute(widgetIdRef.current);
            return true;
          },
          reset: () => {
            if (widgetIdRef.current === null || !window.turnstile?.reset) return false;
            canAcceptTokenRef.current = execution !== 'execute';
            onTokenChange?.('');
            setStatus(CAPTCHA_STATUS.IDLE);
            window.turnstile.reset(widgetIdRef.current);
            return true;
          },
        });

        setStatus(nextStatusAfterRender);
      } catch (error) {
        if (!active) return;
        setStatus(CAPTCHA_STATUS.ERROR);
        onTokenChange?.('');
      }
    };

    renderWidget();

    return () => {
      active = false;
      if (widgetIdRef.current !== null && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      onWidgetReady?.(null);
    };
  }, [
    action,
    appearance,
    execution,
    onTokenChange,
    onWidgetReady,
    refreshExpired,
    refreshTimeout,
    resetKey,
    retry,
    retryKey,
  ]);

  const handleRetry = () => {
    turnstileScriptPromise = null;
    onTokenChange?.('');
    onWidgetReady?.(null);
    setStatus(CAPTCHA_STATUS.LOADING);
    setRetryKey((prev) => prev + 1);
  };

  if (isCaptchaBypassed()) {
    return (
      <div className={cn('rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800', className)}>
        {getCaptchaBypassMessage()}
      </div>
    );
  }

  if (!isCaptchaConfigured()) {
    return (
      <div className={cn('flex w-full flex-col items-center space-y-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700', className)}>
        <p className="text-center">Captcha failed to load. Use Reload CAPTCHA to try again.</p>
        <button
          type="button"
          onClick={handleRetry}
          className="font-medium text-blue-600 transition-colors hover:text-blue-800"
        >
          Reload CAPTCHA
        </button>
      </div>
    );
  }

  const statusMessage = getCaptchaStatusMessage(status);

  return (
    <div className={cn('flex w-full flex-col items-center space-y-2', className)}>
      <div ref={containerRef} className="flex w-full justify-center" />
      {statusMessage ? <p className="text-center text-xs text-slate-500">{statusMessage}</p> : null}
      {canRetryCaptcha(status) ? (
        <button
          type="button"
          onClick={handleRetry}
          className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-800"
        >
          Reload CAPTCHA
        </button>
      ) : null}
      {status === CAPTCHA_STATUS.ERROR ? (
        <p className="text-center text-[11px] text-slate-400">
          {getCaptchaValidationTitle(status)}: retry the security check without refreshing the whole page.
        </p>
      ) : null}
    </div>
  );
};

export default TurnstileField;
