# Faz AI — Deploy na Vercel

## Estrutura
```
fazai-deploy/
├── index.html    ← app completo
└── vercel.json   ← config Vercel
```

## Como subir na Vercel (passo a passo)

### Opção 1 — Via GitHub (recomendado)
1. Crie um repositório no GitHub
2. Suba os dois arquivos (index.html + vercel.json)
3. Acesse vercel.com → "New Project" → importe o repositório
4. Clique em Deploy — pronto!

### Opção 2 — Via Vercel CLI
```bash
npm install -g vercel
cd fazai-deploy
vercel --prod
```

### Opção 3 — Drag & Drop
1. Acesse vercel.com/new
2. Arraste a pasta `fazai-deploy` direto na tela
3. Clique em Deploy

---

## Configuração inicial (primeira vez que abrir)

Ao abrir o site pela primeira vez, aparece uma tela de configuração pedindo:

### 1. Supabase (autenticação de usuários)
- Acesse: https://supabase.com → Create new project (grátis)
- Vá em: Settings → API
- Copie: **Project URL** e **anon public key**

### 2. Claude API Key (motor de IA)
- Acesse: https://console.anthropic.com
- Vá em: API Keys → Create Key
- Copie a chave (começa com sk-ant-...)

Cole os três valores na tela de configuração e salve.

---

## Supabase — Configurar confirmação de e-mail (opcional)

Por padrão o Supabase pede confirmação de e-mail.
Para desativar (mais simples para começar):
- Supabase → Authentication → Email → "Confirm email" → desativar

---

## Domínio personalizado

Na Vercel: Settings → Domains → Add Domain
Digite seu domínio (ex: fazai.com.br) e siga as instruções de DNS.

---

## Custos estimados

| Serviço | Plano gratuito | Quando pagar |
|---------|---------------|--------------|
| Vercel | Ilimitado para sites estáticos | Nunca (para este caso) |
| Supabase | 50.000 usuários grátis | Acima de 50k usuários |
| Claude API | Pago por uso | ~R$0,05 por cálculo |

---

Faz AI © 2025
