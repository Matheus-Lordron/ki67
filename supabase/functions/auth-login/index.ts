// POST /functions/v1/auth-login  { email, password, device }
// A regra está em handler.ts, que os testes importam sem subir um servidor.
import { handler } from './handler.ts';

Deno.serve(handler);
