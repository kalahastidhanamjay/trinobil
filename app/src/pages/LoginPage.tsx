import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button, ErrorBox, Field, Input } from '@/components/ui';
import { call, errorMessage, identity } from '@/lib/api';
import { Logo } from '../components/Logo';
import { useAuth } from '@/lib/auth';

type Step = 'identify' | 'password' | 'code';

/**
 * Same flow as the mobile app: username first; active accounts continue with a password, new accounts get
 * an emailed code to set their password. "Forgot password" also uses an emailed code.
 */
export function LoginPage() {
  const auth = useAuth();
  const [step, setStep] = useState<Step>('identify');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [maskedEmail, setMaskedEmail] = useState<string>();
  const [activation, setActivation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const identify = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await call(identity.POST('/api/v1/auth/identify', { body: { username } }));
      if (res?.next === 'VERIFY_EMAIL') {
        setMaskedEmail(res.maskedEmail);
        setActivation(true);
        setStep('code');
      } else {
        setStep('password');
      }
    });
  };

  const login = (e: FormEvent) => {
    e.preventDefault();
    run(() => auth.signIn(username, password));
  };

  const forgot = () =>
    run(async () => {
      await call(identity.POST('/api/v1/auth/forgot-password', { body: { username } }));
      setActivation(false);
      setStep('code');
      toast.success('We emailed you a code.');
    });

  const setNew = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const body = { username, otp: code.trim(), newPassword };
      await call(
        activation
          ? identity.POST('/api/v1/auth/activate', { body })
          : identity.POST('/api/v1/auth/reset-password', { body }),
      );
      toast.success(activation ? 'Account activated.' : 'Password changed.');
      await auth.signIn(username, newPassword);
    });
  };

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-chrome p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="relative flex items-center gap-2.5">
          <Logo size={30} />
        </div>
        <div className="relative">
          <div className="mb-8 w-80 overflow-hidden rounded-lg border border-white/10 bg-chrome-2 shadow-2xl">
            <div className="flex justify-between border-b border-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <span>Counter 1</span>
              <span>Bill #1042</span>
            </div>
            {[
              ['Basmati rice 5 kg', '1', '645.00'],
              ['Toor dal 1 kg', '2', '318.00'],
              ['Sunflower oil 1 L', '3', '465.00'],
            ].map(([n, q, a]) => (
              <div key={n} className="num flex justify-between px-4 py-1.5 text-xs text-slate-300">
                <span className="font-sans">{n}</span>
                <span>
                  <span className="text-slate-500">×{q}</span> &nbsp;{a}
                </span>
              </div>
            ))}
            <div className="mt-1 flex items-end justify-between border-t border-white/5 px-4 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total</span>
              <span className="num text-3xl font-bold text-brand-200">₹1,428.00</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold leading-tight">The fastest counter in town.</h1>
          <p className="mt-2 max-w-md text-sm text-slate-400">Scan, type, charge. GST bills, live stock, purchases and reports for shops and restaurants.</p>
          <div className="mt-5 flex gap-4 text-xs text-slate-400">
            <span><kbd className="border-white/15 bg-white/5 text-slate-300 shadow-none">F2</kbd> New bill</span>
            <span><kbd className="border-white/15 bg-white/5 text-slate-300 shadow-none">F9</kbd> Charge</span>
            <span><kbd className="border-white/15 bg-white/5 text-slate-300 shadow-none">3*</kbd> Quantity</span>
          </div>
        </div>
        <p className="relative text-xs text-slate-600">© {new Date().getFullYear()} Trinobil</p>
      </div>

      <div className="flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-xs">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Logo size={30} onLight />
          </div>
          <h2 className="text-xl font-bold">{step === 'code' ? (activation ? 'Activate your account' : 'Reset your password') : 'Welcome to Trinobil'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {step === 'identify' && 'Sign in with your username or email.'}
            {step === 'password' && `Signing in as ${username}`}
            {step === 'code' && `Enter the code we emailed${maskedEmail ? ` to ${maskedEmail}` : ''} and choose a password.`}
          </p>

          {error !== undefined && <div className="mt-4"><ErrorBox error={new Error(errorMessage(error))} /></div>}

          {step === 'identify' && (
            <form onSubmit={identify} className="mt-6 space-y-4">
              <Field label="Username or email">
                <Input autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              </Field>
              <Button className="w-full" size="lg" busy={busy}>Continue</Button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={login} className="mt-6 space-y-4">
              <Field label="Password">
                <Input autoFocus required type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </Field>
              <Button className="w-full" size="lg" busy={busy}>Sign in</Button>
              <div className="flex justify-between text-sm">
                <button type="button" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800" onClick={() => setStep('identify')}>
                  <ArrowLeft className="size-4" /> Change user
                </button>
                <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={forgot}>Forgot password?</button>
              </div>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={setNew} className="mt-6 space-y-4">
              <Field label="Code from the email">
                <Input autoFocus required inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
              </Field>
              <Field label="New password" hint="At least 8 characters, with letters and numbers.">
                <Input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              </Field>
              <Button className="w-full" size="lg" busy={busy}>{activation ? 'Activate and sign in' : 'Change password and sign in'}</Button>
              <button type="button" className="text-sm text-slate-500 hover:text-slate-800" onClick={() => setStep('identify')}>Back</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
