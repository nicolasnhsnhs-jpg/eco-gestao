/*
 * Modelos de APR (Análise Preliminar de Risco). Partiram das APRs em Word que a
 * Eco Ambiental usa (limpeza de reservatório e de coifa) e foram completados com o
 * que pedem as normas do trabalho: NR-01 (direito de recusa), NR-06 (EPI com CA),
 * NR-10 (energia elétrica), NR-33 (espaço confinado: PET, vigia, medição de gases) e
 * NR-35 (trabalho em altura).
 *
 * Na emissão, as etapas do modelo são copiadas para a APR (o escritório pode ajustar).
 */

export type EtapaApr = {
  etapa: string
  riscos: string
  medidas: string
  o_que_pode_dar_errado: string
  acoes: string
}

export type ModeloApr = 'reservatorio' | 'coifa' | 'outro'

type Modelo = {
  nome: string
  titulo: string
  descricao: string
  /** Normas citadas no cabeçalho do PDF. */
  normas: string
  etapas: EtapaApr[]
  epis: string[]
}

const RECUSA =
  'Direito de recusa (NR-01): qualquer trabalhador pode interromper a atividade quando houver risco grave e iminente, comunicando o supervisor.'

export const EMERGENCIA = [
  'SAMU 192',
  'Bombeiros 193',
  'Centro de Informações Toxicológicas (CIT) 0800 721 3000',
]

export const AVISO_RECUSA = RECUSA

export const MODELOS_APR: Record<ModeloApr, Modelo> = {
  reservatorio: {
    nome: 'Limpeza de reservatório',
    titulo: "Limpeza e desinfecção de reservatório de água (caixa d'água / cisterna)",
    descricao:
      'Limpeza e desinfecção de reservatório de água potável, com trabalho em altura e em espaço confinado.',
    normas: 'NR-06 · NR-10 · NR-33 · NR-35',
    epis: [
      'Capacete com jugular',
      'Cinto de segurança tipo paraquedista com talabarte duplo (Y)',
      'Trava-quedas ligado à linha de vida',
      'Botas de borracha',
      'Luvas nitrílicas',
      'Óculos de proteção / protetor facial',
      'Macacão impermeável de manga longa com capuz',
      'Máscara/respirador para o produto químico (quando indicado na FISPQ)',
    ],
    etapas: [
      {
        etapa:
          'Avaliar o cenário, os materiais e os equipamentos (avaliação feita pelo supervisor de espaço confinado).',
        riscos: 'Queda de mesmo nível e de nível diferente; equipamento ou EPI em mau estado.',
        medidas:
          'Conferir o estado de todos os equipamentos e EPIs (com CA válido); conferir a lista de materiais; equipamentos com manutenção preventiva em dia; conferir a previsão do tempo.',
        o_que_pode_dar_errado: 'Ventos fortes, chuva com raios; EPI vencido ou danificado.',
        acoes:
          'Não iniciar o serviço; trocar o EPI ou equipamento com defeito; remarcar quando houver chuva com raios.',
      },
      {
        etapa:
          'Liberação do espaço confinado: Permissão de Entrada e Trabalho (PET), bloqueio e medição da atmosfera.',
        riscos:
          'Falta de oxigênio, gases tóxicos ou inflamáveis; entrada de água ou ligação da bomba durante o serviço.',
        medidas:
          'Emitir e assinar a PET; fechar e bloquear o registro de entrada e a bomba de recalque (cadeado e etiqueta); medir O2 (19,5% a 23%), inflamáveis (LIE), H2S e CO antes e durante a entrada; ventilar o reservatório; vigia do lado de fora o tempo todo.',
        o_que_pode_dar_errado:
          'Medição fora do limite; alguém abre o registro ou liga a bomba; vigia se afasta.',
        acoes:
          'Não entrar e ventilar até a medição ficar normal; parar o serviço e retirar o trabalhador; refazer o bloqueio.',
      },
      {
        etapa: 'Subida ao reservatório.',
        riscos: 'Queda de altura (fratura, óbito).',
        medidas:
          'Treinamento em NR-35; cinto de segurança com talabarte duplo ou trava-quedas sempre ligado à linha de vida; calçado de segurança; capacete com jugular; três pontos de apoio na escada.',
        o_que_pode_dar_errado:
          'Chuva com raios; escada de acesso danificada; reservatório descoberto.',
        acoes: 'Parar o serviço; não subir até haver acesso seguro.',
      },
      {
        etapa: 'Içamento manual de materiais e equipamentos.',
        riscos: 'Queda de materiais e equipamentos sobre pessoas; esforço excessivo.',
        medidas:
          'Óculos de proteção e capacete com jugular; isolar e sinalizar a área de baixo; não ficar embaixo da carga; usar corda e balde/bolsa apropriados; dividir o peso.',
        o_que_pode_dar_errado: 'Corda arrebenta; pessoa entra na área isolada; chuva com raios.',
        acoes: 'Parar o içamento; reforçar o isolamento; trocar a corda.',
      },
      {
        etapa:
          'Montagem do equipamento de segurança e do ponto de ancoragem para a descida (sistema de resgate com tripé, quando aplicável).',
        riscos: 'Queda, tropeços, escorregões e queda de materiais.',
        medidas:
          'Treinamento em NR-33 e NR-35; trabalho supervisionado pelo supervisor de espaço confinado; luvas, botas de borracha, óculos e cinto ligado à linha de vida; conferir a resistência do ponto de ancoragem.',
        o_que_pode_dar_errado:
          'Local sem condições para montar e fixar a ancoragem; chuva com raios.',
        acoes:
          'Providenciar condições seguras (ponto de ancoragem e linha de vida) antes de continuar; parar o serviço.',
      },
      {
        etapa:
          'Descida ao interior do reservatório (supervisionada pelo supervisor de espaço confinado).',
        riscos: 'Queda; aprisionamento; atmosfera perigosa.',
        medidas:
          'Treinamento em NR-35 e NR-33; PET liberada; cinto com talabarte duplo ou trava-quedas sempre ligado; botas de borracha; capacete com jugular; sistema de cordas com polias para retirada e escada portátil para descer até o fundo; vigia com comunicação constante.',
        o_que_pode_dar_errado: 'Chuva com raios; mal-estar do trabalhador; perda de comunicação.',
        acoes: 'Parar o serviço e retirar o trabalhador pelo sistema de resgate.',
      },
      {
        etapa: 'Uso da escada portátil dentro do reservatório.',
        riscos:
          'Queda de nível diferente e de mesmo nível, batidas, torções, aprisionamento; piso molhado.',
        medidas:
          'Treinamento em NR-33 e NR-35; trabalho com PET; escada com sapatas antiderrapantes e bem apoiada; luvas, botas de borracha e cinto com talabarte em Y.',
        o_que_pode_dar_errado: 'Escada escorrega; chuva com raios.',
        acoes: 'Parar o serviço; firmar a escada ou trocar por outra em bom estado.',
      },
      {
        etapa: 'Esgotamento da água restante com bomba elétrica.',
        riscos: 'Choque elétrico; umidade; torções.',
        medidas:
          'Treinamento em NR-10 básico, NR-33 e NR-35; bomba e extensão em bom estado, com plugue e fiação sem emendas; ligação em tomada com DR; cabos fora da água e das áreas de passagem.',
        o_que_pode_dar_errado:
          'Fio desencapado; bomba ligada com as mãos molhadas; chuva com raios.',
        acoes:
          'Desligar a energia no quadro antes de mexer na bomba; trocar o cabo; parar o serviço.',
      },
      {
        etapa: 'Lavagem das paredes internas e desinfecção do reservatório (hipoclorito de sódio).',
        riscos:
          'Respingos de líquido e sólidos nos olhos e na pele; inalação do produto; umidade; piso escorregadio.',
        medidas:
          'Seguir a FISPQ do produto e a diluição indicada; óculos de proteção/protetor facial, luvas nitrílicas, macacão impermeável de manga longa com capuz; ventilação durante a aplicação; não misturar produtos.',
        o_que_pode_dar_errado:
          'Produto nos olhos ou na pele; tontura pela inalação; chuva com raios.',
        acoes:
          'Lavar com água corrente por 15 minutos e procurar atendimento (CIT 0800 721 3000); sair do reservatório e ventilar; parar o serviço.',
      },
      {
        etapa: 'Saída do reservatório (supervisionada pelo supervisor de espaço confinado).',
        riscos: 'Queda e aprisionamento; cansaço pelo esforço.',
        medidas:
          'Treinamento em NR-33 e NR-35; PET; cinto com talabarte duplo ou trava-quedas sempre ligado; botas de borracha; capacete com jugular.',
        o_que_pode_dar_errado: 'Cansaço pelo esforço da limpeza e falta de força para subir.',
        acoes:
          'Supervisor faz o resgate com os equipamentos montados e presta o atendimento conforme os treinamentos de NR-33 e NR-35.',
      },
      {
        etapa:
          'Encerramento: retirada dos equipamentos, desbloqueio do registro e da bomba, fechamento da PET.',
        riscos: 'Queda de materiais; reservatório liberado com pessoa ou material dentro.',
        medidas:
          'Conferir que todos saíram e que nenhum material ficou dentro; fechar a tampa; retirar os bloqueios só depois da conferência; encerrar e arquivar a PET; deixar a área limpa.',
        o_que_pode_dar_errado: 'Tampa mal fechada; ferramenta esquecida dentro.',
        acoes: 'Refazer a conferência antes de liberar o reservatório ao cliente.',
      },
    ],
  },
  coifa: {
    nome: 'Limpeza de coifa',
    titulo: 'Limpeza e higienização de coifa de cozinha industrial',
    descricao:
      'Limpeza e desengorduramento de coifa, dutos e filtros de cozinha industrial, com trabalho em altura e produto químico alcalino.',
    normas: 'NR-06 · NR-10 · NR-35',
    epis: [
      'Capacete com jugular',
      'Óculos de proteção / protetor facial',
      'Máscara facial (respirador)',
      'Luvas nitrílicas de cano longo',
      'Botas de borracha',
      'Roupa impermeável',
      'Cinto de segurança e linha de vida (trabalho acima de 2 m)',
    ],
    etapas: [
      {
        etapa: 'Exame médico e treinamento da equipe.',
        riscos: 'Trabalhador sem condição de saúde ou sem treinamento para a atividade.',
        medidas:
          'Todos com ASO válido (exames periódicos) e treinamento em NR-35; equipe especializada e treinada.',
        o_que_pode_dar_errado:
          'Alguém tentar trabalhar sem ASO, com ASO vencido ou sem ter sido aprovado no exame.',
        acoes:
          'É proibida a entrada de operador sem ASO; quem não foi aprovado não executa o trabalho.',
      },
      {
        etapa: 'Preparação e isolamento da área.',
        riscos: 'Entrada de pessoas estranhas à operação expondo-se a acidentes.',
        medidas:
          'Isolar e sinalizar a área com fita e placas; combinar com o cliente o horário com a cozinha parada; afastar pessoas, alimentos e utensílios.',
        o_que_pode_dar_errado: 'Isolamento feito de maneira incorreta; cozinha em funcionamento.',
        acoes:
          'Refazer o isolamento conforme os padrões de segurança; só começar com a cozinha liberada.',
      },
      {
        etapa:
          'Desligamento e bloqueio das fontes de energia: exaustor, quadro elétrico e gás (bloqueio e etiquetagem).',
        riscos: 'Choque elétrico; partida do motor do exaustor; vazamento ou chama de gás.',
        medidas:
          'Desligar o exaustor e o disjuntor no quadro; bloquear e etiquetar; fechar o registro de gás dos equipamentos; esperar as superfícies esfriarem; conferir a ausência de tensão.',
        o_que_pode_dar_errado:
          'Alguém religa o equipamento; gás aberto; fiação ou plugue danificado.',
        acoes:
          'Parar o serviço; refazer o bloqueio; comunicar a manutenção do cliente sobre a fiação danificada.',
      },
      {
        etapa: 'Isolamento da coifa e do fogão com plástico.',
        riscos: 'Contaminação dos equipamentos e móveis com a sujeira retirada.',
        medidas:
          'Cobrir fogões, chapas, bancadas e equipamentos com plástico; proteger tomadas e motores contra água.',
        o_que_pode_dar_errado: 'Plástico solta e a gordura cai nos equipamentos.',
        acoes: 'Refazer a proteção; limpar o equipamento atingido ao final.',
      },
      {
        etapa: 'Subida e descida para alcançar a coifa (escada, plataforma ou andaime).',
        riscos: 'Queda de nível diferente (fraturas, óbito); escorregão no piso engordurado.',
        medidas:
          'Usar escada ou plataforma adequada e bem apoiada (andaime quando aplicável); nunca subir em fogão ou bancada; capacete com jugular, botas de borracha, óculos e máscara; cinto de segurança e linha de vida acima de 2 m.',
        o_que_pode_dar_errado: 'Escada instável; piso escorregadio.',
        acoes:
          'Firmar ou trocar a escada; limpar o piso periodicamente durante a operação; comunicar falhas à manutenção.',
      },
      {
        etapa:
          'Limpeza e desengorduramento da coifa, filtros e dutos (desincrustante alcalino — hidróxido de sódio).',
        riscos:
          'Queimaduras químicas na pele e nos olhos; inalação do produto; cortes nas chapas e filtros; esforço excessivo; posturas forçadas; projeção de partículas; umidade.',
        medidas:
          'Seguir a FISPQ e a diluição do produto (Desincrustante, registro MS 3.1966.0029); óculos/protetor facial, máscara, luvas nitrílicas de cano longo e roupa impermeável; nunca limpar com o equipamento ligado; não jogar água nos motores e tomadas; manusear chapas e filtros com luvas; pausas e revezamento.',
        o_que_pode_dar_errado:
          'Produto nos olhos ou na pele; choque ao ligar equipamento com as mãos ou pés molhados ou com motor molhado; princípio de incêndio pelo acúmulo de gordura.',
        acoes:
          'Lavar com água corrente por 15 minutos e procurar atendimento (CIT 0800 721 3000); manter extintor por perto; parar o serviço e comunicar o supervisor.',
      },
      {
        etapa: 'Uso dos EPIs obrigatórios.',
        riscos: 'Usar os EPIs de maneira incorreta ou com EPI danificado.',
        medidas:
          'Conferir se os EPIs obrigatórios estão sendo usados corretamente e se estão em condições de uso (CA válido).',
        o_que_pode_dar_errado:
          'Alguém tentar fazer o serviço sem um dos EPIs ou com EPI danificado.',
        acoes: 'Só faz o serviço quem estiver com todos os EPIs, em condições de uso.',
      },
      {
        etapa:
          'Encerramento: recolher o plástico e os resíduos, limpar o piso, retirar os bloqueios e liberar ao cliente.',
        riscos: 'Escorregão no piso; equipamento religado com resíduo de produto ou água.',
        medidas:
          'Recolher resíduos e plásticos; limpar e secar o piso; conferir que motores e tomadas estão secos; retirar os bloqueios e religar junto com o responsável do cliente.',
        o_que_pode_dar_errado: 'Equipamento religado molhado; resíduo deixado no local.',
        acoes: 'Secar antes de religar; refazer a conferência com o cliente.',
      },
    ],
  },
  outro: {
    nome: 'Outro serviço',
    titulo: 'Análise Preliminar de Risco',
    descricao: '',
    normas: 'NR-06',
    epis: ['Calçado de segurança', 'Luvas', 'Óculos de proteção'],
    etapas: [
      {
        etapa: 'Avaliar o local, os materiais e os equipamentos.',
        riscos: '',
        medidas:
          'Conferir o estado de todos os equipamentos e EPIs (com CA válido) antes de começar.',
        o_que_pode_dar_errado: '',
        acoes: 'Não iniciar o serviço sem condições seguras.',
      },
    ],
  },
}

export const ETAPA_VAZIA: EtapaApr = {
  etapa: '',
  riscos: '',
  medidas: '',
  o_que_pode_dar_errado: '',
  acoes: '',
}

/** Lê as etapas gravadas (jsonb) sem confiar no formato. */
export function lerEtapas(valor: unknown): EtapaApr[] {
  if (!Array.isArray(valor)) return []
  const texto = (v: unknown) => (typeof v === 'string' ? v : '')
  return valor.flatMap((e) => {
    if (!e || typeof e !== 'object') return []
    const o = e as Record<string, unknown>
    return [
      {
        etapa: texto(o.etapa),
        riscos: texto(o.riscos),
        medidas: texto(o.medidas),
        o_que_pode_dar_errado: texto(o.o_que_pode_dar_errado),
        acoes: texto(o.acoes),
      },
    ]
  })
}

export function lerEpis(valor: unknown): string[] {
  return Array.isArray(valor)
    ? valor.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    : []
}

/** Só as etapas com algum texto, cada campo sem espaços sobrando. */
export function limparEtapas(etapas: EtapaApr[]): EtapaApr[] {
  return etapas
    .map((e) => ({
      etapa: e.etapa.trim(),
      riscos: e.riscos.trim(),
      medidas: e.medidas.trim(),
      o_que_pode_dar_errado: e.o_que_pode_dar_errado.trim(),
      acoes: e.acoes.trim(),
    }))
    .filter((e) => Object.values(e).some(Boolean))
}

/** "Nº 28/2026" */
export const numeroApr = (a: { numero: number; ano: number }) =>
  `${String(a.numero).padStart(2, '0')}/${a.ano}`

export const nomeModelo = (m: string) =>
  m in MODELOS_APR ? MODELOS_APR[m as ModeloApr].nome : 'Outro serviço'
