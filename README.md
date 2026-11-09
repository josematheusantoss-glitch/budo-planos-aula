# Budô · Planos de aula

Aplicação web responsiva para criar e imprimir planos de aula de jiu-jítsu. Funciona sem instalação e sem servidor de dados: os planos são salvos no `localStorage` do navegador.

## Uso local

Abra `index.html` em um navegador. Para servir por HTTP durante o desenvolvimento, execute `python3 -m http.server 8000` nesta pasta e visite `http://localhost:8000`.

- **Salvar:** as alterações são salvas automaticamente; o botão **Salvar** confirma a gravação.
- **PDF A4:** clique em **Exportar PDF** e escolha **Salvar como PDF** na janela de impressão do navegador. A folha usa o formato A4.
- **Backup:** use **Exportar backup** para baixar um JSON e **Importar backup** para restaurá-lo em outro navegador. A importação substitui a biblioteca local.

## Publicação futura

O projeto é estático e pode ser colocado em um repositório GitHub e importado na Vercel sem etapa de build. Configure o diretório raiz do projeto como a raiz do repositório e deixe o comando de build vazio. O armazenamento continuará local a cada navegador; não há sincronização entre aparelhos sem um serviço de dados.

Arquivos: `index.html`, `styles.css`, `app.js` e `logobudo.jpeg`.
