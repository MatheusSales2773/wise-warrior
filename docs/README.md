# Wise Warrior: documentação

## Integrantes

| Nome completo | Matrícula | Turma |
|---|---|---|
| Guilherme Luan Silva dos Reis | UC23200423 | GPE17M80094 (turma de sábado) |
| Luís Medrado | UC23100609 | GPE17M80081 (turma de sexta) |
| Matheus Lopes | UC23200433 | GPE17M80081 (turma de sexta) |
| Matheus Sales Carvalho | UC23101276 | GPE17M80081 (turma de sexta) |
| Otton Simão | UC23101332 | GPE17M80081 (turma de sexta) |
| Raul Moreira | UC23102081 | GPE17M80081 (turma de sexta) |

**Vídeo de apresentação (YouTube, não listado):** https://youtu.be/WZKWlqQ1UQ8

## Documentos da entrega final

| Arquivo | Conteúdo |
|---|---|
| [BMC.pdf](BMC.pdf) | Business Model Canvas atualizado (versão 2.0) |
| [DADOS.pdf](DADOS.pdf) | Modelo de dados: diagrama ER e dicionário de dados |

## Arquivos editáveis

| Arquivo | Conteúdo |
|---|---|
| [dados/DADOS.md](dados/DADOS.md) | Fonte do DADOS.pdf |
| [dados/modelo-er.mmd](dados/modelo-er.mmd) | Diagrama ER em Mermaid |
| [Wise Warrior _standalone_.html](<Wise Warrior _standalone_.html>) e [Wise - Standalone Prototype.html](<Wise - Standalone Prototype.html>) | Protótipos navegáveis das telas |
| [diagrama-aws.drawio](diagrama-aws.drawio) e [diagrama-aws.drawio.png](diagrama-aws.drawio.png) | Diagrama da infraestrutura de homologação na AWS (draw.io e imagem exportada) |
| [api/openapi.yaml](api/openapi.yaml) e [api/asyncapi.yaml](api/asyncapi.yaml) | Contratos da API REST e de tempo real |

Para gerar os PDFs de novo depois de editar o `dados/DADOS.md` ou os fontes em `academico/` (Visão, Arquitetura e Interface), na raiz do repositório e com internet:

```bash
node scripts/docs-pdf.mjs   # precisa do Chromium do Playwright: npx playwright install chromium
# ou, sem instalar o navegador:
docker run --rm -v "$PWD":/w -w /w mcr.microsoft.com/playwright:v1.63.0-noble node scripts/docs-pdf.mjs
```

## Documentos produzidos ao longo do projeto

| Arquivo | Conteúdo |
|---|---|
| [Documento de Visão - Grupo 2.pdf](<Documento de Visão - Grupo 2.pdf>) | Visão do produto, versão 2.1 (fonte: [academico/visao.md](academico/visao.md)) |
| [Documento de Arquitetura de Software.pdf](<Documento de Arquitetura de Software.pdf>) | Arquitetura de software, versão 2.1 (fonte: [academico/arquitetura.md](academico/arquitetura.md)) |
| [Documentação de Interface e Prototipação.pdf](<Documentação de Interface e Prototipação.pdf>) | Interfaces e guia de prototipação, versão 2.1 (fonte: [academico/interface.md](academico/interface.md)) |
| [Pitch.pdf](Pitch.pdf) | Pitch deck |
| [BMC-v1.pdf](BMC-v1.pdf) | Business Model Canvas, versão 1.0 (primeira atividade) |
| `Wise Warrior - UC01` a `UC04` (`.docx`) | Casos de uso, versão 2.0 |
| [PRD.md](PRD.md) | Requisitos e registro de decisões de arquitetura (ADRs) |
| [cronograma.md](cronograma.md) | Cronograma |
| [plans/](plans/) e [validation/](validation/) | Planos de implementação e evidências de validação |
