// Traduce los mensajes de error de Supabase Auth (siempre en inglés) a texto
// legible en español. Usado por LoginScreen y ResetPasswordScreen.
export function translateAuthError(error) {
  const msg = error?.message || "";
  if (/invalid login credentials/i.test(msg)) return "Email o contraseña incorrectos";
  if (/already registered/i.test(msg)) return "Ya existe una cuenta con ese email — inicia sesión en vez de crear una nueva";
  if (/password should be at least/i.test(msg)) return "La contraseña debe tener al menos 6 caracteres";
  if (/rate limit/i.test(msg)) return "Demasiados intentos — espera un momento e inténtalo de nuevo";
  if (/unable to validate email|invalid email/i.test(msg)) return "Ese email no es válido";
  if (/email not confirmed/i.test(msg)) return "Confirma tu email antes de iniciar sesión — revisa tu bandeja de entrada";
  return msg || "Ocurrió un error inesperado";
}
