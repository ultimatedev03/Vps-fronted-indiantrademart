import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInternalAuth } from '@/modules/admin/context/InternalAuthContext';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PASSWORD_MIN_LENGTH } from '@/lib/passwordPolicy';
import TurnstileField from '@/shared/components/TurnstileField';
import { useCaptchaGate } from '@/shared/hooks/useCaptchaGate';
import PublicSiteHomeLink from '@/shared/components/PublicSiteHomeLink';
import { useSubdomain } from '@/contexts/SubdomainContext';

const PortalLogin = ({ portalName, colorScheme, defaultEmail, icon: Icon }) => {
  const navigate = useNavigate();
  const { resolvePath } = useSubdomain();
  const { login } = useInternalAuth();
  const loginCaptcha = useCaptchaGate();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const getColorClass = (type) => {
    const colors = {
      blue: 'bg-blue-600 hover:bg-blue-700 text-blue-600',
      emerald: 'bg-emerald-600 hover:bg-emerald-700 text-emerald-600',
      amber: 'bg-amber-600 hover:bg-amber-700 text-amber-600',
      purple: 'bg-purple-600 hover:bg-purple-700 text-purple-600',
    };
    return colors[colorScheme] || colors.blue;
  };

  const activeColor = getColorClass().split(' ')[0];

  const portalKey = (portalName || '').toLowerCase();
  const expectedRole = portalKey.includes('hr')
    ? 'HR'
    : portalKey.includes('finance')
      ? 'FINANCE'
      : 'ADMIN';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!formData.email.trim() || !formData.password) {
      setError('Email and password are required.');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      setIsLoading(false);
      return;
    }

    const captchaError = loginCaptcha.getCaptchaError();
    if (captchaError) {
      setError(captchaError);
      setIsLoading(false);
      return;
    }

    try {
      // Strict portal-role enforcement (no cross-dashboard login)
      const user = await login(formData.email, formData.password, expectedRole, {
        captcha_token: loginCaptcha.captchaToken,
        captcha_action: 'auth_login',
      });

      if (user) {
        if (user.status === 'BLOCKED') {
          setError('Your account has been suspended. Contact administrator.');
          setIsLoading(false);
          return;
        }

        switch (user.role) {
          case 'ADMIN':
            navigate(resolvePath('dashboard', 'admin'));
            break;
          case 'FINANCE':
            navigate('/finance-portal/dashboard');
            break;
          case 'HR':
            navigate('/hr/dashboard');
            break;
          case 'DATA_ENTRY':
          case 'DATAENTRY':
            navigate('/employee/dataentry/dashboard');
            break;
          case 'SUPPORT':
            navigate('/employee/support/dashboard');
            break;
          case 'SALES':
            navigate('/employee/sales/dashboard');
            break;
          case 'EMPLOYEE':
            navigate('/employee/dataentry/dashboard');
            break;
          default:
            console.error("Unknown role:", user.role);
            setError(`Role mismatch: '${user.role}' not recognized for this portal.`);
        }
      } else {
        setError('Invalid login credentials');
        loginCaptcha.resetCaptcha();
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || 'System error. Please try again.');
      loginCaptcha.resetCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <PublicSiteHomeLink tone="light" />
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-xl flex items-center justify-center shadow-lg bg-white">
            {Icon && <Icon className={`h-8 w-8 ${getColorClass().split(' ').pop()}`} />}
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {portalName}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Restricted System Access
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 rounded-2xl sm:px-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Work Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder={defaultEmail || "name@company.com"}
                className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••"
                  className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="bg-red-50 border-red-100 p-0 text-red-800">
                <div className="flex items-start gap-3 px-4 py-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <div className="min-w-0">
                    <AlertTitle className="mb-1 text-red-800">Authentication Failed</AlertTitle>
                    <AlertDescription className="leading-relaxed text-red-700">{error}</AlertDescription>
                  </div>
                </div>
              </Alert>
            )}

            <Button
              type="submit"
              className={`w-full h-11 text-base font-medium shadow-lg hover:shadow-xl transition-all ${activeColor}`}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Sign In"}
            </Button>

            <TurnstileField
              action="auth_login"
              onStatusChange={loginCaptcha.setCaptchaStatus}
              resetKey={loginCaptcha.captchaResetKey}
              onTokenChange={loginCaptcha.setCaptchaToken}
            />
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-xs text-center text-slate-400">
              Authorized personnel only. All activities are monitored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalLogin;
