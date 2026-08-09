var board = null;
var game = new Chess();
var $status = $('#status');

var playerColor = 'w'; // Standardmäßig spielt der User Weiß
var aiDepth = 2;       // Standardmäßig "Mittel"

// Figurenwerte für die KI-Bewertung
var pieceValues = {
    'p': 10, 'r': 50, 'n': 30, 'b': 30, 'q': 90, 'k': 9000
};

// Berechnet den Wert des aktuellen Brecharts aus Sicht von Weiß
function evaluateBoard(boardState) {
    var totalEvaluation = 0;
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
            var piece = boardState[i][j];
            if (piece) {
                var value = pieceValues[piece.type];
                totalEvaluation += (piece.color === 'w') ? value : -value;
            }
        }
    }
    return totalEvaluation;
}

// Minimax-Algorithmus mit Alpha-Beta-Pruning
function minimax(depth, gameInstance, alpha, beta, isMaximizing) {
    if (depth === 0 || gameInstance.game_over()) {
        return evaluateBoard(gameInstance.board());
    }

    var moves = gameInstance.moves();

    if (isMaximizing) {
        var maxEval = -Infinity;
        for (var i = 0; i < moves.length; i++) {
            gameInstance.move(moves[i]);
            var ev = minimax(depth - 1, gameInstance, alpha, beta, false);
            gameInstance.undo();
            maxEval = Math.max(maxEval, ev);
            alpha = Math.max(alpha, ev);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        var minEval = Infinity;
        for (var i = 0; i < moves.length; i++) {
            gameInstance.move(moves[i]);
            var ev = minimax(depth - 1, gameInstance, alpha, beta, true);
            gameInstance.undo();
            minEval = Math.min(minEval, ev);
            beta = Math.min(beta, ev);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

// Findet den besten Zug für die KI
function makeAiMove() {
    var moves = game.moves();
    if (moves.length === 0) return;

    var bestMove = null;
    // Wenn KI=Weiß (Maximizing), wollen wir hohen Wert. Wenn KI=Schwarz (Minimizing), niedrigen Wert.
    var isAiMaximizing = (playerColor === 'b'); 
    var bestValue = isAiMaximizing ? -Infinity : Infinity;

    // Zufällige Sortierung, damit die KI nicht immer exakt das gleiche spielt
    moves.sort(function() { return 0.5 - Math.random(); });

    for (var i = 0; i < moves.length; i++) {
        game.move(moves[i]);
        var boardValue = minimax(aiDepth - 1, game, -Infinity, Infinity, !isAiMaximizing);
        game.undo();

        if (isAiMaximizing) {
            if (boardValue > bestValue) {
                bestValue = boardValue;
                bestMove = moves[i];
            }
        } else {
            if (boardValue < bestValue) {
                bestValue = boardValue;
                bestMove = moves[i];
            }
        }
    }

    game.move(bestMove);
    board.position(game.fen());
    updateStatus();
}

function onDragStart (source, piece, position, orientation) {
    if (game.game_over()) return false;

    // Spieler darf nur seine eigenen Figuren ziehen
    if ((playerColor === 'w' && piece.search(/^b/) !== -1) ||
        (playerColor === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }

    // Nicht ziehen, wenn die KI am Zug ist
    if ((game.turn() === 'w' && playerColor === 'b') || 
        (game.turn() === 'b' && playerColor === 'w')) {
        return false;
    }
}

function onDrop (source, target) {
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) return 'snapback';

    updateStatus();

    // KI-Zug triggern, falls das Spiel nicht vorbei ist
    if (!game.game_over()) {
        window.setTimeout(makeAiMove, 250);
    }
}

function onSnapEnd () {
    board.position(game.fen());
}

function updateStatus () {
    var status = '';
    var moveColor = (game.turn() === 'b') ? 'Schwarz' : 'Weiß';

    if (game.in_checkmate()) {
        status = 'Spiel vorbei. ' + moveColor + ' ist im Schachmatt!';
    } else if (game.in_draw()) {
        status = 'Spiel vorbei. Unentschieden!';
    } else {
        if (game.turn() === playerColor) {
            status = 'Du bist am Zug (' + (playerColor === 'w' ? 'Weiß' : 'Schwarz') + ')';
        } else {
            status = 'KI überlegt...';
        }
        if (game.in_check()) {
            status += ' - Schach!';
        }
    }
    $status.html(status);
}

// Spiel starten / zurücksetzen
$('#startBtn').on('click', function() {
    playerColor = $('#colorSelect').val();
    aiDepth = parseInt($('#depthSelect').val(), 10);
    
    game.reset();
    
    var config = {
        draggable: true,
        position: 'start',
        orientation: playerColor === 'w' ? 'white' : 'black',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };
    
    board = Chessboard('board', config);
    updateStatus();

    // Wenn der Spieler Schwarz wählt, muss die KI (Weiß) anfangen
    if (playerColor === 'b') {
        window.setTimeout(makeAiMove, 500);
    }
});