// POST /functions/v1/r2-confirm-upload  { batch_id, storage_key, organ?, optical_magnification?, device? }
// A regra está em handler.ts, que os testes importam sem subir um servidor.
import { handler } from './handler.ts';

Deno.serve(handler);
