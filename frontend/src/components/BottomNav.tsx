"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Zap, Search, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Free Now", href: "/free", icon: Zap },
    { label: "Search", href: "/search", icon: Search },
    { label: "CR Panel", href: "/cr", icon: ShieldAlert },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-50">
      <nav className="flex items-center justify-around h-16 glass rounded-full shadow-[0_12px_30px_rgba(0,0,0,0.5)] px-3 relative border border-zinc-800/80">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center flex-1 h-full py-1 text-center select-none"
            >
              <div className="relative flex flex-col items-center justify-center">
                {/* Active Indicator Background Glow */}
                {isActive && (
                  <motion.div
                    layoutId="activeGlow"
                    className="absolute -inset-x-4 -inset-y-2 bg-emerald-500/10 rounded-full blur-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}

                <Icon
                  size={18}
                  className={`transition-all duration-300 relative z-10 ${
                    isActive
                      ? "text-emerald-400 scale-110 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                />

                <span
                  className={`text-[9px] mt-1 font-semibold transition-all duration-300 relative z-10 ${
                    isActive ? "text-emerald-400" : "text-zinc-500"
                  }`}
                >
                  {item.label}
                </span>

                {/* Active Indicator Dot Bar */}
                {isActive && (
                  <motion.div
                    layoutId="activeBar"
                    className="absolute -bottom-1.5 w-1 h-1 bg-emerald-400 rounded-full drop-shadow-[0_0_4px_rgba(16,185,129,0.6)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
