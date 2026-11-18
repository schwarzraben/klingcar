# Expediente Letal

Jogo de ação top-down para navegador, no estilo dos jogos policiais de mundo aberto, ambientado na sede da **KlingCar S.A.**, na Av. Paulista, em São Paulo. Você joga como Ricardo Kling, dono da empresa, e precisa defender o prédio do Grupo Vasconcelos.

## Como jogar

Abra `index.html` em qualquer navegador moderno. O jogo não precisa de build nem de servidor e funciona no computador e no celular (com controles de toque).

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

Todo o áudio é sintetizado com Web Audio, e todos os gráficos são desenhados em Canvas 2D, sem arquivos externos.
