// ========================================
// Bidding.js – Reizen logic, game values, bidding sequence
// ============================================

/**
 * Official Skat game values (Reizwerte)
 * Base values: ♣=12, ♠=11, ♥=10, ♦=9, Grand=24, Null=23
 * Multipliers: Game (1) + Matadors (each) + Hand (1) + Schneider (1) + Schwarz (1) + Ouvert (1)
 */

export const SUIT_BASE_VALUES = {
    '♣': 12,
    '♠': 11,
    '♥': 10,
    '♦': 9
};

export const GRAND_BASE_VALUE = 24;

export const NULL_VALUES = {
    simple: 23,
    hand: 35,
    ouvert: 46,
    hand_ouvert: 59
};

// All possible game values in ascending order (for bidding)
export const ALL_GAME_VALUES = [
    18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 45, 46, 48, 50, 54, 55, 59
];

/**
 * Calculate game value for a specific game
 * @param {Object} params
 * @returns {number} Game value (Reizwert)
 */
export function calculateGameValue(params) {
    const { gameType, trumpSuit, matadors, hand, schneider, schwarz, ouvert } = params;
    
    let baseValue = 0;
    
    if (gameType === 'suit') {
        baseValue = SUIT_BASE_VALUES[trumpSuit] || 0;
    } else if (gameType === 'grand') {
        baseValue = GRAND_BASE_VALUE;
    } else if (gameType === 'null') {
        if (ouvert && hand) return NULL_VALUES.hand_ouvert;
        if (ouvert) return NULL_VALUES.ouvert;
        if (hand) return NULL_VALUES.hand;
        return NULL_VALUES.simple;
    } else {
        return 0; // Ramsch has no bidding value
    }
    
    // Multiplier calculation
    // Base: 1 (game itself)
    // + Matadors (number of top trumps in sequence)
    // + Hand (1 if hand game)
    // + Schneider (1 if schneider announced/achieved)
    // + Schwarz (1 if schwarz announced/achieved)
    // + Ouvert (1 if ouvert)
    
    let multiplier = 1; // Game won
    
    multiplier += matadors || 0;
    if (hand) multiplier += 1;
    if (schneider) multiplier += 1;
    if (schwarz) multiplier += 1;
    if (ouvert) multiplier += 1;
    
    return baseValue * multiplier;
}

/**
 * Get all possible game values for a given hand (for bidding preview)
 * @param {Object} handAnalysis - Result from analyzeHand()
 * @param {string[]} preferredSuits - Suits player might want to play
 * @returns {Array} Array of { gameType, trumpSuit, value, params }
 */
export function getPossibleGameValues(handAnalysis, preferredSuits = ['♣', '♠', '♥', '♦']) {
    const results = [];
    
    // Suit games
    for (const suit of preferredSuits) {
        const baseValue = SUIT_BASE_VALUES[suit];
        const matadors = handAnalysis.matadors || 0;
        
        // Minimum (just game)
        results.push({
            gameType: 'suit',
            trumpSuit: suit,
            value: baseValue * (1 + matadors),
            params: { gameType: 'suit', trumpSuit: suit, matadors, hand: false, schneider: false, schwarz: false, ouvert: false },
            label: `${suit} (${baseValue} × ${1 + matadors} = ${baseValue * (1 + matadors)})`
        });
        
        // With Hand
        results.push({
            gameType: 'suit',
            trumpSuit: suit,
            value: baseValue * (2 + matadors),
            params: { gameType: 'suit', trumpSuit: suit, matadors, hand: true, schneider: false, schwarz: false, ouvert: false },
            label: `${suit} Hand (${baseValue} × ${2 + matadors} = ${baseValue * (2 + matadors)})`
        });
        
        // With Schneider
        results.push({
            gameType: 'suit',
            trumpSuit: suit,
            value: baseValue * (3 + matadors),
            params: { gameType: 'suit', trumpSuit: suit, matadors, hand: true, schneider: true, schwarz: false, ouvert: false },
            label: `${suit} Hand Schneider (${baseValue} × ${3 + matadors} = ${baseValue * (3 + matadors)})`
        });
        
        // With Schwarz
        results.push({
            gameType: 'suit',
            trumpSuit: suit,
            value: baseValue * (4 + matadors),
            params: { gameType: 'suit', trumpSuit: suit, matadors, hand: true, schneider: true, schwarz: true, ouvert: false },
            label: `${suit} Hand Schwarz (${baseValue} × ${4 + matadors} = ${baseValue * (4 + matadors)})`
        });
        
        // With Ouvert
        results.push({
            gameType: 'suit',
            trumpSuit: suit,
            value: baseValue * (5 + matadors),
            params: { gameType: 'suit', trumpSuit: suit, matadors, hand: true, schneider: true, schwarz: true, ouvert: true },
            label: `${suit} Hand Schwarz Ouvert (${baseValue} × ${5 + matadors} = ${baseValue * (5 + matadors)})`
        });
    }
    
    // Grand games
    const grandMatadors = handAnalysis.grandMatadors || handAnalysis.matadors || 0;
    
    results.push({
        gameType: 'grand',
        trumpSuit: null,
        value: GRAND_BASE_VALUE * (1 + grandMatadors),
        params: { gameType: 'grand', matadors: grandMatadors, hand: false, schneider: false, schwarz: false, ouvert: false },
        label: `Grand (${GRAND_BASE_VALUE} × ${1 + grandMatadors} = ${GRAND_BASE_VALUE * (1 + grandMatadors)})`
    });
    
    results.push({
        gameType: 'grand',
        trumpSuit: null,
        value: GRAND_BASE_VALUE * (2 + grandMatadors),
        params: { gameType: 'grand', matadors: grandMatadors, hand: true, schneider: false, schwarz: false, ouvert: false },
        label: `Grand Hand (${GRAND_BASE_VALUE} × ${2 + grandMatadors} = ${GRAND_BASE_VALUE * (2 + grandMatadors)})`
    });
    
    // ... more grand variants
    
    // Null games
    results.push({
        gameType: 'null',
        trumpSuit: null,
        value: NULL_VALUES.simple,
        params: { gameType: 'null', hand: false, ouvert: false },
        label: `Null (${NULL_VALUES.simple})`
    });
    
    results.push({
        gameType: 'null',
        trumpSuit: null,
        value: NULL_VALUES.hand,
        params: { gameType: 'null', hand: true, ouvert: false },
        label: `Null Hand (${NULL_VALUES.hand})`
    });
    
    results.push({
        gameType: 'null',
        trumpSuit: null,
        value: NULL_VALUES.ouvert,
        params: { gameType: 'null', hand: false, ouvert: true },
        label: `Null Ouvert (${NULL_VALUES.ouvert})`
    });
    
    results.push({
        gameType: 'null',
        trumpSuit: null,
        value: NULL_VALUES.hand_ouvert,
        params: { gameType: 'null', hand: true, ouvert: true },
        label: `Null Hand Ouvert (${NULL_VALUES.hand_ouvert})`
    });
    
    // Sort by value and filter valid (value >= 18)
    return results
        .filter(r => r.value >= 18)
        .sort((a, b) => a.value - b.value);
}

/**
 * Bidding state machine
 * Official sequence: Vorhand → Mittelhand → Hinterhand
 * Each can bid or pass, continuing until two pass
 */
export class Bidding {
    constructor(players) {
        this.players = players; // Array of 3 Players [0=vorhand, 1=mittelhand, 2=hinterhand]
        this.currentBid = 17; // Start below minimum
        this.currentBidder = 0; // Index of player whose turn to bid/respond
        this.declarer = null; // Player who won bidding
        this.declarerBid = 0; // Final bid value
        this.declarerGame = null; // Game type declarer will play
        this.passed = [false, false, false];
        this.phase = 'BIDDING'; // 'BIDDING', 'DECLARING', 'COMPLETE'
        this.bidHistory = [];
    }

    /**
     * Start bidding - Vorhand opens
     * @returns {Object} Current state
     */
    start() {
        this.currentBidder = 0; // Vorhand starts
        this.currentBid = 17;
        this.phase = 'BIDDING';
        this.passed = [false, false, false];
        return this.getState();
    }

    /**
     * Get current bidding state
     */
    getState() {
        return {
            currentBid: this.currentBid,
            currentBidder: this.currentBidder,
            currentPlayer: this.players[this.currentBidder],
            phase: this.phase,
            passed: [...this.passed],
            declarer: this.declarer,
            declarerBid: this.declarerBid,
            declarerGame: this.declarerGame,
            canBid: this.currentBid < 59 && !this.passed[this.currentBidder],
            mustRespond: this.currentBid > 17 // After first bid
        };
    }

    /**
     * Player makes a bid
     * @param {number} playerIndex - Index of player bidding
     * @param {number} value - Bid value
     * @returns {Object} Result { success, state, error? }
     */
    bid(playerIndex, value) {
        // Validate
        if (playerIndex !== this.currentBidder) {
            return { success: false, error: 'Nicht an der Reihe' };
        }
        if (this.passed[playerIndex]) {
            return { success: false, error: 'Bereits gepasst' };
        }
        if (value <= this.currentBid) {
            return { success: false, error: `Gebot muss höher als ${this.currentBid} sein` };
        }
        if (value > 59) {
            return { success: false, error: 'Maximaler Wert ist 59' };
        }
        if (!ALL_GAME_VALUES.includes(value)) {
            return { success: false, error: 'Ungültiger Reizwert' };
        }

        // Valid bid
        this.currentBid = value;
        this.bidHistory.push({ player: playerIndex, value, action: 'bid' });
        
        // Move to next player
        this._advanceBidder();
        
        return { success: true, state: this.getState() };
    }

    /**
     * Player passes
     * @param {number} playerIndex
     * @returns {Object} Result
     */
    pass(playerIndex) {
        if (playerIndex !== this.currentBidder) {
            return { success: false, error: 'Nicht an der Reihe' };
        }
        
        this.passed[playerIndex] = true;
        this.bidHistory.push({ player: playerIndex, value: this.currentBid, action: 'pass' });
        
        // Check if bidding is complete (two players passed)
        const activeCount = this.passed.filter(p => !p).length;
        if (activeCount <= 1) {
            this._finishBidding();
        } else {
            this._advanceBidder();
        }
        
        return { success: true, state: this.getState() };
    }

    /**
     * Advance to next player who hasn't passed
     * @private
     */
    _advanceBidder() {
        let attempts = 0;
        do {
            this.currentBidder = (this.currentBidder + 1) % 3;
            attempts++;
        } while (this.passed[this.currentBidder] && attempts < 3);
    }

    /**
     * Bidding complete - determine declarer
     * @private
     */
    _finishBidding() {
        // The player who didn't pass is declarer
        const activeIndex = this.passed.findIndex(p => !p);
        if (activeIndex !== -1) {
            this.declarer = this.players[activeIndex];
            this.declarer.isDeclarer = true;
            this.declarerBid = this.currentBid;
        }
        this.phase = 'DECLARING';
    }

    /**
     * Declarer declares their game
     * @param {Object} gameDeclaration - { gameType, trumpSuit, hand, schneider, schwarz, ouvert }
     * @returns {Object} Result
     */
    declareGame(gameDeclaration) {
        if (this.phase !== 'DECLARING') {
            return { success: false, error: 'Nicht in Ansage-Phase' };
        }
        if (!this.declarer) {
            return { success: false, error: 'Kein Solist' };
        }

        // Verify declaration matches or exceeds bid
        const value = calculateGameValue({
            gameType: gameDeclaration.gameType,
            trumpSuit: gameDeclaration.trumpSuit,
            matadors: gameDeclaration.matadors || 0,
            hand: gameDeclaration.hand || false,
            schneider: gameDeclaration.schneider || false,
            schwarz: gameDeclaration.schwarz || false,
            ouvert: gameDeclaration.ouvert || false
        });

        if (value < this.declarerBid) {
            return { success: false, error: `Ansage (${value}) unterbietet Reizwert (${this.declarerBid})` };
        }

        this.declarerGame = { ...gameDeclaration, value };
        this.phase = 'COMPLETE';
        
        return { success: true, state: this.getState() };
    }

    /**
     * Check if bidding is complete
     * @returns {boolean}
     */
    isComplete() {
        return this.phase === 'COMPLETE';
    }

    /**
     * Get possible bid values for UI
     * @returns {number[]}
     */
    getPossibleBids() {
        return ALL_GAME_VALUES.filter(v => v > this.currentBid);
    }
}

/**
 * Analyze hand for grand matadors
 * @param {Card[]} hand
 * @returns {number}
 */
export function analyzeGrandMatadors(hand) {
    const jacks = hand.filter(c => c.rank === 'J');
    if (jacks.length === 0) return 0;
    
    // Grand matadors: J♣, J♠, J♥, J♦ in sequence
    const order = ['♣', '♠', '♥', '♦'];
    let matadors = 0;
    for (const suit of order) {
        if (hand.some(c => c.rank === 'J' && c.suit === suit)) {
            matadors++;
        } else {
            break;
        }
    }
    return matadors;
}

/**
 * Get bidding position name
 * @param {number} index
 * @returns {string}
 */
export function getPositionName(index) {
    const names = ['Vorhand', 'Mittelhand', 'Hinterhand'];
    return names[index] || `Spieler ${index + 1}`;
}