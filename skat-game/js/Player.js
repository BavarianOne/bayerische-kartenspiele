// ========================================
// Player.js – Player class, hand management, valid plays
// ============================================

import { Card } from './Card.js';

export class Player {
    constructor(name, position, isHuman = false) {
        this.name = name;
        this.position = position;        // 0 = human (vorhand), 1 = mittelhand, 2 = hinterhand
        this.isHuman = isHuman;
        this.hand = [];                  // Card[]
        this.tricks = [];                // Won tricks (each trick is Card[])
        this.score = 0;                  // Total game score
        this.isDeclarer = false;         // Whether this player won bidding
        this.isDealer = false;           // Whether this player dealt
    }

    /**
     * Receive cards and sort hand
     * @param {Card[]} cards
     */
    receiveCards(cards) {
        this.hand = cards;
        this.sortHand();
    }

    /**
     * Sort hand by suit and trump order
     * Requires cards to have trump context set
     */
    sortHand() {
        this.hand.sort((a, b) => {
            // Trumps first
            if (a.isTrump !== b.isTrump) {
                return a.isTrump ? -1 : 1;
            }
            // Then by order (lower = higher rank)
            if (a.order !== null && b.order !== null) {
                return a.order - b.order;
            }
            // Fallback: suit then rank
            const suitOrder = { '♣': 0, '♠': 1, '♥': 2, '♦': 3 };
            const rankOrder = { '7': 0, '8': 1, '9': 2, '10': 3, 'J': 4, 'Q': 5, 'K': 6, 'A': 7 };
            const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
            if (suitDiff !== 0) return suitDiff;
            return rankOrder[a.rank] - rankOrder[b.rank];
        });
    }

    /**
     * Get valid cards that can be played on current trick
     * @param {string|null} leadSuit - Suit led (null if first card)
     * @returns {Card[]}
     */
    getValidPlays(leadSuit) {
        if (!leadSuit) {
            return [...this.hand]; // Can play any card
        }
        
        // Must follow suit if possible
        const sameSuit = this.hand.filter(c => c.suit === leadSuit);
        if (sameSuit.length > 0) {
            return sameSuit;
        }
        
        // No cards of lead suit - can play anything
        return [...this.hand];
    }

    /**
     * Play a card from hand
     * @param {number} cardIndex - Index in hand array
     * @returns {Card|null} Played card or null if invalid
     */
    playCard(cardIndex) {
        if (cardIndex < 0 || cardIndex >= this.hand.length) {
            return null;
        }
        const [card] = this.hand.splice(cardIndex, 1);
        return card;
    }

    /**
     * Play a specific card by ID
     * @param {string} cardId
     * @returns {Card|null}
     */
    playCardById(cardId) {
        const index = this.hand.findIndex(c => c.id === cardId);
        return this.playCard(index);
    }

    /**
     * Add won trick to player's tricks
     * @param {Card[]} trickCards
     */
    addTrick(trickCards) {
        this.tricks.push(trickCards);
    }

    /**
     * Calculate total card points in won tricks
     * @returns {number}
     */
    getCardPoints() {
        let points = 0;
        for (const trick of this.tricks) {
            for (const card of trick) {
                points += card.value;
            }
        }
        return points;
    }

    /**
     * Get number of tricks won
     * @returns {number}
     */
    getTrickCount() {
        return this.tricks.length;
    }

    /**
     * Clear hand and tricks for new game
     */
    resetForNewGame() {
        this.hand = [];
        this.tricks = [];
        this.isDeclarer = false;
    }

    /**
     * Get hand as JSON-serializable array
     * @returns {Object[]}
     */
    getHandJSON() {
        return this.hand.map(c => c.toJSON());
    }

    /**
     * Get tricks as JSON
     * @returns {Object[][]}
     */
    getTricksJSON() {
        return this.tricks.map(trick => trick.map(c => c.toJSON()));
    }

    /**
     * Load hand from JSON
     * @param {Object[]} cardsJson
     */
    loadHandFromJSON(cardsJson) {
        this.hand = cardsJson.map(json => Card.fromJSON(json));
        this.sortHand();
    }

    /**
     * Check if player has a specific card
     * @param {string} cardId
     * @returns {boolean}
     */
    hasCard(cardId) {
        return this.hand.some(c => c.id === cardId);
    }

    /**
     * Get card by ID from hand (without removing)
     * @param {string} cardId
     * @returns {Card|null}
     */
    getCard(cardId) {
        return this.hand.find(c => c.id === cardId) || null;
    }

    /**
     * Get hand count
     * @returns {number}
     */
    get handCount() {
        return this.hand.length;
    }
}

/**
 * AI Player with basic strategy
 */
export class AIPlayer extends Player {
    constructor(name, position, difficulty = 'normal') {
        super(name, position, false);
        this.difficulty = difficulty; // 'easy', 'normal', 'hard'
    }

    /**
     * Make a bid decision
     * @param {number} currentBid - Current highest bid
     * @param {Object} handAnalysis - Analysis of hand strength
     * @returns {number|null} Bid value or null to pass
     */
    makeBid(currentBid, handAnalysis) {
        const maxBid = this._estimateMaxBid(handAnalysis);
        
        if (maxBid <= currentBid) {
            return null; // Pass
        }
        
        // Bid slightly above current, but not more than max
        const nextBid = this._nextBidValue(currentBid);
        return Math.min(nextBid, maxBid);
    }

    /**
     * Estimate maximum bid based on hand
     * @private
     */
    _estimateMaxBid(handAnalysis) {
        // Simplified heuristic
        let baseValue = 0;
        
        // Count matadors (top trumps in sequence)
        const matadors = handAnalysis.matadors || 0;
        baseValue = (matadors + 1) * 10; // Rough estimate
        
        // Adjust for hand quality
        if (handAnalysis.hasGoodTrumps) baseValue += 5;
        if (handAnalysis.hasAces) baseValue += 3;
        if (handAnalysis.hasTens) baseValue += 2;
        
        return Math.min(baseValue, 59); // Cap at max possible
    }

    /**
     * Get next valid bid value
     * @private
     */
    _nextBidValue(current) {
        const bidValues = [
            18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 45, 46, 48, 50, 54, 55, 59
        ];
        const next = bidValues.find(v => v > current);
        return next || current + 1;
    }

    /**
     * Choose card to play
     * @param {string|null} leadSuit
     * @param {Card[]} trickSoFar
     * @returns {Card}
     */
    chooseCard(leadSuit, trickSoFar) {
        const valid = this.getValidPlays(leadSuit);
        
        if (valid.length === 1) return valid[0];
        
        // Simple strategy based on difficulty
        switch (this.difficulty) {
            case 'easy':
                return this._playRandom(valid);
            case 'normal':
                return this._playNormal(valid, leadSuit, trickSoFar);
            case 'hard':
                return this._playSmart(valid, leadSuit, trickSoFar);
        }
    }

    _playRandom(valid) {
        return valid[Math.floor(Math.random() * valid.length)];
    }

    _playNormal(valid, leadSuit, trickSoFar) {
        // If leading, play low non-trump or high trump
        if (!leadSuit) {
            const nonTrumps = valid.filter(c => !c.isTrump);
            if (nonTrumps.length > 0) {
                // Play lowest non-trump
                return nonTrumps.reduce((lowest, c) => 
                    c.order < lowest.order ? c : lowest
                );
            }
            // Only trumps - play lowest
            return valid.reduce((lowest, c) => c.order < lowest.order ? c : lowest);
        }
        
        // Following suit - play lowest winning or lowest losing
        const winning = valid.filter(c => {
            // Would this win against current trick?
            return true; // Simplified
        });
        
        if (winning.length > 0) {
            return winning.reduce((lowest, c) => c.order < lowest.order ? c : lowest);
        }
        
        // Can't win - play lowest
        return valid.reduce((lowest, c) => c.order < lowest.order ? c : lowest);
    }

    _playSmart(valid, leadSuit, trickSoFar) {
        // Advanced: count cards, track points, consider game type
        return this._playNormal(valid, leadSuit, trickSoFar); // Placeholder
    }

    /**
     * Decide which cards to discard (when picking up skat)
     * @param {Card[]} skat - The two skat cards
     * @returns {Card[]} Two cards to discard
     */
    chooseDiscard(skat) {
        const allCards = [...this.hand, ...skat];
        allCards.sort((a, b) => {
            // Keep trumps and high cards
            if (a.isTrump !== b.isTrump) return a.isTrump ? -1 : 1;
            if (a.value !== b.value) return b.value - a.value; // Higher value first
            return (a.order || 99) - (b.order || 99);
        });
        
        // Discard lowest two
        const discard = allCards.slice(-2);
        this.hand = allCards.slice(0, 10);
        this.sortHand();
        return discard;
    }
}

/**
 * Analyze hand for bidding
 * @param {Card[]} hand
 * @returns {Object} Analysis
 */
export function analyzeHand(hand) {
    const trumps = hand.filter(c => c.isTrump);
    const jacks = hand.filter(c => c.rank === 'J');
    const aces = hand.filter(c => c.rank === 'A');
    const tens = hand.filter(c => c.rank === '10');
    
    // Count matadors (uninterrupted sequence of top trumps)
    let matadors = 0;
    const trumpOrder = ['♣', '♠', '♥', '♦'].map(s => `J${s}`); // J♣, J♠, J♥, J♦
    for (const jackId of trumpOrder) {
        if (hand.some(c => c.id === jackId)) {
            matadors++;
        } else {
            break;
        }
    }
    
    // If no J♣, count from highest trump in hand
    if (matadors === 0 && trumps.length > 0) {
        // Find highest trump in hand
        const handTrumps = trumps.sort((a, b) => a.order - b.order);
        const highest = handTrumps[0];
        // Count consecutive from there
        // Simplified: just count trumps
        matadors = trumps.length;
    }
    
    return {
        totalCards: hand.length,
        trumpCount: trumps.length,
        jackCount: jacks.length,
        aceCount: aces.length,
        tenCount: tens.length,
        matadors,
        totalPoints: hand.reduce((sum, c) => sum + c.value, 0),
        hasGoodTrumps: trumps.length >= 3,
        hasAces: aces.length >= 2,
        hasTens: tens.length >= 2,
        suits: [...new Set(hand.map(c => c.suit))].length
    };
}