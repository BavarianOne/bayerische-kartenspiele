/**
 * Math Quest: Number Kingdom - Challenges Module
 * Generates math questions for all worlds and levels
 */

const Challenges = (function() {
    'use strict';

    // World configurations
    const WORLDS = {
        1: {
            id: 1,
            name: 'Meeresbucht',
            theme: 'ocean',
            color: '#4ecdc4',
            levels: 10,
            types: ['counting', 'addition', 'comparison'],
            maxNumber: 10,
            description: 'Lerne zählen und addieren mit freundlichen Meeresbewohnern!'
        },
        2: {
            id: 2,
            name: 'Zahlenwald',
            theme: 'forest',
            color: '#7fb069',
            levels: 10,
            types: ['addition', 'subtraction', 'numberLine', 'patterns'],
            maxNumber: 20,
            description: 'Erkunde den Wald und meistere Addition und Subtraktion!'
        },
        3: {
            id: 3,
            name: 'Wolkenkönigreich',
            theme: 'sky',
            color: '#ffeaa7',
            levels: 10,
            types: ['addition', 'subtraction', 'multiplication', 'shapes', 'wordProblems'],
            maxNumber: 50,
            description: 'Schwebe durch die Wolken mit Multiplikation und Formen!'
        },
        4: {
            id: 4,
            name: 'Eispalast',
            theme: 'ice',
            color: '#81ecec',
            levels: 10,
            types: ['multiplication', 'division', 'patterns', 'comparison', 'wordProblems'],
            maxNumber: 100,
            description: 'Bezwinge den Eispalast mit Division und Mustern!'
        },
        5: {
            id: 5,
            name: 'Weltraumstation',
            theme: 'space',
            color: '#a29bfe',
            levels: 10,
            types: ['multiplication', 'division', 'wordProblems', 'patterns', 'comparison'],
            maxNumber: 100,
            description: 'Starte ins All mit fortgeschrittenen Mathe-Herausforderungen!'
        }
    };

    // Question type configurations
    const QUESTION_TYPES = {
        counting: {
            name: 'Zählen',
            icon: '🔢',
            minLevel: 1,
            maxLevel: 10,
            generate: generateCounting
        },
        addition: {
            name: 'Addition',
            icon: '➕',
            minLevel: 1,
            maxLevel: 10,
            generate: generateAddition
        },
        subtraction: {
            name: 'Subtraktion',
            icon: '➖',
            minLevel: 2,
            maxLevel: 10,
            generate: generateSubtraction
        },
        multiplication: {
            name: 'Multiplikation',
            icon: '✖️',
            minLevel: 3,
            maxLevel: 10,
            generate: generateMultiplication
        },
        division: {
            name: 'Division',
            icon: '➗',
            minLevel: 4,
            maxLevel: 10,
            generate: generateDivision
        },
        numberLine: {
            name: 'Zahlenstrahl',
            icon: '📏',
            minLevel: 2,
            maxLevel: 10,
            generate: generateNumberLine
        },
        patterns: {
            name: 'Muster',
            icon: '🔄',
            minLevel: 2,
            maxLevel: 10,
            generate: generatePatterns
        },
        shapes: {
            name: 'Formen',
            icon: '🔷',
            minLevel: 3,
            maxLevel: 10,
            generate: generateShapes
        },
        comparison: {
            name: 'Vergleich',
            icon: '⚖️',
            minLevel: 1,
            maxLevel: 10,
            generate: generateComparison
        },
        wordProblems: {
            name: 'Textaufgaben',
            icon: '📝',
            minLevel: 3,
            maxLevel: 10,
            generate: generateWordProblem
        }
    };

    // Visual objects for counting questions
    const COUNTING_OBJECTS = [
        '🐠', '🐟', '🦀', '🐙', '🐚', '🦑', '🐡', '🦐', '🦞', '🪸',
        '🌲', '🌳', '🍄', '🌰', '🍂', '🌿', '🍃', '🌱', '🌻', '🌸',
        '☁️', '⭐', '🌙', '☀️', '🌈', '✨', '🎈', '🪁', '🕊️', '🦋',
        '❄️', '🧊', '🐧', '⛄', '🎿', '🧤', '🧣', '🧥', '🌨️', '🏔️',
        '🚀', '🪐', '👽', '🛸', '🌟', '🌌', '🛰️', '🔭', '👨‍🚀', '👩‍🚀'
    ];

    const SHAPES = ['🔴', '🔵', '🟡', '🟢', '🟣', '🟠', '🔶', '🔷', '⬛', '⬜', '🟥', '🟦', '🟨', '🟩', '🟪'];

    // Get world config
    function getWorld(worldId) {
        return WORLDS[worldId] || WORLDS[1];
    }

    // Get all worlds
    function getAllWorlds() {
        return Object.values(WORLDS);
    }

    // Get available question types for a world
    function getTypesForWorld(worldId) {
        const world = getWorld(worldId);
        return world.types.map(t => QUESTION_TYPES[t]).filter(t => t);
    }

    // Get question type config
    function getQuestionType(typeId) {
        return QUESTION_TYPES[typeId];
    }

    // Generate a level's questions
    function generateLevel(worldId, level, count = 10) {
        const world = getWorld(worldId);
        const types = getTypesForWorld(worldId);
        const questions = [];
        
        // Determine difficulty progression
        const progress = (level - 1) / (world.levels - 1); // 0 to 1
        const maxNum = Math.floor(world.maxNumber * (0.3 + 0.7 * progress));
        const minNum = Math.max(1, Math.floor(maxNum * 0.2));
        
        for (let i = 0; i < count; i++) {
            // Weight question types based on level
            const type = selectQuestionType(types, level, world.levels);
            const question = type.generate(worldId, level, maxNum, minNum, i);
            questions.push(question);
        }
        
        return questions;
    }

    // Select question type based on level progression
    function selectQuestionType(types, level, maxLevel) {
        const progress = (level - 1) / (maxLevel - 1);
        
        // Early levels: more counting, addition
        // Later levels: more complex types
        const weights = types.map(t => {
            let weight = 1;
            if (t.id === 'counting') weight = progress < 0.3 ? 3 : 0.5;
            if (t.id === 'addition') weight = progress < 0.5 ? 2 : 1;
            if (t.id === 'subtraction') weight = progress > 0.2 ? 2 : 0.5;
            if (t.id === 'multiplication') weight = progress > 0.4 ? 2 : 0.2;
            if (t.id === 'division') weight = progress > 0.6 ? 2 : 0.1;
            if (t.id === 'wordProblems') weight = progress > 0.5 ? 1.5 : 0.3;
            return { type: t, weight };
        });
        
        // Weighted random selection
        const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const w of weights) {
            random -= w.weight;
            if (random <= 0) return w.type;
        }
        
        return types[0];
    }

    // ===== QUESTION GENERATORS =====

    // Counting: "Wie viele [Objekte]?"
    function generateCounting(worldId, level, maxNum, minNum, index) {
        const count = randomInt(minNum, Math.min(maxNum, 10));
        const object = randomChoice(COUNTING_OBJECTS);
        const objects = Array(count).fill(object);
        
        // Shuffle for visual variety
        shuffleArray(objects);
        
        return {
            type: 'counting',
            subtype: 'visual',
            question: `Wie viele ${object}?`,
            text: `Zähle die ${object}s`,
            visual: objects,
            answer: count,
            options: generateOptions(count, 0, 10),
            explanation: `Es sind ${count} ${object}s.`,
            timeBonus: 5000
        };
    }

    // Addition: "a + b = ?"
    function generateAddition(worldId, level, maxNum, minNum, index) {
        const a = randomInt(minNum, maxNum);
        const b = randomInt(minNum, maxNum);
        const answer = a + b;
        
        const formats = [
            { q: `${a} + ${b} = ?`, visual: 'equation' },
            { q: `Was ist ${a} plus ${b}?`, visual: 'text' },
            { q: `${a} + ? = ${answer}`, visual: 'missing', missing: 'b' },
            { q: `? + ${b} = ${answer}`, visual: 'missing', missing: 'a' }
        ];
        
        const format = randomChoice(formats);
        
        return {
            type: 'addition',
            subtype: format.visual,
            question: format.q,
            text: format.q,
            visual: format.visual === 'equation' ? { a, b, operator: '+', answer } : null,
            answer: format.missing === 'a' ? a : (format.missing === 'b' ? b : answer),
            options: generateOptions(answer, 0, maxNum * 2),
            explanation: `${a} + ${b} = ${answer}`,
            timeBonus: 4000
        };
    }

    // Subtraction: "a - b = ?"
    function generateSubtraction(worldId, level, maxNum, minNum, index) {
        const a = randomInt(minNum + 1, maxNum);
        const b = randomInt(minNum, a - 1);
        const answer = a - b;
        
        const formats = [
            { q: `${a} - ${b} = ?`, visual: 'equation' },
            { q: `Was ist ${a} minus ${b}?`, visual: 'text' },
            { q: `${a} - ? = ${answer}`, visual: 'missing', missing: 'b' },
            { q: `? - ${b} = ${answer}`, visual: 'missing', missing: 'a' }
        ];
        
        const format = randomChoice(formats);
        
        return {
            type: 'subtraction',
            subtype: format.visual,
            question: format.q,
            text: format.q,
            visual: format.visual === 'equation' ? { a, b, operator: '-', answer } : null,
            answer: format.missing === 'a' ? a : (format.missing === 'b' ? b : answer),
            options: generateOptions(answer, 0, maxNum),
            explanation: `${a} - ${b} = ${answer}`,
            timeBonus: 4000
        };
    }

    // Multiplication: "a × b = ?"
    function generateMultiplication(worldId, level, maxNum, minNum, index) {
        // Use smaller numbers for multiplication
        const maxFactor = Math.min(10, Math.floor(Math.sqrt(maxNum)));
        const a = randomInt(2, maxFactor);
        const b = randomInt(2, maxFactor);
        const answer = a * b;
        
        const formats = [
            { q: `${a} × ${b} = ?`, visual: 'equation' },
            { q: `Was ist ${a} mal ${b}?`, visual: 'text' },
            { q: `${a} × ? = ${answer}`, visual: 'missing', missing: 'b' },
            { q: `? × ${b} = ${answer}`, visual: 'missing', missing: 'a' }
        ];
        
        const format = randomChoice(formats);
        
        return {
            type: 'multiplication',
            subtype: format.visual,
            question: format.q,
            text: format.q,
            visual: format.visual === 'equation' ? { a, b, operator: '×', answer } : null,
            answer: format.missing === 'a' ? a : (format.missing === 'b' ? b : answer),
            options: generateOptions(answer, 0, maxFactor * maxFactor),
            explanation: `${a} × ${b} = ${answer}`,
            timeBonus: 5000
        };
    }

    // Division: "a ÷ b = ?"
    function generateDivision(worldId, level, maxNum, minNum, index) {
        // Generate division with clean answers
        const maxFactor = Math.min(10, Math.floor(Math.sqrt(maxNum)));
        const b = randomInt(2, maxFactor);
        const answer = randomInt(2, maxFactor);
        const a = answer * b;
        
        const formats = [
            { q: `${a} ÷ ${b} = ?`, visual: 'equation' },
            { q: `Was ist ${a} geteilt durch ${b}?`, visual: 'text' },
            { q: `${a} ÷ ? = ${answer}`, visual: 'missing', missing: 'b' },
            { q: `? ÷ ${b} = ${answer}`, visual: 'missing', missing: 'a' }
        ];
        
        const format = randomChoice(formats);
        
        return {
            type: 'division',
            subtype: format.visual,
            question: format.q,
            text: format.q,
            visual: format.visual === 'equation' ? { a, b, operator: '÷', answer } : null,
            answer: format.missing === 'a' ? a : (format.missing === 'b' ? b : answer),
            options: generateOptions(answer, 1, maxFactor),
            explanation: `${a} ÷ ${b} = ${answer}`,
            timeBonus: 5000
        };
    }

    // Number Line: "Welche Zahl fehlt?"
    function generateNumberLine(worldId, level, maxNum, minNum, index) {
        const start = randomInt(0, Math.max(0, maxNum - 10));
        const step = randomChoice([1, 2, 5, 10]);
        const length = randomInt(5, 8);
        const points = [];
        
        for (let i = 0; i < length; i++) {
            points.push(start + i * step);
        }
        
        const hiddenIndex = randomInt(1, length - 2);
        const answer = points[hiddenIndex];
        const displayPoints = [...points];
        displayPoints[hiddenIndex] = '?';
        
        return {
            type: 'numberLine',
            subtype: 'missing',
            question: 'Welche Zahl fehlt?',
            text: 'Finde die fehlende Zahl auf dem Zahlenstrahl',
            visual: { points: displayPoints, step, hiddenIndex, answer },
            answer: answer,
            options: generateOptions(answer, Math.max(0, start - step * 2), points[points.length - 1] + step * 2),
            explanation: `Die Zahlen gehen jeweils um ${step} weiter. ${points[hiddenIndex - 1]} + ${step} = ${answer}`,
            timeBonus: 6000
        };
    }

    // Patterns: "Was kommt als Nächstes?"
    function generatePatterns(worldId, level, maxNum, minNum, index) {
        const patternTypes = [
            // Arithmetic sequence
            () => {
                const start = randomInt(minNum, maxNum - 10);
                const step = randomChoice([1, 2, 3, 5, 10]);
                const seq = [start, start + step, start + 2*step, start + 3*step];
                return { seq, answer: start + 4*step, rule: `Jedes Mal ${step} addieren` };
            },
            // Geometric sequence (simple)
            () => {
                const start = randomChoice([2, 3, 4, 5]);
                const mult = randomChoice([2, 3]);
                const seq = [start, start*mult, start*mult*mult];
                return { seq, answer: start*mult*mult*mult, rule: `Jedes Mal mit ${mult} multiplizieren` };
            },
            // Alternating
            () => {
                const a = randomInt(minNum, maxNum);
                const b = randomInt(minNum, maxNum);
                const seq = [a, b, a, b, a];
                return { seq, answer: b, rule: `Abwechselnd ${a} und ${b}` };
            },
            // Shape pattern
            () => {
                const shapes = randomChoices(SHAPES, 3);
                const seq = [shapes[0], shapes[1], shapes[0], shapes[1], shapes[0]];
                return { seq, answer: shapes[1], rule: `Abwechselnde Formen`, isShape: true };
            }
        ];
        
        const pattern = randomChoice(patternTypes)();
        
        return {
            type: 'patterns',
            subtype: pattern.isShape ? 'shapes' : 'numbers',
            question: 'Was kommt als Nächstes?',
            text: 'Vervollständige das Muster',
            visual: { sequence: pattern.seq, isShape: pattern.isShape || false },
            answer: pattern.answer,
            options: pattern.isShape 
                ? randomChoices(SHAPES.filter(s => s !== pattern.answer), 3).concat(pattern.answer).sort(() => Math.random() - 0.5)
                : generateOptions(pattern.answer, Math.max(0, pattern.answer - 10), pattern.answer + 10),
            explanation: pattern.rule,
            timeBonus: 7000
        };
    }

    // Shapes: "Wie viele Ecken?" oder "Welche Form?"
    function generateShapes(worldId, level, maxNum, minNum, index) {
        const shapeQuestions = [
            // Count sides
            () => {
                const shapes = [
                    { emoji: '🔺', name: 'Dreieck', sides: 3 },
                    { emoji: '🔷', name: 'Raute', sides: 4 },
                    { emoji: '⬛', name: 'Quadrat', sides: 4 },
                    { emoji: '🔶', name: 'Rhombus', sides: 4 },
                    { emoji: '🟢', name: 'Kreis', sides: 0 },
                    { emoji: '🟣', name: 'Fünfeck', sides: 5 },
                    { emoji: '🟠', name: 'Sechseck', sides: 6 },
                    { emoji: '⬜', name: 'Rechteck', sides: 4 }
                ];
                const shape = randomChoice(shapes);
                return {
                    question: `Wie viele Ecken hat ein ${shape.name}?`,
                    visual: { shape: shape.emoji, type: 'countSides' },
                    answer: shape.sides,
                    options: generateOptions(shape.sides, 0, 8),
                    explanation: `Ein ${shape.name} hat ${shape.sides} Ecken.`
                };
            },
            // Identify shape
            () => {
                const shapes = [
                    { emoji: '🔺', name: 'Dreieck' },
                    { emoji: '🔷', name: 'Raute' },
                    { emoji: '⬛', name: 'Quadrat' },
                    { emoji: '🔶', name: 'Rhombus' },
                    { emoji: '🟢', name: 'Kreis' },
                    { emoji: '🟣', name: 'Fünfeck' },
                    { emoji: '🟠', name: 'Sechseck' },
                    { emoji: '⬜', name: 'Rechteck' }
                ];
                const shape = randomChoice(shapes);
                const options = randomChoices(shapes.filter(s => s !== shape), 3).map(s => s.name);
                options.push(shape.name);
                shuffleArray(options);
                return {
                    question: `Welche Form ist das?`,
                    visual: { shape: shape.emoji, type: 'identify' },
                    answer: shape.name,
                    options: options,
                    explanation: `Das ist ein ${shape.name}.`
                };
            }
        ];
        
        const q = randomChoice(shapeQuestions)();
        
        return {
            type: 'shapes',
            subtype: q.visual.type,
            question: q.question,
            text: q.question,
            visual: q.visual,
            answer: q.answer,
            options: q.options,
            explanation: q.explanation,
            timeBonus: 5000
        };
    }

    // Comparison: "Was ist größer/kleiner?"
    function generateComparison(worldId, level, maxNum, minNum, index) {
        const a = randomInt(minNum, maxNum);
        const b = randomInt(minNum, maxNum);
        while (b === a) {
            b = randomInt(minNum, maxNum);
        }
        
        const comparisons = [
            { q: `Was ist größer: ${a} oder ${b}?`, answer: Math.max(a, b), type: 'bigger' },
            { q: `Was ist kleiner: ${a} oder ${b}?`, answer: Math.min(a, b), type: 'smaller' },
            { q: `Ist ${a} > ${b}?`, answer: a > b, type: 'boolean', options: ['Ja', 'Nein'] },
            { q: `Ist ${a} < ${b}?`, answer: a < b, type: 'boolean', options: ['Ja', 'Nein'] },
            { q: `Ist ${a} = ${b}?`, answer: a === b, type: 'boolean', options: ['Ja', 'Nein'] }
        ];
        
        const comp = randomChoice(comparisons);
        
        return {
            type: 'comparison',
            subtype: comp.type,
            question: comp.q,
            text: comp.q,
            visual: { a, b, type: comp.type },
            answer: comp.answer,
            options: comp.options || [a, b].sort(() => Math.random() - 0.5),
            explanation: `${a} ${comp.type === 'bigger' ? '>' : comp.type === 'smaller' ? '<' : (a === b ? '=' : (a > b ? '>' : '<'))} ${b}`,
            timeBonus: 3000
        };
    }

    // Word Problems (Textaufgaben)
    function generateWordProblem(worldId, level, maxNum, minNum, index) {
        const templates = [
            // Addition word problem
            () => {
                const a = randomInt(minNum, maxNum);
                const b = randomInt(minNum, maxNum);
                const objects = randomChoice(['Äpfel', 'Münzen', 'Sterne', 'Muscheln', 'Blumen', 'Bücher', 'Spielzeuge']);
                const names = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Avery', 'Quinn'];
                const name = randomChoice(names);
                
                return {
                    question: `${name} hat ${a} ${objects}. Er/Sie findet ${b} weitere. Wie viele ${objects} hat ${name} jetzt?`,
                    answer: a + b,
                    explanation: `${a} + ${b} = ${a + b} ${objects}`
                };
            },
            // Subtraction word problem
            () => {
                const a = randomInt(minNum + 2, maxNum);
                const b = randomInt(minNum, a - 1);
                const objects = randomChoice(['Kekse', 'Luftballons', 'Aufkleber', 'Murmel', 'Buntstifte', 'Bausteine']);
                const names = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Avery', 'Quinn'];
                const name = randomChoice(names);
                
                return {
                    question: `${name} hat ${a} ${objects}. Er/Sie gibt ${b} an einen Freund. Wie viele ${objects} hat ${name} noch?`,
                    answer: a - b,
                    explanation: `${a} - ${b} = ${a - b} ${objects}`
                };
            },
            // Multiplication word problem
            () => {
                const a = randomInt(2, 5);
                const b = randomInt(2, 5);
                const objects = randomChoice(['Malkästen', 'Aufkleberpackungen', 'Murmelbeutel', 'Muschelgläser']);
                const names = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Avery', 'Quinn'];
                const name = randomChoice(names);
                
                return {
                    question: `${name} hat ${a} ${objects}. In jedem ${objects.slice(0, -1)} sind ${b} Stück. Wie viele Stücke insgesamt?`,
                    answer: a * b,
                    explanation: `${a} × ${b} = ${a * b} Stücke`
                };
            },
            // Division word problem
            () => {
                const answer = randomInt(2, 5);
                const b = randomInt(2, 5);
                const a = answer * b;
                const objects = randomChoice(['Kekse', 'Bonbons', 'Spielzeuge', 'Bücher', 'Bleistifte']);
                const names = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Avery', 'Quinn'];
                const name = randomChoice(names);
                
                return {
                    question: `${name} hat ${a} ${objects}. Er/Sie möchte sie gerecht unter ${b} Freunde aufteilen. Wie viele ${objects} bekommt jeder?`,
                    answer: answer,
                    explanation: `${a} ÷ ${b} = ${answer} ${objects} pro Person`
                };
            }
        ];
        
        const wp = randomChoice(templates)();
        
        return {
            type: 'wordProblems',
            subtype: 'text',
            question: wp.question,
            text: wp.question,
            visual: null,
            answer: wp.answer,
            options: generateOptions(wp.answer, Math.max(0, wp.answer - 5), wp.answer + 10),
            explanation: wp.explanation,
            timeBonus: 8000
        };
    }

    // ===== UTILITY FUNCTIONS =====

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    function randomChoices(array, count) {
        const shuffled = [...array].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function generateOptions(correct, min, max) {
        const options = [correct];
        const range = max - min;
        
        while (options.length < 4) {
            const candidate = randomInt(min, max);
            if (!options.includes(candidate)) {
                options.push(candidate);
            }
            // Prevent infinite loop
            if (options.length >= Math.min(4, range + 1)) break;
        }
        
        return shuffleArray(options);
    }

    // Calculate stars for a level
    function calculateStars(questions, correctCount, timeSpent, heartsLost) {
        const total = questions.length;
        const accuracy = correctCount / total;
        const avgTime = timeSpent / total;
        
        let stars = 0;
        
        // Star 1: Complete the level (at least 60% correct)
        if (accuracy >= 0.6) stars = 1;
        
        // Star 2: Good accuracy (80%+) and no hearts lost
        if (accuracy >= 0.8 && heartsLost === 0) stars = 2;
        
        // Star 3: Perfect (100% correct, no hearts lost, fast)
        if (accuracy === 1 && heartsLost === 0 && avgTime < 5000) stars = 3;
        
        return stars;
    }

    // Check if level is perfect
    function isPerfect(questions, correctCount, heartsLost) {
        return correctCount === questions.length && heartsLost === 0;
    }

    // Get question type display info
    function getTypeInfo(typeId) {
        return QUESTION_TYPES[typeId] || { name: typeId, icon: '❓' };
    }

    // Public API
    return {
        WORLDS,
        QUESTION_TYPES,
        getWorld,
        getAllWorlds,
        getTypesForWorld,
        getQuestionType,
        generateLevel,
        calculateStars,
        isPerfect,
        getTypeInfo,
        randomInt,
        randomChoice,
        shuffleArray,
        generateOptions
    };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Challenges;
}