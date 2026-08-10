// ========================================
// UI.js – Rendering, animations, interactions
// ============================================

import { Card } from './Card.js';

export class UI {
    constructor(game) {
        this.game = game;
        this.elements = {};
        this.selectedCards = new Set();
        this.discardSelection = new Set();
        this.animating = false;
        
        console.log('[UI] Constructor called');
        this._cacheElements();
        console.log('[UI] Elements cached:', Object.keys(this.elements).length);
        this._bindEvents();
        console.log('[UI] Events bound');
    }

    _cacheElements() {
        // Panels
        this.elements.tutorialPanel = document.getElementById('tutorial');
        this.elements.gamePanel = document.getElementById('game');
        this.elements.scoringPanel = document.getElementById('scoring');
        
        console.log('[UI] Panels found:', {
            tutorial: !!this.elements.tutorialPanel,
            game: !!this.elements.gamePanel,
            scoring: !!this.elements.scoringPanel
        });
        
        // Mode buttons
        this.elements.btnTutorial = document.getElementById('btn-tutorial');
        this.elements.btnGame = document.getElementById('btn-game');
        this.elements.btnScoring = document.getElementById('btn-scoring');
        
        console.log('[UI] Mode buttons found:', {
            tutorial: !!this.elements.btnTutorial,
            game: !!this.elements.btnGame,
            scoring: !!this.elements.btnScoring
        });
        
        // Game areas
        this.elements.hands = {
            0: document.getElementById('hand-0'),
            1: document.getElementById('hand-1'),
            2: document.getElementById('hand-2')
        };
        this.elements.tricks = {
            0: document.getElementById('tricks-0'),
            1: document.getElementById('tricks-1'),
            2: document.getElementById('tricks-2')
        };
        this.elements.playerAreas = {
            0: document.getElementById('player-area-0'),
            1: document.getElementById('player-area-1'),
            2: document.getElementById('player-area-2')
        };
        
        this.elements.skatCards = document.getElementById('skat-cards');
        this.elements.skatActions = document.getElementById('skat-actions');
        this.elements.skatLabel = document.getElementById('skat-label');
        
        this.elements.currentTrick = document.getElementById('current-trick');
        this.elements.trickInfo = document.getElementById('trick-info');
        
        // Controls
        this.elements.biddingControls = document.getElementById('bidding-controls');
        this.elements.discardControls = document.getElementById('discard-controls');
        this.elements.gameDeclarationControls = document.getElementById('game-declaration-controls');
        this.elements.playControls = document.getElementById('play-controls');
        this.elements.gameOverControls = document.getElementById('game-over-controls');
        
        this.elements.previewValue = document.getElementById('preview-value');
        this.elements.matadorDisplay = document.getElementById('matador-display');
        this.elements.discardHint = document.getElementById('discard-hint');
        this.elements.gameTypeOptions = document.getElementById('game-type-options');
        this.elements.playHint = document.getElementById('play-hint');
        
        // Buttons
        this.elements.btnBid = document.getElementById('btn-bid');
        this.elements.btnPass = document.getElementById('btn-pass');
        this.elements.btnConfirmDiscard = document.getElementById('btn-confirm-discard');
        this.elements.btnConfirmGame = document.getElementById('btn-confirm-game');
        this.elements.btnSortHand = document.getElementById('btn-sort-hand');
        this.elements.btnNewGame = document.getElementById('btn-new-game');
        this.elements.btnBackMenu = document.getElementById('btn-back-menu');
        
        // Game info
        this.elements.phaseDisplay = document.getElementById('phase-display');
        this.elements.declarerDisplay = document.getElementById('declarer-display');
        this.elements.gameValueDisplay = document.getElementById('game-value-display');
        this.elements.scores = {
            0: document.getElementById('score-0'),
            1: document.getElementById('score-1'),
            2: document.getElementById('score-2')
        };
        
        // Modals
        this.elements.biddingModal = document.getElementById('bidding-modal');
        this.elements.modalBiddingInfo = document.getElementById('modal-bidding-info');
        this.elements.modalBid = document.getElementById('modal-bid');
        this.elements.modalPass = document.getElementById('modal-pass');
        
        // Final scores
        this.elements.gameResult = document.getElementById('game-result');
        this.elements.finalScores = document.getElementById('final-scores');
    }

    _bindEvents() {
        // Mode switching
        this.elements.btnTutorial.addEventListener('click', () => this.switchMode('tutorial'));
        this.elements.btnGame.addEventListener('click', () => this.switchMode('game'));
        this.elements.btnScoring.addEventListener('click', () => this.switchMode('scoring'));
        
        // Bidding
        this.elements.btnBid.addEventListener('click', () => this._onBidClick());
        this.elements.btnPass.addEventListener('click', () => this._onPassClick());
        this.elements.modalBid.addEventListener('click', () => this._onModalBid());
        this.elements.modalPass.addEventListener('click', () => this._onModalPass());
        
        // Discard
        this.elements.btnConfirmDiscard.addEventListener('click', () => this._onConfirmDiscard());
        
        // Game declaration
        this.elements.btnConfirmGame.addEventListener('click', () => this._onConfirmGame());
        
        // Play
        this.elements.btnSortHand.addEventListener('click', () => this._onSortHand());
        
        // Game over
        this.elements.btnNewGame.addEventListener('click', () => this._onNewGame());
        this.elements.btnBackMenu.addEventListener('click', () => this.switchMode('tutorial'));
        
        // Card selection (delegated)
        document.addEventListener('card-select', (e) => this._onCardSelect(e));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this._onKeyDown(e));
    }

    switchMode(mode) {
        // Hide all panels
        this.elements.tutorialPanel.hidden = true;
        this.elements.gamePanel.hidden = true;
        this.elements.scoringPanel.hidden = true;
        
        // Show selected
        if (mode === 'tutorial') this.elements.tutorialPanel.hidden = false;
        if (mode === 'game') this.elements.gamePanel.hidden = false;
        if (mode === 'scoring') this.elements.scoringPanel.hidden = false;
        
        // Update button states
        this.elements.btnTutorial.classList.toggle('active', mode === 'tutorial');
        this.elements.btnGame.classList.toggle('active', mode === 'game');
        this.elements.btnScoring.classList.toggle('active', mode === 'scoring');
        
        if (mode === 'tutorial') this.renderTutorial();
        if (mode === 'scoring') this.renderScoringCalculator();
    }

    // ========================================
    // Main Render
    // ========================================
    render(state) {
        this._renderGameInfo(state);
        this._renderHands(state);
        this._renderSkat(state);
        this._renderCurrentTrick(state);
        this._renderControls(state);
        this._renderPlayerAreas(state);
    }

    _renderGameInfo(state) {
        // Phase
        const phaseLabels = {
            'DEALING': 'Karten werden gegeben...',
            'BIDDING': 'Reizen',
            'SKAT_PICKUP': 'Skat aufnehmen',
            'DISCARD': 'Drücken (2 Karten)',
            'GAME_DECLARATION': 'Spiel ansagen',
            'PLAYING': 'Spielen',
            'SCORING': 'Auswertung',
            'GAME_OVER': 'Spiel beendet'
        };
        this.elements.phaseDisplay.textContent = `Phase: ${phaseLabels[state.phase] || state.phase}`;
        
        // Declarer
        if (state.declarer) {
            this.elements.declarerDisplay.textContent = `Solist: ${state.declarer}`;
            this.elements.declarerDisplay.style.display = 'block';
        } else {
            this.elements.declarerDisplay.style.display = 'none';
        }
        
        // Game value
        if (state.gameValue > 0) {
            this.elements.gameValueDisplay.textContent = `Spielwert: ${state.gameValue}`;
            this.elements.gameValueDisplay.style.display = 'block';
        } else {
            this.elements.gameValueDisplay.style.display = 'none';
        }
        
        // Scores
        for (let i = 0; i < 3; i++) {
            const player = state.players[i];
            this.elements.scores[i].textContent = `${player.name}: ${player.score}`;
            this.elements.scores[i].classList.toggle('active', player.isDeclarer);
        }
    }

    _renderHands(state) {
        for (let i = 0; i < 3; i++) {
            const handEl = this.elements.hands[i];
            const player = state.players[i];
            
            handEl.innerHTML = '';
            
            for (const cardData of player.hand) {
                const card = Card.fromJSON(cardData);
                const isHuman = i === 0;
                const faceDown = !isHuman && !cardData.faceDown ? false : !isHuman;
                
                const cardEl = card.createElement({
                    small: false,
                    faceDown: faceDown,
                    selectable: isHuman && (state.phase === 'PLAYING' || state.phase === 'DISCARD'),
                    disabled: isHuman && state.phase === 'PLAYING' && 
                             !state.validPlays.includes(card.id)
                });
                
                handEl.appendChild(cardEl);
            }
            
            // Update trick count
            this.elements.tricks[i].textContent = `${player.trickCount} Stiche`;
        }
    }

    _renderSkat(state) {
        const skatEl = this.elements.skatCards;
        skatEl.innerHTML = '';
        
        if (state.phase === 'SKAT_PICKUP' || state.phase === 'DISCARD') {
            // Show skat cards face up for declarer
            for (const cardData of state.skat) {
                const card = Card.fromJSON(cardData);
                const cardEl = card.createElement({ selectable: false });
                skatEl.appendChild(cardEl);
            }
            this.elements.skatLabel.textContent = 'Skat (aufnehmen)';
            this.elements.skatActions.hidden = false;
        } else if (state.discarded.length > 0) {
            // Show discarded cards
            for (const cardData of state.discarded) {
                const card = Card.fromJSON(cardData);
                const cardEl = card.createElement({ small: true });
                skatEl.appendChild(cardEl);
            }
            this.elements.skatLabel.textContent = 'Skat (gedrückt)';
            this.elements.skatActions.hidden = true;
        } else {
            // Show face down
            for (let i = 0; i < 2; i++) {
                const cardEl = document.createElement('div');
                cardEl.className = 'card face-down';
                skatEl.appendChild(cardEl);
            }
            this.elements.skatLabel.textContent = 'Skat';
            this.elements.skatActions.hidden = true;
        }
    }

    _renderCurrentTrick(state) {
        const trickEl = this.elements.currentTrick;
        trickEl.innerHTML = '';
        
        for (const trick of state.currentTrick) {
            const card = Card.fromJSON(trick.card);
            const cardEl = card.createElement({ small: false });
            cardEl.classList.add('trick-card');
            cardEl.dataset.player = trick.player;
            trickEl.appendChild(cardEl);
        }
        
        // Trick info
        if (state.currentTrick.length > 0) {
            const leader = state.currentTrick[0].player;
            const leaderName = state.players[leader].name;
            this.elements.trickInfo.textContent = `${leaderName} hat angespielt`;
        } else if (state.phase === 'PLAYING') {
            const leaderName = state.players[state.trickLeader].name;
            this.elements.trickInfo.textContent = `${leaderName} ist am Zug`;
        } else {
            this.elements.trickInfo.textContent = '';
        }
    }

    _renderControls(state) {
        // Hide all control groups
        const groups = [
            this.elements.biddingControls,
            this.elements.discardControls,
            this.elements.gameDeclarationControls,
            this.elements.playControls,
            this.elements.gameOverControls
        ];
        groups.forEach(g => g.hidden = true);
        
        // Show relevant group
        switch (state.phase) {
            case 'BIDDING':
                this.elements.biddingControls.hidden = false;
                this._renderBiddingPreview(state);
                break;
            case 'DISCARD':
                this.elements.discardControls.hidden = false;
                this._updateDiscardButton();
                break;
            case 'GAME_DECLARATION':
                this.elements.gameDeclarationControls.hidden = false;
                this._renderGameTypeOptions(state);
                break;
            case 'PLAYING':
                this.elements.playControls.hidden = false;
                this._renderPlayHint(state);
                break;
            case 'GAME_OVER':
                this.elements.gameOverControls.hidden = false;
                this._renderGameOver(state);
                break;
        }
    }

    _renderBiddingPreview(state) {
        if (state.bidding && state.bidding.currentBid > 17) {
            this.elements.previewValue.textContent = state.bidding.currentBid;
            this.elements.btnBid.textContent = `Reizen (${state.bidding.currentBid + 1}+)`;
        } else {
            this.elements.previewValue.textContent = '—';
            this.elements.btnBid.textContent = 'Reizen (18)';
        }
        
        // Show possible bids as hint
        if (state.bidding) {
            const possible = state.bidding.getPossibleBids().slice(0, 5);
            this.elements.matadorDisplay.innerHTML = `Mögliche: ${possible.join(', ')}...`;
        }
    }

    _renderGameTypeOptions(state) {
        const container = this.elements.gameTypeOptions;
        container.innerHTML = '';
        
        if (!state.declarerGame) return;
        
        const gt = state.declarerGame;
        const options = [];
        
        // Generate valid declarations based on bid
        if (gt.gameType === 'suit') {
            options.push(
                { id: 'suit', label: `${gt.trumpSuit} (${gt.value})`, params: { ...gt, hand: false, schneider: false, schwarz: false, ouvert: false } },
                { id: 'suit-hand', label: `${gt.trumpSuit} Hand (${gt.value + gt.trumpSuit})`, params: { ...gt, hand: true, schneider: false, schwarz: false, ouvert: false } }
            );
        } else if (gt.gameType === 'grand') {
            options.push(
                { id: 'grand', label: `Grand (${gt.value})`, params: { ...gt, hand: false, schneider: false, schwarz: false, ouvert: false } },
                { id: 'grand-hand', label: `Grand Hand (${gt.value + 24})`, params: { ...gt, hand: true, schneider: false, schwarz: false, ouvert: false } }
            );
        } else if (gt.gameType === 'null') {
            options.push(
                { id: 'null', label: `Null (23)`, params: { gameType: 'null', hand: false, ouvert: false, value: 23 } },
                { id: 'null-hand', label: `Null Hand (35)`, params: { gameType: 'null', hand: true, ouvert: false, value: 35 } },
                { id: 'null-ouvert', label: `Null Ouvert (46)`, params: { gameType: 'null', hand: false, ouvert: true, value: 46 } }
            );
        }
        
        for (const opt of options) {
            const btn = document.createElement('button');
            btn.className = 'btn secondary game-type-option';
            btn.textContent = opt.label;
            btn.dataset.params = JSON.stringify(opt.params);
            btn.addEventListener('click', () => this._selectGameType(opt.params));
            container.appendChild(btn);
        }
    }

    _selectGameType(params) {
        // Highlight selected
        document.querySelectorAll('.game-type-option').forEach(b => b.classList.remove('selected'));
        event.target.classList.add('selected');
        this.elements.btnConfirmGame.disabled = false;
        this._pendingDeclaration = params;
    }

    _renderPlayHint(state) {
        if (state.trickLeader === 0) {
            this.elements.playHint.textContent = 'Du bist am Zug';
            if (state.currentTrick.length === 0) {
                this.elements.playHint.textContent += ' – Eröffne den Stich';
            } else {
                const leadSuit = state.currentTrick[0].card.suit;
                this.elements.playHint.textContent += ` – Farbe: ${leadSuit}`;
            }
        } else {
            this.elements.playHint.textContent = `${state.players[state.trickLeader].name} ist am Zug`;
        }
    }

    _renderGameOver(state) {
        const result = state.gameResult;
        if (!result) return;
        
        this.elements.gameResult.textContent = result.won ? '🎉 GEWONNEN!' : '😞 Verloren';
        this.elements.gameResult.style.color = result.won ? '#4caf50' : '#f44336';
        
        this.elements.finalScores.innerHTML = `
            <div><strong>${result.declarer} (Solist):</strong> ${result.declarerPoints} Augen, Score: ${result.score > 0 ? '+' : ''}${result.score}</div>
            <div><strong>Gegner:</strong> ${result.opponentPoints} Augen</div>
            ${result.schneider ? '<div>⚡ Schneider!</div>' : ''}
            ${result.schwarz ? '<div>🌑 Schwarz!</div>' : ''}
        `;
    }

    _renderPlayerAreas(state) {
        for (let i = 0; i < 3; i++) {
            const area = this.elements.playerAreas[i];
            const player = state.players[i];
            
            area.classList.toggle('active-turn', state.trickLeader === i && state.phase === 'PLAYING');
            area.classList.toggle('declarer', player.isDeclarer);
        }
    }

    _updateDiscardButton() {
        const selected = document.querySelectorAll('#hand-0 .card.selected').length;
        this.elements.btnConfirmDiscard.disabled = selected !== 2;
        this.elements.discardHint.textContent = selected === 2 
            ? '2 Karten gewählt – Bestätigen' 
            : `Wähle 2 Karten zum Drücken (${selected}/2)`;
    }

    _renderPlayerAreas(state) {
        for (let i = 0; i < 3; i++) {
            const area = this.elements.playerAreas[i];
            const player = state.players[i];
            
            area.classList.toggle('active-turn', state.trickLeader === i && state.phase === 'PLAYING');
            area.classList.toggle('declarer', player.isDeclarer);
        }
    }

    // ========================================
    // Event Handlers
    // ========================================
    _onCardSelect(event) {
        const { card, selected } = event.detail;
        
        if (this.game.currentPhase === 'PLAYING') {
            // Auto-play if valid
            const cardIndex = this.game.players[0].hand.findIndex(c => c.id === card.id);
            if (cardIndex >= 0) {
                this.game.humanPlayCard(cardIndex);
            }
        } else if (this.game.currentPhase === 'DISCARD') {
            this._updateDiscardButton();
        }
    }

    _onBidClick() {
        const state = this.game.getState();
        if (state.bidding) {
            const possible = state.bidding.getPossibleBids();
            if (possible.length > 0) {
                this.game.humanBid(possible[0]);
            }
        }
    }

    _onPassClick() {
        this.game.humanPass();
    }

    _onModalBid() {
        this.elements.biddingModal.hidden = true;
        this._onBidClick();
    }

    _onModalPass() {
        this.elements.biddingModal.hidden = true;
        this._onPassClick();
    }

    _onConfirmDiscard() {
        const selected = document.querySelectorAll('#hand-0 .card.selected');
        const indices = Array.from(selected).map(el => 
            Array.from(el.parentElement.children).indexOf(el)
        );
        this.game.humanDiscard(indices);
    }

    _onConfirmGame() {
        if (this._pendingDeclaration) {
            this.game.humanDeclareGame(this._pendingDeclaration);
            this._pendingDeclaration = null;
        }
    }

    _onSortHand() {
        this.game.players[0].sortHand();
        this.render(this.game.getState());
    }

    _onNewGame() {
        this.game.init();
    }

    _onKeyDown(event) {
        // Space to play selected card
        if (event.code === 'Space' && this.game.currentPhase === 'PLAYING') {
            const selected = document.querySelector('#hand-0 .card.selected');
            if (selected) selected.click();
        }
        // Enter to confirm discard
        if (event.code === 'Enter' && this.game.currentPhase === 'DISCARD') {
            this._onConfirmDiscard();
        }
        // Escape to close modal
        if (event.code === 'Escape') {
            this.elements.biddingModal.hidden = true;
        }
    }

    // ========================================
    // Tutorial Rendering
    // ========================================
    renderTutorial() {
        const container = document.getElementById('tutorial-content');
        container.innerHTML = `
            <div class="tutorial-step" id="tutorial-step-0">
                <h2>🃏 Willkommen beim Skat!</h2>
                <p>Skat ist das beliebteste deutsche Kartenspiel für 3 Spieler.</p>
                <p>Ziel: Als Solist (Alleinspieler) mindestens 61 Augen erreichen oder als Gegner das verhindern.</p>
                <div class="tutorial-nav">
                    <button class="btn secondary" onclick="ui.tutorialNext()">Weiter →</button>
                </div>
            </div>
        `;
        this._tutorialStep = 0;
    }

    tutorialNext() {
        this._tutorialStep++;
        this._renderTutorialStep();
    }

    _renderTutorialStep() {
        // Implementation would show interactive demos for each step
        const steps = [
            { title: 'Die 32 Karten', demo: 'cards' },
            { title: 'Kartenwerte & Augen', demo: 'values' },
            { title: 'Ausgabe & Skat', demo: 'dealing' },
            { title: 'Reizen', demo: 'bidding' },
            { title: 'Spielarten', demo: 'game-types' },
            { title: 'Stichregeln', demo: 'playing' },
            { title: 'Punkteberechnung', demo: 'scoring' }
        ];
        
        if (this._tutorialStep >= steps.length) {
            this.switchMode('game');
            return;
        }
        
        const step = steps[this._tutorialStep];
        const container = document.getElementById('tutorial-content');
        container.innerHTML = `
            <div class="tutorial-step">
                <h2>${step.title}</h2>
                <div class="interactive-demo" id="demo-${step.demo}"></div>
                <div class="tutorial-nav">
                    <button class="btn secondary" onclick="ui.tutorialPrev()">← Zurück</button>
                    <button class="btn primary" onclick="ui.tutorialNext()">${this._tutorialStep === steps.length - 1 ? '🎮 Spielen!' : 'Weiter →'}</button>
                </div>
            </div>
        `;
        
        this._initDemo(step.demo);
    }

    tutorialPrev() {
        this._tutorialStep = Math.max(0, this._tutorialStep - 1);
        this._renderTutorialStep();
    }

    _initDemo(type) {
        // Initialize interactive demos
        const demoEl = document.getElementById(`demo-${type}`);
        if (!demoEl) return;
        
        switch (type) {
            case 'cards':
                demoEl.innerHTML = '<p>Klicke auf Karten um sie zu sortieren...</p>';
                break;
            case 'values':
                demoEl.innerHTML = '<p>Punkte-Rechner: J=2, A=11, 10=10, K=4, Q=3, 9/8/7=0</p>';
                break;
            // ... more demos
        }
    }

    // ========================================
    // Scoring Calculator
    // ========================================
    renderScoringCalculator() {
        const container = document.getElementById('scoring-calculator');
        container.innerHTML = `
            <form class="scoring-form" id="scoring-form">
                <div class="form-group">
                    <label>Spielart</label>
                    <select id="score-gameType">
                        <option value="suit">Farbspiel</option>
                        <option value="grand">Grand</option>
                        <option value="null">Null</option>
                        <option value="ramsch">Ramsch</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Trumpf (bei Farbspiel)</label>
                    <select id="score-trumpSuit">
                        <option value="♣">♣ Kreuz (12)</option>
                        <option value="♠">♠ Pik (11)</option>
                        <option value="♥">♥ Herz (10)</option>
                        <option value="♦">♦ Karo (9)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Reizwert</label>
                    <input type="number" id="score-gameValue" value="18" min="18" max="59">
                </div>
                <div class="form-group">
                    <label>Matadore</label>
                    <input type="number" id="score-matadors" value="0" min="0" max="11">
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="score-hand"> Hand</label>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="score-schneider"> Schneider</label>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="score-schwarz"> Schwarz</label>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="score-ouvert"> Ouvert</label>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="score-won"> Gewonnen</label>
                </div>
                <button type="button" class="btn primary" onclick="ui.calculateScore()">Berechnen</button>
            </form>
            <div class="result-display" id="score-result">Ergebnis: —</div>
        `;
    }

    calculateScore() {
        const params = {
            gameType: document.getElementById('score-gameType').value,
            trumpSuit: document.getElementById('score-trumpSuit').value,
            gameValue: parseInt(document.getElementById('score-gameValue').value) || 18,
            matadors: parseInt(document.getElementById('score-matadors').value) || 0,
            hand: document.getElementById('score-hand').checked,
            schneider: document.getElementById('score-schneider').checked,
            schwarz: document.getElementById('score-schwarz').checked,
            ouvert: document.getElementById('score-ouvert').checked,
            won: document.getElementById('score-won').checked
        };
        
        const result = calculateScoreDetails(params);
        document.getElementById('score-result').innerHTML = `
            <strong>${result.won ? '🎉 GEWONNEN' : '😞 VERLOREN'}: ${result.total > 0 ? '+' : ''}${result.total} Punkte</strong>
            <br><small>${result.breakdown.map(b => `${b.label}: ${b.value > 0 ? '+' : ''}${b.value}`).join(' | ')}</small>
        `;
    }
}