"use client";

import { useState, useEffect } from 'react';
import { Search, Bell, User, TrendingUp, FileText, DollarSign, BarChart3, Activity } from 'lucide-react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

const tickerData = [
  { symbol: 'BTC', price: '$95733.70', change: -1.18 },
  { symbol: 'ETH', price: '$3147.20', change: -0.68 },
  { symbol: 'SOL', price: '$140.76', change: -0.47 },
  { symbol: 'BNB', price: '$930.90', change: 2.17 },
  { symbol: 'XRP', price: '$2.25', change: -1.32 },
  { symbol: 'ADA', price: '$0.5012', change: -2.85 },
  { symbol: 'DOGE', price: '$0.1610', change: -1.00 },
  { symbol: 'AVAX', price: '$15.36', change: -1.16 },
];

const TickerItem = ({ item }: { item: (typeof tickerData)[0] }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="font-bold text-foreground">{item.symbol}</span>
    <span className="text-muted-foreground">{item.price}</span>
    <span className={`transition-colors duration-200 ${item.change >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
      {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
    </span>
  </div>
);

const HeaderBar = () => {
    const [nyTime, setNyTime] = useState<string>('');
    const [lonTime, setLonTime] = useState<string>('');
    const [searchOpen, setSearchOpen] = useState(false);

    useEffect(() => {
        const updateClocks = () => {
            const now = new Date();
            const timeOptions: Intl.DateTimeFormatOptions = {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            };
            setNyTime(now.toLocaleTimeString('en-US', { ...timeOptions, timeZone: 'America/New_York' }));
            setLonTime(now.toLocaleTimeString('en-US', { ...timeOptions, timeZone: 'Europe/London' }));
        };

        updateClocks();
        const intervalId = setInterval(updateClocks, 1000);

        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setSearchOpen((open) => !open);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    return (
        <>
            <header className="flex flex-col border-b bg-card">
                <div className="flex flex-col sm:flex-row h-auto sm:h-14 items-start sm:items-center justify-between gap-3 sm:gap-0 px-3 sm:px-6 py-3 sm:py-0 border-b border-border">
                    <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                        <div className="relative flex items-center flex-1 sm:flex-none">
                            <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                            <button
                                onClick={() => setSearchOpen(true)}
                                className="h-9 w-full sm:w-96 rounded border border-input bg-input pl-10 pr-4 text-sm text-left text-muted-foreground hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all duration-200"
                            >
                                Search the app
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
                        <div className="flex items-center gap-2">
                            <div className="relative flex items-center">
                                <div className="h-2 w-2 rounded-full bg-terminal-green live-indicator-pulse"></div>
                            </div>
                            <span className="text-[10px] sm:text-xs text-muted-foreground">LIVE</span>
                        </div>

                        <div className="text-xs sm:text-sm">
                            <span className="text-muted-foreground">NY </span>
                            <span className="text-primary font-semibold">{nyTime || '05:11:57'}</span>
                        </div>

                        <div className="text-xs sm:text-sm">
                            <span className="text-muted-foreground">LON </span>
                            <span className="font-semibold">{lonTime || '10:11:57'}</span>
                        </div>

                        <button className="relative rounded p-2 hover:bg-accent/10 transition-all duration-200" aria-label="Notifications">
                          <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive animate-pulse"></span>
                        </button>
                        
                        <div className="flex items-center gap-2" data-clerk-component="UserButton">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-10 overflow-hidden bg-secondary/50">
                    <div className="flex items-center h-full">
                        <div className="flex gap-8 whitespace-nowrap px-4 animate-[ticker-tape_60s_linear_infinite]">
                            {[...tickerData, ...tickerData].map((item, index) => (
                               <TickerItem key={`${item.symbol}-${index}`} item={item} />
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
                <CommandInput placeholder="Search the app..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading="Navigation">
                        <CommandItem onSelect={() => setSearchOpen(false)}>
                            <Activity className="h-4 w-4" />
                            <span>Screener</span>
                        </CommandItem>
                        <CommandItem onSelect={() => setSearchOpen(false)}>
                            <BarChart3 className="h-4 w-4" />
                            <span>Markets</span>
                        </CommandItem>
                        <CommandItem onSelect={() => setSearchOpen(false)}>
                            <TrendingUp className="h-4 w-4" />
                            <span>Pivot Analysis</span>
                        </CommandItem>
                        <CommandItem onSelect={() => setSearchOpen(false)}>
                            <DollarSign className="h-4 w-4" />
                            <span>Currencies</span>
                        </CommandItem>
                        <CommandItem onSelect={() => setSearchOpen(false)}>
                            <FileText className="h-4 w-4" />
                            <span>Analytics</span>
                        </CommandItem>
                    </CommandGroup>
                    <CommandGroup heading="Securities">
                        <CommandItem onSelect={() => setSearchOpen(false)}>
                            <span className="font-bold text-primary">BTC</span>
                            <span className="text-muted-foreground ml-auto">Bitcoin</span>
                        </CommandItem>
                        <CommandItem onSelect={() => setSearchOpen(false)}>
                            <span className="font-bold text-primary">ETH</span>
                            <span className="text-muted-foreground ml-auto">Ethereum</span>
                        </CommandItem>
                        <CommandItem onSelect={() => setSearchOpen(false)}>
                            <span className="font-bold text-primary">SOL</span>
                            <span className="text-muted-foreground ml-auto">Solana</span>
                        </CommandItem>
                        <CommandItem onSelect={() => setSearchOpen(false)}>
                            <span className="font-bold text-primary">BNB</span>
                            <span className="text-muted-foreground ml-auto">BNB</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    );
};

export default HeaderBar;