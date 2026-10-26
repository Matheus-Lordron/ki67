import { createSubmitGuard } from '../submitGuard';

/** Promessa que só resolve quando o teste mandar (simula a internet lenta). */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createSubmitGuard (clique duplo)', () => {
  it('ignora o segundo clique enquanto o primeiro envio não terminou', async () => {
    const guard = createSubmitGuard();
    const pending = deferred<string>();
    const action = jest.fn(() => pending.promise);

    const first = guard.run(action);
    const second = guard.run(action);

    expect(action).toHaveBeenCalledTimes(1);
    expect(guard.isPending()).toBe(true);
    await expect(second).resolves.toBeUndefined();

    pending.resolve('ok');
    await expect(first).resolves.toBe('ok');
    expect(guard.isPending()).toBe(false);
  });

  it('libera um novo envio depois que o anterior terminou', async () => {
    const guard = createSubmitGuard();
    const action = jest.fn(async () => 'ok');

    await guard.run(action);
    await guard.run(action);

    expect(action).toHaveBeenCalledTimes(2);
  });

  it('libera um novo envio mesmo quando o anterior falhou', async () => {
    const guard = createSubmitGuard();
    const failing = deferred<string>();

    const first = guard.run(() => failing.promise);
    failing.reject(new Error('sem internet'));
    await expect(first).rejects.toThrow('sem internet');

    expect(guard.isPending()).toBe(false);
    await expect(guard.run(async () => 'de novo')).resolves.toBe('de novo');
  });

  it('avisa quem acompanha quando o envio começa e termina', async () => {
    const changes: boolean[] = [];
    const guard = createSubmitGuard((pending) => changes.push(pending));
    const pending = deferred<void>();

    const run = guard.run(() => pending.promise);
    guard.run(() => pending.promise); // clique ignorado não gera aviso
    pending.resolve();
    await run;

    expect(changes).toEqual([true, false]);
  });
});
