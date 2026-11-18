# Expediente Letal

Jogo de ação top-down para navegador, no estilo dos jogos policiais de mundo aberto, ambientado na sede da **KlingCar S.A.**, na Av. Paulista, em São Paulo. Você joga como Ricardo Kling, dono da empresa, e precisa defender o prédio do Grupo Vasconcelos.

## Como jogar

Há duas versões com as mesmas missões, armas e progresso salvo:

- **`3d.html`**: terceira pessoa com câmera por cima do ombro, feita com Three.js (carregado do cdnjs).
- **`index.html`**: vista de cima em 2D, sem dependências.

Abra o arquivo em qualquer navegador moderno. Não precisa de build nem de servidor, e as duas versões funcionam no computador e no celular (com controles de toque).

### Controles da versão 3D

| Tecla | Ação |
| --- | --- |
| Clique | Prende o mouse para controlar a câmera |
| WASD | Andar (Shift corre) |
| Mouse | Olhar; botão esquerdo atira |
| Botão direito | Mirar com precisão (aproxima a câmera) |
| 1, 2, 3 / roda / Q | Trocar de arma |
| R | Recarregar |
| E (segurar) | Interagir / invadir terminal |
| Esc / P | Pausar |

### Controles da versão 2D

| Tecla | Ação |
| --- | --- |
| WASD / setas | Mover (Shift corre) |
| Mouse | Mirar e atirar |
| 1, 2, 3 / roda do mouse / Q | Trocar de arma |
| R | Recarregar |
| E (segurar) | Interagir / invadir terminal |
| Esc / P | Pausar |

## Missões

| Dificuldade | Missão | Local | Objetivo | Arsenal (3 armas) |
| --- | --- | --- | --- | --- |
| Fácil | Papelada Perdida | 12º andar, administrativo | Recuperar 3 pastas de contratos e voltar ao elevador | Taco de Golfe, Grampeador Pneumático, Pistola .380 |
| Média | Auditoria Hostil | 7º andar, data center | Invadir 3 terminais sob alarme e fugir pelo elevador | Pistola .380, Escopeta 12, Extintor de Incêndio |
| Difícil | Aquisição Hostil | Cobertura, 30º andar | Eliminar Otávio Vasconcelos e chegar ao heliponto em 5 minutos | Submetralhadora, Fuzil de Assalto, Granadas |

## Sistemas

- **Nível de alerta (estrelas):** tiros barulhentos, abates e ser visto aumentam as estrelas. A partir de 3 estrelas chegam reforços pelas escadas. Fique fora da vista para o alerta baixar.
- **IA dos inimigos:** patrulha, cone de visão, audição de disparos, busca por caminho (flow field), troca de posição e tiro só com linha de fogo livre.
- **Cenário destrutível:** vidros das divisórias quebram com tiros e explosões; mesas servem de cobertura.
- **HUD:** minimapa, vida e colete, dinheiro em R$, munição, objetivo, setas de navegação e barra de vida do chefe.
- **Progresso:** melhores tempos e patrimônio acumulado ficam salvos no navegador.

## Arquivos

- `data.js`: missões, mapas, armas e inimigos, compartilhados pelas duas versões.
- `game.js`: motor 2D (Canvas).
- `game3d.js`: motor 3D (Three.js r128), com a mesma simulação e renderização em terceira pessoa.

Todo o áudio é sintetizado com Web Audio, e todos os gráficos são desenhados em Canvas 2D, sem arquivos externos.
