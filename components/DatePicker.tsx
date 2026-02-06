
import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
// Fixed date-fns imports to use named imports from the main package to resolve 'not callable' errors
import {
  format,
  addMonths,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isBefore,
  isValid,
  subMonths,
  startOfMonth,
  startOfWeek,
  parseISO,
  startOfDay
} from 'date-fns';

interface DatePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  className?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({ label, value, onChange, min, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { dateLocale } = useLanguage();

  // Initialize calendar view to the selected date or today
  useEffect(() => {
    if (isOpen) {
        if (value && isValid(parseISO(value))) {
            setCurrentMonth(parseISO(value));
        } else {
            setCurrentMonth(new Date());
        }
    }
  }, [isOpen, value]);

  const handleOpen = () => {
    // Force focus out of any active text fields to dismiss keyboard
    // This resolves the touch target offset bug on mobile devices
    (document.activeElement as HTMLElement)?.blur();
    setIsOpen(true);
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const handleDayClick = (day: Date) => {
    if (min && isBefore(day, startOfDay(parseISO(min)))) return;
    onChange(format(day, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { locale: dateLocale });
    const endDate = endOfWeek(monthEnd, { locale: dateLocale });

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = eachDayOfInterval({
        start: startOfWeek(new Date(), { locale: dateLocale }),
        end: endOfWeek(new Date(), { locale: dateLocale })
    });

    return (
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 transition-colors active:scale-90"
          >
            <ChevronLeft size={24} />
          </button>
          <span className="font-bold text-slate-800 dark:text-slate-200 text-lg capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 transition-colors active:scale-90"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 mb-2 text-center">
          {weekDays.map(d => (
            <div key={d.toString()} className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase py-1 tracking-widest">
              {format(d, 'EEEEEE', { locale: dateLocale })}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
             const isSelected = value ? isSameDay(day, parseISO(value)) : false;
             const isCurrentMonth = isSameMonth(day, currentMonth);
             const isDisabled = min ? isBefore(day, startOfDay(parseISO(min))) : false;

             return (
               <button
                 key={idx}
                 type="button"
                 onClick={() => !isDisabled && handleDayClick(day)}
                 disabled={isDisabled}
                 className={`
                    h-11 w-11 rounded-2xl flex items-center justify-center text-sm font-bold transition-all mx-auto active:scale-90
                    ${isSelected
                        ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30 scale-110 z-10'
                        : isDisabled
                           ? 'text-slate-200 dark:text-slate-600 cursor-not-allowed'
                           : isCurrentMonth
                              ? 'text-slate-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-900/30 hover:text-brand-600'
                              : 'text-slate-300 dark:text-slate-600'
                    }
                 `}
               >
                 {format(day, 'd')}
               </button>
             );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={className}>
      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</label>

      {/* Input Trigger */}
      <div
        className="relative cursor-pointer group"
        onClick={handleOpen}
      >
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-hover:text-brand-500 transition-colors">
            <CalendarIcon size={18} />
        </div>
        <input
          type="text"
          readOnly
          value={value ? format(parseISO(value), 'd MMM yyyy', { locale: dateLocale }) : ''}
          placeholder="Select date"
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl outline-none text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 cursor-pointer caret-transparent text-base font-medium shadow-sm transition-all hover:border-brand-200"
        />
      </div>

      {/* Responsive Modal/Bottom Sheet */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
          style={{ overscrollBehavior: 'contain' }}
          onClick={() => setIsOpen(false)}
        >
           <div
             className="bg-white dark:bg-slate-800 rounded-t-[32px] md:rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-slideUp md:animate-scaleIn h-auto max-h-[90dvh]"
             onClick={e => e.stopPropagation()}
           >
              {/* Grab Handle for Mobile */}
              <div className="md:hidden w-full flex justify-center pt-3 pb-1">
                  <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
              </div>

              <div className="flex justify-between items-center p-5 border-b border-slate-50 dark:border-slate-700">
                 <h3 className="font-black text-slate-900 dark:text-slate-100 text-xl tracking-tight uppercase">{label}</h3>
                 <button
                   type="button"
                   onClick={() => setIsOpen(false)}
                   className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400 rounded-full transition-colors active:scale-90"
                 >
                   <X size={20} />
                 </button>
              </div>

              <div className="p-5 pb-8 md:pb-5 overflow-y-auto">
                 {renderCalendar()}
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-4 text-center border-t border-slate-100 dark:border-slate-700 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                        onChange(format(new Date(), 'yyyy-MM-dd'));
                        setIsOpen(false);
                    }}
                    className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-95"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-900/10 active:scale-95 transition-all"
                  >
                    Done
                  </button>
              </div>

              {/* Extra padding for safe area on mobile */}
              <div className="h-[env(safe-area-inset-bottom)] bg-slate-50 dark:bg-slate-950 md:hidden" />
           </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
