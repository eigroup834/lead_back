import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, Stack, TextField, Typography, Alert } from '@mui/material';
import { useLoginMutation } from '@/features/auth/authApi';
import { useAppDispatch, useAppSelector } from '@/store';
import { setCredentials } from '@/features/auth/authSlice';
import { api } from '@/app/api';
import { landingPath } from '@/constants';
import { usePermissions } from '@/hooks/usePermissions';
import { GRADIENTS } from '@/theme';

const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAppSelector((s) => s.auth.accessToken);
  const { level } = usePermissions();
  const [login, { isLoading, error }] = useLoginMutation();

  const errorMessage = (() => {
    if (!error) return null;
    const status = (error as { status?: number }).status;
    const serverMsg = (error as { data?: { error?: { message?: string } } }).data?.error?.message;
    if (status === 429) return serverMsg ?? 'Too many attempts. Please wait a few minutes.';
    if (status === 401) return 'Invalid email or password';
    return serverMsg ?? 'Login failed. Please try again.';
  })();
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  if (token) return <Navigate to={landingPath(level)} replace />;

  const onSubmit = async (values: FormValues) => {
    const res = await login(values).unwrap();
    dispatch(api.util.resetApiState());
    dispatch(setCredentials({ accessToken: res.data.accessToken, user: res.data.user }));
    const home = landingPath(res.data.user.level);
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
    navigate(from && from !== '/dashboard' ? from : home, { replace: true });
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: GRADIENTS.dark, p: 2 }}>
      <Card sx={{ width: 400, maxWidth: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>Sign in to your account</Typography>
          {errorMessage && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert>}
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={2}>
              <TextField label="Email" fullWidth {...register('email')} error={!!errors.email} helperText={errors.email?.message} />
              <TextField label="Password" type="password" fullWidth {...register('password')} error={!!errors.password} helperText={errors.password?.message} />
              <Button type="submit" variant="contained" size="large" disabled={isLoading}>
                {isLoading ? 'Signing in…' : 'Sign In'}
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
