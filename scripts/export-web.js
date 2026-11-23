// Gera a web (pasta dist) com source maps, envia os mapas ao Sentry e apaga os .map da pasta.
//
// Uso (no lugar de "npx expo export --platform web"):
//   npm run export:web
// Depois publique como sempre:
//   npx eas-cli@latest deploy --prod --non-interactive
//
// Por que: sem os mapas, os erros da web chegam ao Sentry com o código compactado (js_no_source).
// Cada arquivo .js já sai com um debugId (getSentryExpoConfig no metro.config.js), que liga o erro ao mapa.
// Os .map são apagados antes da publicação: o site não serve o código-fonte, só o Sentry tem os mapas.
//
// Precisa de SENTRY_AUTH_TOKEN (token de organização do Sentry, escopo de envio de source maps),
// no ambiente ou em .env.local (nunca no GitHub). Sem o token, gera a web mesmo assim, sem enviar.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
// Mesmo org e projeto do plugin do Sentry no app.json
const ORG = 'bruno-mw';
const PROJECT = 'repositorio';

/** Roda um CLI em JavaScript do node_modules com o próprio Node (sem shell). */
function run(script, args, env) {
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules', script), ...args], { cwd: ROOT, stdio: 'inherit', env });
}

/** Lê uma variável do .env.local sem mostrar o valor. */
function fromEnvLocal(name) {
  try {
    const text = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
    const line = text.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}

function listMaps(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMaps(full));
    else if (entry.name.endsWith('.map')) out.push(full);
  }
  return out;
}

// 1. Web com source maps
// --clear: sem ele, o cache do Metro pode manter o app.json antigo embutido na web (ex.: nome do app antes da troca)
run('expo/bin/cli', ['export', '--platform', 'web', '--source-maps', '--clear'], process.env);

// 2. Envio ao Sentry
const token = process.env.SENTRY_AUTH_TOKEN || fromEnvLocal('SENTRY_AUTH_TOKEN');
let sent = false;
if (!token) {
  console.warn('\n[export-web] Sem SENTRY_AUTH_TOKEN: mapas NÃO enviados ao Sentry (a web foi gerada normalmente).');
} else {
  try {
    run(
      '@sentry/cli/bin/sentry-cli',
      ['sourcemaps', 'upload', '--org', ORG, '--project', PROJECT, DIST],
      { ...process.env, SENTRY_AUTH_TOKEN: token },
    );
    sent = true;
  } catch {
    console.warn('\n[export-web] Falha ao enviar os mapas ao Sentry (a web foi gerada normalmente).');
  }
}

// 3. Os .map não vão para o site
const maps = listMaps(DIST);
for (const file of maps) fs.rmSync(file);
console.log(
  `\n[export-web] ${maps.length} arquivos .map ${sent ? 'enviados ao Sentry e ' : ''}apagados de dist/. Pode publicar.`,
);
