import React, { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  isToday
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CalendarProps {
  events: any[];
  onDateSelect?: (date: Date | null) => void;
  selectedDate?: Date | null;
}

export default function Calendar({ events, onDateSelect, selectedDate }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            <CalendarIcon size={20} />
          </div>
          <h2 className="text-lg font-black text-slate-900 capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day, idx) => (
          <div key={idx} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = eachDayOfInterval({
      start: startDate,
      end: endDate,
    });

    const rows = [];
    let days = [];

    calendarDays.forEach((day, i) => {
      const formattedDate = format(day, 'd');
      const dayEvents = events.filter(event => isSameDay(new Date(event.startDate), day));
      const isSelected = selectedDate && isSameDay(day, selectedDate);
      const isCurrentMonth = isSameMonth(day, monthStart);
      const isTodayDate = isToday(day);

      days.push(
        <motion.div
          key={day.toString()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`relative h-14 sm:h-20 flex flex-col items-center justify-center cursor-pointer rounded-2xl transition-all border ${
            !isCurrentMonth ? 'text-slate-300 border-transparent' : 
            isSelected ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 
            isTodayDate ? 'bg-primary/5 text-primary border-primary/20 font-bold' :
            'text-slate-700 border-transparent hover:bg-slate-50'
          }`}
          onClick={() => onDateSelect?.(isSelected ? null : day)}
        >
          <span className="text-sm sm:text-base relative z-10">{formattedDate}</span>
          
          {dayEvents.length > 0 && (
            <div className="absolute bottom-2 flex gap-1 justify-center w-full px-1">
              {dayEvents.slice(0, 3).map((event, idx) => (
                <div 
                  key={idx} 
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected ? 'bg-white' : 
                    event.category === 'business' ? 'bg-blue-500' :
                    event.category === 'formation' ? 'bg-emerald-500' :
                    event.category === 'priere' ? 'bg-amber-500' :
                    'bg-primary'
                  }`} 
                />
              ))}
              {dayEvents.length > 3 && (
                <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/50' : 'bg-slate-300'}`} />
              )}
            </div>
          )}
        </motion.div>
      );

      if ((i + 1) % 7 === 0) {
        rows.push(
          <div className="grid grid-cols-7 gap-1" key={day.toString()}>
            {days}
          </div>
        );
        days = [];
      }
    });

    return <div className="space-y-1">{rows}</div>;
  };

  return (
    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
      {renderHeader()}
      {renderDays()}
      {renderCells()}
      
      <div className="mt-6 pt-6 border-t border-slate-50 flex flex-wrap gap-4 justify-center">
        {[
          { label: 'Business', color: 'bg-blue-500' },
          { label: 'Formation', color: 'bg-emerald-500' },
          { label: 'Prière', color: 'bg-amber-500' },
          { label: 'Networking', color: 'bg-primary' }
        ].map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${item.color}`} />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
