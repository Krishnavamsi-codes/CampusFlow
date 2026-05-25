"use client";

import { useEffect, useState, useMemo } from "react";
import { api, RoomStatus } from "../../utils/api";
import RoomCard from "../../components/RoomCard";
import BottomNav from "../../components/BottomNav";
import { Search as SearchIcon, Filter, X } from "lucide-react";
import { motion } from "framer-motion";

export default function SearchPage() {
  const [rooms, setRooms] = useState<RoomStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [activeBatch, setActiveBatch] = useState<string | null>(null);

  const [queryDate, setQueryDate] = useState("");

  const loadRooms = async (dateVal?: string, timeVal?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getRooms(dateVal, timeVal);
      const all: RoomStatus[] = [
        ...data.groupedRooms.G_ROOMS,
        ...data.groupedRooms.B_ROOMS,
        ...data.groupedRooms.FIRST_FLOOR,
      ];
      setRooms(all);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to fetch rooms metadata.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const d = new Date();
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(d.getTime() + tzOffset);

    const hours = String(istTime.getUTCHours()).padStart(2, '0');
    const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');

    const formattedDate = `${year}-${month}-${day}`;

    setQueryDate(formattedDate);

    loadRooms(formattedDate, `${hours}:${minutes}`);
  }, []);

  // Filter Logic
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      // 1. Search Query text
      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        const matchesRoom = r.roomName.toLowerCase().includes(query) || r.roomId.toLowerCase().includes(query);
        const matchesOngoing = r.ongoingClass?.course.toLowerCase().includes(query);
        const matchesNext = r.nextClass?.course.toLowerCase().includes(query);

        if (!matchesRoom && !matchesOngoing && !matchesNext) return false;
      }

      // 2. Room Category Filter
      if (activeCategory && r.category !== activeCategory) return false;

      // 3. Status Filter
      if (activeStatus && r.status !== activeStatus) return false;

      // 4. Batch Ownership Filter
      if (activeBatch) {
        const isOngoingBatch = r.ongoingClass?.batch === activeBatch;
        const isNextBatch = r.nextClass?.batch === activeBatch;
        if (!isOngoingBatch && !isNextBatch) return false;
      }

      return true;
    });
  }, [rooms, searchQuery, activeCategory, activeStatus, activeBatch]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setActiveCategory(null);
    setActiveStatus(null);
    setActiveBatch(null);
  };

  const hasActiveFilters = searchQuery || activeCategory || activeStatus || activeBatch;

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-28">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <SearchIcon className="text-emerald-400" size={22} />
          Search & Filters
        </h1>
        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-1">Drill down classrooms by category, batch, or status</p>
      </header>

      {/* Search Inputs */}
      <div className="relative mb-4">
        <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
          <SearchIcon size={16} />
        </span>
        <input
          type="text"
          placeholder="Search rooms or course prefixes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#0f0f12]/95 text-white border border-zinc-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/10 rounded-2xl py-3.5 pl-11 pr-4 text-xs outline-none transition-all placeholder:text-zinc-500 shadow-inner"
        />
      </div>

      {/* Filter Section */}
      <div className="p-5 bg-[#0f0f12] border border-zinc-850 rounded-2xl mb-6 space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
            <Filter size={11} className="text-emerald-500" /> Filters
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-[9px] font-black uppercase tracking-wider text-rose-450 flex items-center gap-0.5 hover:underline"
            >
              <X size={10} /> Clear All
            </button>
          )}
        </div>

        {/* Categories (Floors) */}
        <div>
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Floor Category</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "G_ROOMS", label: "G Rooms" },
              { id: "B_ROOMS", label: "B Rooms" },
              { id: "FIRST_FLOOR", label: "1st Floor" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                className={`text-[9px] font-extrabold px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${
                  activeCategory === cat.id
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-zinc-950 text-zinc-500 border-zinc-900 hover:text-zinc-300"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Availability</span>
          <div className="flex gap-1.5">
            {[
              { id: "FREE", label: "Free Now" },
              { id: "OCCUPIED", label: "Busy" },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setActiveStatus(activeStatus === st.id ? null : st.id)}
                className={`text-[9px] font-extrabold px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${
                  activeStatus === st.id
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-zinc-950 text-zinc-500 border-zinc-900 hover:text-zinc-300"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Batch */}
        <div>
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Batch Schedule</span>
          <div className="flex gap-1.5">
            {["UG1", "UG2", "UG3", "UG4"].map((b) => (
              <button
                key={b}
                onClick={() => setActiveBatch(activeBatch === b ? null : b)}
                className={`text-[9px] font-extrabold px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${
                  activeBatch === b
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-zinc-950 text-zinc-500 border-zinc-900 hover:text-zinc-300"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search results */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 4, 5].map((s) => (
            <div key={s} className="h-36 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-xs text-zinc-500 text-center py-6 font-semibold">{error}</p>
      ) : filteredRooms.length === 0 ? (
        <div className="text-center py-12 glass border border-zinc-800/80 rounded-3xl p-6 shadow-lg">
          <p className="text-xs text-zinc-450 font-semibold">No classrooms match your filter selections</p>
          <button
            onClick={clearAllFilters}
            className="text-[10px] text-emerald-400 underline font-black uppercase tracking-wider mt-3"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.04
              }
            }
          }}
        >
          <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 px-1">
            Rooms Found ({filteredRooms.length})
          </div>
          <div className="grid grid-cols-2 gap-3">
            {filteredRooms.map((room) => (
              <motion.div
                key={`search-${room.roomId}`}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 25 } }
                }}
              >
                <RoomCard room={room} dateStr={queryDate} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      <BottomNav />
    </div>
  );
}
