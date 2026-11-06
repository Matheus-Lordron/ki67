// POST /functions/v1/r2-upload-url  { batch_id, sha256, mime_type, size_bytes }
// A regra está em handler.ts, que os testes importam sem subir um servidor.
import { handler } from './handler.ts';

Deno.serve(handler);
