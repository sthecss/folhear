# Folhear

O **Folhear** é uma aplicação web para visualizar como um PDF pode ficar depois de impresso e encadernado. Todo o processamento acontece localmente no navegador, sem envio do documento para servidores externos.

## Acesse o projeto

O site está disponível pelo GitHub Pages:

### [Abrir o Folhear](https://sthecss.github.io/folhear/)

Para utilizar, basta selecionar um arquivo PDF do computador e escolher as opções de impressão e encadernação desejadas.

## Funcionalidades

- Carregamento de PDFs com várias páginas.

- Processamento local e privado com PDF.js.

- Visualização de capa, páginas duplas e contracapa.

- Navegação por setas, teclado, clique ou gesto de arrastar.

- Zoom e modo tela cheia.

- Formatos A4, A5 ou dimensões originais do PDF.

- Orientação retrato ou paisagem.

- Papéis de 75, 90, 120 ou 150 g/m².

- Estimativa da quantidade de folhas e da espessura do material.

- Interface responsiva para computador e celular.

## Tipos de encadernação

### Brochura

- Lombada quadrada e bloco de páginas com espessura estimada.

- Visualização fechada ou aberta em páginas duplas.

- Aceita apenas PDFs cuja quantidade de páginas seja múltipla de 4.

- Caso o arquivo não atenda à regra, o Folhear seleciona automaticamente a encadernação espiral.

### Espiral

- Furos e mola visíveis durante a visualização.

- Opções de mola preta, branca ou metálica.

- Aceita qualquer quantidade de páginas.

- Abertura em páginas duplas com animação individual das folhas.

## Visualização 3D

O modo **Objeto 3D** permite:

- Girar o livro usando o mouse ou o toque.

- Aproximar e afastar o objeto.

- Examinar capa, contracapa, lombada, espiral e bordas das folhas.

- Visualizar a espessura calculada conforme a quantidade de páginas e a gramatura.

- Navegar pelas páginas mantendo a visualização tridimensional.

Os botões **Início** e **Fim** levam diretamente à primeira página e à última página do PDF. A última página é utilizada como contracapa nos dois tipos de encadernação.

## Privacidade

O arquivo selecionado é lido diretamente pelo navegador com `File.arrayBuffer()` e PDF.js. O PDF não é enviado, armazenado ou compartilhado com nenhum servidor.

Não há backend, banco de dados, login, cookies ou serviço de armazenamento.

## Tecnologias

- HTML5

- CSS responsivo e transformações 3D

- JavaScript ES Modules

- PDF.js

- GitHub Pages

O projeto é totalmente estático e não possui etapa de build.

