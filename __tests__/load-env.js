// Testes de API: carrega o .env.local (só local; no CI as variáveis vêm dos segredos do GitHub).
// Variáveis já definidas no ambiente têm prioridade.
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const file = join(__dirname, '..', '.env.local');
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
