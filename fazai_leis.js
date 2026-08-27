/* ============================================================
   FazAI — Base de dispositivos legais para transcrição em peça
   ------------------------------------------------------------
   Por que existe: a IA NÃO transcreve lei. Ela escolhe QUAL
   dispositivo se aplica; o texto literal sai daqui, de tabela
   mantida — do mesmo jeito que os índices de correção.
   Assim a peça nunca sai com redação inventada.

   CONFERIR UMA VEZ: cada verbete tem "conferido". Ao validar a
   redação contra a fonte oficial, troque para true. O sistema
   avisa na tela enquanto houver verbete não conferido.
   Para acrescentar uma tese nova, basta acrescentar aqui.
   ============================================================ */
window.FazAILeis = {

/* ---------- CLT ---------- */
art66: { ref:'Art. 66 da CLT', conferido:false,
  txt:'Entre 2 (duas) jornadas de trabalho haverá um período mínimo de 11 (onze) horas consecutivas para descanso.' },

art67: { ref:'Art. 67, caput, da CLT', conferido:false,
  txt:'Será assegurado a todo empregado um descanso semanal de 24 (vinte e quatro) horas consecutivas, o qual, salvo motivo de conveniência pública ou necessidade imperiosa do serviço, deverá coincidir com o domingo, no todo ou em parte.' },

art71: { ref:'Art. 71, caput, da CLT', conferido:false,
  txt:'Em qualquer trabalho contínuo, cuja duração exceda de 6 (seis) horas, é obrigatória a concessão de um intervalo para repouso ou alimentação, o qual será, no mínimo, de 1 (uma) hora e, salvo acordo escrito ou contrato coletivo em contrário, não poderá exceder de 2 (duas) horas.' },

art71p4: { ref:'Art. 71, § 4º, da CLT (redação da Lei 13.467/2017)', conferido:false,
  txt:'A não concessão ou a concessão parcial do intervalo intrajornada mínimo, para repouso e alimentação, a empregados urbanos e rurais, implica o pagamento, de natureza indenizatória, apenas do período suprimido, com acréscimo de 50% (cinquenta por cento) sobre o valor da remuneração da hora normal de trabalho.',
  nota:'Para contratos e períodos anteriores a 11/11/2017 aplica-se a redação anterior e a Súmula 437, I, do TST (pagamento do período integral, com natureza salarial).' },

art11: { ref:'Art. 11 da CLT', conferido:false,
  txt:'A pretensão quanto a créditos resultantes das relações de trabalho prescreve em cinco anos para os trabalhadores urbanos e rurais, até o limite de dois anos após a extinção do contrato de trabalho.' },

art192: { ref:'Art. 192 da CLT', conferido:false,
  txt:'O exercício de trabalho em condições insalubres, acima dos limites de tolerância estabelecidos pelo Ministério do Trabalho, assegura a percepção de adicional respectivamente de 40% (quarenta por cento), 20% (vinte por cento) e 10% (dez por cento) do salário-mínimo da região, segundo se classifiquem nos graus máximo, médio e mínimo.' },

art193p1: { ref:'Art. 193, § 1º, da CLT', conferido:false,
  txt:'O trabalho em condições de periculosidade assegura ao empregado um adicional de 30% (trinta por cento) sobre o salário sem os acréscimos resultantes de gratificações, prêmios ou participações nos lucros da empresa.' },

art193p2: { ref:'Art. 193, § 2º, da CLT', conferido:false,
  txt:'O empregado poderá optar pelo adicional de insalubridade que porventura lhe seja devido.' },

art477p8: { ref:'Art. 477, § 8º, da CLT', conferido:false,
  txt:'A inobservância do disposto no § 6º deste artigo sujeitará o infrator à multa de 160 BTN, por trabalhador, bem assim ao pagamento da multa a favor do empregado, em valor equivalente ao seu salário, devidamente corrigido pelo índice de variação do BTN, salvo quando, comprovadamente, o trabalhador der causa à mora.' },

art487p2: { ref:'Art. 487, § 2º, da CLT', conferido:false,
  txt:'A falta de aviso prévio por parte do empregado dá ao empregador o direito de descontar os salários correspondentes ao prazo respectivo.' },

art790B: { ref:'Art. 790-B, caput, da CLT', conferido:false,
  txt:'A responsabilidade pelo pagamento dos honorários periciais é da parte sucumbente na pretensão objeto da perícia, ainda que beneficiária da justiça gratuita.' },

art791A: { ref:'Art. 791-A, caput, da CLT', conferido:false,
  txt:'Ao advogado, ainda que atue em causa própria, serão devidos honorários de sucumbência, fixados entre o mínimo de 5% (cinco por cento) e o máximo de 15% (quinze por cento) sobre o valor que resultar da liquidação da sentença, do proveito econômico obtido ou, não sendo possível mensurá-lo, sobre o valor atualizado da causa.' },

art791Ap3: { ref:'Art. 791-A, § 3º, da CLT', conferido:false,
  txt:'Na hipótese de procedência parcial, o juízo arbitrará honorários de sucumbência recíproca, vedada a compensação entre os honorários.' },

art840p1: { ref:'Art. 840, § 1º, da CLT', conferido:false,
  txt:'Sendo escrita, a reclamação deverá conter a designação do juízo, a qualificação das partes, a breve exposição dos fatos de que resulte o dissídio, o pedido, que deverá ser certo, determinado e com indicação de seu valor, a data e a assinatura do reclamante ou de seu representante.' },

art879p1: { ref:'Art. 879, § 1º, da CLT', conferido:false,
  txt:'Na liquidação, não se poderá modificar, ou inovar, a sentença liquidanda nem discutir matéria pertinente à causa principal.' },

/* ---------- Constituição ---------- */
cf7xxix: { ref:'Art. 7º, XXIX, da Constituição Federal', conferido:false,
  txt:'ação, quanto aos créditos resultantes das relações de trabalho, com prazo prescricional de cinco anos para os trabalhadores urbanos e rurais, até o limite de dois anos após a extinção do contrato de trabalho.' },

/* ---------- Leis esparsas e Código Civil ---------- */
lei8036a15: { ref:'Art. 15 da Lei 8.036/90', conferido:false,
  txt:'Para os fins previstos nesta Lei, todos os empregadores ficam obrigados a depositar, até o dia 7 (sete) de cada mês, em conta bancária vinculada, a importância correspondente a 8 (oito) por cento da remuneração paga ou devida, no mês anterior, a cada trabalhador.' },

lei8177a39: { ref:'Art. 39, caput, da Lei 8.177/91', conferido:false,
  txt:'Os débitos trabalhistas de qualquer natureza, quando não satisfeitos pelo empregador nas épocas próprias assim definidas em lei, acordo ou convenção coletiva, sentença normativa ou cláusula contratual sofrerão juros de mora equivalentes à TRD acumulada no período compreendido entre a data de vencimento da obrigação e o seu efetivo pagamento.' },

cc884: { ref:'Art. 884 do Código Civil', conferido:false,
  txt:'Aquele que, sem justa causa, se enriquecer à custa de outrem, será obrigado a restituir o indevidamente auferido, feita a atualização dos valores monetários.' },

cc406: { ref:'Art. 406 do Código Civil', conferido:false,
  txt:'Quando os juros moratórios não forem convencionados, ou o forem sem taxa estipulada, ou quando provierem de determinação da lei, serão fixados de acordo com a taxa que estiver em vigor para a mora do pagamento de impostos devidos à Fazenda Nacional.',
  nota:'Redação anterior à Lei 14.905/2024. Para fatos posteriores, conferir a nova redação (SELIC deduzido o IPCA).' },

/* ---------- STF ---------- */
adc58: { ref:'Tese firmada pelo STF nas ADCs 58 e 59', conferido:false,
  txt:'À atualização dos créditos decorrentes de condenação judicial na Justiça do Trabalho deverão ser aplicados, até que sobrevenha solução legislativa, os mesmos índices de correção monetária e de juros vigentes para as condenações cíveis em geral: na fase pré-judicial, o IPCA-E acrescido dos juros do art. 39, caput, da Lei 8.177/91; e, a partir do ajuizamento da ação, a taxa SELIC, que já engloba correção monetária e juros de mora.',
  nota:'Síntese da tese para uso em peça. Conferir a ementa oficial quando a transcrição integral for exigida.' },

/* ---------- Súmulas do TST ---------- */
sum63: { ref:'Súmula 63 do TST', conferido:false,
  txt:'A contribuição para o Fundo de Garantia do Tempo de Serviço incide sobre a remuneração mensal devida ao empregado, inclusive horas extras e adicionais eventuais.' },

sum146: { ref:'Súmula 146 do TST', conferido:false,
  txt:'O trabalho prestado em domingos e feriados, não compensado, deve ser pago em dobro, sem prejuízo da remuneração relativa ao repouso semanal.' },

sum191: { ref:'Súmula 191, I, do TST', conferido:false,
  txt:'O adicional de periculosidade incide apenas sobre o salário básico e não sobre este acrescido de outros adicionais.' },

sum264: { ref:'Súmula 264 do TST', conferido:false,
  txt:'A remuneração do serviço suplementar é composta do valor da hora normal, integrado por parcelas de natureza salarial e acrescido do adicional previsto em lei, contrato, acordo, convenção coletiva ou sentença normativa.' },

sum305: { ref:'Súmula 305 do TST', conferido:false,
  txt:'O pagamento relativo ao período de aviso prévio, trabalhado ou não, está sujeito a contribuição para o FGTS.' },

sum338: { ref:'Súmula 338, I, do TST', conferido:false,
  txt:'É ônus do empregador que conta com mais de 10 (dez) empregados o registro da jornada de trabalho na forma do art. 74, § 2º, da CLT. A não-apresentação injustificada dos controles de frequência gera presunção relativa de veracidade da jornada de trabalho, a qual pode ser elidida por prova em contrário.' },

sum340: { ref:'Súmula 340 do TST', conferido:false,
  txt:'O empregado, sujeito a controle de horário, remunerado à base de comissões, tem direito ao adicional de, no mínimo, 50% (cinquenta por cento) pelo trabalho em horas extras, calculado sobre o valor-hora das comissões recebidas no mês, considerando-se como divisor o número de horas efetivamente trabalhadas.' },

sum431: { ref:'Súmula 431 do TST', conferido:false,
  txt:'Para os empregados a que alude o art. 58, caput, da CLT, quando sujeitos a 40 (quarenta) horas semanais de trabalho, aplica-se o divisor 200 (duzentos) para o cálculo do valor do salário-hora.' },

sum437: { ref:'Súmula 437, I e III, do TST', conferido:false,
  txt:'I - Após a edição da Lei nº 8.923/94, a não-concessão ou a concessão parcial do intervalo intrajornada mínimo, para repouso e alimentação, a empregados urbanos e rurais, implica o pagamento total do período correspondente, e não apenas daquele suprimido, com acréscimo de, no mínimo, 50% sobre o valor da remuneração da hora normal de trabalho, sem prejuízo do cômputo da efetiva jornada de labor para efeito de remuneração. III - Possui natureza salarial a parcela prevista no art. 71, § 4º, da CLT, repercutindo, assim, no cálculo de outras parcelas salariais.',
  nota:'Aplicável aos períodos anteriores à Lei 13.467/2017. A partir de 11/11/2017 prevalece a nova redação do art. 71, § 4º, da CLT.' },

/* ---------- Orientações Jurisprudenciais — SDI-1 ---------- */
oj355: { ref:'OJ 355 da SDI-1 do TST', conferido:false,
  txt:'O desrespeito ao intervalo mínimo interjornadas previsto no art. 66 da CLT acarreta, por analogia, os mesmos efeitos previstos no § 4º do art. 71 da CLT e na Súmula nº 110 do TST, devendo-se pagar a título de horas extras o período de descanso não usufruído.' },

oj397: { ref:'OJ 397 da SDI-1 do TST', conferido:false,
  txt:'O empregado que recebe salário misto (parte fixa e parte variável) tem direito a horas extras pelo trabalho em sobrejornada. Em relação à parte fixa, são devidas as horas simples acrescidas do adicional de horas extras. Em relação à parte variável, é devido somente o adicional de horas extras, aplicando-se, à hipótese, o disposto na Súmula nº 340 do TST.' },

oj415: { ref:'OJ 415 da SDI-1 do TST', conferido:false,
  txt:'A dedução das horas extras comprovadamente pagas daquelas reconhecidas em juízo não pode ser limitada ao mês de apuração, devendo ser integral e considerar todo o período do pedido.' },

/* ---------- acrescentados a partir do Catálogo de Teses ---------- */
art59p1: { ref:'Art. 59, § 1º, da CLT', conferido:false,
  txt:'A remuneração da hora extra será, pelo menos, 50% (cinquenta por cento) superior à da hora normal.' },

art73: { ref:'Art. 73, caput, da CLT', conferido:false,
  txt:'Salvo nos casos de revezamento semanal ou quinzenal, o trabalho noturno terá remuneração superior a do diurno e, para esse efeito, sua remuneração terá um acréscimo de 20% (vinte por cento), pelo menos, sobre a hora diurna.' },

art73p1: { ref:'Art. 73, § 1º, da CLT', conferido:false,
  txt:'A hora do trabalho noturno será computada como de 52 (cinquenta e dois) minutos e 30 (trinta) segundos.' },

art73p2: { ref:'Art. 73, § 2º, da CLT', conferido:false,
  txt:'Considera-se noturno, para os efeitos deste artigo, o trabalho executado entre as 22 (vinte e duas) horas de um dia e as 5 (cinco) horas do dia seguinte.' },

art477p6: { ref:'Art. 477, § 6º, da CLT', conferido:false,
  txt:'A entrega ao empregado de documentos que comprovem a comunicação da extinção contratual aos órgãos competentes bem como o pagamento dos valores constantes do instrumento de rescisão ou recibo de quitação deverão ser efetuados até dez dias contados a partir do término do contrato.' },

art818: { ref:'Art. 818 da CLT', conferido:false,
  txt:'O ônus da prova incumbe: I - ao reclamante, quanto ao fato constitutivo de seu direito; II - ao reclamado, quanto à existência de fato impeditivo, modificativo ou extintivo do direito do reclamante.' },

art879p2: { ref:'Art. 879, § 2º, da CLT', conferido:false,
  txt:'Elaborada a conta e tornada líquida, o juízo deverá abrir às partes prazo comum de 8 (oito) dias para impugnação fundamentada com a indicação dos itens e valores objeto da discordância, sob pena de preclusão.' },

lei12506: { ref:'Art. 1º e parágrafo único da Lei 12.506/2011', conferido:false,
  txt:'O aviso prévio será concedido na proporção de 30 (trinta) dias aos empregados que contem até 1 (um) ano de serviço na mesma empresa. Parágrafo único. Ao aviso prévio previsto neste artigo serão acrescidos 3 (três) dias por ano de serviço prestado na mesma empresa, até o máximo de 60 (sessenta) dias, perfazendo um total de até 90 (noventa) dias.' },

lei8212a22: { ref:'Art. 22, I e II, da Lei 8.212/91', conferido:false,
  txt:'A contribuição a cargo da empresa, destinada à Seguridade Social, é de: I - vinte por cento sobre o total das remunerações pagas, devidas ou creditadas a qualquer título, durante o mês, aos segurados empregados e trabalhadores avulsos que lhe prestem serviços; II - para o financiamento do benefício previsto nos arts. 57 e 58 da Lei nº 8.213/91, 1% (um por cento) para as empresas em cuja atividade preponderante o risco de acidentes do trabalho seja considerado leve, 2% (dois por cento) se médio e 3% (três por cento) se grave.' },

cc404: { ref:'Art. 404, parágrafo único, do Código Civil', conferido:false,
  txt:'Provado que os juros da mora não cobrem o prejuízo, e não havendo pena convencional, pode o juiz conceder ao credor indenização suplementar.' },

sum60: { ref:'Súmula 60, I e II, do TST', conferido:false,
  txt:'I - O adicional noturno, pago com habitualidade, integra o salário do empregado para todos os efeitos. II - Cumprida integralmente a jornada no período noturno e prorrogada esta, devido é também o adicional quanto às horas prorrogadas.' },

sum85: { ref:'Súmula 85, III e IV, do TST', conferido:false,
  txt:'III - O mero não atendimento das exigências legais para a compensação de jornada, inclusive quando encetada mediante acordo tácito, não implica a repetição do pagamento das horas excedentes à jornada normal diária, se não dilatada a jornada máxima semanal, sendo devido apenas o respectivo adicional. IV - A prestação de horas extras habituais descaracteriza o acordo de compensação de jornada. Nesta hipótese, as horas que ultrapassarem a jornada semanal normal deverão ser pagas como horas extraordinárias e, quanto àquelas destinadas à compensação, deverá ser pago a mais apenas o adicional por trabalho extraordinário.',
  nota:'Conferir a aplicação aos contratos posteriores à Lei 13.467/2017, diante do art. 59-B da CLT.' },

sum172: { ref:'Súmula 172 do TST', conferido:false,
  txt:'Computam-se no cálculo do repouso remunerado as horas extras habitualmente prestadas.' },

sum341: { ref:'Súmula 341 do TST', conferido:false,
  txt:'A indicação do perito assistente é faculdade da parte, a qual deve responder pelos respectivos honorários, ainda que vencedora no objeto da perícia.' },

sum347: { ref:'Súmula 347 do TST', conferido:false,
  txt:'O cálculo do valor das horas extras habituais, para efeito de reflexos em verbas trabalhistas, observará o número das horas efetivamente prestadas e a elas aplica-se o valor do salário-hora da época do pagamento daquelas verbas.' },

sum368: { ref:'Súmula 368, II, do TST', conferido:false,
  txt:'É do empregador a responsabilidade pelo recolhimento das contribuições previdenciárias e fiscais, resultantes de crédito do empregado oriundo de condenação judicial. A culpa do empregador pelo inadimplemento das verbas remuneratórias, contudo, não exime a responsabilidade do empregado pelos pagamentos do imposto de renda devido e da contribuição previdenciária que recaia sobre sua quota-parte.',
  nota:'A Súmula 368 tem outros itens (fato gerador, regime de competência). Conferir e acrescentar o item necessário ao caso.' },

sum396: { ref:'Súmula 396, I, do TST', conferido:false,
  txt:'Exaurido o período de estabilidade, são devidos ao empregado apenas os salários do período compreendido entre a data da despedida e o final do período de estabilidade, não lhe sendo assegurada a reintegração no emprego.' },

oj394: { ref:'OJ 394, I e II, da SDI-1 do TST', conferido:false,
  txt:'I - A majoração do valor do repouso semanal remunerado, decorrente da integração das horas extras habitualmente prestadas, não repercute no cálculo das férias, da gratificação natalina, do aviso prévio e do FGTS, sob pena de caracterização de bis in idem. II - O item I será aplicado às horas extras trabalhadas a partir de 20.03.2023.',
  nota:'Marco temporal relevante: para horas extras posteriores a 20/03/2023 a repercussão passou a ser admitida. Conferir o período do caso antes de impugnar.' }

};

/* índice para o prompt: só chave + referência (o texto não vai para a IA) */
window.FazAILeisIndice = Object.keys(window.FazAILeis).map(function(k){
  return k + ' = ' + window.FazAILeis[k].ref;
});
