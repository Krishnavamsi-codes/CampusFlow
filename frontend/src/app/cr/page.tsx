"use client";

import { useEffect, useState } from "react";
import { api, CRUser, RawSchedule, RoomStatus, saveAuthToken, clearAuthToken, getCRUserMeta, getAuthToken } from "../../utils/api";
import BottomNav from "../../components/BottomNav";
import { ShieldAlert, LogOut, Key, User, Calendar, RefreshCw, Ban, Move, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CRPanelPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [crMeta, setCrMeta] = useState<CRUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [schedules, setSchedules] = useState<RawSchedule[]>([]);
  const [allRooms, setAllRooms] = useState<string[]>([]);

  // Submitting States
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick Move form states
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [targetRoomId, setTargetRoomId] = useState("");
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  const queryDate = (() => {
    const d = new Date();
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(d.getTime() + tzOffset);
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();

  const fetchCRSchedules = async () => {
    setIsLoadingSchedules(true);
    setError(null);
    try {
      const data = await api.getCRSchedules();
      setSchedules(data.schedules);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to load schedules.";
      setError(message);
    } finally {
      setIsLoadingSchedules(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const data = await api.getRooms();
      const rooms: string[] = [];
      const values = Object.values(data.groupedRooms) as RoomStatus[][];
      values.forEach((list) => {
        list.forEach((r) => rooms.push(r.roomId));
      });
      setAllRooms(rooms);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const token = getAuthToken();
    const meta = getCRUserMeta();
    if (token && meta) {
      setIsLoggedIn(true);
      setCrMeta(meta);
      fetchCRSchedules();
      fetchRooms();
    }
  }, [isLoggedIn]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsLoggingIn(true);
    setError(null);
    try {
      const res = await api.login(username, password);
      saveAuthToken(res.token, res.user);
      setCrMeta(res.user);
      setIsLoggedIn(true);
      setUsername("");
      setPassword("");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Invalid username or password";
      setError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    setIsLoggedIn(false);
    setCrMeta(null);
    setSchedules([]);
  };

  // Action: Cancel
  const handleCancel = async (scheduleId: string) => {
    if (!window.confirm("Cancel this class for today?")) return;
    setIsSubmittingOverride(true);
    try {
      await api.cancelClass(scheduleId, queryDate);
      alert("Class cancelled successfully!");
      fetchCRSchedules();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to cancel class.";
      alert(message);
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Action: Quick Move Submit
  const handleMoveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScheduleId || !targetRoomId) return;

    setIsSubmittingOverride(true);
    try {
      await api.moveClass(selectedScheduleId, queryDate, targetRoomId);
      alert(`Class successfully moved to ${targetRoomId}!`);
      setSelectedScheduleId("");
      setTargetRoomId("");
      fetchCRSchedules();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to move class.";
      alert(message);
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Action: Delete/Reset Override
  const handleDeleteOverride = async (overrideId: string) => {
    if (!window.confirm("Remove override and restore this class to its original schedule?")) return;
    setIsSubmittingOverride(true);
    try {
      await api.deleteOverride(overrideId);
      alert("Override removed successfully.");
      fetchCRSchedules();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete override.";
      alert(message);
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Separate active overrides created for today
  const activeOverrides = schedules.flatMap((s) =>
    s.overrides.filter((o) => o.date === queryDate).map((o) => ({
      ...o,
      courseCode: `${s.course}${s.section}`,
      timeSlot: `${s.startTime} - ${s.endTime}`,
      originalRoom: s.roomName,
    }))
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-28">
      {/* Header */}
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="text-emerald-500 animate-pulse" size={22} />
            CR Control Center
          </h1>
          <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-1">Temporary timetable cancellations and room moves</p>
        </div>

        {isLoggedIn && (
          <button
            onClick={handleLogout}
            className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:text-rose-350 hover:bg-rose-500/15 transition-all active:scale-95 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider"
          >
            <LogOut size={11} /> Log Out
          </button>
        )}
      </header>

      {/* Main Panel Content */}
      <AnimatePresence mode="wait">
        {!isLoggedIn ? (
          <motion.div
            key="login-panel"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Login Form */}
            <div className="p-6 bg-[#0f0f12] border border-zinc-850 rounded-3xl shadow-xl">
              <h2 className="text-base font-black text-white tracking-tight mb-4 uppercase">CR Sign In</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl text-xs font-semibold">
                    {error}
                  </div>
                )}

                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <User size={15} />
                  </span>
                  <input
                    type="text"
                    placeholder="CR Username (e.g. cr_ug1_1)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full bg-zinc-950 text-white border border-zinc-900 focus:border-emerald-500/60 rounded-xl py-3 pl-10 pr-4 text-xs outline-none transition-all placeholder:text-zinc-500"
                  />
                </div>

                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <Key size={15} />
                  </span>
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-zinc-950 text-white border border-zinc-900 focus:border-emerald-500/60 rounded-xl py-3 pl-10 pr-4 text-xs outline-none transition-all placeholder:text-zinc-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-black text-xs font-black uppercase tracking-wider rounded-xl active:scale-95 transition-all shadow-lg flex items-center justify-center gap-1.5"
                >
                  {isLoggingIn ? "Signing In..." : "Authenticate"}
                </button>
              </form>
            </div>

            {/* Dev helper credentials card */}
            <div className="p-5 bg-zinc-950/40 border border-zinc-900 rounded-3xl">
              <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <ShieldAlert size={12} className="text-emerald-500" /> Dev Accounts Information
              </h3>
              <p className="text-[10px] text-zinc-500 leading-relaxed mb-3.5 font-medium">
                Use these mock CR credentials to test availability modifications and authorization constraints:
              </p>
              <div className="grid grid-cols-2 gap-2 text-[9px] text-zinc-400 font-mono">
                <div className="p-2 bg-zinc-950/80 rounded-xl border border-zinc-900/60">
                  <span className="text-emerald-400 font-bold block mb-1">UG1 Sec 1 CR</span>
                  User: <span className="text-white">cr_ug1_1</span><br />
                  Pass: <span className="text-white">password123</span>
                </div>
                <div className="p-2 bg-zinc-950/80 rounded-xl border border-zinc-900/60">
                  <span className="text-emerald-400 font-bold block mb-1">UG2 Sec 2 CR</span>
                  User: <span className="text-white">cr_ug2_2</span><br />
                  Pass: <span className="text-white">password123</span>
                </div>
                <div className="p-2 bg-zinc-950/80 rounded-xl border border-zinc-900/60">
                  <span className="text-emerald-400 font-bold block mb-1">UG3 Sec 1 CR</span>
                  User: <span className="text-white">cr_ug3_1</span><br />
                  Pass: <span className="text-white">password123</span>
                </div>
                <div className="p-2 bg-zinc-950/80 rounded-xl border border-zinc-900/60">
                  <span className="text-emerald-400 font-bold block mb-1">UG4 Sec 1 CR</span>
                  User: <span className="text-white">cr_ug4_1</span><br />
                  Pass: <span className="text-white">password123</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard-panel"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Logged in Profile Badge */}
            <div className="p-4.5 bg-emerald-500/5 border border-emerald-500/15 rounded-3xl flex items-center justify-between shadow-md">
              <div>
                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest block leading-none">Logged In Administrator</span>
                <span className="text-base font-black text-white block mt-1">{crMeta?.name}</span>
                <span className="text-[10px] text-zinc-400 block mt-1 font-semibold">
                  Permissions: {crMeta?.batch} Section {crMeta?.section}
                </span>
              </div>
              <button
                onClick={fetchCRSchedules}
                className="p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 hover:text-white transition-all active:scale-95"
              >
                <RefreshCw size={13} className={isLoadingSchedules ? "animate-spin text-emerald-400" : ""} />
              </button>
            </div>

            {/* Active overrides checklist */}
            {activeOverrides.length > 0 && (
              <div className="p-5 bg-[#0f0f12] border border-indigo-500/15 rounded-3xl shadow-lg">
                <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
                  <ShieldAlert size={12} className="text-indigo-400" /> Active Modifications Today
                </h3>
                <div className="space-y-2">
                  {activeOverrides.map((o) => (
                    <div
                      key={o.id}
                      className="p-3.5 bg-zinc-950/60 border border-zinc-900 rounded-2xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-black text-white">{o.courseCode}</span>
                        <span className="text-zinc-500 block text-[9px] mt-1 font-mono">
                          {o.timeSlot} • original: {o.originalRoom}
                        </span>
                        <span className="mt-2.5 inline-block px-2 py-0.5 bg-indigo-500/10 text-indigo-450 border border-indigo-500/20 rounded-md text-[8px] font-black uppercase tracking-wider">
                          {o.type === "CANCELLED" ? "Cancelled Class" : `Moved to ${o.targetRoomId}`}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteOverride(o.id)}
                        disabled={isSubmittingOverride}
                        className="p-2.5 bg-rose-500/10 text-rose-450 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 transition-all active:scale-95 shadow-sm"
                        title="Remove Override"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Action Move Form */}
            {schedules.length > 0 && (
              <div className="p-5 bg-[#0f0f12] border border-zinc-850 rounded-3xl shadow-lg">
                <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <Move size={12} className="text-emerald-500" /> Redirect Lecture Room
                </h3>

                <form onSubmit={handleMoveClass} className="space-y-4">
                  <div>
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-2 px-1">
                      Choose Lecture
                    </label>
                    <select
                      value={selectedScheduleId}
                      onChange={(e) => setSelectedScheduleId(e.target.value)}
                      required
                      className="w-full bg-zinc-950 border border-zinc-900 text-white rounded-xl p-3 text-xs outline-none focus:border-emerald-500/60"
                    >
                      <option value="">-- Choose Class --</option>
                      {schedules.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.course}{s.section} ({s.day} {s.startTime}-{s.endTime})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-2 px-1">
                      Target Classroom
                    </label>
                    <select
                      value={targetRoomId}
                      onChange={(e) => setTargetRoomId(e.target.value)}
                      required
                      disabled={!selectedScheduleId}
                      className="w-full bg-zinc-950 border border-zinc-900 disabled:border-zinc-950 text-white rounded-xl p-3 text-xs outline-none focus:border-emerald-500/60"
                    >
                      <option value="">-- Select Room --</option>
                      {allRooms
                        .filter((r) => {
                          const sched = schedules.find((s) => s.id === selectedScheduleId);
                          return !sched || sched.roomName !== r;
                        })
                        .map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingOverride || !selectedScheduleId || !targetRoomId}
                    className="w-full py-3 px-4 bg-indigo-500 hover:bg-indigo-600 disabled:bg-zinc-900 disabled:text-zinc-650 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-md"
                  >
                    Confirm Redirect Override
                  </button>
                </form>
              </div>
            )}

            {/* List of owned schedules */}
            <div>
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5 px-1">
                <Calendar size={13} className="text-emerald-500" /> Authorized Weekly Lectures
              </h3>

              {isLoadingSchedules ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="h-16 bg-zinc-900/60 border border-zinc-800/85 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : schedules.length === 0 ? (
                <div className="p-6 glass rounded-2xl text-center text-xs text-zinc-500 font-semibold shadow-inner">
                  No weekly classes mapped to your batch & section.
                </div>
              ) : (
                <div className="space-y-2">
                  {schedules.map((s) => {
                    const todayOverride = s.overrides.find((o) => o.date === queryDate);

                    return (
                      <div
                        key={s.id}
                        className="p-4 bg-[#0f0f12] border border-zinc-850 rounded-2xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-white">
                              {s.course}
                              {s.section}
                            </span>
                            <span className="text-[9px] text-zinc-500 font-semibold">({s.day})</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 block mt-1 font-mono font-bold">
                            {s.startTime} - {s.endTime} • Room {s.roomName}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {todayOverride ? (
                            <span className="px-2.5 py-1.5 bg-zinc-950 text-zinc-500 border border-zinc-900 rounded-xl text-[8px] font-black uppercase tracking-wider">
                              Modified
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCancel(s.id)}
                              disabled={isSubmittingOverride}
                              className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/15 hover:text-rose-300 transition-all rounded-xl active:scale-95 flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider"
                            >
                              <Ban size={10} /> Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
