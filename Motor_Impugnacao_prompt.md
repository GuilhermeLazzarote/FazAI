# Motor de Impugnação — Prompt e Lógica
### O "cérebro" que gera a impugnação ao cálculo da parte contrária, no estilo do calculista

---

## Como encaixa na esteira

```
DECISÃO (PDF) → [EXTRATOR] → parâmetros estruturados
                                    │
                                    ▼
                            [PARECER TÉCNICO]  ← seções 1-2 (parâmetros da condenação)
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                                ▼
          (A) alimenta o CÁLCULO           (B) + CÁLCULO DA PARTE CONTRÁRIA (PDF/Excel)
              do nosso lado                         │
                                                    ▼
                                          [MOTOR DE IMPUGNAÇÃO]  ← seção 3
                                          compara parâmetro deferido × o que a autora fez
                                                    │
                                                    ▼
                                          Documento: PARECER + IMPUGNAÇÃO (um só)
```

O parecer é sempre a base. A impugnação é acionada quando o usuário **sobe o cálculo do adversário**. Ela pega cada parâmetro que o parecer levantou e verifica se o cálculo da outra parte respeitou.

---

## Fluxo híbrido (sistema sugere, calculista decide)

1. **Sistema detecta** as divergências: compara cada parâmetro deferido (do parecer) com o que o cálculo da parte contrária fez.
2. **Sistema sugere** os pontos de impugnação, cada um com um nível de confiança (certo / provável / conferir).
3. **Calculista escolhe** quais incluir, edita o texto, adiciona pontos manuais.
4. **Sistema redige** no estilo do calculista (usando o modelo-base que ele subiu).

---

## Os inputs do motor

```json
{
  "parecer": { /* saída do parecer: verbas deferidas, jornada, params, ADC 58, limitação */ },
  "calculo_adversario": { /* extração do cálculo da parte contrária (PDF/Excel) */ },
  "modelo_base": "texto da impugnação-modelo do calculista (o estilo dele)",
  "pontos_seic ionados": [ /* quais divergências o calculista marcou para incluir */ ]
}
```

---

## PROMPT DO MOTOR (para o backend /api/claude)

```
Você é um assistente técnico de calculista trabalhista. Sua função é redigir uma
IMPUGNAÇÃO ao cálculo de liquidação apresentado pela parte contrária, confrontando
cada erro do cálculo dela com os PARÂMETROS EXPRESSAMENTE DEFERIDOS na decisão.

REGRAS ABSOLUTAS:
- Você NÃO calcula e NÃO decide o mérito. Você CONFRONTA o que foi deferido com o que
  a parte contrária fez, e redige a impugnação técnica.
- Cada ponto de impugnação SEMPRE segue esta estrutura de 4 movimentos:
  1) O QUE FOI DEFERIDO — cite o comando expresso da decisão (com a fl./súmula/OJ/tese).
     Use "A R. Sentença determinou, de forma EXPRESSA, ..." / "autorizou EXPRESSAMENTE ...".
  2) O QUE A PARTE CONTRÁRIA FEZ — aponte o desvio ("O cálculo da Autora não observou...",
     "computou X", "NÃO procedeu a qualquer dedução...").
  3) A PROVA — introduza a evidência com "Vejamos" e referencie o dado concreto
     (índice usado, valor apurado, dia computado).
  4) A CONCLUSÃO — feche o ponto ("Resta impugnado o cálculo obreiro." /
     "imprestáveis os cálculos apresentados, devendo ser ignorados pelo Magistrado.").
- Fundamente na COISA JULGADA sempre que o desvio contrarie o que foi deferido
  (é vedada alteração em liquidação do que transitou em julgado).
- Só impugne o que tiver base no parecer/decisão. Se um ponto exigir conferência
  humana (norma coletiva, interpretação), marque requerConferencia e NÃO afirme.
- ESTILO: siga o MODELO-BASE fornecido pelo calculista. Reproduza o tom, os jargões e
  a estrutura dele. NÃO invente um estilo novo — você está redigindo COMO ELE redige.

ENTRADA:
- PARÂMETROS DEFERIDOS (do parecer): {parecer}
- CÁLCULO DA PARTE CONTRÁRIA (extraído): {calculo_adversario}
- MODELO-BASE DO CALCULISTA (estilo a seguir): {modelo_base}
- PONTOS SELECIONADOS PELO CALCULISTA: {pontos_selecionados}

SAÍDA (JSON):
{
  "cabecalho": { "titulo": "...", "processo": "...", "vara": "...", "partes": {...} },
  "parametros_condenacao": [ /* seções 1-2: o parecer, resumido em tópicos */ ],
  "impugnacoes": [
    {
      "id": "correcao_adc58",
      "titulo": "Índice de correção monetária incorreto — inobservância da ADC 58/59",
      "deferido": "texto do que foi deferido, com citação",
      "o_que_fez": "texto do desvio do adversário",
      "prova": "o dado concreto (índice X vs Y deferido)",
      "conclusao": "Resta impugnado...",
      "confianca": "certo | provavel | conferir",
      "fundamento": "ADC 58/59, coisa julgada"
    }
  ],
  "conclusao": "síntese dos pontos impugnados (i, ii, iii...)"
}
```

---

## Catálogo de teses (o motor SUGERE teses ao calculista)

O motor carrega um **catálogo de 44 teses** extraídas dos modelos reais do calculista (ver `Catalogo_Teses_Impugnacao.md`). Não é só detectar os 4 erros óbvios — é varrer o cálculo do adversário contra TODO o repertório e **lembrar o calculista de teses que ele poderia esquecer**.

Exemplos do catálogo (cada um vira um "card" que o calculista aceita, edita ou descarta):

| Tese | Gatilho (o que procura) | Confiança |
|---|---|---|
| **Índice de correção (ADC 58)** | índice ≠ IPCA-E/SELIC deferido, ou cumulação | Alta |
| **SELIC no campo da correção** | SELIC como correção E como juros (bis in idem) | Alta |
| **TRD na fase pré-judicial** | juros TRD antes do ajuizamento | Alta |
| **FGTS sobre reflexos** | FGTS incidindo sobre reflexo, não só principal | Alta |
| **Súmula 340 / OJ 397 (comissionista)** | HE variável com divisor fixo 180 / hora+adicional | Alta |
| **Feriados computados** | HE em feriado/sáb/dom com jornada seg-sex | Alta |
| **Abatimento de valores pagos (OJ 415)** | verba "cheia" sem deduzir pagamentos | Alta |
| **Cumulação de adicionais na base** | adic. noturno na base da HE em cascata | Alta |
| **Modalidade de rescisão** | rescisão apurada ≠ reconhecida | Alta |
| **Limitação da inicial** | apuração acima dos valores da exordial | Alta |
| **INSS patronal / SAT** | alíquota SAT divergente da atividade | Média |
| **Base de periculosidade/insalubridade** | base/grau/percentual divergente | Média |
| ... (44 no total, ver catálogo) | | |

**A instrução de sugestão no prompt:**
```
Além dos erros que você detectar diretamente, VARRA o cálculo do adversário contra
o CATÁLOGO DE TESES fornecido. Para cada tese cujo gatilho esteja presente no cálculo,
SUGIRA-A ao calculista com a confiança correspondente (alta/média/conferir). Não afirme
teses de confiança "conferir" — apenas sinalize para o calculista verificar. O objetivo
é ser a MEMÓRIA DE TESES do calculista: lembrá-lo de tudo que cabe, mesmo o que ele não
notou de imediato. Ele decide o que entra.
```

---

## Por que o modelo-base do calculista importa

Impugnação tem MUITO estilo próprio — cada calculista tem seus jargões ("Resta impugnado o cálculo obreiro", "imprestáveis os cálculos", "Vejamos deferimento"). Se o sistema gerar um texto genérico, o calculista reescreve tudo e o ganho de produtividade some.

Por isso o motor recebe o **modelo-base dele** e imita: mesma estrutura, mesmo tom, mesmos fechamentos. O calculista sobe uma impugnação antiga dele uma vez; o sistema aprende o padrão e todas as próximas saem na voz dele. É o que faz o documento sair pronto pra assinar, não pra reescrever.
