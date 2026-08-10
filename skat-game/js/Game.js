// ========================================
// Game.js – Game state machine, flow, game types
// ============================================

import { Deck } from './Deck.js';
import { Player, AIPlayer, analyzeHand } from './Player.js';
import { Bidding, calculateGameValue, getPossibleGameValues, ALL_GAME_VALUES } from './Bidding.js';
import { calculateScore } from './Scoring.js';

export const PHASES = [
    'DEALING',
    'BIDDING', 
    'SKAT_PICKUP',
    'DISCARD',
    'GAME_DECLARATION',
    'PLAYING',
    'SCORING',
    'GAME_OVER'
];

export const GAME_TYPES = {
    SUIT: 'suit',
    GRAND: 'grand',
    NULL: 'null',
    NULL_OUVERT: 'null_ouvert',
    RAMSCH: 'ramsch'
};

export class Game {
    constructor(options = {}) {
        console.log('[Game] Constructor called with options:', options);
        this.options = {
            playerNames: ['Du', 'Gegner 1', 'Gegner 2'],
            aiDifficulty: 'normal',
            ...options
        };
        
        this.players = [];
        this.deck = new Deck();
        this.currentPhase = 'DEALING';
        this.currentTrick = [];
        this.trickLeader = 0;
        this.tricksPlayed = 0;
        this.skat = [];
        this.discarded = [];
        this.declarer = null;
        this.declarerGame = null;
        this.bidding = null;
        this.gameValue = 0;
        this.gameResult = null;
        this.moveHistory = [];
        
        this._createPlayers();
    }

    _createPlayers() {
        this.players = [
            new Player(this.options.playerNames[0], 0, true),
            new AIPlayer(this.options.playerNames[1], 1, this.options.aiDifficulty),
            new AIPlayer(this.options.playerNames[2], 2, this.options.aiDifficulty)
        ];
    }

    /**
     * Initialize and start new game
     */
    init() {
        console.log('[Game] init() called - starting new game');
        this._resetGame();
        this._dealCards();
        this._startBidding();
        this._emit('gameStateChanged', this.getState());
    }

    _resetGame() {
        this.deck = new Deck();
        this.currentPhase = 'DEALING';
        this.currentTrick = [];
        this.trickLeader = 0;
        this.tricksPlayed = 0;
        this.skat = [];
        this.discarded = [];
        this.declarer = null;
        this.declarerGame = null;
        this.gameValue = 0;
        this.gameResult = null;
        this.moveHistory = [];
        
        for (const player of this.players) {
            player.resetForNewGame();
        }
    }

    /**
     * Deal cards to all players
     */
    _dealCards() {
        console.log('[Game] _dealCards() - dealing cards');
        this.deck.shuffle();
        const { hands, skat } = this.deck.deal(3, 10);
        
        this.skat = skat;
        console.log('[Game] Skat cards:', this.skat.map(c => c.toString()));
        
        for (let i = 0; i < 3; i++) {
            this.players[i].receiveCards(hands[i]);
            console.log('[Game] Player', i, 'received', hands[i].length, 'cards');
        }
        
        this.currentPhase = 'BIDDING';
    }

    /**
     * Start bidding phase
     */
    _startBidding() {
        console.log('[Game] _startBidding() - starting bidding phase');
        this.bidding = new Bidding(this.players);
        this.bidding.start();
        this.currentPhase = 'BIDDING';
    }

    /**
     * Handle human player bid
     */
    humanBid(value) {
        if (this.currentPhase !== 'BIDDING') return { success: false };
        return this._processBid(0, value);
    }

    /**
     * Handle human player pass
     */
    humanPass() {
        if (this.currentPhase !== 'BIDDING') return { success: false };
        return this._processPass(0);
    }

    _processBid(playerIndex, value) {
        console.log('[Game] _processBid() playerIndex:', playerIndex, 'value:', value);
        const result = this.bidding.bid(playerIndex, value);
        
        if (result.success) {
            this.moveHistory.push({ phase: 'BIDDING', player: playerIndex, action: 'bid', value });
            
            // Process AI responses until human's turn or bidding complete
            this._processAIBidding();
            
            if (this.bidding.phase === 'DECLARING') {
                this.currentPhase = 'SKAT_PICKUP';
                this._pickupSkat();
            }
        }
        
        this._emit('gameStateChanged', this.getState());
        return result;
    }

    _processPass(playerIndex) {
        console.log('[Game] _processPass() playerIndex:', playerIndex);
        const result = this.bidding.pass(playerIndex);
        
        if (result.success) {
            this.moveHistory.push({ phase: 'BIDDING', player: playerIndex, action: 'pass' });
            
            // Process AI responses
            this._processAIBidding();
            
            if (this.bidding.phase === 'DECLARING') {
                this.currentPhase = 'SKAT_PICKUP';
                this._pickupSkat();
            }
        }
        
        this._emit('gameStateChanged', this.getState());
        return result;
    }

    /**
     * Process AI bidding until human's turn or complete
     */
    _processAIBidding() {
        while (this.bidding.phase === 'BIDDING' && this.bidding.currentBidder !== 0) {
            const aiIndex = this.bidding.currentBidder;
            const ai = this.players[aiIndex];
            
            // Get hand analysis for AI
            const analysis = analyzeHand(ai.hand);
            analysis.grandMatadors = this._analyzeGrandMatadors(ai.hand);
            
            // AI decides to bid or pass
            const possibleBids = this.bidding.getPossibleBids();
            const bid = ai.makeBid(this.bidding.currentBid, analysis);
            
            if (bid && possibleBids.includes(bid)) {
                this.bidding.bid(aiIndex, bid);
                this.moveHistory.push({ phase: 'BIDDING', player: aiIndex, action: 'bid', value: bid });
            } else {
                this.bidding.pass(aiIndex);
                this.moveHistory.push({ phase: 'BIDDING', player: aiIndex, action: 'pass' });
            }
        }
        
        // Check if bidding complete
        if (this.bidding.phase === 'DECLARING') {
            this.currentPhase = 'SKAT_PICKUP';
            this._pickupSkat();
        }
    }

    /**
     * Declarer picks up skat
     */
    _pickupSkat() {
        this.declarer = this.bidding.declarer;
        this.declarer.isDeclarer = true;
        
        // Add skat to declarer's hand
        this.declarer.hand.push(...this.skat);
        this.declarer.sortHand();
        
        this.currentPhase = 'DISCARD';
    }

    /**
     * Human discards 2 cards
     */
    humanDiscard(cardIndices) {
        if (this.currentPhase !== 'DISCARD') return { success: false };
        if (cardIndices.length !== 2) return { success: false, error: 'Genau 2 Karten wählen' };
        
        const human = this.players[0];
        if (!human.isDeclarer) return { success: false, error: 'Nicht der Solist' };
        
        // Sort indices descending to avoid index shift
        cardIndices.sort((a, b) => b - a);
        
        this.discarded = [];
        for (const idx of cardIndices) {
            const [card] = human.hand.splice(idx, 1);
            this.discarded.push(card);
        }
        
        human.sortHand();
        this.currentPhase = 'GAME_DECLARATION';
        this._emit('gameStateChanged', this.getState());
        return { success: true };
    }

    /**
     * AI discards automatically
     */
    _aiDiscard() {
        // Only if AI is declarer
        const aiDeclarer = this.players.find(p => p.isDeclarer && !p.isHuman);
        if (aiDeclarer) {
            this.discarded = aiDeclarer.chooseDiscard(this.skat);
            this.currentPhase = 'GAME_DECLARATION';
        }
    }

    /**
     * Human declares game type
     */
    humanDeclareGame(declaration) {
        if (this.currentPhase !== 'GAME_DECLARATION') return { success: false };
        
        const result = this.bidding.declareGame(declaration);
        
        if (result.success) {
            this.declarerGame = this.bidding.declarerGame;
            this.gameValue = this.declarerGame.value;
            this._setupGameType();
            this.currentPhase = 'PLAYING';
            this._emit('gameStateChanged', this.getState());
        }
        
        return result;
    }

    /**
     * AI declares game automatically
     */
    _aiDeclareGame() {
        if (this.bidding.declarer && !this.bidding.declarer.isHuman) {
            // AI chooses best game based on hand
            const analysis = analyzeHand(this.bidding.declarer.hand);
            analysis.grandMatadors = this._analyzeGrandMatadors(this.bidding.declarer.hand);
            
            const possible = getPossibleGameValues(analysis);
            const best = possible.find(g => g.value >= this.bidding.declarerBid);
            
            if (best) {
                this.bidding.declareGame(best.params);
                this.declarerGame = this.bidding.declarerGame;
                this.gameValue = this.declarerGame.value;
                this._setupGameType();
                this.currentPhase = 'PLAYING';
            }
        }
    }

    /**
     * Set trump context on all cards based on declared game
     */
    _setupGameType() {
        const gt = this.declarerGame;
        
        // Collect all cards to set trump context
        const allCards = [
            ...this.players[0].hand,
            ...this.players[1].hand,
            ...this.players[2].hand,
            ...this.discarded
        ];
        
        for (const card of allCards) {
            if (gt.gameType === 'suit') {
                card.setTrumpContext(gt.trumpSuit, 'suit');
            } else if (gt.gameType === 'grand') {
                card.setTrumpContext(null, 'grand');
            } else {
                card.setTrumpContext(null, gt.gameType);
            }
        }
        
        // Re-sort all hands
        for (const player of this.players) {
            player.sortHand();
        }
    }

    _analyzeGrandMatadors(hand) {
        const order = ['♣', '♠', '♥', '♦'];
        let matadors = 0;
        for (const suit of order) {
            if (hand.some(c => c.rank === 'J' && c.suit === suit)) {
                matadors++;
            } else break;
        }
        return matadors;
    }

    /**
     * Play a card (human)
     */
    humanPlayCard(cardIndex) {
        console.log('[Game] humanPlayCard() cardIndex:', cardIndex, 'phase:', this.currentPhase, 'trickLeader:', this.trickLeader);
        if (this.currentPhase !== 'PLAYING') return { success: false };
        if (this.trickLeader !== 0) return { success: false, error: 'Nicht am Zug' };
        
        return this._playCard(0, cardIndex);
    }

    /**
     * Play card for any player
     */
    _playCard(playerIndex, cardIndex) {
        console.log('[Game] _playCard() playerIndex:', playerIndex, 'cardIndex:', cardIndex);
        const player = this.players[playerIndex];
        const leadSuit = this.currentTrick.length > 0 ? this.currentTrick[0].card.suit : null;
        
        // Validate
        const validPlays = player.getValidPlays(leadSuit);
        if (cardIndex < 0 || cardIndex >= player.hand.length) {
            return { success: false, error: 'Ungültiger Index' };
        }
        
        const card = player.hand[cardIndex];
        if (!validPlays.includes(card)) {
            return { success: false, error: 'Karte nicht spielbar (Farbzwang!)' };
        }
        
        // Play the card
        const playedCard = player.playCard(cardIndex);
        console.log('[Game] Card played:', playedCard.toString(), 'by player', playerIndex);
        this.currentTrick.push({ player: playerIndex, card: playedCard });
        
        this.moveHistory.push({ 
            phase: 'PLAYING', 
            player: playerIndex, 
            action: 'play', 
            card: playedCard.toJSON(),
            trickNumber: this.tricksPlayed + 1
        });
        
        this._emit('cardPlayed', { player: playerIndex, card: playedCard, trick: this.currentTrick });
        
        // Check if trick complete
        if (this.currentTrick.length === 3) {
            this._completeTrick();
        } else {
            // Next player's turn
            this.trickLeader = (this.trickLeader + 1) % 3;
            this._processAIPlay();
        }
        
        this._emit('gameStateChanged', this.getState());
        return { success: true };
    }

    /**
     * Process AI plays until human's turn or game over
     */
    _processAIPlay() {
        while (this.currentPhase === 'PLAYING' && this.trickLeader !== 0) {
            const ai = this.players[this.trickLeader];
            const leadSuit = this.currentTrick.length > 0 ? this.currentTrick[0].card.suit : null;
            
            const card = ai.chooseCard(leadSuit, this.currentTrick);
            const cardIndex = ai.hand.findIndex(c => c.id === card.id);
            
            this._playCard(this.trickLeader, cardIndex);
            
            // Small delay for UX
            if (this.currentPhase !== 'PLAYING') break;
        }
    }

    /**
     * Complete current trick
     */
    _completeTrick() {
        console.log('[Game] _completeTrick() - completing trick', this.tricksPlayed + 1);
        // Determine winner
        const leadSuit = this.currentTrick[0].card.suit;
        let winnerIndex = this.currentTrick[0].player;
        let winningCard = this.currentTrick[0].card;
        
        for (let i = 1; i < 3; i++) {
            const comparison = this.currentTrick[i].card.compare(winningCard, leadSuit);
            if (comparison > 0) {
                winnerIndex = this.currentTrick[i].player;
                winningCard = this.currentTrick[i].card;
            }
        }
        
        console.log('[Game] Trick winner: player', winnerIndex, 'card:', winningCard.toString());
        
        // Winner takes trick
        const trickCards = this.currentTrick.map(t => t.card);
        this.players[winnerIndex].addTrick(trickCards);
        
        this.moveHistory.push({
            phase: 'PLAYING',
            action: 'trickComplete',
            winner: winnerIndex,
            trickCards: trickCards.map(c => c.toJSON()),
            points: trickCards.reduce((sum, c) => sum + c.value, 0)
        });
        
        this.tricksPlayed++;
        this.trickLeader = winnerIndex; // Winner leads next
        
        this._emit('trickComplete', { 
            winner: winnerIndex, 
            cards: trickCards,
            trickNumber: this.tricksPlayed 
        });
        
        // Check if game over
        if (this.tricksPlayed >= 10) {
            this._endGame();
        } else {
            // Next trick
            this.currentTrick = [];
            this._processAIPlay();
        }
        
        this._emit('gameStateChanged', this.getState());
    }

    /**
     * End game and calculate score
     */
    _endGame() {
        console.log('[Game] _endGame() - calculating final score');
        this.currentPhase = 'SCORING';
        
        const declarer = this.players.find(p => p.isDeclarer);
        const opponents = this.players.filter(p => !p.isDeclarer);
        
        // Calculate card points
        const declarerPoints = declarer.getCardPoints();
        const opponentPoints = opponents.reduce((sum, p) => sum + p.getCardPoints(), 0);
        const totalPoints = declarerPoints + opponentPoints; // Should be 120
        
        console.log('[Game] Points - Declarer:', declarerPoints, 'Opponents:', opponentPoints);
        
        // Determine game outcome
        const gt = this.declarerGame;
        let won = false;
        let schneider = false;
        let schwarz = false;
        
        if (gt.gameType === 'null' || gt.gameType === 'null_ouvert') {
            // Null: declarer wins if they take NO tricks
            won = declarer.getTrickCount() === 0;
            schwarz = won; // All tricks lost = schwarz in null
        } else {
            // Suit/Grand: declarer needs 61+ points
            won = declarerPoints >= 61;
            schneider = declarerPoints >= 90 || opponentPoints >= 90;
            schwarz = declarer.getTrickCount() === 10 || opponents.every(p => p.getTrickCount() === 0);
        }
        
        console.log('[Game] Game result - Won:', won, 'Schneider:', schneider, 'Schwarz:', schwarz);
        
        // Calculate final score
        const scoreParams = {
            gameValue: this.gameValue,
            won,
            schneider,
            schwarz,
            hand: gt.hand || false,
            ouvert: gt.ouvert || false
        };
        
        const score = calculateScore(scoreParams);
        
        // Apply scores
        declarer.score += score;
        for (const opp of opponents) {
            opp.score -= score / 2; // Each opponent gets half
        }
        
        this.gameResult = {
            declarer: declarer.name,
            declarerPoints,
            opponentPoints,
            won,
            schneider,
            schwarz,
            score,
            declarerFinalScore: declarer.score,
            opponentScores: opponents.map(p => ({ name: p.name, score: p.score }))
        };
        
        this.currentPhase = 'GAME_OVER';
        this._emit('gameOver', this.gameResult);
        this._emit('gameStateChanged', this.getState());
    }

    /**
     * Get complete game state for UI
     */
    getState() {
        return {
            phase: this.currentPhase,
            players: this.players.map(p => ({
                name: p.name,
                position: p.position,
                isHuman: p.isHuman,
                isDeclarer: p.isDeclarer,
                handCount: p.handCount,
                hand: p.isHuman ? p.getHandJSON() : p.hand.map(c => ({ ...c.toJSON(), faceDown: true })),
                trickCount: p.getTrickCount(),
                score: p.score
            })),
            skat: this.skat.map(c => c.toJSON()),
            discarded: this.discarded.map(c => c.toJSON()),
            currentTrick: this.currentTrick.map(t => ({
                player: t.player,
                card: t.card.toJSON()
            })),
            trickLeader: this.trickLeader,
            tricksPlayed: this.tricksPlayed,
            bidding: this.bidding ? this.bidding.getState() : null,
            declarer: this.declarer ? this.declarer.name : null,
            declarerGame: this.declarerGame,
            gameValue: this.gameValue,
            gameResult: this.gameResult,
            validPlays: this.players[0].getValidPlays(
                this.currentTrick.length > 0 ? this.currentTrick[0].card.suit : null
            ).map(c => c.id)
        };
    }

    // Event emitter pattern
    _listeners = {};
    
    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
    }
    
    off(event, callback) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }
    
    _emit(event, data) {
        if (!this._listeners[event]) return;
        this._listeners[event].forEach(cb => cb(data));
    }
}