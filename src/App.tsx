import React, { useState, useCallback, useEffect } from 'react';
import { Volume2, VolumeX, FastForward, Rewind, HelpCircle } from 'lucide-react';

type BingoCard = {
  id: string;
  numbers: number[][];
  marks: boolean[][];
  completedLines: boolean[][];
};

type WinPattern = 'line';

type WinningResult = {
  cardId: string;
  amount: number;
  pattern: WinPattern;
  timestamp: number;
};

const CARD_PRICE = 5;
const MAX_CARDS = 4;
const BINGO_NUMBERS = Array.from({ length: 100 }, (_, i) => i + 1);
const WIN_MULTIPLIERS = {
  line: 1,
};

const DRAW_SPEEDS = {
  slow: 8000,
  normal: 4000,
  fast: 2000,
};

const SOUND_URLS = {
  draw: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
  win: 'https://assets.mixkit.co/active_storage/sfx/2001/2001-preview.mp3',
  buy: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
  line: 'https://assets.mixkit.co/active_storage/sfx/2002/2002-preview.mp3',
};

function App() {
  const [balance, setBalance] = useState(20);
  const [cards, setCards] = useState<BingoCard[]>([]);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [isAutoDrawing, setIsAutoDrawing] = useState(false);
  const [sound, setSound] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(5);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [lastWin, setLastWin] = useState(0);
  const [winningPattern, setWinningPattern] = useState<WinPattern | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [drawSpeed, setDrawSpeed] = useState<keyof typeof DRAW_SPEEDS>('normal');
  const [drawnNumbersHistory, setDrawnNumbersHistory] = useState<number[]>([]);
  const [winningResults, setWinningResults] = useState<WinningResult[]>([]);
  const [totalPrize, setTotalPrize] = useState(0);
  const [lastDrawnNumber, setLastDrawnNumber] = useState<number | null>(null);

  const generateBingoCard = (): BingoCard => {
    const numbers: number[][] = Array(5).fill(null).map(() => Array(5).fill(0));
    const marks: boolean[][] = Array(5).fill(null).map(() => Array(5).fill(false));
    const completedLines: boolean[][] = Array(5).fill(null).map(() => Array(5).fill(false));
    
    for (let col = 0; col < 5; col++) {
      const min = col * 20 + 1;
      const max = min + 19;
      const columnNumbers = Array.from({ length: 20 }, (_, i) => min + i);
      
      for (let row = 0; row < 5; row++) {
        const randomIndex = Math.floor(Math.random() * columnNumbers.length);
        numbers[row][col] = columnNumbers.splice(randomIndex, 1)[0];
      }
    }

    numbers[2][2] = 0;
    marks[2][2] = true;

    return {
      id: Math.random().toString(36).substr(2, 9),
      numbers,
      marks,
      completedLines,
    };
  };

  const buyCard = () => {
    if (balance >= CARD_PRICE && cards.length < MAX_CARDS) {
      setBalance(prev => prev - CARD_PRICE);
      setCards(prev => [...prev, generateBingoCard()]);
      playSound('buy');
    }
  };

  const checkWin = (card: BingoCard): { pattern: WinPattern | null; completedLines: boolean[][] } => {
    const newCompletedLines = [...card.completedLines.map(row => [...row])];
    let hasWin = false;

    for (let row = 0; row < 5; row++) {
      const isLineComplete = card.marks[row].every(mark => mark);
      if (isLineComplete && !card.completedLines[row].every(completed => completed)) {
        hasWin = true;
        for (let col = 0; col < 5; col++) {
          newCompletedLines[row][col] = true;
        }
      }
    }

    return {
      pattern: hasWin ? 'line' : null,
      completedLines: newCompletedLines,
    };
  };

  const markNumber = (number: number) => {
    let hasNewWin = false;
    setCards(prev => prev.map(card => {
      const newMarks = [...card.marks.map(row => [...row])];
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          if (card.numbers[row][col] === number) {
            newMarks[row][col] = true;
          }
        }
      }
      
      const { pattern, completedLines } = checkWin({ ...card, marks: newMarks });
      if (pattern) {
        hasNewWin = true;
        const winAmount = 5;
        setBalance(prev => prev + winAmount);
        setLastWin(winAmount);
        setWinningPattern(pattern);
        setWinningResults(prev => [...prev, {
          cardId: card.id,
          amount: winAmount,
          pattern,
          timestamp: Date.now(),
        }]);
        setTotalPrize(prev => prev + winAmount);
        playSound('line');
      }
      
      return { ...card, marks: newMarks, completedLines };
    }));

    if (hasNewWin) {
      playSound('win');
    }
  };

  const drawNumber = () => {
    if (!isGameRunning || gameOver) return;

    const remainingNumbers = BINGO_NUMBERS.filter(n => !drawnNumbers.includes(n));
    if (remainingNumbers.length === 0 || drawnNumbers.length >= 100) {
      endGame();
      return;
    }

    const randomIndex = Math.floor(Math.random() * remainingNumbers.length);
    const newNumber = remainingNumbers[randomIndex];
    
    setDrawnNumbers(prev => [...prev, newNumber]);
    setDrawnNumbersHistory(prev => [newNumber, ...prev]);
    setLastDrawnNumber(newNumber);
    markNumber(newNumber);
    playSound('draw');

    if (drawnNumbers.length >= 99) {
      endGame();
    }
  };

  const endGame = () => {
    setIsGameRunning(false);
    setIsAutoDrawing(false);
    setGameOver(true);
    playSound('win');
  };

  const startNewGame = () => {
    if (cards.length === 0) return;
    setDrawnNumbers([]);
    setDrawnNumbersHistory([]);
    setIsGameRunning(true);
    setIsAutoDrawing(false);
    setWinningPattern(null);
    setLastWin(0);
    setGameOver(false);
    setWinningResults([]);
    setTotalPrize(0);
    setLastDrawnNumber(null);
    setCards(prev => prev.map(card => ({
      ...card,
      marks: Array(5).fill(null).map((_, row) => 
        Array(5).fill(false).map((_, col) => row === 2 && col === 2)
      ),
      completedLines: Array(5).fill(null).map(() => Array(5).fill(false)),
    })));
  };

  const playSound = useCallback((soundName: keyof typeof SOUND_URLS) => {
    if (!sound) return;
    new Audio(SOUND_URLS[soundName]).play();
  }, [sound]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGameRunning && isAutoDrawing && !gameOver) {
      interval = setInterval(drawNumber, DRAW_SPEEDS[drawSpeed]);
    }
    return () => clearInterval(interval);
  }, [isGameRunning, isAutoDrawing, gameOver, drawSpeed]);

  const createPreference = async () => {
    try {
      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer APP_USR-3499365808502924-030421-87e0e7b8e7dbeba725542f6d1f07162b-29008060',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{
            title: `Créditos Super Bingo Online - R$ ${selectedAmount.toFixed(2)}`,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: selectedAmount,
          }],
          back_urls: {
            success: window.location.href,
            failure: window.location.href,
            pending: window.location.href,
          },
          auto_return: 'approved',
        }),
      });
      const data = await response.json();
      setPreferenceId(data.id);
    } catch (error) {
      console.error('Error creating payment preference:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-900 to-purple-900 text-white flex flex-col">
      <header className="w-full py-6 px-4 text-center bg-black/30">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-purple-400">
          Super Bingo Online
        </h1>
        <p className="mt-2 text-gray-300">O melhor bingo virtual com prêmios reais!</p>
      </header>

      <main className="flex-1 container mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-violet-800/50 backdrop-blur rounded-xl p-4 border border-violet-700">
            <p className="text-sm text-gray-300 mb-1">Saldo</p>
            <p className="text-2xl font-bold">R$ {balance.toFixed(2)}</p>
          </div>
          <div className="bg-violet-800/50 backdrop-blur rounded-xl p-4 border border-violet-700">
            <p className="text-sm text-gray-300 mb-1">Último Prêmio</p>
            <p className="text-2xl font-bold text-yellow-400">
              {lastWin > 0 ? `R$ ${lastWin.toFixed(2)}` : '-'}
            </p>
          </div>
          <div className="bg-violet-800/50 backdrop-blur rounded-xl p-4 border border-violet-700">
            <p className="text-sm text-gray-300 mb-1">Total de Prêmios</p>
            <p className="text-2xl font-bold text-green-400">R$ {totalPrize.toFixed(2)}</p>
          </div>
          <div className="bg-violet-800/50 backdrop-blur rounded-xl p-4 border border-violet-700">
            <p className="text-sm text-gray-300 mb-1">Números Sorteados</p>
            <p className="text-2xl font-bold">{drawnNumbers.length}/100</p>
          </div>
        </div>

        <div className="flex gap-4 mb-8">
          <button
            onClick={buyCard}
            disabled={balance < CARD_PRICE || cards.length >= MAX_CARDS}
            className={`flex-1 py-4 px-6 rounded-lg font-bold text-lg transition-all ${
              balance < CARD_PRICE || cards.length >= MAX_CARDS
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'
            }`}
          >
            Comprar Cartela (R$ {CARD_PRICE.toFixed(2)})
          </button>
          <button
            onClick={startNewGame}
            disabled={cards.length === 0 || isGameRunning}
            className={`flex-1 py-4 px-6 rounded-lg font-bold text-lg transition-all ${
              cards.length === 0 || isGameRunning
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500'
            }`}
          >
            {isGameRunning ? 'Jogo em Andamento' : 'Iniciar Jogo'}
          </button>
          <button
            onClick={() => setShowHowToPlay(true)}
            className="p-4 rounded-lg bg-violet-800/50 backdrop-blur border border-violet-700 hover:bg-violet-700/50 transition-colors"
          >
            <HelpCircle size={24} />
          </button>
        </div>

        <div className="bg-violet-800/30 p-4 rounded-lg border border-violet-700/50 mb-8">
          <p className="text-yellow-400 font-bold mb-1">Prêmio por Linha Completa</p>
          <p className="text-2xl font-bold">R$ 5,00</p>
        </div>

        {gameOver && (
          <div className="bg-yellow-600/20 border border-yellow-500/50 rounded-xl p-4 mb-8">
            <p className="text-xl font-bold text-yellow-400 text-center mb-4">
              Fim do Jogo!
            </p>
            {winningResults.length > 0 ? (
              <div className="space-y-4">
                <p className="text-lg text-center text-gray-300">
                  Total de Prêmios: R$ {totalPrize.toFixed(2)}
                </p>
                <div className="space-y-2">
                  {winningResults.map((result, index) => (
                    <div key={index} className="bg-violet-800/30 p-3 rounded-lg border border-violet-700/50">
                      <p className="font-bold text-yellow-400">
                        Cartela #{result.cardId.slice(-4)}
                      </p>
                      <p className="text-gray-300">
                        Prêmio: R$ {result.amount.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-300">
                Nenhum prêmio nesta rodada. Tente novamente!
              </p>
            )}
          </div>
        )}

        {isGameRunning && !gameOver && (
          <div className="space-y-4 mb-8">
            <div className="flex gap-4">
              <button
                onClick={drawNumber}
                disabled={isAutoDrawing}
                className={`flex-1 py-4 px-6 rounded-lg font-bold text-lg transition-all ${
                  isAutoDrawing
                    ? 'bg-gray-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500'
                }`}
              >
                Sortear Número
              </button>
              <button
                onClick={() => setIsAutoDrawing(!isAutoDrawing)}
                className={`flex-1 py-4 px-6 rounded-lg font-bold text-lg transition-all ${
                  isAutoDrawing
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                {isAutoDrawing ? 'Parar Sorteio Automático' : 'Iniciar Sorteio Automático'}
              </button>
            </div>
            
            {isAutoDrawing && (
              <div className="flex items-center justify-center gap-4 bg-violet-800/50 backdrop-blur rounded-xl p-4 border border-violet-700">
                <button
                  onClick={() => setDrawSpeed('slow')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    drawSpeed === 'slow' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <Rewind size={16} />
                  Lento
                </button>
                <button
                  onClick={() => setDrawSpeed('normal')}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    drawSpeed === 'normal' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  Normal
                </button>
                <button
                  onClick={() => setDrawSpeed('fast')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    drawSpeed === 'fast' ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  Rápido
                  <FastForward size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {cards.map(card => (
            <div key={card.id} className="bg-violet-800/50 backdrop-blur rounded-xl p-4 border border-violet-700">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-300">Cartela #{card.id.slice(-4)}</span>
                {winningResults.some(result => result.cardId === card.id) && (
                  <span className="text-yellow-400 font-bold">
                    Premiada! R$ {winningResults
                      .filter(result => result.cardId === card.id)
                      .reduce((sum, result) => sum + result.amount, 0)
                      .toFixed(2)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {card.numbers.map((row, rowIndex) => (
                  row.map((number, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`aspect-square flex items-center justify-center rounded-lg text-lg font-bold ${
                        card.completedLines[rowIndex][colIndex]
                          ? 'bg-yellow-500 text-black animate-pulse'
                          : card.marks[rowIndex][colIndex]
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-700 text-gray-300'
                      } ${number === 0 ? 'bg-yellow-600' : ''}`}
                    >
                      {number === 0 ? '★' : number}
                    </div>
                  ))
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-violet-800/50 backdrop-blur rounded-xl p-4 border border-violet-700">
            <h3 className="text-xl font-bold mb-4">Painel de Números</h3>
            <div className="grid grid-cols-10 gap-2">
              {BINGO_NUMBERS.map(number => (
                <div
                  key={number}
                  className={`aspect-square flex items-center justify-center rounded-lg text-sm font-bold ${
                    number === lastDrawnNumber
                      ? 'bg-yellow-500 text-black animate-pulse'
                      : drawnNumbers.includes(number)
                        ? 'bg-green-400 text-black'
                        : 'bg-gray-700/50 text-gray-400'
                  }`}
                >
                  {number}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-violet-800/50 backdrop-blur rounded-xl p-4 border border-violet-700">
            <h3 className="text-xl font-bold mb-4">Histórico de Sorteio</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {drawnNumbersHistory.map((number, index) => (
                <div
                  key={`${number}-${index}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-gray-700/50"
                >
                  <span className="text-sm text-gray-400">#{drawnNumbersHistory.length - index}º</span>
                  <span className="text-lg font-bold text-white">{number}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 font-bold transition-all"
          >
            Adicionar Saldo
          </button>
          <button
            onClick={() => setSound(!sound)}
            className="p-3 rounded-lg bg-violet-800/50 backdrop-blur border border-violet-700 hover:bg-violet-700/50 transition-colors"
          >
            {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>
      </main>

      <footer className="w-full py-6 px-4 bg-black/30 text-center">
        <div className="container mx-auto max-w-2xl">
          <p className="font-medium mb-2">Desenvolvido por Julio Campos Machado</p>
          <p className="text-sm text-gray-400 mb-2">Programador Full Stack</p>
          <div className="flex justify-center gap-4">
            <a 
              href="https://wa.me/5511970603441" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-500 hover:text-green-400 transition-colors"
            >
              WhatsApp: (11) 97060-3441
            </a>
            <a 
              href="https://likelook.wixsite.com/solutions" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-400 transition-colors"
            >
              Like Look Solutions
            </a>
          </div>
        </div>
      </footer>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-violet-900 p-6 rounded-xl max-w-md w-full border border-violet-700">
            <h2 className="text-xl font-bold mb-4">Adicionar Saldo</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[5, 10, 20, 50, 100, 200].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      setSelectedAmount(amount);
                      createPreference();
                    }}
                    className={`p-2 rounded ${
                      selectedAmount === amount
                        ? 'bg-purple-600'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    R$ {amount}
                  </button>
                ))}
              </div>
              {preferenceId && (
                <div className="mt-4">
                </div>
              )}
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPreferenceId(null);
                }}
                className="w-full py-2 px-4 bg-gray-700 rounded hover:bg-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showHowToPlay && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-violet-900 p-6 rounded-xl max-w-2xl w-full border border-violet-700">
            <h2 className="text-2xl font-bold mb-4">Como Jogar</h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Regras Básicas</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Compre até 4 cartelas por R$ {CARD_PRICE.toFixed(2)} cada</li>
                  <li>Cada cartela tem 24 números e um espaço livre no centro</li>
                  <li>Os números são sorteados automaticamente ou manualmente</li>
                  <li>Marque os números sorteados em suas cartelas</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Prêmios</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Linha Completa: R$ 5,00</li>
                  <li>Você pode ganhar múltiplas vezes com a mesma cartela!</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">Dicas</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Quanto mais cartelas, mais chances de ganhar</li>
                  <li>Use o sorteio automático para maior agilidade</li>
                  <li>Fique atento aos números sorteados no painel</li>
                  <li>Os prêmios são acumulativos por cartela</li>
                </ul>
              </div>
            </div>
            <button
              onClick={() => setShowHowToPlay(false)}
              className="w-full mt-6 py-2 px-4 bg-purple-600 rounded hover:bg-purple-500"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;