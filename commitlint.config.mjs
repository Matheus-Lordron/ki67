// R-03: Conventional Commits como em docs/03-planejamento.md, seção 5.
// Regras completas aqui (sem extends), para o CI rodar só com `npx @commitlint/cli`.
// 2 = recusa o commit; 1 = só avisa.

const ESCOPOS = [
  'auth', 'usuarios', 'projetos', 'imagens', 'preanotacao', 'anotacao', 'cegamento',
  'validacao', 'auditoria', 'exportacao', 'app', 'banco', 'funcoes', 'deps',
];

// ID da tarefa ou do requisito: R-05, RF-14, RNF-03, RN-07, E-03...
const ID_TAREFA = /\b(?:R|RF|RNF|RN|E)-\d+\b/;

export default {
  // Aceita o `!` de mudança que quebra compatibilidade: feat(banco)!: ...
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\w*)(?:\((.*)\))?!?: (.*)$/,
      breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
      noteKeywords: ['BREAKING CHANGE', 'BREAKING-CHANGE'],
      revertPattern: /^(?:Revert|revert:)\s"?([\s\S]+?)"?\s*This reverts commit (\w*)\./i,
      revertCorrespondence: ['header', 'hash'],
    },
  },
  plugins: [
    {
      rules: {
        'id-da-tarefa': ({ header, body }) => [
          ID_TAREFA.test(`${header}\n${body ?? ''}`),
          'cite o ID da tarefa ou do requisito, ex.: (R-05) ou (RF-14)',
        ],
      },
    },
  ],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'refactor', 'test', 'chore', 'ci', 'perf', 'build', 'style', 'revert']],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lower-case'],
    'scope-enum': [1, 'always', ESCOPOS],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [1, 'always'],
    'footer-leading-blank': [1, 'always'],
    'body-max-line-length': [1, 'always', 100],
    'id-da-tarefa': [1, 'always'], // aviso: commits do Dependabot e ajustes pequenos não têm ID
  },
};
