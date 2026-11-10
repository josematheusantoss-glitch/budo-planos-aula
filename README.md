# Budô · Planos de aula

Aplicação web responsiva para montar, agendar, compartilhar e imprimir aulas de jiu-jítsu. O site usa Supabase Auth, Postgres e Storage para sincronizar planos e vídeos entre instrutores autorizados. Cada alteração também é salva imediatamente no navegador e enviada ao banco em seguida.

## Uso

- Entre com o usuário e a senha fornecidos pela Budô. Todos os instrutores autorizados podem visualizar e editar os rascunhos compartilhados.
- Em **Montar**, preencha a aula. O rascunho é salvo automaticamente. **Salvar e registrar aula** exige 60 minutos e move o plano para **Registradas**.
- A aula registrada fica disponível para consulta e PDF, sem edição. Às **19h da data da aula**, no horário de São Paulo, ela passa para **Concluídas**. Se o cronômetro ainda estiver ativo ou pausado, a aula continua em **Registradas** até ser finalizada.
- Abra a aula registrada no dia agendado e toque em **Iniciar aula**. O cronômetro acompanha o tempo total e a etapa atual. A etapa fica amarela aos 80% e vermelha aos 90% do tempo previsto. A troca só ocorre em **Próxima etapa**. **Pausar** interrompe a contagem; **Finalizar aula** salva a duração real de cada etapa e da aula.
- O botão flutuante pode ser arrastado e sua opacidade pode ser ajustada. A contagem usa os horários salvos e continua correta após fechar ou colocar o app em segundo plano.
- Para receber avisos com a tela bloqueada no iPhone, abra o site pelo ícone instalado em **Compartilhar → Adicionar à Tela de Início**, toque em **Ativar avisos no celular** e permita notificações. O servidor verifica os alertas a cada 30 segundos. Os avisos são enviados ao aparelho do usuário que iniciou a aula.
- O vídeo de referência pode ser anexado (até 50 MB no plano gratuito do Supabase) ou informado por link. O anexo é armazenado em uma área privada acessível aos instrutores autorizados.
- **PDF:** clique em **↗ PDF** e escolha **Salvar como PDF** na janela de impressão do navegador. A página usa o formato A4.
- **Backup:** exporte um JSON para guardar uma cópia de todos os planos e vídeos. A importação substitui a biblioteca local e sincroniza os planos com o banco.

- Em **Registradas** e **Concluídas**, escolha o mês, depois o instrutor/monitor e então a aula para abrir todos os detalhes.

## Novos instrutores

Crie o usuário em **Supabase → Authentication → Users → Add user → Create new user**, com e-mail no formato `usuario@budo-planos.internal` e **Auto confirm user** ativado. Depois, adicione o UUID criado à tabela `public.instructors` com o nome de usuário correspondente. Apenas usuários presentes nessa tabela, com `active = true`, podem ler ou editar aulas e vídeos. Nunca coloque senhas no repositório.

## Arquivos

O site estático é publicado pela Vercel a partir do GitHub. Código: `index.html`, `styles.css`, `app.js`, `live.js`, `cloud.js`, `sw.js`, `manifest.webmanifest` e a logo. A estrutura e as políticas do banco estão em `supabase/migrations`; a função de avisos está em `supabase/functions/budo-push`. As chaves privadas de notificação ficam no Supabase Vault e nunca no repositório.
