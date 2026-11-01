import React, { useState } from 'react';
import { Calendar, Phone, Hash, XCircle, RotateCcw, Send, Check } from 'lucide-react';

interface ManageBookingFormProps {
  alreadySubmitted?: boolean;
  isLoading?: boolean;
  language?: 'English' | 'Amharic';
  initialAction?: 'cancel' | 'reschedule';
  onSubmit: (formattedDetails: string) => void;
}

export default function ManageBookingForm({
  alreadySubmitted = false,
  isLoading = false,
  language = 'English',
  initialAction = 'cancel',
  onSubmit,
}: ManageBookingFormProps) {
  const [action, setAction] = useState<'cancel' | 'reschedule'>(initialAction);
  const [phone, setPhone] = useState('');
  const [reference, setReference] = useState('');
  const [newTimePreference, setNewTimePreference] = useState('');

  const isAmharic = language === 'Amharic';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || alreadySubmitted || isLoading) return;

    if (action === 'cancel') {
      let formatted = `Cancel appointment request: Phone: ${phone.trim()}`;
      if (reference.trim()) {
        formatted += `, Reference: ${reference.trim()}`;
      }
      onSubmit(formatted);
    } else {
      let formatted = `Reschedule appointment request: Phone: ${phone.trim()}`;
      if (reference.trim()) {
        formatted += `, Reference: ${reference.trim()}`;
      }
      if (newTimePreference.trim()) {
        formatted += `, New preferred time: ${newTimePreference.trim()}`;
      }
      onSubmit(formatted);
    }
  };

  if (alreadySubmitted) {
    return (
      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] flex items-center gap-2">
        <Check className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          {isAmharic
            ? action === 'cancel'
              ? 'የቀጠሮ መሰረዝ ጥያቄዎ ለክሊኒኩ ደርሷል።'
              : 'የቀጠሮ ማስተካከያ ጥያቄዎ ለክሊኒኩ ደርሷል።'
            : action === 'cancel'
            ? 'Your cancellation request has been submitted.'
            : 'Your rescheduling request has been submitted.'}
        </span>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3.5 p-3.5 sm:p-4 bg-slate-50 border border-amber-200/90 rounded-xl shadow-xs space-y-3 text-slate-700 text-xs"
    >
      <div className="font-semibold text-slate-800 flex items-center justify-between text-[11px] pb-2 border-b border-slate-200/70">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>
            {isAmharic ? 'ቀጠሮ ማስተዳደር' : 'Manage Appointment'}
          </span>
        </div>

        {/* Action Toggle */}
        <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-[10px]">
          <button
            type="button"
            onClick={() => setAction('cancel')}
            className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
              action === 'cancel'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isAmharic ? 'መሰረዝ (Cancel)' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => setAction('reschedule')}
            className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
              action === 'reschedule'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isAmharic ? 'ቀን መቀየር (Postpone)' : 'Postpone'}
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        <div>
          <label className="block text-[10px] text-slate-600 font-semibold mb-1">
            {isAmharic ? 'የተመዘገቡበት ስልክ ቁጥር *' : 'Registered Phone Number *'}
          </label>
          <div className="relative">
            <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0911234567 / +251 91 123 4567"
              className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-slate-600 font-semibold mb-1">
            {isAmharic ? 'የቀጠሮ መለያ ቁጥር (ካለዎት)' : 'Booking Reference (Optional)'}
          </label>
          <div className="relative">
            <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. DC-482913"
              className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 shadow-xs font-mono"
            />
          </div>
        </div>

        {action === 'reschedule' && (
          <div>
            <label className="block text-[10px] text-slate-600 font-semibold mb-1">
              {isAmharic ? 'አዲስ የሚመርጡት ቀን እና ሰዓት *' : 'New Preferred Day & Time *'}
            </label>
            <input
              type="text"
              required={action === 'reschedule'}
              value={newTimePreference}
              onChange={(e) => setNewTimePreference(e.target.value)}
              placeholder={
                isAmharic
                  ? 'ለምሳሌ፡ ሐሙስ ከሰዓት 8:30 (2:30 PM)'
                  : 'e.g. Thursday 2:30 PM'
              }
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading || !phone.trim() || (action === 'reschedule' && !newTimePreference.trim())}
        className={`w-full mt-2.5 py-2.5 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs text-white ${
          action === 'cancel'
            ? 'bg-rose-600 hover:bg-rose-700 disabled:opacity-50'
            : 'bg-amber-600 hover:bg-amber-700 disabled:opacity-50'
        }`}
      >
        {action === 'cancel' ? (
          <>
            <XCircle className="w-3.5 h-3.5" />
            <span>{isAmharic ? 'ቀጠሮውን ሰርዝ' : 'Confirm Cancellation'}</span>
          </>
        ) : (
          <>
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isAmharic ? 'ቀጠሮውን አዛውር' : 'Reschedule to New Time'}</span>
          </>
        )}
      </button>
    </form>
  );
}
