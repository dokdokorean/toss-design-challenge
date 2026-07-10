import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

function CreateMeeting() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [participantError, setParticipantError] = useState(false);
  const [calendarError, setCalendarError] = useState(false); // specific dates
  const [dayError, setDayError] = useState(false);           // day-of-week
  const [timeError, setTimeError] = useState(false);         // time validation error
  const [participants, setParticipants] = useState([
    { id: 'initial-1', name: '', attendance: 'required' },
    { id: 'initial-2', name: '', attendance: 'required' }
  ]);



  // 24-hour format state values
  const [startHour, setStartHour] = useState('09');
  const [endHour, setEndHour] = useState('18');

  // Date type dropdown state
  const [dateType, setDateType] = useState('specific'); // 'specific' (특정 날짜) or 'dayofweek' (요일별)
  const [dateTypeDropdownOpen, setDateTypeDropdownOpen] = useState(false);
  const [dateTypeDropdownClosing, setDateTypeDropdownClosing] = useState(false);

  // Calendar states
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 6, 1)); // Default: July 2026
  const [selectedDates, setSelectedDates] = useState([]); // Formatted 'YYYY-MM-DD'
  const [selectedDays, setSelectedDays] = useState([]); // '월', '화', '수' ...

  // Drag selection states for Calendar dates
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null); // holds dateStr
  const [dragMode, setDragMode] = useState(null); // 'select' or 'deselect'
  const [dragStartSnapshot, setDragStartSnapshot] = useState([]); // holds selectedDates snapshot BEFORE dragging

  // Drag selection states for Weekdays
  const [isDayDragging, setIsDayDragging] = useState(false);
  const [dayDragStart, setDayDragStart] = useState(null); // holds day abbreviation (e.g. '월')
  const [dayDragMode, setDayDragMode] = useState(null); // 'select' or 'deselect'
  const [dayDragStartSnapshot, setDayDragStartSnapshot] = useState([]); // holds selectedDays snapshot BEFORE dragging

  // Toast notification state
  const [showToast, setShowToast] = useState(false);

  const listRef = useRef(null);
  const dateTypeDropdownRef = useRef(null);

  // Generate lists for 24-hour picker
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

  // Weekdays abbreviations for calendar grid
  const calendarWeekdays = ['일', '월', '화', '수', '목', '금', '토'];
  // Weekday selection options — Sunday first
  const weekdayOptions = ['일', '월', '화', '수', '목', '금', '토'];

  // Auto scroll to bottom when a new participant row is added
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [participants.length]);

  // Animated close helper
  const closeDropdown = () => {
    setDateTypeDropdownClosing(true);
    setTimeout(() => {
      setDateTypeDropdownOpen(false);
      setDateTypeDropdownClosing(false);
    }, 130);
  };

  // Close date type dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dateTypeDropdownRef.current && !dateTypeDropdownRef.current.contains(e.target)) {
        if (dateTypeDropdownOpen) closeDropdown();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dateTypeDropdownOpen]);

  // Global mouseup listener to stop all drag selections
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setDragStart(null);
      setDragMode(null);
      setDragStartSnapshot([]);
      setIsDayDragging(false);
      setDayDragStart(null);
      setDayDragMode(null);
      setDayDragStartSnapshot([]);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const [removingIds, setRemovingIds] = useState([]);

  const triggerRemoveParticipant = (id) => {
    // Count active non-empty participants
    const activeCount = participants.filter(p => p.name.trim() !== '').length;

    if (activeCount <= 1) {
      // Just clear the name content of the targeted row instead of removing it from DOM
      setParticipants(prev => prev.map(p => p.id === id ? { ...p, name: '' } : p));
      return;
    }

    if (removingIds.includes(id)) return;

    setRemovingIds(prev => [...prev, id]);
    setTimeout(() => {
      setParticipants(prev => {
        // Double check count inside state update
        const currentActive = prev.filter(p => p.name.trim() !== '').length;
        if (currentActive <= 1) {
          return prev.map(p => p.id === id ? { ...p, name: '' } : p);
        }
        return prev.filter(p => p.id !== id);
      });
      setRemovingIds(prev => prev.filter(item => item !== id));
    }, 280); // match CSS animation duration
  };

  const handleNameChange = (id, val) => {
    if (participantError) setParticipantError(false);
    setParticipants((prev) => {
      const index = prev.findIndex(p => p.id === id);
      if (index === -1) return prev;

      const updated = [...prev];
      updated[index] = { ...updated[index], name: val };

      // If it's the last row (draft) and the user has typed something
      if (index === prev.length - 1 && val.trim() !== '') {
        updated.push({
          id: `draft-${Date.now()}-${Math.random()}`,
          name: '',
          attendance: 'required',
          isNew: true
        });
      }

      return updated;
    });
  };

  const handleNameBlur = (id) => {
    const index = participants.findIndex(p => p.id === id);
    // Remove if it's an empty row, unless it is the very first row (index === 0)
    if (index > 0 && index !== participants.length - 1 && participants[index].name.trim() === '') {
      triggerRemoveParticipant(id);
    }
  };

  const handleAttendanceChange = (id, status) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, attendance: status } : p))
    );
  };

  const handleDeleteParticipant = (id) => {
    triggerRemoveParticipant(id);
  };
  // Keyboard navigation helper (Enter to focus next text input)
  const handleKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setTimeout(() => {
        const wrapper = document.querySelector('.modern-input-wrapper');
        if (wrapper) {
          const inputs = Array.from(wrapper.querySelectorAll('input[type="text"]'));
          const nextInput = inputs[index + 1];
          if (nextInput) {
            nextInput.focus();
          }
        }
      }, 50); // Small timeout to allow new DOM element generation
    }
  };
  // Month navigation handlers
  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Calendar drag selection handlers
  const handleMouseDown = (dateStr, e) => {
    e.preventDefault(); // Prevent text selection highlight
    setIsDragging(true);
    setDragStart(dateStr);
    if (calendarError) setCalendarError(false); // clear error on interaction

    const isAlreadySelected = selectedDates.includes(dateStr);
    const mode = isAlreadySelected ? 'deselect' : 'select';
    setDragMode(mode);

    setDragStartSnapshot(selectedDates);

    if (mode === 'select') {
      setSelectedDates((prev) => [...prev.filter(d => d !== dateStr), dateStr]);
    } else {
      setSelectedDates((prev) => prev.filter((d) => d !== dateStr));
    }
  };

  const handleMouseEnter = (dateStr) => {
    if (isDragging && dragStart && dragMode) {
      const range = getDatesInRange(dragStart, dateStr);
      if (dragMode === 'select') {
        setSelectedDates(() => {
          const uniqueDates = new Set([...dragStartSnapshot, ...range]);
          return Array.from(uniqueDates);
        });
      } else {
        setSelectedDates(() => {
          return dragStartSnapshot.filter((d) => !range.includes(d));
        });
      }
    }
  };

  // Helper to generate dates range array chronologically
  const getDatesInRange = (startStr, endStr) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const dates = [];

    const minDate = start < end ? start : end;
    const maxDate = start < end ? end : start;

    let current = new Date(minDate);
    while (current <= maxDate) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  // Weekday drag selection handlers
  const handleDayMouseDown = (day, e) => {
    e.preventDefault(); // Prevent text selection highlight
    setIsDayDragging(true);
    setDayDragStart(day);
    if (dayError) setDayError(false); // clear error on interaction

    const isAlreadySelected = selectedDays.includes(day);
    const mode = isAlreadySelected ? 'deselect' : 'select';
    setDayDragMode(mode);

    setDayDragStartSnapshot(selectedDays);

    if (mode === 'select') {
      setSelectedDays((prev) => [...prev.filter(d => d !== day), day]);
    } else {
      setSelectedDays((prev) => prev.filter((d) => d !== day));
    }
  };

  const handleDayMouseEnter = (day) => {
    if (isDayDragging && dayDragStart && dayDragMode) {
      const range = getDaysInRange(dayDragStart, day);
      if (dayDragMode === 'select') {
        setSelectedDays(() => {
          const uniqueDays = new Set([...dayDragStartSnapshot, ...range]);
          return Array.from(uniqueDays);
        });
      } else {
        setSelectedDays(() => {
          return dayDragStartSnapshot.filter((d) => !range.includes(d));
        });
      }
    }
  };

  // Helper to generate weekday range array
  const getDaysInRange = (startDay, endDay) => {
    const startIndex = weekdayOptions.indexOf(startDay);
    const endIndex = weekdayOptions.indexOf(endDay);

    const minIdx = Math.min(startIndex, endIndex);
    const maxIdx = Math.max(startIndex, endIndex);

    return weekdayOptions.slice(minIdx, maxIdx + 1);
  };

  // Firebase integration and toast redirect
  const handleCreateMeeting = async () => {
    if (!title.trim()) {
      setTitleError(false);
      setTimeout(() => {
        setTitleError(true);
      }, 10);
      return;
    }

    const activeParticipantsCount = participants.filter(p => p.name.trim() !== '').length;
    if (activeParticipantsCount === 0) {
      setParticipantError(false);
      setTimeout(() => {
        setParticipantError(true);
      }, 10);
      return;
    }

    if (Number(endHour) <= Number(startHour)) {
      setTimeError(false);
      setTimeout(() => {
        setTimeError(true);
      }, 10);
      return;
    }

    if (dateType === 'specific' && selectedDates.length === 0) {
      setCalendarError(false);
      setTimeout(() => setCalendarError(true), 10);
      return;
    }

    if (dateType === 'dayofweek' && selectedDays.length === 0) {
      setDayError(false);
      setTimeout(() => setDayError(true), 10);
      return;
    }

    // Filter out trailing empty participant row
    const filteredParticipants = participants
      .filter(p => p.name.trim() !== '')
      .map(p => ({ id: p.id, name: p.name, attendance: p.attendance }));

    const meetingId = Math.random().toString(36).substring(2, 10);

    const meetingData = {
      title,
      participants: filteredParticipants,
      startTime: `${startHour}:00`,
      endTime: `${endHour}:00`,
      dateType,
      selectedDates: dateType === 'specific' ? selectedDates : [],
      selectedDays: dateType === 'dayofweek' ? selectedDays : [],
      createdAt: new Date().toISOString()
    };

    // Save to localStorage as a client-side fallback
    localStorage.setItem(`meeting-${meetingId}`, JSON.stringify(meetingData));

    // Save to firestore in the background (non-blocking)
    setDoc(doc(db, 'meetings', meetingId), meetingData).catch(error => {
      console.warn("Firestore save failed in background. Client-side fallback activated: ", error);
    });

    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      navigate(`/${meetingId}`);
    }, 1500);
  };

  // Helper to generate calendar days matrix
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();

    const days = [];

    // Trailing days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevMonthNum = month === 0 ? 11 : month - 1;
      const prevYearNum = month === 0 ? year - 1 : year;
      const dNum = prevTotalDays - i;
      days.push({
        dayNum: dNum,
        isCurrentMonth: false,
        dateStr: `${prevYearNum}-${String(prevMonthNum + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`
      });
    }

    // Days of the current month
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        dayNum: i,
        isCurrentMonth: true,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      });
    }

    // Leading days from next month
    const totalCells = days.length;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonthNum = month === 11 ? 0 : month + 1;
      const nextYearNum = month === 11 ? year + 1 : year;
      days.push({
        dayNum: i,
        isCurrentMonth: false,
        dateStr: `${nextYearNum}-${String(nextMonthNum + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <>
      <div className="split-container" style={{ height: 'auto', minHeight: '100vh', overflow: 'visible' }}>
        {/* Left panel: Meeting details & Participants */}
        <div className="left-panel" ref={listRef} style={{ height: 'auto', overflowY: 'visible', borderRight: '1px solid #f3f4f6', backgroundColor: '#ffffff' }}>
          <div className="modern-input-wrapper">
            {/* Title and Subtitle */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#191f28', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>회의 기본 정보</h2>
              <p style={{ fontSize: '0.9rem', color: '#8b95a1', margin: 0, fontWeight: '400', lineHeight: '1.4' }}>회의 제목과 회의 참여자를 입력해주세요.</p>
            </div>

            <div className={`form-group ${titleError ? 'title-group-error' : ''}`}>
              <label className="form-label">회의 제목</label>
              <input
                type="text"
                className="modern-input"
                placeholder="회의 제목을 입력해주세요"
                autoFocus
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (titleError) setTitleError(false);
                }}
                onFocus={() => { if (titleError) setTitleError(false); }}
                onKeyDown={(e) => handleKeyDown(e, 0)}
              />
            </div>

            <div className={`form-group ${participantError ? 'participant-group-error' : ''}`}>
              <label className="form-label">
                회의 참여자
                {participants.filter(p => p.name.trim() !== '').length > 0 && (
                  <span style={{ fontWeight: '500', color: '#0099FF', marginLeft: '6px' }}>
                    ( {participants.filter(p => p.name.trim() !== '').length}명 )
                  </span>
                )}
              </label>
              <div className="participants-list">
                {participants.map((p, index) => {
                  const isLast = index === participants.length - 1;
                  const isFaded = isLast && p.name.trim() === '';

                  const isRemoving = removingIds.includes(p.id);

                  return (
                    <div
                      key={p.id}
                      className={`participant-row ${isFaded ? 'faded' : ''} ${isRemoving ? 'removing' : ''} ${p.isNew ? 'animate-in' : ''}`}
                    >
                      <div className="input-with-toggle">
                        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                          <input
                            type="text"
                            className="modern-input"
                            placeholder={isLast ? "참여자를 추가해주세요" : "참여자를 입력해주세요"}
                            value={p.name}
                            onChange={(e) => handleNameChange(p.id, e.target.value)}
                            onFocus={() => { if (participantError) setParticipantError(false); }}
                            onBlur={() => handleNameBlur(p.id)}
                            onKeyDown={(e) => handleKeyDown(e, index + 1)}
                            style={{ paddingRight: '40px' }} // Make space for the absolute X button inside input box
                          />
                          {p.name.trim() !== '' && (
                            <button
                              type="button"
                              className="delete-btn"
                              onClick={() => handleDeleteParticipant(p.id)}
                              tabIndex={-1}
                              aria-label="Delete participant"
                              style={{
                                position: 'absolute',
                                right: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                margin: 0,
                                width: '28px',
                                height: '28px',
                                padding: 0
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6 6 18M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="toggle-group" data-active={p.attendance}>
                          <button
                            type="button"
                            className={`toggle-button ${p.attendance === 'required' ? 'active' : ''}`}
                            onClick={() => handleAttendanceChange(p.id, 'required')}
                            tabIndex={-1}
                          >
                            필수 참여
                          </button>
                          <button
                            type="button"
                            className={`toggle-button ${p.attendance === 'optional' ? 'active' : ''}`}
                            onClick={() => handleAttendanceChange(p.id, 'optional')}
                            tabIndex={-1}
                          >
                            선택 참여
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right panel: Time & Date Selection & Calendar */}
        <div className="right-panel" style={{ height: 'auto', overflowY: 'visible' }}>
          <div className="modern-input-wrapper">
            {/* Section header: 후보 시간대 */}
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#191f28', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>시간 범위 설정</h2>
              <p style={{ fontSize: '0.9rem', color: '#8b95a1', margin: 0, fontWeight: '400', lineHeight: '1.4' }}>참여자들이 입력할 시간 범위를 설정해주세요.</p>
            </div>
            {/* Dynamic Calendar Selection */}
            <div className={`form-group ${(calendarError || dayError) ? 'calendar-group-error' : ''}`}>
              {dateType === 'specific' ? (
                /* Monthly Calendar View */
                <div className="calendar-container">
                  <div className="calendar-header">
                    {/* Custom Date Type Dropdown — left side of header */}
                    <div ref={dateTypeDropdownRef} className="cal-datetype-dropdown" style={{ position: 'relative' }}>
                      <button
                        type="button"
                        className="cal-datetype-trigger"
                        onClick={() => {
                          if (dateTypeDropdownOpen) {
                            closeDropdown();
                          } else {
                            setDateTypeDropdownOpen(true);
                          }
                        }}
                        aria-haspopup="listbox"
                        aria-expanded={dateTypeDropdownOpen}
                      >
                        <span>{dateType === 'specific' ? '특정 날짜' : '요일별'}</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                          viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transition: 'transform 0.2s', transform: dateTypeDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      {(dateTypeDropdownOpen || dateTypeDropdownClosing) && (
                        <ul className={`cal-datetype-menu ${dateTypeDropdownClosing ? 'closing' : ''}`} role="listbox">
                          {[
                            { value: 'specific', label: '특정 날짜', sub: '날짜를 직접 콕 집어서 골라요' },
                            { value: 'dayofweek', label: '요일별', sub: '매주 반복되는 요일로 잡아요' }
                          ].map(opt => (
                            <li
                              key={opt.value}
                              role="option"
                              aria-selected={dateType === opt.value}
                              className={`cal-datetype-option ${dateType === opt.value ? 'selected' : ''}`}
                              onClick={() => { setDateType(opt.value); closeDropdown(); }}
                            >
                              <div className="cal-datetype-option-text">
                                <span className="cal-datetype-option-main">{opt.label}</span>
                                <span className="cal-datetype-option-sub">{opt.sub}</span>
                              </div>
                              {dateType === opt.value && (
                                <svg className="cal-datetype-check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Month nav — right side */}
                    <div className="cal-month-nav">
                      <button className="calendar-nav-btn" onClick={handlePrevMonth}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m15 18-6-6 6-6" />
                        </svg>
                      </button>
                      <span className="calendar-title">
                        {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
                      </span>
                      <button className="calendar-nav-btn" onClick={handleNextMonth}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="calendar-grid">
                    {calendarWeekdays.map(w => (
                      <span key={w} className="calendar-weekday">{w}</span>
                    ))}
                    {calendarDays.map((d, idx) => {
                      const isSelected = selectedDates.includes(d.dateStr);
                      const isToday = d.dateStr === todayStr;
                      return (
                        <button
                          key={`${d.dateStr}-${idx}`}
                          className={`calendar-day-btn ${isSelected ? 'selected' : ''} ${!d.isCurrentMonth ? 'outside' : ''} ${isToday ? 'today' : ''}`}
                          onMouseDown={(e) => handleMouseDown(d.dateStr, e)}
                          onMouseEnter={() => handleMouseEnter(d.dateStr)}
                        >
                          {d.dayNum}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Weekday Row Toggles with Drag Selection */
                <div className="weekday-section">
                  <div className="calendar-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '20px' }}>
                    <div ref={dateTypeDropdownRef} className="cal-datetype-dropdown" style={{ position: 'relative' }}>
                      <button
                        type="button"
                        className="cal-datetype-trigger"
                        onClick={() => {
                          if (dateTypeDropdownOpen) {
                            closeDropdown();
                          } else {
                            setDateTypeDropdownOpen(true);
                          }
                        }}
                        aria-haspopup="listbox"
                        aria-expanded={dateTypeDropdownOpen}
                      >
                        <span>{dateType === 'specific' ? '특정 날짜' : '요일별'}</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                          viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transition: 'transform 0.2s', transform: dateTypeDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      {(dateTypeDropdownOpen || dateTypeDropdownClosing) && (
                        <ul className={`cal-datetype-menu ${dateTypeDropdownClosing ? 'closing' : ''}`} role="listbox">
                          {[
                            { value: 'specific', label: '특정 날짜', sub: '날짜를 직접 콕 집어서 골라요' },
                            { value: 'dayofweek', label: '요일별', sub: '매주 반복되는 요일로 잡아요' }
                          ].map(opt => (
                            <li
                              key={opt.value}
                              role="option"
                              aria-selected={dateType === opt.value}
                              className={`cal-datetype-option ${dateType === opt.value ? 'selected' : ''}`}
                              onClick={() => { setDateType(opt.value); closeDropdown(); }}
                            >
                              <div className="cal-datetype-option-text">
                                <span className="cal-datetype-option-main">{opt.label}</span>
                                <span className="cal-datetype-option-sub">{opt.sub}</span>
                              </div>
                              {dateType === opt.value && (
                                <svg className="cal-datetype-check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="weekday-grid">
                    {weekdayOptions.map((day) => {
                      const isActive = selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          className={`weekday-btn ${isActive ? 'active' : ''}`}
                          onMouseDown={(e) => handleDayMouseDown(day, e)}
                          onMouseEnter={() => handleDayMouseEnter(day)}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Time selects — below calendar */}
            <div className={`form-group ${timeError ? 'time-group-error' : ''}`} style={{ marginBottom: 0 }}>
              {/* Dynamic slide-down container: show only when selectedDates or selectedDays is not empty */}
              <div
                className={`slide-down-container ${(selectedDates.length > 0 || selectedDays.length > 0) ? 'show' : ''}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '1.05rem',
                  fontWeight: '500',
                  color: '#4e5968',
                  lineHeight: '1.5',
                  letterSpacing: '-0.01em'
                }}
                onFocus={() => { if (timeError) setTimeError(false); }}
                onChange={() => { if (timeError) setTimeError(false); }}
              >
                <div>
                  참여자들은 <span style={{ fontWeight: '700', color: '#191f28' }}>{startHour}:00</span> ~ <span style={{ fontWeight: '700', color: '#191f28' }}>{endHour}:00</span> 사이에서 고르게 돼요
                </div>

                {/* Toss-style premium dual range slider */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 8px',
                  boxSizing: 'border-box',
                  userSelect: 'none',
                  marginTop: '4px'
                }}>
                  {/* Outer track bar background */}
                  <div style={{
                    position: 'absolute',
                    left: '8px',
                    right: '8px',
                    height: '6px',
                    backgroundColor: '#eef1f4',
                    borderRadius: '3px',
                    zIndex: 1
                  }} />

                  {/* Hourly tick separators (25 lines from 0 to 24) */}
                  {Array.from({ length: 25 }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: `calc(8px + (100% - 16px) * ${i / 24})`,
                        width: '1.5px',
                        height: i % 6 === 0 ? '8px' : '4px',
                        backgroundColor: i % 6 === 0 ? '#d1d5db' : '#e5e7eb',
                        zIndex: i % 6 === 0 ? 2 : 1,
                        transform: 'translateX(-50%)'
                      }}
                    />
                  ))}

                  {/* Colored active fill bar */}
                  <div style={{
                    position: 'absolute',
                    left: `calc(8px + (100% - 16px) * ${Number(startHour) / 24})`,
                    width: `calc((100% - 16px) * ${(Number(endHour) - Number(startHour)) / 24})`,
                    height: '6px',
                    backgroundColor: '#3182F6',
                    borderRadius: '3px',
                    zIndex: 2
                  }} />

                  {/* Dynamic Time Badge directly centered as the Start Handle */}
                  <div style={{
                    position: 'absolute',
                    left: `calc(8px + (100% - 16px) * ${Number(startHour) / 24})`,
                    backgroundColor: '#191f28',
                    color: '#ffffff',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    pointerEvents: 'none',
                    zIndex: 10,
                    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.22)',
                    whiteSpace: 'nowrap',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    {startHour}:00
                  </div>

                  {/* Dynamic Time Badge directly centered as the End Handle */}
                  <div style={{
                    position: 'absolute',
                    left: `calc(8px + (100% - 16px) * ${Number(endHour) / 24})`,
                    backgroundColor: '#191f28',
                    color: '#ffffff',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    pointerEvents: 'none',
                    zIndex: 10,
                    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.22)',
                    whiteSpace: 'nowrap',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    {endHour}:00
                  </div>

                  {/* Hidden native input for start hour */}
                  <input
                    type="range"
                    min="0"
                    max="24"
                    value={startHour}
                    onChange={(e) => {
                      const val = Math.min(Number(e.target.value), Number(endHour) - 1);
                      setStartHour(String(val).padStart(2, '0'));
                    }}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '24px',
                      left: 0,
                      background: 'none',
                      pointerEvents: 'none',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      outline: 'none',
                      margin: 0,
                      zIndex: 11
                    }}
                    className="dual-range-slider-input"
                  />

                  {/* Hidden native input for end hour */}
                  <input
                    type="range"
                    min="0"
                    max="24"
                    value={endHour}
                    onChange={(e) => {
                      const val = Math.max(Number(e.target.value), Number(startHour) + 1);
                      setEndHour(String(val).padStart(2, '0'));
                    }}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '24px',
                      left: 0,
                      background: 'none',
                      pointerEvents: 'none',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      outline: 'none',
                      margin: 0,
                      zIndex: 12
                    }}
                    className="dual-range-slider-input"
                  />
                </div>

                {/* Slider labels for start, mid, end */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                  color: '#8b95a1',
                  marginTop: '-10px',
                  padding: '0 8px'
                }}>
                  <span>00:00</span>
                  <span>12:00</span>
                  <span>24:00</span>
                </div>
              </div>

              {timeError && (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 500, textAlign: 'right', marginTop: '6px' }}>
                  종료 시간은 시작 시간 이후여야 합니다!
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Sticky Bottom bar for Create Meeting CTA */}
      <div 
        className="sticky-bottom-bar"
        style={{
          boxSizing: 'border-box'
        }}
      >
        {/* Real-time Live Summary of Configuration (now aligned right next to button) */}
        <div className={`bottom-bar-summary-wrapper ${(
          title.trim() !== '' && 
          participants.filter(p => p.name.trim() !== '').length > 0 && 
          (selectedDates.length > 0 || selectedDays.length > 0)
        ) ? 'show' : ''}`}>
          {title.trim() && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: '600', color: '#191f28', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title}
              </span>
              <span style={{ color: '#d1d5db' }}>|</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>
              참여자 <strong style={{ color: '#191f28' }}>{participants.filter(p => p.name.trim() !== '').length}명</strong>
            </span>
            <span style={{ color: '#d1d5db' }}>|</span>

            {/* Dates / Days summary */}
            <span>
              {dateType === 'specific' ? (
                <>
                  선택 날짜{' '}
                  <strong style={{ color: '#191f28' }}>
                    {selectedDates.length > 0 ? (
                      (() => {
                        // Sort selected dates chronologically
                        const sorted = [...selectedDates].sort((a, b) => new Date(a) - new Date(b));

                        // Check if all dates are contiguous
                        let isContiguous = true;
                        for (let i = 1; i < sorted.length; i++) {
                          const prevDate = new Date(sorted[i - 1]);
                          const currDate = new Date(sorted[i]);
                          const diffTime = Math.abs(currDate - prevDate);
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          if (diffDays !== 1) {
                            isContiguous = false;
                            break;
                          }
                        }

                        // Contiguous flow formatting: "M/D ~ M/D (N일)"
                        if (isContiguous && sorted.length > 1) {
                          const startParts = sorted[0].split('-');
                          const endParts = sorted[sorted.length - 1].split('-');
                          const startM = parseInt(startParts[1], 10);
                          const startD = parseInt(startParts[2], 10);
                          const endM = parseInt(endParts[1], 10);
                          const endD = parseInt(endParts[2], 10);
                          return `${startM}/${startD} ~ ${endM}/${endD} (${sorted.length}일)`;
                        }

                        // Format each as M/D for non-contiguous fallback list
                        const formatted = sorted.map(dStr => {
                          const parts = dStr.split('-');
                          const m = parseInt(parts[1], 10);
                          const d = parseInt(parts[2], 10);
                          return `${m}/${d}`;
                        });

                        if (formatted.length <= 3) {
                          return formatted.join(', ');
                        } else {
                          return `${formatted.slice(0, 3).join(', ')} 외 ${formatted.length - 3}일`;
                        }
                      })()
                    ) : (
                      '없음'
                    )}
                  </strong>
                </>
              ) : (
                <>
                  선택 요일{' '}
                  <strong style={{ color: '#191f28' }}>
                    {selectedDays.length > 0 ? (
                      (() => {
                        const dayOrder = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
                        const sortedDays = [...selectedDays].sort((a, b) => dayOrder[a] - dayOrder[b]);
                        return sortedDays.join(', ');
                      })()
                    ) : (
                      '없음'
                    )}
                  </strong>
                </>
              )}
            </span>
            <span style={{ color: '#d1d5db' }}>|</span>

            <span>
              시간 <strong style={{ color: '#191f28' }}>{startHour}:00 ~ {endHour}:00</strong>
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          className="create-meeting-btn"
          onClick={handleCreateMeeting}
          style={{
            margin: 0,
            padding: '10px 22px',
            fontSize: '0.95rem',
            fontWeight: 600,
            borderRadius: '11px',
            backgroundColor: '#3182F6',
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(49, 130, 246, 0.12)',
            transition: 'all 0.15s ease-in-out'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#1b64da';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#3182F6';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          회의 생성하기
        </button>
      </div>

      {/* Success Toast */}
      <div className={`toast-popup ${showToast ? 'show' : ''}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <span>회의가 성공적으로 생성되었습니다!</span>
      </div>
    </>
  );
}

export default CreateMeeting;
