# Budô · Planos de aula

Aplicação web responsiva para montar, agendar, compartilhar e imprimir aulas de jiu-jítsu. O site usa Supabase Auth, Postgres e Storage para sincronizar planos e vídeos entre instrutores autorizados. Cada alteração também é salva imediatamente no navegador e enviada ao banco em seguida.

## Uso

- Entre com o usuário e a senha fornecidos pela Budô. Todos os instrutores autorizados podem visualizar e editar os rascunhos compartilhados.
- Em **Montar**, preencha a aula. O rascunho é salvo automaticamente. **Salvar e registrar aula** exige 60 minutos e move o plano para **Registradas**.
- A aula registrada fica disponível para consulta e PDF, sem edição. Às **19h da data da aula**, no horário de São Paulo, ela passa para **Concluídas**.
- O botão **Hoje** abre diretamente as aulas do dia. Ao abrir um plano, as etapas e o vídeo de referência ficam visíveis para consulta.
- No dia da aula ou depois, **Após a aula** permite anotar o que funcionou e o que ajustar. Esse relato é salvo automaticamente, compartilhado entre instrutores e armazenado separadamente do plano registrado.
- O vídeo de referência pode ser anexado (até 50 MB no plano gratuito do Supabase) ou informado por link. O anexo é armazenado em uma área privada acessível aos instrutores autorizados.
- **PDF:** clique em **↗ PDF** e escolha **Salvar como PDF** na janela de impressão do navegador. A página usa o formato A4.
- **Backup:** exporte um JSON para guardar uma cópia de todos os planos, relatos e vídeos. A importação substitui a biblioteca local e sincroniza os dados com o banco.

- Em **Registradas** e **Concluídas**, escolha o mês, depois o instrutor/monitor e então a aula para abrir todos os detalhes.

## Novos instrutores

Crie o usuário em **Supabase → Authentication → Users → Add user → Create new user**, com e-mail no formato `usuario@budo-planos.internal` e **Auto confirm user** ativado. Depois, adicione o UUID criado à tabela `public.instructors` com o nome de usuário correspondente. Apenas usuários presentes nessa tabela, com `active = true`, podem ler ou editar aulas e vídeos. Nunca coloque senhas no repositório.

## Arquivos

O site estático é publicado pela Vercel a partir do GitHub. Código: `index.html`, `styles.css`, `app.js`, `cloud.js`, `manifest.webmanifest` e a logo. A estrutura e as políticas do banco estão em `supabase/migrations`. A rotina de avisos do cronômetro foi desativada; seus arquivos de migração e função permanecem no histórico para rastreabilidade.
