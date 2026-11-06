// POST /functions/v1/admin-create-user  { name, email, institution?, roles: ['avaliador', ...] }
// A regra está em handler.ts, que os testes importam sem subir um servidor.
import { handler } from './handler.ts';

Deno.serve(handler);
