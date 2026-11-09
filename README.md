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

Os 6 carros ficam num anel 3D (plataforma giratória). A cada 5 s (ou pelas setas, pontos,
teclado ← → e arrastar no celular):

1. **o carro se mexe** — arranca para frente com "agachada" da traseira, desfoque e linhas de velocidade;
2. **a plataforma gira** 60° e traz o próximo carro, enquanto o nome gigante sai e o novo entra;
3. **o novo carro chega** e assenta na suspensão.

**Por dentro (raio-X):** ao passar o mouse sobre o carro (ou tocar nele no celular), a carroceria
se abre sobre o motor e a cabine, mostrando um desenho do motor e dos bancos em laranja com
etiquetas da ficha técnica. O menu ao lado (Visão geral / Motor / Interior) fixa cada vista e
pausa a troca automática. As posições do motor e da cabine de cada foto ficam em `xray` no
`script.js`.

O autoplay pausa com o mouse sobre o showroom, com a aba oculta ou fora da tela, e respeita
`prefers-reduced-motion`.

## Estrutura

- `index.html` — marcação das seções (showroom, diferenciais, estoque, números, contato, rodapé)
- `styles.css` — estilos e responsividade
- `script.js` — dados dos carros, animação do showroom, abas, estoque, contadores e formulário
- `assets/cars/*.webp` — fotos dos carros com fundo removido (transparente)
