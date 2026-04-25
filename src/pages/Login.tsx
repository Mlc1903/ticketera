import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Ticket, Mail, Lock, User, ArrowRight, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Rate limits state
  const [failedAttempts, setFailedAttempts] = useState(() => {
    return parseInt(localStorage.getItem('login_fails') || '0', 10);
  });
  const [lockoutExpiration, setLockoutExpiration] = useState<number | null>(() => {
    const lockTime = localStorage.getItem('login_lockout');
    return lockTime ? parseInt(lockTime, 10) : null;
  });

  const navigate = useNavigate();

  useEffect(() => {
    if (lockoutExpiration) {
      const interval = setInterval(() => {
        if (Date.now() > lockoutExpiration) {
          setFailedAttempts(0);
          setLockoutExpiration(null);
          localStorage.removeItem('login_fails');
          localStorage.removeItem('login_lockout');
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutExpiration]);

  const isLocked = lockoutExpiration && Date.now() < lockoutExpiration;
  const lockoutRemainingMinutes = lockoutExpiration ? Math.ceil((lockoutExpiration - Date.now()) / 60000) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) {
      toast.error(`Demasiados intentos. Espera ${lockoutRemainingMinutes} minuto(s) más.`);
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    if (forgotPassword) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Te hemos enviado un correo para restablecer tu contraseña.');
        setForgotPassword(false);
      }
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('¡Cuenta creada! Revisa tu correo para confirmar.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error('Credenciales incorrectas');
        const newFails = failedAttempts + 1;
        setFailedAttempts(newFails);
        localStorage.setItem('login_fails', newFails.toString());
        
        if (newFails >= 5) {
          const expiration = Date.now() + 3 * 60 * 1000; // 3 minutos
          setLockoutExpiration(expiration);
          localStorage.setItem('login_lockout', expiration.toString());
          toast.error('Has excedido el número de intentos. Cuenta bloqueada por 3 minutos.');
        }
      } else {
        setFailedAttempts(0);
        setLockoutExpiration(null);
        localStorage.removeItem('login_fails');
        localStorage.removeItem('login_lockout');
        
        toast.success('¡Bienvenido!');
        navigate('/');
      }
    }
    setLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-sm mx-auto py-12 space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
          <Ticket className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-black text-foreground">
          {forgotPassword ? 'Recuperar Contraseña' : isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {forgotPassword 
            ? 'Ingresa tu correo para recibir un enlace seguro'
            : isSignUp 
              ? 'Regístrate para comprar entradas' 
              : 'Accede a tu cuenta NitePass'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && !forgotPassword && (
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={isSignUp}
              className="w-full rounded-xl bg-secondary pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-all"
            />
          </div>
        )}
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="email"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl bg-secondary pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-all"
          />
        </div>
        
        {!forgotPassword && (
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl bg-secondary pl-10 pr-12 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-all"
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground touch-target"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        )}
        
        {isSignUp && !forgotPassword && (
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirmar Contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl bg-secondary pl-10 pr-12 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-all"
            />
            <button 
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground touch-target"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        )}

        {!isSignUp && !forgotPassword && (
          <div className="flex justify-end pr-1">
            <button
              type="button"
              onClick={() => setForgotPassword(true)}
              className="text-xs text-primary font-medium hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || isLocked}
          className="w-full touch-target rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {loading 
            ? 'Cargando...' 
            : isLocked 
              ? `Bloqueado (${lockoutRemainingMinutes}m)` 
              : forgotPassword 
                ? 'Enviar Instrucciones' 
                : isSignUp 
                  ? 'Crear Cuenta' 
                  : 'Entrar'}
          {!loading && !isLocked && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        {forgotPassword ? (
          <button
            onClick={() => setForgotPassword(false)}
            className="flex items-center justify-center gap-2 mx-auto hover:text-foreground hover:underline transition-colors font-medium"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Volver al Inicio de Sesión
          </button>
        ) : (
          <p>
            {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setConfirmPassword('');
              }}
              className="text-primary hover:underline font-medium"
            >
              {isSignUp ? 'Inicia sesión' : 'Regístrate'}
            </button>
          </p>
        )}
      </div>
    </motion.div>
  );
}
