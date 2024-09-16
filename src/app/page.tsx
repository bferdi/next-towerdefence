"use client";
import { useState, useEffect } from 'react'
import { ShoppingCart, Shield, AlertTriangle, Heart, Activity } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import toast, { Toaster } from 'react-hot-toast'

const gridSize = 11 // Increased grid size

type Unit = {
  name: string;
  price: number;
  icon: string;
  type: 'unit' | 'building' | 'action' | 'defense';
  attackRange?: number;
  attackPower?: number;
  attackRate?: number; // Attacks per second
  attackType?: 'melee' | 'ranged' | 'magic';
}

type PlacedUnit = Unit & {
  id: string;
  health: number;
  status: 'active' | 'damaged' | 'destroyed';
  position: { row: number; col: number };
  lastAttackTime?: number;
}

type EnemyUnit = {
  id: string;
  health: number;
  position: { row: number; col: number };
  attackPower: number;
  attackRate: number; // Attacks per second
  lastAttackTime?: number;
  isStrong?: boolean; // Indicates if the enemy is a stronger version
}

export default function TowerDefenseGame() {
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null)
  const [alertMessage, setAlertMessage] = useState('')
  const [placedUnits, setPlacedUnits] = useState<Record<string, PlacedUnit>>({})
  const [enemyUnits, setEnemyUnits] = useState<Record<string, EnemyUnit>>({})
  const [playerMoney, setPlayerMoney] = useState(500)
  const [baseHealth, setBaseHealth] = useState(100)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [gameInProgress, setGameInProgress] = useState(false)

  const shopItems: Unit[] = [
    {
      name: 'Warrior',
      price: 100,
      icon: '⚔️',
      type: 'unit',
      attackRange: 1,
      attackPower: 20,
      attackRate: 1, // Attacks per second
      attackType: 'melee'
    },
    {
      name: 'Archer',
      price: 120,
      icon: '🏹',
      type: 'unit',
      attackRange: 3,
      attackPower: 15,
      attackRate: 0.5, // Attacks every 2 seconds
      attackType: 'ranged'
    },
    {
      name: 'Mage',
      price: 150,
      icon: '🧙',
      type: 'unit',
      attackRange: gridSize,
      attackPower: 10,
      attackRate: 0.2, // Attacks every 5 seconds
      attackType: 'magic'
    },
    {
      name: 'Tower',
      price: 80,
      icon: '🏰',
      type: 'defense',
      attackRange: 3,
      attackPower: 15,
      attackRate: 0.5,
      attackType: 'ranged'
    },
    { name: 'Wall', price: 50, icon: '🧱', type: 'defense' },
    { name: 'Farm', price: 200, icon: '🏠', type: 'building' },
    { name: 'Heal', price: 50, icon: '❤️', type: 'action' },
  ]

  const handleShopItemClick = (item: Unit) => {
    if (playerMoney >= item.price) {
      setSelectedUnit(item)
      setAlertMessage(`${item.name} selected. Click on the grid to ${item.type === 'action' ? 'use' : 'place'}.`)
    } else {
      setAlertMessage(`Not enough money to purchase ${item.name}`)
    }
  }

  const handleGridCellClick = (rowIndex: number, colIndex: number) => {
    if (selectedUnit) {
      const cellId = `${rowIndex}-${colIndex}`
      const isEnemyHere = Object.values(enemyUnits).some(
        enemy => enemy.position.row === rowIndex && enemy.position.col === colIndex
      )
      if (isEnemyHere) {
        setAlertMessage('Cannot perform action on a cell occupied by an enemy')
        return
      }
      if (selectedUnit.type === 'unit' || selectedUnit.type === 'building' || selectedUnit.type === 'defense') {
        if (!placedUnits[cellId]) {
          setPlacedUnits(prev => ({
            ...prev,
            [cellId]: {
              ...selectedUnit,
              id: cellId,
              health: 100,
              status: 'active',
              position: { row: rowIndex, col: colIndex },
              lastAttackTime: 0,
            }
          }))
          setPlayerMoney(prevMoney => prevMoney - selectedUnit.price)
          setAlertMessage(`${selectedUnit.name} placed at position (${rowIndex}, ${colIndex})`)
          setSelectedUnit(null)
        } else {
          setAlertMessage('There is already a unit here')
        }
      } else if (selectedUnit.type === 'action') {
        if (selectedUnit.name === 'Heal') {
          const unitToHeal = placedUnits[cellId]
          if (unitToHeal && unitToHeal.status !== 'destroyed') {
            if (playerMoney >= selectedUnit.price) {
              setPlayerMoney(prevMoney => prevMoney - selectedUnit.price)
              setPlacedUnits(prev => ({
                ...prev,
                [cellId]: {
                  ...unitToHeal,
                  health: Math.min(100, unitToHeal.health + 30),
                  status: unitToHeal.health + 30 >= 50 ? 'active' : 'damaged'
                }
              }))
              setAlertMessage(`${unitToHeal.name} healed at position (${rowIndex}, ${colIndex})`)
              setSelectedUnit(null)
            } else {
              setAlertMessage('Not enough money to heal the unit')
            }
          } else {
            setAlertMessage('No unit to heal at this position')
          }
        }
      }
    } else {
      setAlertMessage('Select an item from the shop first')
    }
  }

  const resetGame = () => {
    setSelectedUnit(null)
    setAlertMessage('')
    setPlacedUnits({})
    setEnemyUnits({})
    setPlayerMoney(500)
    setBaseHealth(100)
    setGameOver(false)
    setGameStarted(false)
    setGameInProgress(false)
  }

  // Generate income from buildings (starts after pressing "Go")
  useEffect(() => {
    if (!gameInProgress || gameOver) return

    const incomeInterval = setInterval(() => {
      let income = 0
      Object.values(placedUnits).forEach(unit => {
        if (unit.type === 'building' && unit.status !== 'destroyed') {
          income += 10  // Each building generates 10 money per interval
        }
      })
      if (income > 0) {
        setPlayerMoney(prevMoney => prevMoney + income)
      }
    }, 1000)  // Every second

    return () => clearInterval(incomeInterval)
  }, [gameInProgress, gameOver]) // Removed placedUnits from dependencies

  // Spawn enemies at intervals with strength adjustment, including new stronger enemies
  useEffect(() => {
    if (!gameInProgress || gameOver) return

    const spawnInterval = setInterval(() => {
      // Regular enemy spawning logic
      const enemyCount = Object.keys(enemyUnits).length
      const isStrong = enemyCount >= 10

      const baseHealth = 100
      const baseAttackPower = 10

      const enemyHealth = isStrong ? baseHealth * 3 : baseHealth
      const enemyAttackPower = isStrong ? baseAttackPower * 2 : baseAttackPower

      const edgePositions = []
      for (let i = 0; i < gridSize; i++) {
        edgePositions.push({ row: 0, col: i })  // Top edge
        edgePositions.push({ row: gridSize - 1, col: i })  // Bottom edge
        edgePositions.push({ row: i, col: 0 })  // Left edge
        edgePositions.push({ row: i, col: gridSize - 1 })  // Right edge
      }
      const spawnPosition = edgePositions[Math.floor(Math.random() * edgePositions.length)]
      const enemyId = `enemy-${Date.now()}-${Math.random()}`
      setEnemyUnits(prev => ({
        ...prev,
        [enemyId]: {
          id: enemyId,
          health: enemyHealth,
          position: spawnPosition,
          attackPower: enemyAttackPower,
          attackRate: 1, // Attacks per second
          lastAttackTime: 0,
          isStrong: isStrong,
        }
      }))

      // **Stronger enemies at (0,5) and (10,5)**:
      const strongEnemyPositions = [{ row: 0, col: 5 }, { row: 10, col: 5 }]
      strongEnemyPositions.forEach(pos => {
        const strongEnemyId = `strong-enemy-${Date.now()}-${Math.random()}`
        setEnemyUnits(prev => ({
          ...prev,
          [strongEnemyId]: {
            id: strongEnemyId,
            health: 100,  // Stronger enemy health
            position: pos,
            attackPower: 13,  // Stronger attack power
            attackRate: .5,  // Attacks per second
            lastAttackTime: 0,
            isStrong: true,
          }
        }))
      })
    }, 15000)  // Spawn enemies every 15 seconds

    return () => clearInterval(spawnInterval)
  }, [gameInProgress, gameOver])

 // Move enemies towards the center and attack the base
useEffect(() => {
  if (!gameInProgress || gameOver) return;

  const moveInterval = setInterval(() => {
    setEnemyUnits(prev => {
      const newEnemyUnits = { ...prev };
      Object.values(newEnemyUnits).forEach(enemy => {
        const targetRow = Math.floor(gridSize / 2);
        const targetCol = Math.floor(gridSize / 2);
        let nextRow = enemy.position.row;
        let nextCol = enemy.position.col;

        // Prioritize vertical movement towards the center
        if (enemy.position.row !== targetRow) {
          nextRow = enemy.position.row + Math.sign(targetRow - enemy.position.row);
        } else if (enemy.position.col !== targetCol) {
          // Then prioritize horizontal movement towards the center
          nextCol = enemy.position.col + Math.sign(targetCol - enemy.position.col);
        }

        const nextCellId = `${nextRow}-${nextCol}`;
        const isOccupied = placedUnits[nextCellId];

        if (!isOccupied) {
          // Move enemy if the cell is not occupied
          enemy.position.row = nextRow;
          enemy.position.col = nextCol;
        }

        // Check if enemy reached the base (center of the grid)
        if (enemy.position.row === targetRow && enemy.position.col === targetCol) {
          // Enemy reached the base, damage the base
          setBaseHealth(prevHealth => {
            const newHealth = prevHealth - enemy.attackPower; // Damage base based on enemy attack power
            if (newHealth <= 0) {
              setGameOver(true);
              toast.error('Game Over! Your base has been destroyed.', {
                icon: '💥',
                duration: 5000,
                style: {
                  background: '#374151',
                  color: '#fff',
                  border: '1px solid #4B5563',
                },
              });
              return 0;
            } else {
              toast.error('An enemy has damaged your base!', {
                icon: '💥',
                duration: 3000,
                style: {
                  background: '#374151',
                  color: '#fff',
                  border: '1px solid #4B5563',
                },
              });
              return newHealth;
            }
          });
          delete newEnemyUnits[enemy.id]; // Remove the enemy after attacking the base
        }
      });
      return newEnemyUnits;
    });
  }, 1000); // Move every second

  return () => clearInterval(moveInterval);
}, [gameInProgress, gameOver]);

  // Combat between units and enemies with attack rates
  useEffect(() => {
    if (!gameInProgress || gameOver) return

    const combatInterval = setInterval(() => {
      const currentTime = Date.now()

      setEnemyUnits(prevEnemies => {
        let newEnemies = { ...prevEnemies }
        setPlacedUnits(prevUnits => {
          let newUnits = { ...prevUnits }
          Object.values(newUnits).forEach(unit => {
            if (unit.status === 'destroyed' || !unit.attackPower || !unit.attackRate) return
            const unitRow = unit.position.row
            const unitCol = unit.position.col

            if (currentTime - (unit.lastAttackTime || 0) >= (1000 / unit.attackRate)) {
              Object.values(newEnemies).forEach(enemy => {
                const enemyRow = enemy.position.row
                const enemyCol = enemy.position.col
                const distance = Math.abs(unitRow - enemyRow) + Math.abs(unitCol - enemyCol)

                let canAttack = false
                if (unit.attackType === 'melee') {
                  canAttack = distance === 1
                } else if (unit.attackType === 'ranged') {
                  canAttack = distance <= (unit.attackRange || 1) && distance > 1
                } else if (unit.attackType === 'magic') {
                  canAttack = true
                } else {
                  canAttack = false
                }

                if (canAttack) {
                  enemy.health -= unit.attackPower || 0
                  unit.lastAttackTime = currentTime
                  if (enemy.health <= 0) {
                    delete newEnemies[enemy.id]
                    setPlayerMoney(prevMoney => prevMoney + 20)
                    toast.success('Enemy defeated', {
                      icon: '⚔️',
                      duration: 2000,
                      style: {
                        background: '#374151',
                        color: '#fff',
                        border: '1px solid #4B5563',
                      },
                    })
                  }
                }
              })
            }
          })

          newUnits = Object.fromEntries(
            Object.entries(newUnits).filter(([_, unit]) => unit.status !== 'destroyed')
          )

          return newUnits
        })

        return newEnemies
      })

      setPlacedUnits(prevUnits => {
        let newUnits = { ...prevUnits }
        setEnemyUnits(prevEnemies => {
          let newEnemies = { ...prevEnemies }
          Object.values(newEnemies).forEach(enemy => {
            const enemyRow = enemy.position.row
            const enemyCol = enemy.position.col

            if (currentTime - (enemy.lastAttackTime || 0) >= (1000 / enemy.attackRate)) {
              Object.values(newUnits).forEach(unit => {
                if (unit.status === 'destroyed') return
                const unitRow = unit.position.row
                const unitCol = unit.position.col
                const distance = Math.abs(unitRow - enemyRow) + Math.abs(unitCol - enemyCol)

                if (distance === 1) {
                  unit.health -= enemy.attackPower
                  enemy.lastAttackTime = currentTime
                  if (unit.health <= 0) {
                    unit.health = 0
                    unit.status = 'destroyed'
                    toast.error(`${unit.name} has been destroyed by an enemy!`, {
                      icon: unit.icon,
                      duration: 3000,
                      style: {
                        background: '#374151',
                        color: '#fff',
                        border: '1px solid #4B5563',
                      },
                    })
                  } else if (unit.health < 50) {
                    unit.status = 'damaged'
                  }
                }
              })
            }
          })

          newEnemies = Object.fromEntries(
            Object.entries(newEnemies).filter(([_, enemy]) => enemy.health > 0)
          )

          return newEnemies
        })

        newUnits = Object.fromEntries(
          Object.entries(newUnits).filter(([_, unit]) => unit.status !== 'destroyed')
        )

        return newUnits
      })
    }, 100)

    return () => clearInterval(combatInterval)
  }, [gameInProgress, gameOver])

  if (!gameStarted) {
    return (
      <div className="flex h-screen bg-gray-900 text-white p-4 items-center justify-center">
        <button
          onClick={() => setGameStarted(true)}
          className="bg-blue-500 px-6 py-3 rounded text-2xl font-bold hover:bg-blue-600 transition-colors"
        >
          Start Game
        </button>
      </div>
    )
  }

  if (gameOver) {
    return (
      <div className="flex h-screen bg-gray-900 text-white p-4 flex-col items-center justify-center">
        <h1 className="text-5xl font-bold mb-4">Game Over</h1>
        <button
          onClick={resetGame}
          className="bg-blue-500 px-6 py-3 rounded text-2xl font-bold hover:bg-blue-600 transition-colors"
        >
          Restart Game
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white p-4">
      <Toaster position="top-center" />
      {/* Shop */}
      <div className="w-1/5 bg-gray-800 p-4 rounded-l-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold flex items-center">
            <ShoppingCart className="mr-2" /> Shop
          </h2>
          <div className="text-xl">
            💰 {playerMoney}
          </div>
        </div>
        <div className="space-y-2">
          {shopItems.map((item) => (
            <button
              key={item.name}
              className={`w-full bg-gray-700 p-2 rounded flex justify-between items-center hover:bg-gray-600 transition-colors ${playerMoney < item.price ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => handleShopItemClick(item)}
              disabled={playerMoney < item.price}
            >
              <span>{item.icon} {item.name}</span>
              <span>{item.price} 💰</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Game Board */}
      <div className="w-3/5 flex flex-col">
        <div className="flex-grow grid place-items-center p-4">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}>
            {Array.from({ length: gridSize }).map((_, rowIndex) => (
              Array.from({ length: gridSize }).map((_, colIndex) => {
                const isCenter = rowIndex === Math.floor(gridSize / 2) && colIndex === Math.floor(gridSize / 2)
                const cellId = `${rowIndex}-${colIndex}`
                const placedUnit = placedUnits[cellId]
                const enemyHere = Object.values(enemyUnits).find(
                  enemy => enemy.position.row === rowIndex && enemy.position.col === colIndex
                )
                const isEnemyHere = !!enemyHere
                return (
                  <Popover.Root key={cellId}>
                    <Popover.Trigger asChild>
                      <button
                        className={`w-10 h-10 rounded flex items-center justify-center text-xl
                          ${isCenter ? 'bg-red-500' :
                            isEnemyHere ? 'bg-purple-700' :
                              placedUnit ?
                                placedUnit.status === 'active' ? 'bg-blue-500' :
                                  placedUnit.status === 'damaged' ? 'bg-yellow-500' :
                                    'bg-gray-500' :
                              'bg-gray-700'}
                          ${!isCenter && !placedUnit && !isEnemyHere ? 'hover:bg-gray-600' : ''} transition-colors`}
                        onClick={() => !isCenter && handleGridCellClick(rowIndex, colIndex)}
                        disabled={isCenter || (placedUnit && selectedUnit && selectedUnit.type !== 'action') || false}
                      >
                        {isCenter ? <Shield className="w-6 h-6" /> : placedUnit?.icon || (isEnemyHere && '👹')}
                      </button>
                    </Popover.Trigger>
                    {(placedUnit || isEnemyHere) && (
                      <Popover.Portal>
                        <Popover.Content
                          className="rounded p-2 bg-gray-800 text-white shadow-md border border-gray-700"
                          sideOffset={5}
                        >
                          {placedUnit && (
                            <div className="flex flex-col">
                              <span className="font-bold">{placedUnit.name}</span>
                              <span>Health: {placedUnit.health}%</span>
                              <span>Status: {placedUnit.status}</span>
                              {placedUnit.attackPower && <span>Attack Power: {placedUnit.attackPower}</span>}
                              {placedUnit.attackRate && <span>Attack Rate: {placedUnit.attackRate} per sec</span>}
                            </div>
                          )}
                          {isEnemyHere && enemyHere && (
                            <div className="flex flex-col">
                              <span className="font-bold">{enemyHere.isStrong ? 'Strong Enemy' : 'Enemy'}</span>
                              <span>Health: {enemyHere.health}%</span>
                              <span>Attack Power: {enemyHere.attackPower}</span>
                              <span>Attack Rate: {enemyHere.attackRate} per sec</span>
                            </div>
                          )}
                          <Popover.Arrow className="fill-gray-800" />
                        </Popover.Content>
                      </Popover.Portal>
                    )}
                  </Popover.Root>
                )
              })
            ))}
          </div>
        </div>

        {/* Alert Area */}
        <div className="bg-gray-800 p-4 rounded-br-lg flex justify-between items-center">
          <div className="flex items-center">
            <AlertTriangle className="mr-2 text-yellow-500" />
            <p>{alertMessage || 'Select an item to begin.'}</p>
          </div>
          {!gameInProgress && (
            <button
              onClick={() => {
                setGameInProgress(true)
                setAlertMessage('Game has started! Enemies are approaching.')
              }}
              className="bg-green-500 px-4 py-2 rounded text-lg font-bold hover:bg-green-600 transition-colors"
            >
              Go
            </button>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="w-1/5 bg-gray-800 p-4 rounded-r-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold flex items-center">
            <Activity className="mr-2" /> Status
          </h2>
          <div className="text-xl flex items-center">
            <Shield className="mr-1" /> {baseHealth}%
          </div>
        </div>
        <h3 className="text-xl font-bold mb-2">Units</h3>
        <div className="space-y-2">
          {Object.values(placedUnits).map((unit) => (
            <div key={unit.id} className="bg-gray-700 p-2 rounded">
              <div className="flex justify-between items-center">
                <span>{unit.icon} {unit.name}</span>
                <Heart className={`w-4 h-4 ${
                  unit.status === 'active' ? 'text-green-500' :
                    unit.status === 'damaged' ? 'text-yellow-500' :
                      'text-red-500'
                }`} />
              </div>
              <div className="mt-1 bg-gray-600 rounded-full h-2">
                <div
                  className={`h-full rounded-full ${
                    unit.status === 'active' ? 'bg-green-500' :
                      unit.status === 'damaged' ? 'bg-yellow-500' :
                        'bg-red-500'
                  }`}
                  style={{ width: `${unit.health}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <h3 className="text-xl font-bold mt-4 mb-2">Enemies</h3>
        <div className="space-y-2">
          {Object.values(enemyUnits).map((enemy) => (
            <div key={enemy.id} className="bg-gray-700 p-2 rounded">
              <div className="flex justify-between items-center">
                <span>{enemy.isStrong ? '👹 Strong Enemy' : '👹 Enemy'}</span>
                <Heart className="w-4 h-4 text-red-500" />
              </div>
              <div className="mt-1 bg-gray-600 rounded-full h-2">
                <div
                  className="h-full rounded-full bg-red-500"
                  style={{ width: `${enemy.health}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
