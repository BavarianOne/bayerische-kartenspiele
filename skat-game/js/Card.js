// ========================================
// Card.js – Card class with Skat values & ordering
// ============================================

/**
 * Skat Card ranks in order: 7, 8, 9, 10, J, Q, K, A
 * Suits: ♣ (Clubs), ♠ (Spades), ♥ (Hearts), ♦ (Diamonds)
 * 
 * Trump order (highest to lowest):
 * J♣, J♠, J♥, J♦, A♣, 10♣, K♣, Q♣, 9♣, 8♣, 7♣,
 * A♠, 10♠, K♠, Q♠, 9♠, 8♠, 7♠,
 * A♥, 10♥, K♥, Q♥, 9♥, 8♥, 7♥,
 * A♦, 10♦, K♦, Q♦, 9♦, 8♦, 7♦
 * 
 * Card values (points):
 * J = 2, A = 11, 10 = 10, K = 4, Q = 3, 9/8/7 = 0
 */

export class Card {
    constructor(suit, rank) {
        this.suit = suit;        // '♣', '♠', '♥', '♦'
        this.rank = rank;        // '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
        this.id = `${suit}${rank}`; // Unique identifier
        
        // Skat point values
        this.value = this._calculateValue();
        
        // For sorting and comparison
        this.order = null;       // Set by game context (trump-aware)
        this.isTrump = false;    // Set by game context
    }

    _calculateValue() {
        const values = { 'J': 2, 'A': 11, '10': 10, 'K': 4, 'Q': 3, '9': 0, '8': 0, '7': 0 };
        return values[this.rank] || 0;
    }

    /**
     * Set trump status and calculate trump order
     * @param {string} trumpSuit - The trump suit for this game
     * @param {string} gameType - 'suit', 'grand', 'null', 'null_ouvert'
     */
    setTrumpContext(trumpSuit, gameType = 'suit') {
        this.gameType = gameType;
        
        if (gameType === 'grand') {
            // Only Jacks are trumps in Grand
            this.isTrump = (this.rank === 'J');
            this.order = this._getGrandOrder();
        } else if (gameType === 'null' || gameType === 'null_ouvert') {
            // No trumps in Null
            this.isTrump = false;
            this.order = this._getNullOrder();
        } else {
            // Suit game: Jacks + trump suit are trumps
            this.isTrump = (this.rank === 'J') || (this.suit === trumpSuit);
            this.order = this._getSuitOrder(trumpSuit);
        }
        return this;
    }

    _getGrandOrder() {
        // Grand: J♣ > J♠ > J♥ > J♦ > A♣ > 10♣ > K♣ > Q♣ > 9♣ > 8♣ > 7♣ > ...
        if (this.rank === 'J') {
            const jackOrder = { '♣': 1, '♠': 2, '♥': 3, '♦': 4 };
            return jackOrder[this.suit];
        }
        // Non-trumps in suit order: ♣ > ♠ > ♥ > ♦
        const suitOrder = { '♣': 5, '♠': 14, '♥': 23, '♦': 32 };
        const rankOrder = { 'A': 0, '10': 1, 'K': 2, 'Q': 3, '9': 4, '8': 5, '7': 6 };
        return suitOrder[this.suit] + rankOrder[this.rank];
    }

    _getSuitOrder(trumpSuit) {
        // Suit game: All Jacks first, then trump suit, then other suits
        if (this.rank === 'J') {
            const jackOrder = { '♣': 1, '♠': 2, '♥': 3, '♦': 4 };
            return jackOrder[this.suit];
        }
        if (this.suit === trumpSuit) {
            // Trump suit: A, 10, K, Q, 9, 8, 7
            const rankOrder = { 'A': 5, '10': 6, 'K': 7, 'Q': 8, '9': 9, '8': 10, '7': 11 };
            return rankOrder[this.rank];
        }
        // Side suits in order: ♣ > ♠ > ♥ > ♦ (excluding trump suit)
        const suitOrder = { '♣': 12, '♠': 20, '♥': 28, '♦': 36 };
        const rankOrder = { 'A': 0, '10': 1, 'K': 2, 'Q': 3, '9': 4, '8': 5, '7': 6 };
        // Adjust if suit is trump
        let base = suitOrder[this.suit];
        if (this.suit === trumpSuit) base = 5; // Already handled above
        return base + rankOrder[this.rank];
    }

    _getNullOrder() {
        // Null: No trumps, normal order A > K > Q > J > 10 > 9 > 8 > 7
        // Suit order: ♣ > ♠ > ♥ > ♦
        const suitOrder = { '♣': 1, '♠': 9, '♥': 17, '♦': 25 };
        const rankOrder = { 'A': 0, 'K': 1, 'Q': 2, 'J': 3, '10': 4, '9': 5, '8': 6, '7': 7 };
        return suitOrder[this.suit] + rankOrder[this.rank];
    }

    /**
     * Compare this card with another for trick winning
     * @param {Card} other - The other card
     * @param {string} leadSuit - The suit led in this trick
     * @returns {number} -1 if this loses, 0 if tie, 1 if this wins
     */
    compare(other, leadSuit) {
        // If both same card (shouldn't happen)
        if (this.id === other.id) return 0;

        // Trump beats non-trump
        if (this.isTrump && !other.isTrump) return 1;
        if (!this.isTrump && other.isTrump) return -1;

        // Both trumps or both non-trumps: higher order wins
        if (this.order !== null && other.order !== null) {
            return this.order < other.order ? 1 : -1; // Lower order = higher rank
        }

        // Fallback: compare by suit then rank (for null games)
        if (this.suit !== other.suit) {
            // In null, suit order matters only if same rank
            // For trick: must follow lead suit if possible
            if (this.suit === leadSuit && other.suit !== leadSuit) return 1;
            if (other.suit === leadSuit && this.suit !== leadSuit) return -1;
        }

        // Same suit: compare rank
        const rankValues = { '7': 1, '8': 2, '9': 3, '10': 4, 'J': 5, 'Q': 6, 'K': 7, 'A': 8 };
        // In null: A > K > Q > J > 10 > 9 > 8 > 7
        const nullRankValues = { '7': 1, '8': 2, '9': 3, '10': 4, 'J': 5, 'Q': 6, 'K': 7, 'A': 8 };
        
        const values = this.gameType === 'null' ? nullRankValues : rankValues;
        const thisVal = values[this.rank] || 0;
        const otherVal = values[other.rank] || 0;
        
        return thisVal > otherVal ? 1 : -1;
    }

    /**
     * Check if this card can be played on a trick
     * @param {string} leadSuit - The suit led (null if first card)
     * @param {Card[]} hand - Player's hand
     * @returns {boolean}
     */
    canPlay(leadSuit, hand) {
        if (!leadSuit) return true; // First card of trick
        if (this.suit === leadSuit) return true; // Can follow suit
        // Check if player has any card of lead suit
        const hasLeadSuit = hand.some(c => c.suit === leadSuit);
        return !hasLeadSuit; // Can play anything if no lead suit
    }

    /**
     * Create HTML element for this card
     * @param {Object} options - { small, faceDown, selectable, selected, disabled }
     * @returns {HTMLElement}
     */
    createElement(options = {}) {
        const {
            small = false,
            faceDown = false,
            selectable = true,
            selected = false,
            disabled = false
        } = options;

        const card = document.createElement('div');
        card.className = `card${small ? ' small' : ''}${faceDown ? ' face-down' : ''}${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`;
        card.dataset.cardId = this.id;
        card.dataset.suit = this.suit;
        card.dataset.rank = this.rank;
        
        if (this.isTrump) card.classList.add('trump');

        if (faceDown) {
            return card;
        }

        const isRed = this.suit === '♥' || this.suit === '♦';
        const rankClass = small ? 'card-rank-small' : 'card-rank';
        const suitClass = small ? 'card-suit-small' : 'card-suit';

        card.innerHTML = `
            <span class="${rankClass}">${this.rank}</span>
            <span class="${suitClass}">${this.suit}</span>
        `;

        if (selectable) {
            card.addEventListener('click', () => {
                if (!disabled) {
                    card.classList.toggle('selected');
                    card.dispatchEvent(new CustomEvent('card-select', { 
                        detail: { card: this, selected: card.classList.contains('selected') },
                        bubbles: true 
                    }));
                }
            });
        }

        return card;
    }

    toString() {
        return `${this.rank}${this.suit}`;
    }

    toJSON() {
        return { suit: this.suit, rank: this.rank, id: this.id };
    }

    static fromJSON(json) {
        const card = new Card(json.suit, json.rank);
        return card;
    }
}

/**
 * Create a full Skat deck (32 cards)
 * @returns {Card[]}
 */
export function createDeck() {
    const suits = ['♣', '♠', '♥', '♦'];
    const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push(new Card(suit, rank));
        }
    }
    return deck;
}

/**
 * Shuffle array in place (Fisher-Yates)
 * @param {Array} array
 * @returns {Array} Same array, shuffled
 */
export function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Deal cards to players
 * @param {Card[]} deck - Shuffled deck
 * @param {number} playerCount - Number of players (3 for Skat)
 * @param {number} cardsPerPlayer - Cards per player (10 for Skat)
 * @returns {Object} { hands: Card[][], skat: Card[] }
 */
export function deal(deck, playerCount = 3, cardsPerPlayer = 10) {
    const hands = [];
    let index = 0;
    
    for (let p = 0; p < playerCount; p++) {
        hands.push(deck.slice(index, index + cardsPerPlayer));
        index += cardsPerPlayer;
    }
    
    const skat = deck.slice(index, index + 2);
    
    return { hands, skat };
}