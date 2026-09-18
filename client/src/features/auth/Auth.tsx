import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { sessionSchema } from '@solar-management/shared';
import { z } from 'zod';
import { getSession, mutate } from '../../api/request';

export const useSession = () => useQuery({ queryKey: ['session'], queryFn: getSession, retry: false, staleTime: 30000 });

export function AccountNav() {
  const session = useSession();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const logout = useMutation({
    mutationFn: () => mutate('/auth/logout', 'POST', z.undefined(), {}),
    onSuccess: async () => {
      await cache.cancelQueries();
      cache.removeQueries({ queryKey: ['sites'] });
      cache.setQueryData(['session'], { ...session.data, user: null });
      void cache.invalidateQueries({ queryKey: ['session'] });
      navigate('/login');
    },
  });
  return (
    <nav className="account-nav" aria-label="Account">
      <Link to="/demo">Demo</Link>
      {session.data?.user ? <>
        <Link to="/sites">My installations</Link>
        <button className="button-secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>Log out</button>
      </> : <><Link to="/login">Log in</Link><Link className="button-link" to="/register">Create account</Link></>}
      {logout.isError && <p role="alert">{logout.error.message}</p>}
    </nav>
  );
}

export function AuthPage({ register = false }: { register?: boolean }) {
  const session = useSession();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const auth = useMutation({
    mutationFn: () => mutate(register ? '/auth/register' : '/auth/login', 'POST', sessionSchema,
      register ? values : { email: values.email, password: values.password }),
    onSuccess: async (data) => {
      await cache.cancelQueries({ queryKey: ['sites'] });
      cache.removeQueries({ queryKey: ['sites'] });
      cache.setQueryData(['session'], data);
      navigate('/sites');
    },
  });
  if (session.data?.user) return <Navigate to="/sites" replace />;
  function submit(event: FormEvent) { event.preventDefault(); auth.mutate(); }
  return (
    <section className="form-panel" aria-labelledby="auth-title">
      <p className="eyebrow">Your solar workspace</p>
      <h1 id="auth-title">{register ? 'Create your account' : 'Welcome back'}</h1>
      <p>{register ? 'Save and manage installations that belong to you.' : 'Log in to manage your installations.'}</p>
      <form onSubmit={submit}>
        {register && <label>Name<input name="name" autoComplete="name" required maxLength={80} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} /></label>}
        <label>Email<input type="email" name="email" autoComplete="email" required maxLength={254} value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} /></label>
        <label>Password<input type="password" name="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={12} maxLength={128} value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} aria-describedby="password-help" /></label>
        <p className="field-help" id="password-help">Use 12–128 characters.</p>
        {auth.isError && <p className="error-message" role="alert">{auth.error.message}</p>}
        <button disabled={auth.isPending}>{auth.isPending ? 'Please wait…' : register ? 'Create account' : 'Log in'}</button>
      </form>
      <p>{register ? 'Already registered? ' : 'New here? '}<Link to={register ? '/login' : '/register'}>{register ? 'Log in' : 'Create an account'}</Link></p>
    </section>
  );
}
