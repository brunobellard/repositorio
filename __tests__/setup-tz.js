// Os testes rodam sempre no fuso do estúdio padrão, em qualquer máquina ou no CI.
module.exports = async () => {
  process.env.TZ = 'America/Sao_Paulo';
};
