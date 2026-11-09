# Budô · Planos de aula

Aplicação web responsiva para montar, registrar e imprimir aulas de jiu-jítsu. Funciona sem instalação e sem servidor de dados: rascunhos e aulas passadas são salvos no `localStorage` do navegador.

## Uso local

Abra `index.html` em um navegador. Para servir por HTTP durante o desenvolvimento, execute `python3 -m http.server 8000` nesta pasta e visite `http://localhost:8000`.

- **Montar aula:** escreva as atividades livremente em cada etapa e ajuste os tempos até somarem 60 minutos. A barra flutuante mostra o tempo disponível ou excedente. O rascunho é salvo automaticamente.
- **Registrar:** preencha identificação e horário, confira a soma final e clique em **Salvar e registrar aula**. O registro completo vai para **Aulas passadas**, organizado em abas por mês e ano da data da aula. Cada registro destaca o instrutor/monitor, a data e o tema.
- **PDF A4:** clique em **Exportar PDF** e escolha **Salvar como PDF** na janela de impressão do navegador. A folha usa o formato A4.
- **Backup:** use **Exportar backup** para baixar um JSON e **Importar backup** para restaurá-lo em outro navegador. A importação substitui a biblioteca local.

## Publicação futura

O projeto está publicado no GitHub e na Vercel como site estático, sem etapa de build. O armazenamento continua local a cada navegador; não há sincronização entre aparelhos sem um serviço de dados.

Arquivos: `index.html`, `styles.css`, `app.js` e `logobudo.jpeg`.
