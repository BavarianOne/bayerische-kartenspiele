// ========================================
// Deck.js – Deck management, shuffling, dealing
// ============================================

import { createDeck, shuffle, deal } from './Card.js';

export class Deck {
    constructor() {
        this.cards = createDeck();
        this.originalOrder = [...this.cards];
    }

    /**
     * Shuffle the deck using Fisher-Yates
     * @returns {Deck} this for chaining
     */
    shuffle() {
        shuffle(this.cards);
        return this;
    }

    /**
     * Deal cards to players
     * @param {number} playerCount - Number of players (default 3)
     * @param {number} cardsPerPlayer - Cards per player (default 10)
     * @returns {Object} { hands: Card[][], skat: Card[] }
     */
    deal(playerCount = 3, cardsPerPlayer = 10) {
        if (this.cards.length < playerCount * cardsPerPlayer + 2) {
            throw new Error('Not enough cards in deck');
        }
        return deal(this.cards, playerCount, cardsPerPlayer);
    }

    /**
     * Reset deck to original order
     * @returns {Deck} this for chaining
     */
    reset() {
        this.cards = [...this.originalOrder];
        return this;
    }

    /**
     * Get remaining cards count
     * @returns {number}
     */
    get remaining() {
        return this.cards.length;
    }

    /**
     * Draw a single card from top
     * @returns {Card|null}
     */
    draw() {
        return this.cards.pop() || null;
    }

    /**
     * Get card by ID
     * @param {string} id - Card ID (e.g., '♣J')
     * @returns {Card|null}
     */
    findById(id) {
        return this.cards.find(c => c.id === id) || null;
    }

    /**
     * Remove specific cards from deck
     * @param {Card[]} cards - Cards to remove
     * @returns {Deck} this for chaining
     */
    remove(cards) {
        const ids = new Set(cards.map(c => c.id));
        this.cards = this.cards.filter(c => !ids.has(c.id));
        return this;
    }

    /**
     * Sort deck by suit and rank (for display)
     * @returns {Deck} this for chaining
     */
    sort() {
        const suitOrder = { '♣': 0, '♠': 1, '♥': 2, '♦': 3 };
        const rankOrder = { '7': 0, '8': 1, '9': 2, '10': 3, 'J': 4, 'Q': 5, 'K': 6, 'A': 7 };
        
        this.cards.sort((a, b) => {
            const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
            if (suitDiff !== 0) return suitDiff;
            return rankOrder[a.rank] - rankOrder[b.rank];
        });
        return this;
    }

    /**
     * Clone deck
     * @returns {Deck}
     */
    clone() {
        const newDeck = new Deck();
        newDeck.cards = this.cards.map(c => new Card(c.suit, c.rank));
        return newDeck;
    }
}

// Re-export utility functions
export { createDeck, shuffle, deal };