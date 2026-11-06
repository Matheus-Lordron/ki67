// POST /functions/v1/r2-download-url
// A regra está em handler.ts, que os testes importam sem subir um servidor.
import { handler } from './handler.ts';

Deno.serve(handler);
