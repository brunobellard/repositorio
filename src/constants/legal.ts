// Textos dos Termos de Uso (EULA) e da Política de Privacidade (LGPD — Lei nº 13.709/2018).
//
// ANTES DE PUBLICAR NAS LOJAS, preencha LEGAL_INFO com os dados reais de quem opera o app
// (razão social, CNPJ e e-mail de contato). Revisão por um advogado é recomendada.

export const LEGAL_INFO = {
  appName: 'Esmero',
  /** Razão social ou nome de quem oferece o app (controlador dos dados da conta) */
  company: 'DataCore Intelligence',
  /** CNPJ ou CPF do responsável (deixe vazio para não exibir) */
  document: '68.947.841/0001-44',
  /** E-mail para suporte, privacidade e pedidos do titular (LGPD art. 18) */
  // PROVISÓRIO (fase de testes): trocar pelo e-mail de contato definitivo antes de publicar nas lojas
  contactEmail: 'brunobellard@gmail.com',
  updatedAt: '21 de novembro de 2026',
};

/** Um bloco de texto: parágrafo (string) ou lista de itens (string[]). */
export type LegalBlock = string | string[];

export interface LegalSection {
  heading: string;
  body: LegalBlock[];
}

export interface LegalDocument {
  title: string;
  intro: string;
  sections: LegalSection[];
}

const { appName, company, document, contactEmail } = LEGAL_INFO;
const operator = document ? `${company} (CPF/CNPJ ${document})` : company;
const contact = contactEmail
  ? `pelo e-mail ${contactEmail}`
  : 'pelos canais de suporte indicados na página do app na App Store ou no Google Play';

export const PRIVACY: LegalDocument = {
  title: 'Política de Privacidade',
  intro: `Esta Política explica como o ${appName} trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018). Ela vale para o aplicativo (Android e iOS), para a versão web e para as páginas públicas de agendamento online.`,
  sections: [
    {
      heading: '1. Quem é responsável pelos dados',
      body: [
        `O ${appName} é oferecido por ${operator}. O tratamento de dados acontece em dois papéis diferentes, conforme a LGPD:`,
        [
          'Dados da sua conta (profissional ou estúdio que usa o app): somos o controlador. Decidimos como e por que esses dados são tratados para prestar o serviço.',
          'Dados das clientes que você cadastra ou que agendam pelo seu link: você (o estúdio) é o controlador, e nós atuamos como operador, tratando esses dados apenas para executar o serviço, conforme suas instruções e esta Política.',
        ],
        'Se você é cliente de um estúdio e quer exercer seus direitos sobre seus dados, fale primeiro com o estúdio. Também podemos ajudar a encaminhar o pedido.',
      ],
    },
    {
      heading: '2. Dados que tratamos',
      body: [
        'Dados da conta e do estúdio:',
        [
          'nome, e-mail e senha (a senha é armazenada de forma criptografada, e não temos acesso a ela);',
          'nome do estúdio, razão social, CPF/CNPJ, telefone, e-mail comercial, Instagram, endereço e logo;',
          'serviços, preços, horários de funcionamento, folgas, modelos de mensagem, taxas de pagamento e configurações;',
          'plano de assinatura, situação do período de teste e ciclo de cobrança.',
        ],
        'Dados das clientes do estúdio (inseridos por você ou pela própria cliente no agendamento online):',
        [
          'nome, WhatsApp, e-mail e data de nascimento;',
          'histórico de agendamentos, pacotes, pagamentos e valores;',
          'anotações técnicas, que podem conter informações sobre saúde (por exemplo, alergias ou sensibilidade a produtos). Essas informações são dados pessoais sensíveis (LGPD, art. 11). Registre apenas o necessário para a segurança do atendimento e com a ciência da cliente.',
        ],
        'Dados técnicos:',
        [
          'identificador de notificações (token de push) do aparelho, quando você ativa os avisos;',
          'registros técnicos de acesso e de erro (data, hora, endereço IP e tipo de dispositivo), mantidos por segurança e pelo prazo exigido pelo Marco Civil da Internet (Lei nº 12.965/2014);',
          'registros de uso do app: quais telas e ações foram usadas (por exemplo, abrir o formulário de agendamento, concluir um atendimento ou compartilhar o link), quando, quanto tempo levaram, o tipo de aparelho e a versão do app. Esses registros ficam ligados à sua conta e nunca incluem nome, telefone, e-mail, endereço, anotações ou qualquer outro dado das suas clientes, nem textos que você digita. Uma cópia desses registros é enviada à ferramenta de análise de uso PostHog (seção 4), identificada apenas pelo código interno da sua conta e pelo plano, sem e-mail, nome ou CPF/CNPJ, sem gravação de tela e sem localização pelo endereço IP;',
          'relatórios de erro e de desempenho do app, enviados à ferramenta Sentry (seção 4): o tipo e o local do erro no código, o tempo de abertura das telas e das chamadas ao servidor, o modelo e o sistema do aparelho, a versão do app e o código interno da sua conta. Antes do envio, o app remove e-mails, números de documento e de telefone, nomes, endereços e anotações; não são enviados capturas de tela nem textos digitados;',
          'na página pública de agendamento: as etapas percorridas (por exemplo, serviços escolhidos e agendamento enviado), de forma anônima, sem nome, WhatsApp, endereço IP nem cookies de rastreamento. Esses registros ficam ligados ao estúdio da página e não são enviados ao PostHog. Se a página apresentar um erro, o relatório de erro (sem dados de quem está agendando) pode ser enviado ao Sentry.',
        ],
        'Biometria: o login por digital ou Face ID é feito inteiramente pelo sistema do seu aparelho. Nunca recebemos nem armazenamos sua impressão digital ou imagem do rosto.',
      ],
    },
    {
      heading: '3. Para que usamos e com qual base legal',
      body: [
        [
          'Criar e manter sua conta, a agenda, o cadastro de clientes, o financeiro e o link de agendamento online: execução de contrato (LGPD, art. 7º, V).',
          'Enviar avisos de novos agendamentos por notificação: consentimento (art. 7º, I), que você pode retirar a qualquer momento em Ajustes.',
          'Gerenciar planos, período de teste e assinaturas: execução de contrato.',
          'Prevenir fraudes, abusos e acessos indevidos, e manter a segurança do serviço: legítimo interesse (art. 7º, IX) e proteção ao crédito, quando aplicável.',
          'Entender como o app é usado (onde as pessoas encontram dificuldade, quais etapas são abandonadas) para melhorar a usabilidade: legítimo interesse (art. 7º, IX), usando apenas os registros de uso descritos acima, sem dados das clientes do estúdio. Você pode se opor a esse uso pelo contato da seção 12.',
          'Identificar, investigar e corrigir erros e lentidão do app, usando os relatórios de erro e de desempenho descritos acima: legítimo interesse (art. 7º, IX).',
          'Cumprir obrigações legais e regulatórias, como a guarda de registros de acesso e documentos fiscais: cumprimento de obrigação legal (art. 7º, II).',
          'Dados sensíveis registrados em anotações técnicas: tratados somente para a finalidade definida pelo estúdio, que é responsável por obter o consentimento específico da cliente ou por se apoiar em outra hipótese do art. 11 da LGPD.',
        ],
        'Não vendemos dados pessoais e não usamos os dados das suas clientes para publicidade.',
      ],
    },
    {
      heading: '4. Com quem compartilhamos',
      body: [
        'Usamos fornecedores que tratam dados em nosso nome, com obrigações contratuais de segurança e confidencialidade:',
        [
          'Supabase: banco de dados, autenticação, armazenamento de arquivos e funções do servidor;',
          'Expo (EAS): envio de notificações e hospedagem da versão web e das páginas de agendamento;',
          'Sentry (Functional Software, Inc.): recebimento dos relatórios de erro e de desempenho do app;',
          'PostHog (PostHog, Inc.): análise dos registros de uso do app logado, sem dados das clientes do estúdio;',
          'Apple e Google: distribuição do app e, quando houver, processamento das assinaturas pelas lojas;',
          'provedores de pagamento que venham a ser usados para cobrança das assinaturas.',
        ],
        'Quando você usa o botão de WhatsApp ou de e-mail, a mensagem é enviada pelo aplicativo do seu aparelho, sob as regras desses serviços.',
        'Também podemos compartilhar dados quando exigido por lei, por ordem judicial ou por autoridade competente.',
      ],
    },
    {
      heading: '5. Transferência internacional',
      body: [
        'Alguns fornecedores armazenam dados em servidores fora do Brasil, principalmente nos Estados Unidos (por exemplo, Supabase, Expo, Sentry e PostHog). Nesses casos, a transferência segue o art. 33 da LGPD, com cláusulas contratuais e garantias de proteção compatíveis com a lei brasileira.',
        'Para o Sentry e o PostHog, enviamos apenas o mínimo descrito na seção 2: o código interno da conta, o plano e registros técnicos e de uso já sem e-mail, nome, CPF/CNPJ, telefone, endereço ou anotações.',
      ],
    },
    {
      heading: '6. Por quanto tempo guardamos',
      body: [
        [
          'Os dados ficam guardados enquanto sua conta existir.',
          'Ao excluir a conta (Ajustes > Dados do estúdio > Excluir minha conta), apagamos imediatamente sua conta e todos os dados do estúdio, incluindo clientes, agenda, financeiro e arquivos. Cópias de segurança são sobrescritas em até 30 dias.',
          'Registros de uso guardados no nosso banco (app e página pública): até 13 meses, e depois apagados. Ao excluir a conta, eles são apagados junto.',
          'Cópia dos registros de uso no PostHog: até 12 meses, prazo do fornecedor. A limpeza é mensal e pode levar até 2 meses a mais. Ao excluir a conta, o cadastro da conta no PostHog e os eventos ligados a ela são apagados automaticamente; o fornecedor conclui a exclusão em segundo plano, normalmente em poucos dias.',
          'Relatórios de erro e de desempenho no Sentry: até 90 dias, e depois apagados pelo fornecedor.',
          'Podemos manter, pelo prazo legal, apenas o que a lei exigir, como registros de acesso (6 meses, pelo Marco Civil da Internet) e documentos fiscais das assinaturas.',
        ],
      ],
    },
    {
      heading: '7. Segurança',
      body: [
        'Adotamos medidas técnicas e administrativas para proteger os dados: comunicação criptografada (HTTPS), senhas com hash, isolamento dos dados de cada estúdio no banco de dados (cada conta acessa somente os próprios registros), controle de acesso no servidor e chaves administrativas guardadas apenas no servidor.',
        'Nenhum sistema é totalmente imune a incidentes. Se ocorrer um incidente de segurança que possa causar risco ou dano relevante, comunicaremos os titulares afetados e a Autoridade Nacional de Proteção de Dados (ANPD), conforme o art. 48 da LGPD.',
      ],
    },
    {
      heading: '8. Seus direitos',
      body: [
        'Pela LGPD (art. 18), você pode pedir, a qualquer momento e sem custo:',
        [
          'confirmação de que tratamos seus dados e acesso a eles;',
          'correção de dados incompletos, inexatos ou desatualizados;',
          'anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei;',
          'portabilidade dos dados (o app permite exportar clientes e financeiro em planilha e PDF, conforme o plano);',
          'eliminação dos dados tratados com base no consentimento e informação sobre a possibilidade de não consentir;',
          'informação sobre com quem compartilhamos seus dados;',
          'revogação do consentimento;',
          'revisão de decisões tomadas unicamente com base em tratamento automatizado.',
        ],
        `Boa parte desses direitos pode ser exercida no próprio app (editar dados, exportar, excluir a conta). Para os demais, fale com a gente ${contact}. Responderemos em até 15 dias. Você também pode apresentar reclamação à ANPD (www.gov.br/anpd).`,
      ],
    },
    {
      heading: '9. Armazenamento no aparelho',
      body: [
        'O app guarda no seu aparelho uma cópia dos dados para funcionar sem internet, a sessão de login e preferências (como o login por digital). Registros de uso ainda não enviados (por falta de internet) também ficam guardados no aparelho até o envio. Essas informações são apagadas ao sair da conta ou ao excluí-la. A versão web usa o armazenamento local do navegador para manter a sessão. Não usamos cookies de publicidade ou rastreamento.',
      ],
    },
    {
      heading: '10. Menores de idade',
      body: [
        `O ${appName} é destinado a profissionais maiores de 18 anos. Dados de clientes menores de idade só devem ser cadastrados pelo estúdio com o consentimento de um dos pais ou responsável legal (LGPD, art. 14).`,
      ],
    },
    {
      heading: '11. Alterações desta Política',
      body: [
        'Podemos atualizar esta Política para refletir mudanças no app ou na lei. A data da última atualização fica no topo desta página. Mudanças relevantes serão avisadas no app.',
      ],
    },
    {
      heading: '12. Contato e encarregado (DPO)',
      body: [
        `Dúvidas, pedidos e comunicações sobre privacidade e proteção de dados podem ser enviados ao nosso encarregado ${contact}.`,
      ],
    },
  ],
};

export const TERMS: LegalDocument = {
  title: 'Termos de Uso',
  intro: `Estes Termos de Uso, que funcionam também como Contrato de Licença de Usuário Final (EULA), regulam o uso do ${appName}, oferecido por ${operator}. Ao criar uma conta ou usar o app, você declara que leu e concorda com estes Termos e com a Política de Privacidade.`,
  sections: [
    {
      heading: '1. O serviço',
      body: [
        `O ${appName} é um aplicativo de gestão para profissionais e estúdios de beleza. Ele oferece agenda, cadastro de clientes, controle financeiro, pacotes, lembretes, comprovantes, link de agendamento online e relatórios, conforme o plano contratado.`,
      ],
    },
    {
      heading: '2. Cadastro e conta',
      body: [
        [
          'Você precisa ter pelo menos 18 anos e informar dados verdadeiros e atualizados.',
          'A conta é pessoal. Você é responsável por manter sua senha em sigilo e por tudo o que for feito com ela. Avise-nos imediatamente em caso de uso não autorizado.',
          'Você pode excluir sua conta a qualquer momento em Ajustes > Dados do estúdio > Excluir minha conta. A exclusão é permanente e apaga todos os dados do estúdio.',
        ],
      ],
    },
    {
      heading: '3. Licença de uso',
      body: [
        'Concedemos a você uma licença limitada, pessoal, não exclusiva, intransferível e revogável para instalar e usar o app nos seus aparelhos, apenas para gerir o seu negócio. É proibido:',
        [
          'copiar, modificar, distribuir, vender ou sublicenciar o app;',
          'fazer engenharia reversa, descompilar ou tentar extrair o código-fonte, salvo quando a lei permitir;',
          'contornar limites de plano, medidas de segurança ou controles de acesso;',
          'usar o app para atividades ilegais, para enviar spam ou para tratar dados pessoais sem base legal.',
        ],
        'Se você baixou o app pela App Store, estes Termos são firmados entre você e nós, e não com a Apple. A Apple não é responsável pelo app nem pelo seu suporte, e pode fazer valer estes Termos como terceira beneficiária. Em caso de conflito, prevalecem as regras obrigatórias da loja de onde o app foi baixado.',
      ],
    },
    {
      heading: '4. Planos, teste grátis e pagamentos',
      body: [
        [
          'O app tem um plano gratuito (Free), com limites de uso, e planos pagos (Básico, Intermediário e Empresarial), mensais ou anuais, com os recursos e preços mostrados na tela de Planos.',
          'Contas novas recebem um período de teste grátis. Ao fim do teste, sem uma assinatura ativa, a conta passa para o plano Free e os dados continuam guardados. Recursos que exigem plano pago ficam bloqueados.',
          'As assinaturas são renovadas automaticamente ao fim de cada período, pelo mesmo valor, até serem canceladas. Quando a cobrança é feita pela App Store ou pelo Google Play, o cancelamento e os reembolsos seguem as regras da loja e são feitos nas configurações da sua conta da loja.',
          'Se a contratação for feita fora das lojas, você pode desistir em até 7 dias após a primeira contratação e receber o valor de volta, conforme o art. 49 do Código de Defesa do Consumidor.',
          'Os preços podem mudar. Avisaremos com antecedência, e o novo valor valerá a partir da renovação seguinte.',
        ],
      ],
    },
    {
      heading: '5. Seus dados e os dados das suas clientes',
      body: [
        'Os dados que você insere no app pertencem a você. Em relação aos dados das suas clientes, você é o controlador perante a LGPD e se compromete a:',
        [
          'ter base legal para cadastrar e tratar esses dados e informar as clientes sobre esse tratamento;',
          'obter o consentimento específico da cliente antes de registrar informações de saúde nas anotações técnicas;',
          'enviar mensagens por WhatsApp ou e-mail apenas a clientes que aceitam esse contato;',
          'atender aos pedidos das suas clientes sobre os dados delas.',
        ],
        'Nós tratamos esses dados apenas para prestar o serviço, conforme a Política de Privacidade.',
      ],
    },
    {
      heading: '6. Agendamento online',
      body: [
        'Quando o link de agendamento está ativo, qualquer pessoa com o endereço pode ver os serviços, preços e horários livres do estúdio e pedir um horário. O estúdio é responsável pelas informações publicadas e pelo atendimento combinado com a cliente. Nós não participamos da relação comercial entre o estúdio e suas clientes.',
      ],
    },
    {
      heading: '7. Disponibilidade',
      body: [
        'Trabalhamos para manter o app disponível e seguro, mas ele pode ter interrupções para manutenção, por falhas de terceiros ou por motivos fora do nosso controle. Algumas funções funcionam sem internet e sincronizam quando a conexão volta. Recomendamos exportar seus relatórios com regularidade.',
      ],
    },
    {
      heading: '8. Propriedade intelectual',
      body: [
        `O app, a marca ${appName}, o design e o código são protegidos por lei e pertencem a ${company} ou aos seus licenciantes. Estes Termos não transferem nenhum desses direitos a você.`,
      ],
    },
    {
      heading: '9. Limitação de responsabilidade',
      body: [
        'Na extensão permitida pela lei, não respondemos por lucros cessantes, perda de clientes ou danos indiretos decorrentes do uso do app, nem por conteúdos e dados inseridos por você. Também não respondemos por falhas causadas pelo seu aparelho, pela sua conexão ou por serviços de terceiros. Nada nestes Termos limita os direitos garantidos pelo Código de Defesa do Consumidor.',
      ],
    },
    {
      heading: '10. Suspensão e encerramento',
      body: [
        'Podemos suspender ou encerrar contas que violem estes Termos, a lei ou que coloquem em risco a segurança do serviço ou de outras pessoas. Sempre que possível, avisaremos antes. Você pode parar de usar o app e excluir sua conta quando quiser.',
      ],
    },
    {
      heading: '11. Alterações dos Termos',
      body: [
        'Podemos atualizar estes Termos. A data da última atualização fica no topo desta página. Mudanças relevantes serão avisadas no app, e continuar a usar o app depois do aviso significa concordar com a nova versão.',
      ],
    },
    {
      heading: '12. Lei aplicável e foro',
      body: [
        'Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro do domicílio do consumidor para resolver qualquer controvérsia, quando aplicável o Código de Defesa do Consumidor.',
      ],
    },
    {
      heading: '13. Contato',
      body: [`Dúvidas sobre estes Termos podem ser enviadas ${contact}.`],
    },
  ],
};
