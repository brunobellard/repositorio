/** Aba que a tela de login deve abrir na próxima vez (ex: "Não aceito" nos Termos volta para o cadastro). */
let next: 'entrar' | 'criar' = 'entrar';

export function setNextLoginMode(mode: 'entrar' | 'criar') {
  next = mode;
}

/** Lê e limpa a aba pedida. */
export function takeNextLoginMode(): 'entrar' | 'criar' {
  const m = next;
  next = 'entrar';
  return m;
}
