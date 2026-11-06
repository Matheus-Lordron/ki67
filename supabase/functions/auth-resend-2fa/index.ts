// POST /functions/v1/auth-resend-2fa  (com o token da sessão que aguarda o código)
// A regra está em handler.ts, que os testes importam sem subir um servidor.
import { handler } from './handler.ts';

Deno.serve(handler);
