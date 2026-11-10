# Budô · Planos de aula

Aplicação web responsiva para montar, agendar, compartilhar e imprimir aulas de jiu-jítsu. O site usa Supabase Auth, Postgres e Storage para sincronizar planos e vídeos entre instrutores autorizados. Cada alteração também é salva imediatamente no navegador e enviada ao banco em seguida.

## Uso

- Entre com o usuário e a senha fornecidos pela Budô. Todos os instrutores autorizados podem visualizar e editar as mesmas aulas.
- Em **Montar**, preencha a aula. O rascunho é salvo automaticamente. **Salvar e registrar aula** exige 60 minutos e move o plano para **Registradas**.
- A aula registrada continua editável. Às **19h da data da aula**, no horário de São Paulo, ela passa automaticamente para **Concluídas**. Se ninguém estiver com o site aberto nesse horário, a mudança aparece assim que o site for aberto novamente.
- O vídeo de referência pode ser anexado (até 50 MB no plano gratuito do Supabase) ou informado por link. O anexo é armazenado em uma área privada acessível aos instrutores autorizados.
- **PDF:** clique em **↗ PDF** e escolha **Salvar como PDF** na janela de impressão do navegador. A página usa o formato A4.
- **Backup:** exporte um JSON para guardar uma cópia de todos os planos e vídeos. A importação substitui a biblioteca local e sincroniza os planos com o banco.

- Em **Registradas** e **Concluídas**, escolha o mês, depois o instrutor/monitor e então a aula para abrir todos os detalhes.

## Novos instrutores

Crie o usuário em **Supabase → Authentication → Users → Add user → Create new user**, com e-mail no formato `usuario@budo-planos.internal` e **Auto confirm user** ativado. Depois, adicione o UUID criado à tabela `public.instructors` com o nome de usuário correspondente. Apenas usuários presentes nessa tabela, com `active = true`, podem ler ou editar aulas e vídeos. Nunca coloque senhas no repositório.

## Arquivos

O site estático é publicado pela Vercel a partir do GitHub. Código: `index.html`, `styles.css`, `app.js`, `cloud.js`, `logobudo.jpeg`. A estrutura e as políticas do banco estão em `supabase/migrations`.
