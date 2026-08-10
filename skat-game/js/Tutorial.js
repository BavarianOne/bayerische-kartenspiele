// ========================================
// Tutorial.js – Interactive rule tutorial (7 steps)
// ============================================

import { Card, createDeck } from './Card.js';
import { Deck } from './Deck.js';
import { calculateScoreDetails, NULL_VALUES } from './Scoring.js';

export class Tutorial {
    constructor(ui) {
        console.log('[Tutorial] Constructor called');
        this.ui = ui;
        this.currentStep = 0;
        this.demoInstances = {};
        
        this.steps = [
            {
                id: 'cards',
                title: '🃏 Die 32 Karten',
                content: `
                    <p>Skat wird mit einem <strong>32-Karten-Blatt</strong> gespielt (französisches Blatt).</p>
                    <p>Farben: <span style="color:#d32f2f">♥ Herz</span>, <span style="color:#d32f2f">♦ Karo</span>, ♠ Pik, ♣ Kreuz</p>
                    <p>Ränge: <strong>7, 8, 9, 10, Bube, Dame, König, Ass</strong></p>
                    <p>Die <strong>Buben sind immer Trumpf</strong> (außer bei Null-Spielen)!</p>
                `,
                demo: 'card-sorting'
            },
            {
                id: 'values',
                title: '🎯 Kartenwerte & Augen',
                content: `
                    <p>Jede Karte hat einen <strong>Punktwert (Augen)</strong>:</p>
                    <table style="margin:1rem auto; text-align:center;">
                        <tr><th>Rang</th><th>Wert</th></tr>
                        <tr><td>Bube (J)</td><td><strong>2</strong></td></tr>
                        <tr><td>Ass (A)</td><td><strong>11</strong></td></tr>
                        <tr><td>10</td><td><strong>10</strong></td></tr>
                        <tr><td>König (K)</td><td><strong>4</strong></td></tr>
                        <tr><td>Dame (Q)</td><td><strong>3</strong></td></tr>
                        <tr><td>9, 8, 7</td><td><strong>0</strong></td></tr>
                    </table>
                    <p>Summe aller Karten: <strong>120 Augen</strong>. Solist braucht <strong>61+</strong> zum Gewinnen.</p>
                `,
                demo: 'points-calculator'
            },
            {
                id: 'dealing',
                title: '🎴 Ausgabe & Skat',
                content: `
                    <p><strong>Ausgabe:</strong> 3 Spieler erhalten je <strong>10 Karten</strong> (3+4+3 oder 4+3+3), <strong>2 Karten kommen in den Skat</strong> (Mitte).</p>
                    <p>Der Geber wechselt im Uhrzeigersinn. <strong>Vorhand</strong> (links vom Geber) eröffnet das Reizen.</p>
                    <p>Der Solist (Gewinner des Reizens) <strong>nimmt den Skat auf</strong> und drückt <strong>2 Karten</strong> wieder verdeckt weg.</p>
                `,
                demo: 'deal-animation'
            },
            {
                id: 'bidding',
                title: '🗣️ Reizen (Bieten)',
                content: `
                    <p>Reizen bestimmt den <strong>Solisten</strong> und den <strong>Spielwert</strong>.</p>
                    <p><strong>Reihenfolge:</strong> Vorhand → Mittelhand → Hinterhand</p>
                    <p>Man kann <strong>bieten</strong> (Zahl nennen) oder <strong>passen</strong>. Wer zuletzt nicht passt, wird Solist.</p>
                    <p>Der Solist muss ein Spiel ansagen, dessen Wert <strong>mindestens seinem Gebot</strong> entspricht.</p>
                    <p>Mögliche Werte: <strong>18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 45, 46, 48, 50, 54, 55, 59</strong></p>
                `,
                demo: 'bidding-simulator'
            },
            {
                id: 'game-types',
                title: '🎮 Spielarten',
                content: `
                    <p><strong>Farbspiel:</strong> Eine Farbe ist Trumpf + alle 4 Buben. Basiswerte: ♣12 ♠11 ♥10 ♦9</p>
                    <p><strong>Grand:</strong> Nur die 4 Buben sind Trumpf. Basiswert: 24</p>
                    <p><strong>Null:</strong> Keine Trümpfe, Solist darf <strong>keinen Stich</strong> machen. Werte: 23/35/46/59</p>
                    <p><strong>Null Ouvert:</strong> Wie Null, aber Solist spielt <strong>offene Hand</strong>.</p>
                    <p><strong>Ramsch:</strong> Wenn alle passen – Augen zählen negativ, wenigste Augen gewinnt.</p>
                `,
                demo: 'game-type-picker'
            },
            {
                id: 'playing',
                title: '🃏 Stichregeln',
                content: `
                    <p><strong>Farbzwang:</strong> Man muss die angespielte Farbe bedienen, wenn man sie hat.</p>
                    <p><strong>Trumpfzwang:</strong> Kann man nicht folgen, muss man trumpfen (wenn man Trumpf hat).</p>
                    <p><strong>Stichentscheidung:</strong> Höchster Trumpf gewinnt, sonst höchste Karte der angespielten Farbe.</p>
                    <p><strong>Der Stichgewinner führt zum nächsten Stich an.</strong></p>
                    <p>Nach 10 Stichen ist das Spiel zu Ende.</p>
                `,
                demo: 'trick-demo'
            },
            {
                id: 'scoring',
                title: '📊 Punkteberechnung',
                content: `
                    <p><strong>Gewonnen:</strong> Spielwert × (1 + Matadore + Hand + Schneider + Schwarz + Ouvert)</p>
                    <p><strong>Verloren:</strong> <strong>Doppelt negativ</strong> = -2 × Spielwert × Multiplikator</p>
                    <p><strong>Matadore:</strong> Ununterbrochene Folge der höchsten Trümpfe (ab J♣)</p>
                    <p><strong>Schneider:</strong> 90+ Augen (oder Gegner 90+), <strong>Schwarz:</strong> Alle 10 Stiche</p>
                    <p><strong>Null:</strong> Feste Werte (23/35/46/59), verloren = doppelt negativ</p>
                `,
                demo: 'score-calculator'
            }
        ];
    }

    start() {
            console.log('[Tutorial] start() called');
            this.currentStep = 0;
            // Don't call ui.switchMode - we render directly into the tutorial panel
            const tutorialPanel = document.getElementById('tutorial');
            console.log('[Tutorial] tutorialPanel found:', !!tutorialPanel);
            if (tutorialPanel) {
                tutorialPanel.hidden = false;
                console.log('[Tutorial] tutorialPanel.hidden set to false');
                console.log('[Tutorial] tutorialPanel style.display:', tutorialPanel.style.display);
                console.log('[Tutorial] tutorialPanel computed hidden:', tutorialPanel.hidden);
            } else {
                console.error('[Tutorial] tutorialPanel NOT FOUND!');
            }
            // Hide other panels
            const gamePanel = document.getElementById('game');
            const scoringPanel = document.getElementById('scoring');
            if (gamePanel) gamePanel.hidden = true;
            if (scoringPanel) scoringPanel.hidden = true;
        
            // Update mode buttons
            const btnTutorial = document.getElementById('btn-tutorial');
            const btnGame = document.getElementById('btn-game');
            const btnScoring = document.getElementById('btn-scoring');
            if (btnTutorial) btnTutorial.classList.add('active');
            if (btnGame) btnGame.classList.remove('active');
            if (btnScoring) btnScoring.classList.remove('active');
        
            // Check tutorial-content
            const content = document.getElementById('tutorial-content');
            console.log('[Tutorial] tutorial-content element:', !!content);
            if (content) {
                console.log('[Tutorial] content innerHTML length before:', content.innerHTML.length);
            }
        
            // DEBUG: Add visual indicator
            this._addDebugInfo('Tutorial started, step: ' + this.currentStep);
        
            // Force render
            this.renderStep();
            console.log('[Tutorial] start() completed');
        }
    
    _addDebugInfo(msg) {
        const debugDiv = document.getElementById('tutorial-debug') || document.createElement('div');
        debugDiv.id = 'tutorial-debug';
        debugDiv.style.cssText = 'position:fixed;bottom:10px;right:10px;background:#333;color:#0f0;padding:10px;z-index:10000;font-family:monospace;font-size:0.7rem;max-width:300px;';
        debugDiv.textContent = msg + '\n' + (debugDiv.textContent || '');
        document.body.appendChild(debugDiv);
    }

    renderStep() {
        console.log('[Tutorial] renderStep() called, currentStep:', this.currentStep);
        const step = this.steps[this.currentStep];
        const container = document.getElementById('tutorial-content');
        console.log('[Tutorial] container found:', !!container);
        
        if (!container) {
            console.error('[Tutorial] tutorial-content element NOT FOUND!');
            return;
        }
        
        container.innerHTML = `
            <div class="tutorial-step">
                <h2>${step.title}</h2>
                <div class="step-content">${step.content}</div>
                <div class="interactive-demo" id="demo-${step.demo}"></div>
                <div class="tutorial-nav">
                    <button class="btn secondary" onclick="tutorial.prevStep()" ${this.currentStep === 0 ? 'disabled' : ''}>← Zurück</button>
                    <span class="step-indicator">${this.currentStep + 1} / ${this.steps.length}</span>
                    <button class="btn primary" onclick="tutorial.nextStep()">
                        ${this.currentStep === this.steps.length - 1 ? '🎮 Jetzt Spielen!' : 'Weiter →'}
                    </button>
                </div>
            </div>
        `;
        console.log('[Tutorial] HTML injected into container');
        
        // Initialize demo
        setTimeout(() => this.initDemo(step.demo), 50);
    }

    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.renderStep();
        } else {
            // Tutorial complete -> switch to game
            this.ui.switchMode('game');
            this.ui.game.init();
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.renderStep();
        }
    }

    initDemo(type) {
            console.log('[Tutorial] initDemo called with type:', type);
            const demoEl = document.getElementById(`demo-${type}`);
            console.log('[Tutorial] demo element found:', !!demoEl);
            if (!demoEl) return;
        
            console.log('[Tutorial] initializing demo type:', type);
            switch (type) {
            case 'card-sorting':
                this._demoCardSorting(demoEl);
                break;
            case 'points-calculator':
                this._demoPointsCalculator(demoEl);
                break;
            case 'deal-animation':
                this._demoDealAnimation(demoEl);
                break;
            case 'bidding-simulator':
                this._demoBiddingSimulator(demoEl);
                break;
            case 'game-type-picker':
                this._demoGameTypePicker(demoEl);
                break;
            case 'trick-demo':
                this._demoTrick(demoEl);
                break;
            case 'score-calculator':
                this._demoScoreCalculator(demoEl);
                break;
        }
    }

    _demoCardSorting(container) {
        const deck = new Deck();
        deck.shuffle();
        const hand = deck.cards.slice(0, 10);
        
        // Set trump context for demo
        for (const card of hand) {
            card.setTrumpContext('♥', 'suit');
        }
        hand.sort((a, b) => {
            if (a.isTrump !== b.isTrump) return a.isTrump ? -1 : 1;
            return (a.order || 99) - (b.order || 99);
        });

        container.innerHTML = `
            <p>Klicke auf Karten zum Auswählen. "Sortieren" ordnet nach Trumpf-Reihenfolge.</p>
            <div class="hand" id="demo-hand" style="display:flex; gap:4px; flex-wrap:wrap; justify-content:center; margin:1rem 0;"></div>
            <button class="btn secondary" onclick="tutorial._sortDemoHand()">Sortieren</button>
            <button class="btn secondary" onclick="tutorial._shuffleDemoHand()">Mischen</button>
        `;
        
        this._renderCards('demo-hand', hand);
        this._demoHand = hand;
    }

    _renderCards(containerId, cards) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        for (const card of cards) {
            const el = card.createElement({ selectable: true });
            container.appendChild(el);
        }
    }

    _sortDemoHand() {
        this._demoHand.sort((a, b) => {
            if (a.isTrump !== b.isTrump) return a.isTrump ? -1 : 1;
            return (a.order || 99) - (b.order || 99);
        });
        this._renderCards('demo-hand', this._demoHand);
    }

    _shuffleDemoHand() {
        const deck = new Deck();
        deck.shuffle();
        this._demoHand = deck.cards.slice(0, 10);
        for (const card of this._demoHand) {
            card.setTrumpContext('♥', 'suit');
        }
        this._renderCards('demo-hand', this._demoHand);
    }

    _demoPointsCalculator(container) {
        container.innerHTML = `
            <p>Klicke auf Karten, um Punkte zu addieren:</p>
            <div class="hand" id="demo-points-cards" style="display:flex; gap:4px; flex-wrap:wrap; justify-content:center; margin:1rem 0;"></div>
            <div style="font-size:1.5rem; color:var(--gold);" id="demo-points-total">Gesamt: 0 Augen</div>
        `;
        
        // Create sample cards
        const sampleCards = [
            new Card('♥', 'A'), new Card('♠', '10'), new Card('♣', 'K'),
            new Card('♦', 'Q'), new Card('♥', 'J'), new Card('♠', '9')
        ];
        for (const card of sampleCards) {
            card.setTrumpContext('♥', 'suit');
        }
        
        this._renderCards('demo-points-cards', sampleCards);
        
        // Add click handler
        setTimeout(() => {
            document.querySelectorAll('#demo-points-cards .card').forEach(el => {
                el.addEventListener('click', () => {
                    el.classList.toggle('selected');
                    this._updatePointsTotal();
                });
            });
        }, 100);
    }

    _updatePointsTotal() {
        const selected = document.querySelectorAll('#demo-points-cards .card.selected');
        let total = 0;
        selected.forEach(el => {
            const rank = el.dataset.rank;
            const values = { 'J': 2, 'A': 11, '10': 10, 'K': 4, 'Q': 3, '9': 0, '8': 0, '7': 0 };
            total += values[rank] || 0;
        });
        document.getElementById('demo-points-total').textContent = `Gesamt: ${total} Augen`;
    }

    _demoDealAnimation(container) {
        container.innerHTML = `
            <p>Animation der Kartenausgabe (3 Spieler + Skat):</p>
            <div id="deal-animation-area" style="display:flex; justify-content:center; gap:2rem; flex-wrap:wrap; margin:1rem 0;"></div>
            <button class="btn primary" onclick="tutorial._runDealAnimation()">Neue Ausgabe</button>
        `;
        this._runDealAnimation();
    }

    _runDealAnimation() {
        const area = document.getElementById('deal-animation-area');
        area.innerHTML = '<div style="color:var(--gold);">Gebe Karten...</div>';
        
        const deck = new Deck();
        deck.shuffle();
        const { hands, skat } = deck.deal(3, 10);
        
        setTimeout(() => {
            area.innerHTML = '';
            
            const positions = ['Vorhand (Du)', 'Mittelhand', 'Hinterhand'];
            hands.forEach((hand, i) => {
                const div = document.createElement('div');
                div.style.textAlign = 'center';
                div.innerHTML = `<strong>${positions[i]}</strong><br>`;
                const handDiv = document.createElement('div');
                handDiv.style.display = 'flex';
                handDiv.style.justifyContent = 'center';
                handDiv.style.gap = '4px';
                handDiv.style.flexWrap = 'wrap';
                
                for (const card of hand) {
                    handDiv.appendChild(card.createElement({ small: true }));
                }
                div.appendChild(handDiv);
                area.appendChild(div);
            });
            
            // Skat
            const skatDiv = document.createElement('div');
            skatDiv.style.textAlign = 'center';
            skatDiv.style.marginTop = '1rem';
            skatDiv.innerHTML = '<strong>Skat</strong><br>';
            const skatHand = document.createElement('div');
            skatHand.style.display = 'flex';
            skatHand.style.justifyContent = 'center';
            skatHand.style.gap = '4px';
            for (const card of skat) {
                skatHand.appendChild(card.createElement({ small: true }));
            }
            skatDiv.appendChild(skatHand);
            area.appendChild(skatDiv);
        }, 500);
    }

    _demoBiddingSimulator(container) {
        container.innerHTML = `
            <p>Simuliere Reizen: Klicke auf "Bieten" oder "Passen"</p>
            <div id="bidding-state" style="margin:1rem 0; padding:1rem; background:rgba(0,0,0,0.2); border-radius:8px;">
                <div>Aktueller Wert: <strong id="bid-value">17</strong></div>
                <div>Am Zug: <strong id="bid-player">Vorhand (Du)</strong></div>
                <div>Mögliche Gebote: <span id="bid-possible">18, 20, 22, 23, 24...</span></div>
            </div>
            <div style="display:flex; gap:0.5rem;">
                <button class="btn primary" onclick="tutorial._simBid()">Bieten (${document.getElementById('bid-value').textContent})</button>
                <button class="btn secondary" onclick="tutorial._simPass()">Passen</button>
                <button class="btn secondary" onclick="tutorial._resetBidding()">Neustart</button>
            </div>
        `;
        
        this._biddingState = { currentBid: 17, currentPlayer: 0, passed: [false, false, false] };
    }

    _simBid() {
        const possible = [18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 45, 46, 48, 50, 54, 55, 59];
        const next = possible.find(v => v > this._biddingState.currentBid);
        if (!next) return;
        
        this._biddingState.currentBid = next;
        this._biddingState.currentPlayer = (this._biddingState.currentPlayer + 1) % 3;
        this._updateBiddingDisplay();
        
        // Auto AI response
        setTimeout(() => {
            if (this._biddingState.currentPlayer !== 0 && Math.random() > 0.3) {
                this._simBid();
            } else {
                this._simPass();
            }
        }, 800);
    }

    _simPass() {
        this._biddingState.passed[this._biddingState.currentPlayer] = true;
        const active = this._biddingState.passed.filter(p => !p).length;
        
        if (active <= 1) {
            document.getElementById('bid-player').textContent = 'Reizen beendet!';
            document.getElementById('bid-value').textContent = this._biddingState.currentBid;
            return;
        }
        
        this._biddingState.currentPlayer = (this._biddingState.currentPlayer + 1) % 3;
        while (this._biddingState.passed[this._biddingState.currentPlayer]) {
            this._biddingState.currentPlayer = (this._biddingState.currentPlayer + 1) % 3;
        }
        this._updateBiddingDisplay();
    }

    _resetBidding() {
        this._biddingState = { currentBid: 17, currentPlayer: 0, passed: [false, false, false] };
        this._updateBiddingDisplay();
    }

    _updateBiddingDisplay() {
        const names = ['Vorhand (Du)', 'Mittelhand', 'Hinterhand'];
        document.getElementById('bid-value').textContent = this._biddingState.currentBid;
        document.getElementById('bid-player').textContent = names[this._biddingState.currentPlayer] + (this._biddingState.passed[this._biddingState.currentPlayer] ? ' (passed)' : '');
        
        const possible = [18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 45, 46, 48, 50, 54, 55, 59]
            .filter(v => v > this._biddingState.currentBid).slice(0, 5);
        document.getElementById('bid-possible').textContent = possible.join(', ') + '...';
    }

    _demoGameTypePicker(container) {
        container.innerHTML = `
            <p>Wähle ein Spiel und sieh den Wert:</p>
            <div style="display:flex; flex-wrap:wrap; gap:0.5rem; justify-content:center; margin:1rem 0;" id="game-type-buttons"></div>
            <div id="game-type-detail" style="margin:1rem 0; padding:1rem; background:rgba(0,0,0,0.2); border-radius:8px; min-height:80px;">
                Wähle links ein Spiel...
            </div>
        `;
        
        const games = [
            { type: 'suit', suit: '♣', base: 12, label: '♣ Kreuz' },
            { type: 'suit', suit: '♠', base: 11, label: '♠ Pik' },
            { type: 'suit', suit: '♥', base: 10, label: '♥ Herz' },
            { type: 'suit', suit: '♦', base: 9, label: '♦ Karo' },
            { type: 'grand', base: 24, label: 'Grand' },
            { type: 'null', base: 23, label: 'Null' },
            { type: 'null', base: 35, label: 'Null Hand', hand: true },
            { type: 'null', base: 46, label: 'Null Ouvert', ouvert: true },
            { type: 'null', base: 59, label: 'Null Hand Ouvert', hand: true, ouvert: true }
        ];
        
        const btnContainer = document.getElementById('game-type-buttons');
        games.forEach(g => {
            const btn = document.createElement('button');
            btn.className = 'btn secondary';
            btn.textContent = `${g.label} (${g.base}${g.hand ? ' H' : ''}${g.ouvert ? ' O' : ''})`;
            btn.onclick = () => this._showGameTypeDetail(g);
            btnContainer.appendChild(btn);
        });
    }

    _showGameTypeDetail(game) {
        const detail = document.getElementById('game-type-detail');
        let html = `<strong>${game.label}</strong>: Basiswert ${game.base}`;
        
        if (game.type === 'suit') {
            html += `<br>Mit 1 Matador: ${game.base * 2} | Hand: ${game.base * 3} | Schneider: ${game.base * 4} | Schwarz: ${game.base * 5}`;
        } else if (game.type === 'grand') {
            html += `<br>Hand: ${game.base * 2} | Mit Matadoren steigt der Wert`;
        } else if (game.type === 'null') {
            html += `<br>Feste Werte: ${NULL_VALUES.simple} / ${NULL_VALUES.hand} / ${NULL_VALUES.ouvert} / ${NULL_VALUES.hand_ouvert}`;
        }
        
        detail.innerHTML = html;
    }

    _demoTrick(container) {
        container.innerHTML = `
            <p>Simuliere einen Stich: Klicke auf Karten zum Ausspielen</p>
            <div id="trick-demo-area" style="margin:1rem 0;"></div>
            <button class="btn primary" onclick="tutorial._newTrickDemo()">Neuer Stich</button>
        `;
        this._newTrickDemo();
    }

    _newTrickDemo() {
        const area = document.getElementById('trick-demo-area');
        const deck = new Deck();
        deck.shuffle();
        
        // Create a sample trick
        const leadCard = new Card('♥', 'A');
        const followCard = new Card('♥', '10');
        const trumpCard = new Card('♣', 'J'); // Trump!
        
        for (const c of [leadCard, followCard, trumpCard]) {
            c.setTrumpContext('♥', 'suit');
        }
        
        const winner = trumpCard.compare(followCard, '♥') > 0 && trumpCard.compare(leadCard, '♥') > 0 ? 'Trumpf gewinnt!' : 'Farbe gewinnt';
        
        area.innerHTML = `
            <div style="display:flex; justify-content:center; gap:1rem; margin:1rem 0;">
                <div style="text-align:center;">
                    <div>Ansage: ${leadCard.rank}${leadCard.suit}</div>
                    ${leadCard.createElement({}).outerHTML}
                </div>
                <div style="text-align:center;">
                    <div>Spieler 2: ${followCard.rank}${followCard.suit}</div>
                    ${followCard.createElement({}).outerHTML}
                </div>
                <div style="text-align:center;">
                    <div>Spieler 3: ${trumpCard.rank}${trumpCard.suit} ⭐</div>
                    ${trumpCard.createElement({}).outerHTML}
                </div>
            </div>
            <div style="text-align:center; font-size:1.2rem; color:var(--gold); margin:1rem 0;">
                🏆 ${winner}
            </div>
            <p><strong>Regel:</strong> Trumpf sticht Farbe. Höchster Trumpf (J♣ > J♠ > J♥ > J♦) gewinnt.</p>
        `;
    }

    _demoScoreCalculator(container) {
        container.innerHTML = `
            <p>Teste die Punkteberechnung:</p>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin:1rem 0;">
                <div>
                    <label>Spielwert: <input type="number" id="demo-game-value" value="18" min="18" max="59"></label>
                </div>
                <div>
                    <label>Matadore: <input type="number" id="demo-matadors" value="1" min="0" max="11"></label>
                </div>
                <div>
                    <label><input type="checkbox" id="demo-hand"> Hand</label>
                </div>
                <div>
                    <label><input type="checkbox" id="demo-schneider"> Schneider</label>
                </div>
                <div>
                    <label><input type="checkbox" id="demo-schwarz"> Schwarz</label>
                </div>
                <div>
                    <label><input type="checkbox" id="demo-won"> Gewonnen</label>
                </div>
            </div>
            <button class="btn primary" onclick="tutorial._calcDemoScore()">Berechnen</button>
            <div id="demo-score-result" style="margin:1rem 0; padding:1rem; background:rgba(0,0,0,0.2); border-radius:8px; font-size:1.2rem; color:var(--gold);">
                Ergebnis: —
            </div>
        `;
    }

    _calcDemoScore() {
        const params = {
            gameType: 'suit',
            gameValue: parseInt(document.getElementById('demo-game-value').value) || 18,
            matadors: parseInt(document.getElementById('demo-matadors').value) || 0,
            hand: document.getElementById('demo-hand').checked,
            schneider: document.getElementById('demo-schneider').checked,
            schwarz: document.getElementById('demo-schwarz').checked,
            ouvert: false,
            won: document.getElementById('demo-won').checked
        };
        
        const result = calculateScoreDetails(params);
        const el = document.getElementById('demo-score-result');
        el.innerHTML = `
            <strong>${result.won ? '🎉 GEWONNEN' : '😞 VERLOREN'}: ${result.total > 0 ? '+' : ''}${result.total} Punkte</strong>
            <br><small>Multiplikator: ${result.multiplier} × Reizwert ${params.gameValue} = ${params.gameValue * result.multiplier}${result.won ? '' : ' (doppelt)'}</small>
            <br><small>${result.breakdown.map(b => `${b.label}: ${b.value > 0 ? '+' : ''}${b.value}`).join(' | ')}</small>
        `;
    }
}