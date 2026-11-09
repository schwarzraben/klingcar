# KLING CAR — Landing page

Landing page estática (HTML + CSS + JS puro, sem build) para a loja de carros **Kling Car**,
inspirada no layout de referência (nome gigante do modelo atrás do carro, carro em perfil,
próximo carro aparecendo nas laterais).

## Como rodar

Abra `index.html` no navegador, ou sirva a pasta:

```bash
python3 -m http.server 8000
```

## Showroom animado

A cada 5 s (ou pelas setas, pontos, teclado ← → e arrastar no celular) os carros trocam
**dirigindo**:

1. o carro atual acelera e sai pela lateral, com a traseira "agachando", desfoque de movimento,
   linhas de velocidade e as **rodas girando** na proporção da distância percorrida;
2. o próximo carro entra pelo outro lado e **freia** no centro, com a frente mergulhando na
   suspensão; voltando (seta ←), os carros andam de ré.

As rodas são recortes da própria foto (posições em `wheels` no `script.js`) que giram por cima
do carro.

**Por dentro (raio-X):** ao passar o mouse sobre o carro (ou tocar nele no celular), a carroceria
se abre sobre o motor e a cabine, mostrando um desenho do motor e dos bancos em laranja com
etiquetas da ficha técnica. O menu ao lado (Visão geral / Motor / Interior) fixa cada vista e
pausa a troca automática. As posições do motor e da cabine de cada foto ficam em `xray` no
`script.js`.

**Ficha completa:** clicar num card do estoque (ou em "Explorar" no showroom) abre a ficha do
carro: galeria com vistas Exterior / Motor / Interior, ficha técnica completa (motor, potência,
torque, câmbio, tração, 0–100, velocidade máxima, carroceria, ano-modelo, interior) e botões para
agendar test drive ou ver o carro no showroom. As setas da ficha passam para o próximo carro.

O autoplay pausa com o mouse sobre o showroom, com a aba oculta ou fora da tela, e respeita
`prefers-reduced-motion`.

## Estrutura

- `index.html` — marcação das seções (showroom, diferenciais, estoque, números, contato, rodapé)
- `styles.css` — estilos e responsividade
- `script.js` — dados dos carros, animação do showroom, abas, estoque, contadores e formulário
- `assets/cars/*.webp` — fotos dos carros com fundo removido (transparente)
