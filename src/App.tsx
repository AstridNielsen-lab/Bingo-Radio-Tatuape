import React, { useState, useCallback, useEffect } from 'react';
import { Volume2, VolumeX, Plus, Minus, Play, Square, Award } from 'lucide-react';

// Tipos
type BingoCard = {
  id: string;
  numbers: number[][];
  marks: boolean[][];
};

type WinPattern = 'line' | 'column' | 'full';

const CARD_PRICE = 5;
const MAX_CARDS = 4;
const BINGO_NUMBERS = Array.from({ length: 75 }, (_, i) => i + 1);
const WIN_MULTIPLIERS = {
  line: 10,
  column: 10,
  full: 50,
};

function App() {
  const [balance, setBalance] = useState(20);
  const [cards, setCards] = useState<BingoCard[]>([]);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [sound, setSound] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(5);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [lastWin, setLastWin] = useState(0);
  const [winningPattern, setWinningPattern] = useState<WinPattern | null>(null);

  // Gerar uma cartela de bingo
  const generateBingoCard = (): BingoCard => {
    const numbers: number[][] = Array(5).fill(null).map(() => Array(5).fill(0));
    const marks: boolean[][] = Array(5).fill(null).map(() => Array(5).fill(false));
    
    // Preencher cada coluna com números apropriados
    for (let col = 0; col < 5; col++) {
      const min = col * 15 + 1;
      const max = min + 14;
      const columnNumbers = Array.from({ length: 15 }, (_, i) => min + i);
      
      // Embaralhar e pegar os primeiros 5 números
      for (let row = 0; row < 5; row++) {
        const randomIndex = Math.floor(Math.random() * columnNumbers.length);
        numbers[row][col] = columnNumbers.splice(randomIndex, 1)[0];
      }
    }

    // Espaço central livre
    numbers[2][2] = 0;
    marks[2][2] = true;

    return {
      id: Math.random().toString(36).substr(2, 9),
      numbers,
      marks,
    };
  };

  // Comprar uma nova cartela
  const buyCard = () => {
    if (balance >= CARD_PRICE && cards.length < MAX_CARDS) {
      setBalance(prev => prev - CARD_PRICE);
      setCards(prev => [...prev, generateBingoCard()]);
      playSound('buy');
    }
  };

  // Verificar vitória
  const checkWin = (card: BingoCard): WinPattern | null => {
    // Verificar linhas
    for (let row = 0; row < 5; row++) {
      if (card.marks[row].every(mark => mark)) return 'line';
    }

    // Verificar colunas
    for (let col = 0; col < 5; col++) {
      if (card.marks.every(row => row[col])) return 'column';
    }

    // Verificar cartela completa
    if (card.marks.every(row => row.every(mark => mark))) return 'full';

    return null;
  };

  // Marcar número na cartela
  const markNumber = (number: number) => {
    setCards(prev => prev.map(card => {
      const newMarks = [...card.marks.map(row => [...row])];
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          if (card.numbers[row][col] === number) {
            newMarks[row][col] = true;
          }
        }
      }
      return { ...card, marks: newMarks };
    }));
  };

  // Sortear próximo número
  const drawNumber = () => {
    if (!isGameRunning) return;

    const remainingNumbers = BINGO_NUMBERS.filter(n => !drawnNumbers.includes(n));
    if (remainingNumbers.length === 0) {
      setIsGameRunning(false);
      return;
    }

    const randomIndex = Math.floor(Math.random() * remainingNumbers.length);
    const newNumber = remainingNumbers[randomIndex];
    
    setDrawnNumbers(prev => [...prev, newNumber]);
    markNumber(newNumber);
    playSound('draw');

    // Verificar vitórias
    cards.forEach(card => {
      const pattern = checkWin(card);
      if (pattern) {
        const winAmount = CARD_PRICE * WIN_MULTIPLIERS[pattern];
        setBalance(prev => prev + winAmount);
        setLastWin(winAmount);
        setWinningPattern(pattern);
        playSound('win');
      }
    });
  };

  // Iniciar novo jogo
  const startNewGame = () => {
    if (cards.length === 0) return;
    setDrawnNumbers([]);
    setIsGameRunning(true);
    setWinningPattern(null);
    setLastWin(0);
    setCards(prev => prev.map(card => ({
      ...card,
      marks: Array(5).fill(null).map((_, row) => 
        Array(5).fill(false).map((_, col) => row === 2 && col === 2)
      ),
    })));
  };

  // Efeitos sonoros
  const playSound = useCallback((soundName: 'draw' | 'win' | 'buy') => {
    if (!sound) return;
    const sounds = {
      draw: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
      win: 'https://assets.mixkit.co/active_storage/sfx/2001/2001-preview.mp3',
      buy: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
    };
    new Audio(sounds[soundName]).play();
  }, [sound]);

  // Sorteio automático
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGameRunning) {
      interval = setInterval(drawNumber, 3000);
    }
    return () => clearInterval(interval);
  }, [isGameRunning]);

  // Criar preferência de pagamento
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
            title: `Créditos Bingo Rádio Tatuapé - R$ ${selectedAmount.toFixed(2)}`,
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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col">
      {/* Header */}
      <header className="w-full py-6 px-4 text-center bg-black/30">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
          Bingo Rádio Tatuapé
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto max-w-6xl px-4 py-8">
        {/* Status Bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-gray-700">
            <p className="text-sm text-gray-400 mb-1">Saldo</p>
            <p className="text-2xl font-bold">R$ {balance.toFixed(2)}</p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-gray-700">
            <p className="text-sm text-gray-400 mb-1">Último Prêmio</p>
            <p className="text-2xl font-bold text-green-500">
              {lastWin > 0 ? `R$ ${lastWin.toFixed(2)}` : '-'}
            </p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-gray-700">
            <p className="text-sm text-gray-400 mb-1">Números Sorteados</p>
            <p className="text-2xl font-bold">{drawnNumbers.length}/75</p>
          </div>
        </div>

        {/* Game Controls */}
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
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'
            }`}
          >
            {isGameRunning ? 'Jogo em Andamento' : 'Iniciar Jogo'}
          </button>
        </div>

        {/* Bingo Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {cards.map(card => (
            <div key={card.id} className="bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-gray-700">
              <div className="grid grid-cols-5 gap-2">
                {card.numbers.map((row, rowIndex) => (
                  row.map((number, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`aspect-square flex items-center justify-center rounded-lg text-lg font-bold ${
                        card.marks[rowIndex][colIndex]
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-300'
                      } ${number === 0 ? 'bg-pink-600' : ''}`}
                    >
                      {number === 0 ? '★' : number}
                    </div>
                  ))
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Drawn Numbers */}
        {drawnNumbers.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-gray-700 mb-8">
            <h3 className="text-xl font-bold mb-4">Números Sorteados</h3>
            <div className="grid grid-cols-10 gap-2">
              {BINGO_NUMBERS.map(number => (
                <div
                  key={number}
                  className={`aspect-square flex items-center justify-center rounded-lg text-sm font-bold ${
                    drawnNumbers.includes(number)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700/50 text-gray-400'
                  }`}
                >
                  {number}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 font-bold transition-all"
          >
            Adicionar Saldo
          </button>
          <button
            onClick={() => setSound(!sound)}
            className="p-3 rounded-lg bg-gray-800/50 backdrop-blur border border-gray-700 hover:bg-gray-700/50 transition-colors"
          >
            {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>
      </main>

      {/* Footer */}
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

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 p-6 rounded-xl max-w-md w-full border border-gray-700">
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
                  {/* Aqui vai o componente do Mercado Pago */}
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
    </div>
  );
}

export default App;