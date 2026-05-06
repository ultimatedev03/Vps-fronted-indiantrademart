import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useEmployeeAuth } from '@/modules/employee/context/EmployeeAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Briefcase, Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Logo from '@/shared/components/Logo';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { PASSWORD_MIN_LENGTH } from '@/lib/passwordPolicy';
import TurnstileField from '@/shared/components/TurnstileField';
import { useCaptchaGate } from '@/shared/hooks/useCaptchaGate';
import PublicSiteHomeLink from '@/shared/components/PublicSiteHomeLink';
import { employeeApi } from '@/modules/employee/services/employeeApi';

const normalizePortalRole = (value = '') => {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'DATAENTRY') return 'DATA_ENTRY';
  return raw;
};

const PORTAL_CONFIGS = {
  dataentry: {
    heading: 'Data Entry Portal',
    subtitle: 'Restricted access for data operations personnel only',
    cardTitle: 'Data Entry Login',
    cardDescription: 'Enter your data entry credentials to continue',
    submitLabel: 'Access Data Entry Workspace',
    expectedRole: 'DATA_ENTRY',
  },
  support: {
    heading: 'Support Portal',
    subtitle: 'Restricted access for support personnel only',
    cardTitle: 'Support Login',
    cardDescription: 'Enter your support credentials to continue',
    submitLabel: 'Access Support Workspace',
    expectedRole: 'SUPPORT',
  },
  sales: {
    heading: 'Sales Portal',
    subtitle: 'Restricted access for sales personnel only',
    cardTitle: 'Sales Login',
    cardDescription: 'Enter your sales credentials to continue',
    submitLabel: 'Access Sales Workspace',
    expectedRole: 'SALES',
  },
  manager: {
    heading: 'Manager Portal',
    subtitle: 'Restricted access for managers only',
    cardTitle: 'Manager Login',
    cardDescription: 'Enter your manager credentials to continue',
    submitLabel: 'Access Manager Workspace',
    expectedRole: 'MANAGER',
  },
  vp: {
    heading: 'VP Portal',
    subtitle: 'Restricted access for VP personnel only',
    cardTitle: 'VP Login',
    cardDescription: 'Enter your VP credentials to continue',
    submitLabel: 'Access VP Workspace',
    expectedRole: 'VP',
  },
};

const DEFAULT_PORTAL_CONFIG = {
  heading: 'Employee Portal',
  subtitle: 'Restricted access for authorized personnel only',
  cardTitle: 'Sign In',
  cardDescription: 'Enter your staff credentials to continue',
  submitLabel: 'Access Workspace',
  expectedRole: '',
};

const Login = ({ forcedPortalKey = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login } = useEmployeeAuth();
  const loginCaptcha = useCaptchaGate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const portalConfig = useMemo(() => {
    const pathPortalKey = String(location.pathname || '')
      .split('/')
      .filter(Boolean)
      .slice(-2, -1)[0] || '';
    const portalKey = String(forcedPortalKey || searchParams.get('portal') || pathPortalKey).trim().toLowerCase();
    return PORTAL_CONFIGS[portalKey] || DEFAULT_PORTAL_CONFIG;
  }, [forcedPortalKey, location.pathname, searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.email || !formData.password) {
      setError('Please enter both email and password');
      return;
    }

    if (formData.password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
      return;
    }

    const captchaError = loginCaptcha.getCaptchaError();
    if (captchaError) {
      setError(captchaError);
      return;
    }

    setIsLoading(true);

    try {
      const user = await login(formData.email, formData.password, {
        captcha_token: loginCaptcha.captchaToken,
        captcha_action: 'auth_login',
      }, portalConfig.expectedRole);

      if (user) {
        if (
          portalConfig.expectedRole &&
          normalizePortalRole(user.role) !== normalizePortalRole(portalConfig.expectedRole)
        ) {
          await employeeApi.auth.logout().catch(() => {});
          setError(`${user.role?.replaceAll('_', ' ') || 'This'} account is not allowed in this portal.`);
          loginCaptcha.resetCaptcha();
          return;
        }

        // ✅ Role-based redirect (covers ADMIN/HR too)
        if (user.role === 'ADMIN') {
          navigate('/admin/dashboard');
        } else if (user.role === 'HR') {
          navigate('/hr/dashboard');
        } else if (user.role === 'FINANCE') {
          navigate('/finance-portal/dashboard');
        } else if (user.role === 'DATA_ENTRY' || user.role === 'DATAENTRY') {
          navigate('/employee/dataentry/dashboard');
        } else if (user.role === 'SUPPORT') {
          navigate('/employee/support/dashboard');
        } else if (user.role === 'SALES') {
          navigate('/employee/sales/dashboard');
        } else if (user.role === 'MANAGER') {
          navigate('/employee/manager/dashboard');
        } else if (user.role === 'VP') {
          navigate('/employee/vp/dashboard');
        } else {
          navigate('/');
        }
      } else {
        setError('Invalid credentials');
        loginCaptcha.resetCaptcha();
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || 'An unexpected error occurred during login.');
      loginCaptcha.resetCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <PublicSiteHomeLink tone="dark" />
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute -top-[30%] -right-[10%] w-[800px] h-[800px] rounded-full bg-blue-600/10 blur-3xl"></div>
        <div className="absolute top-[60%] -left-[10%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-3xl"></div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10 mb-8">
        <Logo
          className="mx-auto h-16 brightness-0 invert"
          showTagline={false}
          compact={true}
        />

        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
          {portalConfig.heading}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          {portalConfig.subtitle}
        </p>
      </div>

      <div className="mt-2 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Card className="border-slate-800 bg-slate-950/50 backdrop-blur-xl shadow-2xl text-slate-200">
          <CardHeader>
            <CardTitle className="text-xl text-center">{portalConfig.cardTitle}</CardTitle>
            <CardDescription className="text-center text-slate-400">
              {portalConfig.cardDescription}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">
                  Work Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="username"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10 bg-slate-900/50 border-slate-700 focus:border-blue-500 text-white placeholder:text-slate-600"
                    placeholder="name@itm.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-slate-300">
                    Password
                  </Label>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      toast({
                        title: "Contact IT Support",
                        description: "Please contact admin to reset password.",
                      });
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Forgot password?
                  </a>
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10 pr-10 bg-slate-900/50 border-slate-700 focus:border-blue-500 text-white placeholder:text-slate-600"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white h-11"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Briefcase className="mr-2 h-4 w-4" />
                )}
                {portalConfig.submitLabel}
              </Button>

              <TurnstileField
                action="auth_login"
                onStatusChange={loginCaptcha.setCaptchaStatus}
                resetKey={loginCaptcha.captchaResetKey}
                onTokenChange={loginCaptcha.setCaptchaToken}
              />
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
