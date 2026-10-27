// R-03: commit fora do padrão (docs/03, seção 5) é recusado; escopo fora da lista
// e falta do ID da tarefa só geram aviso. Rode da raiz: node --test .github/tests/
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const CLI = '@commitlint/cli@21.2.3';

function lint(message) {
  const r = spawnSync('npx', ['--yes', CLI, '--config', 'commitlint.config.mjs'], {
    input: message,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}` };
}

const aceitas = [
  'feat(anotacao): ferramenta de polígono (RF-14)',
  'ci: roda lint, tipos, testes e build no pull request (R-01)',
  'fix(app,banco): clique duplo não cria projeto repetido (RF-09)',
  'feat(banco)!: save_analysis_version passa a exigir versão base (R-28)',
  'revert(app): volta o frontend ao estado da main (E-03)',
  'chore(deps): bump uuid',
  'test(cegamento): avaliador não lê análise alheia (R-05)\n\nCorpo explicando o motivo.\n\nCo-Authored-By: Alguém <a@b.c>',
];

const recusadas = {
  'sem tipo': 'ajusta a tela de login',
  'tipo desconhecido': 'feature(app): nova tela (RF-01)',
  'tipo em maiúsculas': 'Fix(app): corrige login (RF-01)',
  'descrição vazia': 'fix(app): ',
  'ponto final': 'fix(app): corrige login (RF-01).',
  'descrição em maiúsculas': 'fix(app): CORRIGE LOGIN',
  'cabeçalho com mais de 100 caracteres': `docs: ${'texto muito comprido '.repeat(6)}(R-01)`,
};

for (const msg of aceitas) {
  test(`aceita: ${msg.split('\n')[0]}`, () => {
    const r = lint(msg);
    assert.ok(r.ok, r.out);
  });
}

for (const [motivo, msg] of Object.entries(recusadas)) {
  test(`recusa (${motivo}): ${msg.slice(0, 60)}`, () => {
    assert.equal(lint(msg).ok, false);
  });
}

test('commit sem ID da tarefa passa, mas com aviso', () => {
  const r = lint('fix(app): corrige o login');
  assert.ok(r.ok, r.out);
  assert.match(r.out, /ID da tarefa/);
});

test('escopo fora da lista do docs/03 passa, mas com aviso', () => {
  const r = lint('fix(telas): corrige o login (RF-01)');
  assert.ok(r.ok, r.out);
  assert.match(r.out, /scope must be one of/);
});
