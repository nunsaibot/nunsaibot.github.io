const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');

context.scale(20, 20); // Увеличиваем масштаб для удобства рисования

// Определяем фигуры
const tetrominos = [
    [[1, 1, 1, 1]], // I
    [[1, 1], [1, 1]], // O
    [[0, 1, 0], [1, 1, 1]], // T
    [[1, 1, 0], [0, 1, 1]], // S
    [[0, 1, 1], [1, 1, 0]], // Z
    [[1, 0, 0], [1, 1, 1]], // L
    [[0, 0, 1], [1, 1, 1]] // J
];

let board = Array.from({ length: 20 }, () => Array(10).fill(0));
let currentTetromino;
let currentPosition;

function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard();
    drawTetromino();
}

function drawBoard() {
    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
            if (board[row][col]) {
                context.fillStyle = 'white';
                context.fillRect(col, row, 1, 1);
            }
        }
    }
}

function drawTetromino() {
    currentTetromino.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                context.fillStyle = 'red';
                context.fillRect(currentPosition.x + x, currentPosition.y + y, 1, 1);
            }
        });
    });
}

function resetGame() {
    board = Array.from({ length: 20 }, () => Array(10).fill(0));
    spawnTetromino();
}

function spawnTetromino() {
    const randomIndex = Math.floor(Math.random() * tetrominos.length);
    currentTetromino = {
        shape: tetrominos[randomIndex],
        position: { x: 3, y: 0 }
    };
}

function update() {
    currentPosition = currentTetromino.position;

    if (!collision()) {
        currentPosition.y++;
    } else {
        merge();
        clearLines();
        spawnTetromino();
    }

    draw();
}

function collision() {
    return currentTetromino.shape.some((row, y) => {
        return row.some((value, x) => {
            if (value) {
                const newX = currentPosition.x + x;
                const newY = currentPosition.y + y + 1; // Проверяем на одну клетку ниже
                return newY >= board.length || newX < 0 || newX >= board[0].length || board[newY][newX];
            }
            return false;
        });
    });
}

function merge() {
    currentTetromino.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                board[currentPosition.y + y][currentPosition.x + x] = value;
            }
        });
    });
}

function clearLines() {
    board = board.filter(row => row.some(value => !value));
    while (board.length < 20) {
        board.unshift(Array(10).fill(0));
    }
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
        currentPosition.x--;
        if (collision()) currentPosition.x++;
    } else if (event.key === 'ArrowRight') {
        currentPosition.x++;
        if (collision()) currentPosition.x--;
    } else if (event.key === 'ArrowDown') {
        update();
    }
});

resetGame();
setInterval(update, 1000);
