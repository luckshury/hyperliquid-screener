"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useWebSocket } from "@/contexts/websocket-context";
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

interface Node {
  id: string;
  label: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  volume: number;
  trades: number;
  color: string;
}

interface Edge {
  source: string;
  target: string;
  weight: number;
  coin: string;
}

const NetworkGraph = () => {
  const { fills, isConnected } = useWebSocket();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [coinFilter, setCoinFilter] = useState("");
  const [minTradeSize, setMinTradeSize] = useState(0);
  const animationFrameRef = useRef<number>();

  // Build graph data from fills
  const graphData = useMemo(() => {
    const nodes = new Map<string, Node>();
    const edges: Edge[] = [];
    const connections = new Map<string, Map<string, { weight: number; coin: string }>>();

    // Filter fills
    const filteredFills = fills.filter(fill => {
      if (coinFilter && !fill.coin.toLowerCase().includes(coinFilter.toLowerCase())) return false;
      if (fill.value < minTradeSize) return false;
      return true;
    });

    // Take last 2000 fills for better wallet aggregation
    const recentFills = filteredFills.slice(0, 2000);

    // First pass: aggregate all wallet data
    recentFills.forEach(fill => {
      const address = fill.address;

      // Add or update node
      if (!nodes.has(address)) {
        nodes.set(address, {
          id: address,
          label: address.slice(0, 6) + '...' + address.slice(-4), // Shortened label
          volume: 0,
          trades: 0,
          color: fill.side === 'A' ? '#10b981' : '#ef4444' // green for buy, red for sell
        });
      }

      const node = nodes.get(address)!;
      node.volume += fill.value;
      node.trades += 1;
      
      // Update color based on dominant side
      const buyTrades = recentFills.filter(f => f.address === address && f.side === 'A').length;
      const sellTrades = recentFills.filter(f => f.address === address && f.side === 'B').length;
      node.color = buyTrades > sellTrades ? '#10b981' : '#ef4444';
    });

    // Get top 100 wallets by volume
    const topWallets = Array.from(nodes.values())
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 100);
    
    const topWalletIds = new Set(topWallets.map(w => w.id));

    // Second pass: create edges only between top wallets
    const topWalletFills = recentFills.filter(fill => topWalletIds.has(fill.address));
    
    topWalletFills.forEach(fill => {
      const address = fill.address;
      
      // Create edges between addresses trading the same coin
      topWalletFills.forEach(otherFill => {
        if (otherFill.address !== address && otherFill.coin === fill.coin) {
          const key = [address, otherFill.address].sort().join('-');
          
          if (!connections.has(key)) {
            connections.set(key, new Map());
          }
          
          const coinMap = connections.get(key)!;
          if (!coinMap.has(fill.coin)) {
            coinMap.set(fill.coin, { weight: 0, coin: fill.coin });
          }
          
          const connection = coinMap.get(fill.coin)!;
          connection.weight += fill.value;
        }
      });
    });

    // Convert connections to edges
    connections.forEach((coinMap, key) => {
      const [source, target] = key.split('-');
      coinMap.forEach(({ weight, coin }) => {
        edges.push({ source, target, weight, coin });
      });
    });

    return {
      nodes: topWallets,
      edges: edges.sort((a, b) => b.weight - a.weight).slice(0, 300) // Top 300 edges by weight
    };
  }, [fills, coinFilter, minTradeSize]);

  // Force-directed layout simulation
  useEffect(() => {
    if (!canvasRef.current || isPaused) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize node positions if needed
    graphData.nodes.forEach(node => {
      if (node.x === undefined) {
        node.x = canvas.width / 2 + (Math.random() - 0.5) * 200;
        node.y = canvas.height / 2 + (Math.random() - 0.5) * 200;
        node.vx = 0;
        node.vy = 0;
      }
    });

    const animate = () => {
      // Physics simulation
      const alpha = 0.3;
      const repulsion = 5000;
      const attraction = 0.001;

      // Apply forces
      graphData.nodes.forEach(node => {
        let fx = 0, fy = 0;

        // Repulsion between nodes
        graphData.nodes.forEach(other => {
          if (node.id === other.id) return;
          const dx = node.x! - other.x!;
          const dy = node.y! - other.y!;
          const dist = Math.sqrt(dx * dx + dy * dy) + 1;
          const force = repulsion / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        });

        // Attraction along edges
        graphData.edges.forEach(edge => {
          if (edge.source === node.id) {
            const target = graphData.nodes.find(n => n.id === edge.target);
            if (target) {
              const dx = target.x! - node.x!;
              const dy = target.y! - node.y!;
              fx += dx * attraction * edge.weight;
              fy += dy * attraction * edge.weight;
            }
          }
          if (edge.target === node.id) {
            const source = graphData.nodes.find(n => n.id === edge.source);
            if (source) {
              const dx = source.x! - node.x!;
              const dy = source.y! - node.y!;
              fx += dx * attraction * edge.weight;
              fy += dy * attraction * edge.weight;
            }
          }
        });

        // Center gravity
        fx += (canvas.width / 2 - node.x!) * 0.01;
        fy += (canvas.height / 2 - node.y!) * 0.01;

        // Update velocity and position
        node.vx = (node.vx || 0) * 0.9 + fx * alpha;
        node.vy = (node.vy || 0) * 0.9 + fy * alpha;
        node.x! += node.vx;
        node.y! += node.vy;
      });

      // Render
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(zoom, zoom);

      // Draw edges
      ctx.strokeStyle = 'rgba(255, 186, 0, 0.2)';
      ctx.lineWidth = 1;
      graphData.edges.forEach(edge => {
        const source = graphData.nodes.find(n => n.id === edge.source);
        const target = graphData.nodes.find(n => n.id === edge.target);
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x!, source.y!);
          ctx.lineTo(target.x!, target.y!);
          ctx.stroke();
        }
      });

      // Draw nodes
      graphData.nodes.forEach(node => {
        const radius = Math.max(5, Math.min(20, Math.log(node.volume + 1) * 2));
        
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.strokeStyle = selectedNode?.id === node.id ? '#ffba00' : 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = selectedNode?.id === node.id ? 3 : 1;
        ctx.stroke();

        // Draw label for large nodes or selected node
        if (radius > 10 || selectedNode?.id === node.id) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(node.label, node.x!, node.y! + radius + 12);
        }
      });

      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [graphData, isPaused, zoom, offset, selectedNode]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = canvasRef.current.offsetWidth;
        canvasRef.current.height = canvasRef.current.offsetHeight;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;

    // Check if clicking on a node
    const clickedNode = graphData.nodes.find(node => {
      const dx = node.x! - x;
      const dy = node.y! - y;
      const radius = Math.max(5, Math.min(20, Math.log(node.volume + 1) * 2));
      return Math.sqrt(dx * dx + dy * dy) < radius;
    });

    if (clickedNode) {
      setSelectedNode(clickedNode);
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
  };

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  return (
    <div className="h-full flex flex-col bg-card/50 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div>
          <h2 className="text-lg font-semibold text-primary">Wallet Network Graph - Top 100 by Volume</h2>
          <p className="text-sm text-muted-foreground">
            {isConnected ? `${graphData.nodes.length} wallets, ${graphData.edges.length} connections` : 'Connecting...'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-2 rounded bg-accent/10 hover:bg-accent/20 transition-colors"
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setZoom(prev => Math.min(5, prev * 1.2))}
            className="p-2 rounded bg-accent/10 hover:bg-accent/20 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(0.1, prev * 0.8))}
            className="p-2 rounded bg-accent/10 hover:bg-accent/20 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={resetView}
            className="p-2 rounded bg-accent/10 hover:bg-accent/20 transition-colors"
            title="Reset View"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 p-4 border-b border-border/50">
        <input
          type="text"
          placeholder="Filter by coin..."
          value={coinFilter}
          onChange={(e) => setCoinFilter(e.target.value)}
          className="px-3 py-1.5 bg-background border border-border rounded text-sm"
        />
        <input
          type="number"
          placeholder="Min trade size"
          value={minTradeSize || ''}
          onChange={(e) => setMinTradeSize(Number(e.target.value))}
          className="px-3 py-1.5 bg-background border border-border rounded text-sm w-32"
        />
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-move"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />

        {/* Selected Node Info */}
        {selectedNode && (
          <div className="absolute top-4 right-4 bg-card border border-border rounded-lg p-4 shadow-lg max-w-xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Wallet Details</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Address:</span>
                <span className="font-mono">{selectedNode.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trades:</span>
                <span>{selectedNode.trades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Volume:</span>
                <span>${selectedNode.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-card border border-border rounded-lg p-3 text-xs">
          <div className="font-semibold mb-2">Legend</div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Buyers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Sellers</span>
          </div>
          <div className="mt-2 text-muted-foreground">
            Node size = trading volume
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkGraph;

