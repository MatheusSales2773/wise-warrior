# Fontes locais

Os TTF desta pasta são instâncias estáticas, sem eixos variáveis, geradas dos
arquivos oficiais do repositório [Google Fonts](https://github.com/google/fonts):

- Cinzel: pesos 600 e 700;
- Inter: pesos 400, 500, 600 e 700, com tamanho óptico 18;
- JetBrains Mono: pesos 500 e 600.

As fontes são empacotadas no aplicativo e nunca são baixadas em runtime. As
licenças SIL Open Font License 1.1 de cada família permanecem versionadas ao lado
dos arquivos. Os nomes internos e de arquivo são aliases únicos por peso. O
plugin nativo e o `useFonts` da Web usam os mesmos aliases, impedindo que algum
peso ausente seja sintetizado.
