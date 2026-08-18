# Conexão de Fluxo: Extrator (Ponto + Holerite) → Cálculo
### "Conectar o fluxo" — sem tocar no motor, só ligar a saída de um na entrada do outro

> Decisão: o extrator fica separado (skills próprias), mas a saída dele **despeja** nas estruturas que a `analise-processo.html` já entende. Ponto entra em DOIS lugares (jornada para conferência + horas apuradas como premissa); holerite entra no salário/base. Zero mudança no motor de cálculo.

---

## O mapa da esteira completa

```
┌─ DECISÃO (PDF) ──→ [leitor de decisão] ─→ parâmetros + verbas deferidas ─┐
│                                                                          │
├─ ESPELHO DE PONTO (PDF) ─→ [extrator ponto] ─→ ① jornada dia-a-dia ──────┤
│                                              └→ ② horas apuradas ────────┤
│                                                 (qHE50, noturno, art71)  │
├─ HOLERITE (PDF) ─→ [extrator holerite] ─→ ③ salário-base + base INSS ────┤
│                                                                          ▼
│                                                            [CÁLCULO / motor]
│                                                                          │
│                                          ┌───────────────────────────────┤
│                                          ▼                               ▼
│                                    Excel formulado                  PARECER
│                                    + CSV PJe-Calc              (+ IMPUGNAÇÃO se
│                                                                sobe cálculo adverso)
```

Cada extrator já existe e já produz Excel/CSV. A integração é **fazer a saída deles cair nas estruturas do cálculo**, além de continuarem gerando seus próprios arquivos.

---

## PONTO → duas entradas (a decisão "os dois")

### ① Jornada dia-a-dia → tabela de conferência

O extrator de ponto produz o CSV PJe-Calc (`Data;Entrada1;Saída1;...`), dia a dia. A `analise-processo.html` tem a tabela `montarJornada` que hoje é por **dia-da-semana** (Segunda, Terça...). 

A ponte resume o dia-a-dia por dia-da-semana **para conferência** (o calculista vê "as segundas foram ~8h-18h") e preenche a tabela. O formato que a tabela já lê:

```javascript
// o que a tabela de jornada entende (dadosContratuais.jornada):
{
  tipo: 'fixa',
  descricao: 'jornada extraída do espelho de ponto',
  dias: {
    '1': { entrada: 8,  saida: 18, intervMin: 60 },  // segunda
    '2': { entrada: 8,  saida: 18, intervMin: 60 },  // terça
    // ... 0=domingo, 6=sábado
  }
}
```

O extrator, ao resumir o ponto, calcula a moda (horário mais frequente) de cada dia-da-semana e preenche isso. Aparece com a tag "extraído do ponto — confira", igual ao que a IA de decisão já faz. **É conferência, não é o cálculo final.**

### ② Horas já apuradas → premissa direta (a precisão)

Aqui está o ganho: o extrator já apura as horas com TODAS as regras (noturno reduzido, HE 8/44 não acumuladas, art. 66, art. 71) — melhor que o motor recalcularia da jornada resumida. Então essas quantidades entram como **premissa**, direto:

```javascript
// as premissas que o cálculo já entende (coletarPremissas):
[
  { descricao: 'Horas extras 50%', vid: 'heTotais', tipo: 'horas',    valor: 1564.8 },
  { descricao: 'Adicional noturno', vid: 'adicionalNoturno', tipo: 'horasNot', valor: 208.6 },
  { descricao: 'Intervalo art. 71', vid: 'heArt71', tipo: 'horas',    valor: 26.1 }
]
```

Essas horas vêm do extrator (apuração precisa dia-a-dia), não do motor. A tabela de jornada fica lá **para o calculista conferir de onde vieram**, mas o número que entra no cálculo é o apurado.

> **Por que os dois juntos é o certo:** a jornada dá transparência (o calculista vê e confia); as horas apuradas dão precisão (não perde os dias atípicos que a jornada resumida jogaria fora). O calculista pode, se quiser, editar a jornada e recalcular pelo motor — mas o default usa o número mais fiel, que é o do extrator.

---

## HOLERITE → salário + base (plug quase direto)

O extrator de holerite produz salário-base fixo mês a mês + base INSS + rubricas. Sem dilema de granularidade — ele alimenta os campos do formulário direto:

```javascript
// campos do formulário que o holerite preenche:
{
  salario: 5000,               // salário-base fixo (do cabeçalho, não proporcional)
  dataBaseAtualizacao: '2024-06',
  evolucaoSalarial: [          // se houver variação mês a mês
    { competencia: '2023-01', valor: 4500 },
    { competencia: '2024-01', valor: 5000 }
  ],
  // rubricas pagas → alimentam as DEDUÇÕES (o que já foi pago, p/ abater)
  pagamentos: [ { rubrica: 'Horas extras', valor: 1234.56, competencia: '2023-05' } ]
}
```

O salário vira base de cálculo; as rubricas já pagas viram **deduções** (aquele abatimento OJ 415 que aparece nas impugnações — o holerite prova o que foi pago).

---

## O que construir (a ponte, sem tocar no motor)

Uma função-ponte para cada extrator, que pega a saída dele e despeja nas estruturas acima:

**`pontoParaCalculo(saidaExtrator)`** → retorna `{ jornada, premissasApuradas }`. A jornada preenche `montarJornada`; as premissas entram via `premissasManuais`/`coletarPremissas`.

**`holeriteParaCalculo(saidaExtrator)`** → retorna `{ salario, evolucao, pagamentos }`. Preenche os campos do formulário e a lista de deduções.

Nenhuma das duas mexe no `fazai_engine.js`. Elas só traduzem o formato do extrator para o formato que a tela já lê. É "conectar o fluxo" no sentido literal: um adaptador entre a saída de um e a entrada do outro.

---

## Ordem de implementação (menor risco primeiro)

1. **Holerite** primeiro — é o plug mais direto (sem granularidade). Valida a mecânica da ponte com o caso fácil.
2. **Ponto → jornada** (conferência) — preenche a tabela, visível e conferível.
3. **Ponto → horas apuradas** (premissa) — o ganho de precisão, sobre a mecânica já validada.
4. Botão na tela: "Importar do extrator" em cada seção (jornada, salário), que chama a ponte.

Cada passo é testável isolado. Se o passo 3 der problema, os passos 1-2 já entregam valor e nada quebrou no motor.

---

## Contrapontos honestos

- **O resumo ponto→jornada perde informação por definição.** Dias atípicos (faltas, plantões, escala 12x36) não cabem num "dia-da-semana padrão". Por isso as horas apuradas (②) são a fonte de verdade, e a jornada (①) é só conferência. Deixar claro na tela qual é qual — senão o calculista acha que a jornada resumida é o cálculo.
- **A apuração do extrator precisa ser auditável.** Como as horas entram "prontas", o calculista tem que conseguir ver COMO o extrator chegou nelas (a aba de auditoria/metodologia que a skill já gera). Sem isso, ele está assinando um número que não consegue defender. A ponte deve trazer também o link/ref para a auditoria.
- **Divergência entre a jornada resumida e as horas apuradas é esperada** (a resumida aproxima). Não é bug — mas pode assustar o calculista se ele recalcular pela jornada e der diferente. Avisar: "as horas vêm da apuração dia-a-dia; recalcular pela jornada resumida dá uma aproximação".
- **Holerite: o salário-base certo é o do cabeçalho, não a rubrica proporcional.** A skill já sabe disso, mas a ponte tem que pegar o campo certo — pegar a rubrica "dias trabalhados" em vez do salário fixo quebra a base de tudo.
