// Schedule Manager Application
class ScheduleManager {
    constructor() {
        this.schedules = this.loadSchedules();
        this.teachers = this.loadTeachers();
        this.rooms = this.loadRooms();
        this.migrateSchedules();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.render();
        this.renderTeacherOptions();
        this.renderRoomOptions();
    }

    setupEventListeners() {
        document.getElementById('scheduleForm').addEventListener('submit', (e) => this.handleAddSchedule(e));
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            // view toggles already wired in HTML; keep existing behavior
            btn.addEventListener('click', (e) => {
                if (e.target.dataset && e.target.dataset.view) this.switchView(e);
            });
        });

        document.getElementById('addTeacherBtn').addEventListener('click', () => this.handleAddTeacher());
        document.getElementById('addRoomBtn').addEventListener('click', () => this.handleAddRoom());
        document.getElementById('closeScheduleModal').addEventListener('click', () => this.hideTeacherSchedule());
        document.getElementById('teacherScheduleModal').addEventListener('click', (e) => {
            if (e.target.id === 'teacherScheduleModal') this.hideTeacherSchedule();
        });

        // PDF / Print buttons in modal
        const viewPdfBtn = document.getElementById('viewPdfBtn');
        const printBtn = document.getElementById('printBtn');
        if (viewPdfBtn) viewPdfBtn.addEventListener('click', () => this.viewSchedulePdf());
        if (printBtn) printBtn.addEventListener('click', () => this.printSchedule());

        // update available rooms when day/time changes
        ['day', 'startTime', 'endTime'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.updateRoomOptions());
        });
    }

    handleAddTeacher() {
        const input = document.getElementById('newTeacher');
        const name = input.value.trim();
        if (!name) return this.showNotification('Please enter a teacher name to add.', 'error');
        if (this.teachers.includes(name)) return this.showNotification('Teacher already exists.', 'error');
        this.teachers.push(name);
        this.saveTeachers();
        input.value = '';
        this.renderTeacherOptions();
        this.showNotification('Teacher added.', 'success');
    }

    handleAddRoom() {
        const input = document.getElementById('newRoom');
        const name = input.value.trim();
        if (!name) return this.showNotification('Please enter a room name to add.', 'error');
        if (this.rooms.includes(name)) return this.showNotification('Room already exists.', 'error');
        this.rooms.push(name);
        this.saveRooms();
        input.value = '';
        this.renderRoomOptions();
        this.showNotification('Room added.', 'success');
        this.updateRoomOptions();
    }

    handleAddSchedule(e) {
        e.preventDefault();

        const teacherName = document.getElementById('teacherSelect').value;
        const subject = document.getElementById('subject').value.trim();
        const courseYear = document.getElementById('courseYear').value.trim();
        const day = document.getElementById('day').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const room = document.getElementById('roomSelect').value;

        const schedule = {
            id: Date.now(),
            teacherName,
            subject,
            courseYear,
            day,
            startTime,
            endTime,
            room
        };

        // Validation
        const validationError = this.validateSchedule(schedule);
        if (validationError) {
            this.showNotification(validationError, 'error');
            return;
        }

        // Check for conflicts with structured details
        const conflictCheck = this.checkConflicts(schedule);
        if (conflictCheck.hasConflict) {
            // Format clear message
            const bullets = conflictCheck.conflicts.map(c => `<li><strong>${c.type}:</strong> ${c.message}</li>`).join('');
            const html = `⚠️ Conflict detected:<ul style="margin-top:8px">${bullets}</ul>`;
            this.showNotification(html, 'error');
            return;
        }

        // Add schedule
        this.schedules.push(schedule);
        this.saveSchedules();
        this.showNotification('✓ Schedule added successfully!', 'success');
        document.getElementById('scheduleForm').reset();
        this.render();
        this.updateRoomOptions();
    }

    validateSchedule(schedule) {
        if (!schedule.teacherName || !schedule.subject || !schedule.courseYear || !schedule.day || !schedule.startTime || !schedule.endTime || !schedule.room) {
            return 'Please fill in all fields.';
        }

        if (schedule.startTime >= schedule.endTime) {
            return 'End time must be after start time.';
        }

        const [sh] = schedule.startTime.split(':').map(x => parseInt(x));
        const [eh, em] = schedule.endTime.split(':').map(x => parseInt(x));
        // Allow classes from 7:00 up to 21:00 (9:00 PM)
        if (sh < 7 || eh > 21 || (eh === 21 && em > 0)) {
            return 'Classes must be between 7:00 AM and 9:00 PM.';
        }

        return null;
    }

    // returns structured conflict info
    checkConflicts(newSchedule) {
        const conflicts = [];
        for (const schedule of this.schedules) {
            if (schedule.day !== newSchedule.day) continue;

            // teacher conflict
            if (schedule.teacherName.toLowerCase() === newSchedule.teacherName.toLowerCase()) {
                if (this.timesOverlap(schedule.startTime, schedule.endTime, newSchedule.startTime, newSchedule.endTime)) {
                    conflicts.push({
                        type: 'Teacher conflict',
                        message: `${schedule.teacherName} is already scheduled for ${schedule.subject} in ${schedule.room} from ${this.formatTime(schedule.startTime)} to ${this.formatTime(schedule.endTime)}.`
                        
                    });
                }
            }

            // room conflict
            if (schedule.room.toLowerCase() === newSchedule.room.toLowerCase()) {
                if (this.timesOverlap(schedule.startTime, schedule.endTime, newSchedule.startTime, newSchedule.endTime)) {
                    conflicts.push({
                        type: 'Room conflict',
                        message: `${schedule.room} is already in use by ${schedule.teacherName} for ${schedule.subject} from ${this.formatTime(schedule.startTime)} to ${this.formatTime(schedule.endTime)}.`
                    });
                }
            }
        }

        // Deduplicate based on message
        const unique = [];
        const seen = new Set();
        for (const c of conflicts) {
            if (!seen.has(c.message)) {
                unique.push(c);
                seen.add(c.message);
            }
        }

        return { hasConflict: unique.length > 0, conflicts: unique };
    }

    timesOverlap(start1, end1, start2, end2) {
        return start1 < end2 && start2 < end1;
    }

    formatTime(time) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }

    getTeacherSchedules(teacherName) {
        return this.schedules.filter(s => s.teacherName.toLowerCase() === teacherName.toLowerCase());
    }

    getTeacherConflicts(teacherName) {
        const teacherSchedules = this.getTeacherSchedules(teacherName);
        const conflicts = [];
        for (let i = 0; i < teacherSchedules.length; i++) {
            for (let j = i + 1; j < teacherSchedules.length; j++) {
                const a = teacherSchedules[i];
                const b = teacherSchedules[j];
                if (a.day === b.day && this.timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
                    conflicts.push({ schedule1: a, schedule2: b });
                }
            }
        }
        return conflicts;
    }

    deleteSchedule(id) {
        if (confirm('Are you sure you want to delete this schedule?')) {
            this.schedules = this.schedules.filter(s => s.id !== id);
            this.saveSchedules();
            this.render();
            this.showNotification('Schedule deleted.', 'success');
            this.updateRoomOptions();
        }
    }

    render() {
        this.renderTeacherView();
        this.renderAllView();
        this.renderManageView();
    }

    renderTeacherView() {
        const teacherList = document.getElementById('teacherList');
        const uniqueTeachers = [...new Set(this.schedules.map(s => s.teacherName))];
        if (uniqueTeachers.length === 0) {
            teacherList.innerHTML = '<p class="empty-message">No schedules yet. Add one to get started!</p>';
            return;
        }

        teacherList.innerHTML = uniqueTeachers.map(teacherName => {
            const teacherSchedules = this.getTeacherSchedules(teacherName);
            const conflicts = this.getTeacherConflicts(teacherName);
            const hasConflict = conflicts.length > 0;

            return `
                <div class="teacher-card ${hasConflict ? 'has-conflict' : ''}">
                    <div class="teacher-name">
                        ${teacherName}
                        ${hasConflict ? '<span class="conflict-badge">⚠️ CONFLICT</span>' : ''}
                    </div>
                    ${hasConflict ? `
                        <div class="conflict-notice">
                            ❌ This teacher has ${conflicts.length} scheduling conflict(s). Please fix before confirming.
                        </div>
                    ` : ''}
                    <table class="schedule-table">
                        <thead>
                            <tr>
                                <th>Subject</th>
                                <th>Course &amp; Year</th>
                                <th>Day</th>
                                <th>Time</th>
                                <th>Room</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${teacherSchedules.map(schedule => {
                                const isConflicted = conflicts.some(c => c.schedule1.id === schedule.id || c.schedule2.id === schedule.id);
                                return `
                                    <tr class="${isConflicted ? 'conflict-row' : ''}">
                                        <td>${schedule.subject}</td>
                                        <td>${schedule.courseYear}</td>
                                        <td>${schedule.day}</td>
                                        <td>${this.formatTime(schedule.startTime)} - ${this.formatTime(schedule.endTime)}</td>
                                        <td>${schedule.room}</td>
                                        <td><button class="delete-btn" onclick="manager.deleteSchedule(${schedule.id})">Delete</button></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }).join('');
    }

    renderAllView() {
        const allSchedules = document.getElementById('allSchedules');
        if (this.schedules.length === 0) {
            allSchedules.innerHTML = '<p class="empty-message">No schedules yet. Add one to get started!</p>';
            return;
        }

        const grouped = {};
        this.schedules.forEach(s => {
            if (!grouped[s.teacherName]) grouped[s.teacherName] = [];
            grouped[s.teacherName].push(s);
        });

        const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
        Object.keys(grouped).forEach(teacher => {
            grouped[teacher].sort((a, b) => {
                const dayCompare = (dayOrder[a.day] || 0) - (dayOrder[b.day] || 0);
                if (dayCompare !== 0) return dayCompare;
                const courseCompare = a.courseYear.localeCompare(b.courseYear);
                if (courseCompare !== 0) return courseCompare;
                return a.startTime.localeCompare(b.startTime);
            });
        });

        const teachersSorted = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

        allSchedules.innerHTML = teachersSorted.map(teacherName => {
            const teacherSchedules = grouped[teacherName];
            const conflicts = this.getTeacherConflicts(teacherName);
            const hasConflict = conflicts.length > 0;
            return `
                <div class="teacher-card ${hasConflict ? 'has-conflict' : ''}">
                    <div class="teacher-name">
                        ${teacherName}
                        ${hasConflict ? '<span class="conflict-badge">⚠️ CONFLICT</span>' : ''}
                    </div>
                    ${hasConflict ? `
                        <div class="conflict-notice">
                            ❌ This teacher has ${conflicts.length} scheduling conflict(s).
                        </div>
                    ` : ''}
                    <table class="schedule-table full-table">
                        <thead>
                            <tr>
                                <th>Subject</th>
                                <th>Course &amp; Year</th>
                                <th>Day</th>
                                <th>Time</th>
                                <th>Room</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${teacherSchedules.map(schedule => {
                                const isConflicted = conflicts.some(c => c.schedule1.id === schedule.id || c.schedule2.id === schedule.id);
                                return `
                                    <tr class="${isConflicted ? 'conflict-row' : ''}">
                                        <td>${schedule.subject}</td>
                                        <td>${schedule.courseYear}</td>
                                        <td>${schedule.day}</td>
                                        <td>${this.formatTime(schedule.startTime)} - ${this.formatTime(schedule.endTime)}</td>
                                        <td>${schedule.room}</td>
                                        <td><button class="delete-btn" onclick="manager.deleteSchedule(${schedule.id})">Delete</button></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                    <div class="view-row">
                        <button class="btn-view" onclick="manager.showTeacherSchedule('${teacherName.replace(/'/g, "\\'")}')">View Timetable</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderManageView() {
        const teacherListManage = document.getElementById('teacherListManage');
        const roomListManage = document.getElementById('roomListManage');

        if (this.teachers.length === 0) {
            teacherListManage.innerHTML = '<p class="empty-message">No teachers added yet.</p>';
        } else {
            teacherListManage.innerHTML = this.teachers.sort((a, b) => a.localeCompare(b)).map(teacherName => {
                const count = this.schedules.filter(s => s.teacherName === teacherName).length;
                return `
                    <div class="manage-item">
                        <div>
                            <div class="manage-item-title">${teacherName}</div>
                            <div class="manage-item-subtext">${count} schedule${count === 1 ? '' : 's'}</div>
                        </div>
                        <div class="manage-actions">
                            <button class="edit-btn" onclick="manager.handleEditTeacher('${teacherName.replace(/'/g, "\\'")}')">Edit</button>
                            <button class="delete-btn" onclick="manager.handleDeleteTeacher('${teacherName.replace(/'/g, "\\'")}')">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        if (this.rooms.length === 0) {
            roomListManage.innerHTML = '<p class="empty-message">No rooms added yet.</p>';
        } else {
            roomListManage.innerHTML = this.rooms.sort((a, b) => a.localeCompare(b)).map(roomName => {
                const count = this.schedules.filter(s => s.room === roomName).length;
                return `
                    <div class="manage-item">
                        <div>
                            <div class="manage-item-title">${roomName}</div>
                            <div class="manage-item-subtext">${count} schedule${count === 1 ? '' : 's'}</div>
                        </div>
                        <div class="manage-actions">
                            <button class="edit-btn" onclick="manager.handleEditRoom('${roomName.replace(/'/g, "\\'")}')">Edit</button>
                            <button class="delete-btn" onclick="manager.handleDeleteRoom('${roomName.replace(/'/g, "\\'")}')">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    handleEditTeacher(oldName) {
        const newNameRaw = prompt('Enter a new name for the teacher:', oldName);
        const newName = newNameRaw ? newNameRaw.trim() : '';
        if (!newName) return;
        if (this.teachers.some(t => t.toLowerCase() === newName.toLowerCase() && t !== oldName)) {
            return this.showNotification('A teacher with that name already exists.', 'error');
        }
        const index = this.teachers.findIndex(t => t === oldName);
        if (index === -1) return;
        this.teachers[index] = newName;
        this.schedules = this.schedules.map(s => s.teacherName === oldName ? { ...s, teacherName: newName } : s);
        this.saveTeachers();
        this.saveSchedules();
        this.render();
        this.showNotification('Teacher name updated.', 'success');
    }

    handleDeleteTeacher(name) {
        const related = this.schedules.filter(s => s.teacherName === name).length;
        if (related > 0) {
            const cascade = confirm(`${name} has ${related} schedule(s). Click OK to delete the teacher and all their schedules, or Cancel to keep them.`);
            if (!cascade) return this.showNotification('Deletion cancelled. Remove schedules first to delete teacher.', 'error');
            // remove schedules and teacher
            this.schedules = this.schedules.filter(s => s.teacherName !== name);
        } else {
            if (!confirm(`Delete teacher ${name}?`)) return;
        }
        this.teachers = this.teachers.filter(t => t !== name);
        this.saveTeachers();
        this.saveSchedules();
        this.render();
        this.showNotification('Teacher deleted.', 'success');
    }

    handleEditRoom(oldName) {
        const newNameRaw = prompt('Enter a new name for the room:', oldName);
        const newName = newNameRaw ? newNameRaw.trim() : '';
        if (!newName) return;
        if (this.rooms.some(r => r.toLowerCase() === newName.toLowerCase() && r !== oldName)) {
            return this.showNotification('A room with that name already exists.', 'error');
        }
        const index = this.rooms.findIndex(r => r === oldName);
        if (index === -1) return;
        this.rooms[index] = newName;
        this.schedules = this.schedules.map(s => s.room === oldName ? { ...s, room: newName } : s);
        this.saveRooms();
        this.saveSchedules();
        this.render();
        this.showNotification('Room name updated.', 'success');
    }

    handleDeleteRoom(name) {
        const related = this.schedules.filter(s => s.room === name).length;
        if (related > 0) {
            const cascade = confirm(`${name} is used in ${related} schedule(s). Click OK to delete the room and remove those schedule entries, or Cancel to keep them.`);
            if (!cascade) return this.showNotification('Deletion cancelled. Remove schedules first to delete room.', 'error');
            // remove schedules that reference the room
            this.schedules = this.schedules.filter(s => s.room !== name);
        } else {
            if (!confirm(`Delete room ${name}?`)) return;
        }
        this.rooms = this.rooms.filter(r => r !== name);
        this.saveRooms();
        this.saveSchedules();
        this.render();
        this.showNotification('Room deleted.', 'success');
    }

    switchView(e) {
        document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        const viewType = e.target.dataset.view;
        document.querySelectorAll('.view-content').forEach(view => view.classList.remove('active'));
        document.getElementById(viewType === 'teacher' ? 'teacherView' : viewType === 'all' ? 'allView' : 'manageView').classList.add('active');
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.classList.toggle('all-view-active', viewType === 'all');
        }
    }

    showTeacherSchedule(teacherName) {
        const teacherSchedules = this.getTeacherSchedules(teacherName);

        // Determine days to display: default Mon-Fri, include Saturday only if teacher has classes there
        const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const teacherDays = new Set(teacherSchedules.map(s => s.day));
        const daysToShow = allDays.filter(d => d !== 'Saturday').filter(d => true);
        if (teacherDays.has('Saturday')) daysToShow.push('Saturday');

        // Determine display end time: show until 5pm unless teacher has classes after 5pm
        const latestEndMin = teacherSchedules.reduce((max, s) => Math.max(max, this.timeToMinutes(s.endTime)), 0);
        const defaultEnd = 17 * 60; // 5:00 PM
        const maxAllowedEnd = 21 * 60; // 9:00 PM
        let displayEnd = defaultEnd;
        if (latestEndMin > defaultEnd) displayEnd = Math.min(latestEndMin, maxAllowedEnd);

        const slots = this.generateTimeSlots().filter(slot => this.timeToMinutes(slot.start) < displayEnd);
        const grid = this.buildScheduleGrid(teacherSchedules, daysToShow, slots);

        document.getElementById('modalTeacherName').textContent = `${teacherName} — Plotted Schedule`;
        document.getElementById('scheduleGridContainer').innerHTML = grid;
        document.getElementById('teacherScheduleModal').classList.remove('hidden');
    }

    hideTeacherSchedule() {
        document.getElementById('teacherScheduleModal').classList.add('hidden');
    }

    generateTimeSlots() {
        const slots = [];
        let minutes = 7 * 60;
        // generate 30-min slots from 7:00 up to 21:00 (9:00 PM)
        while (minutes < 21 * 60) {
            const startH = Math.floor(minutes / 60);
            const startM = minutes % 60;
            const endMinutes = minutes + 30;
            const endH = Math.floor(endMinutes / 60);
            const endM = endMinutes % 60;
            const format = (h, m) => `${((h + 11) % 12) + 1}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
            slots.push({
                start: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
                end: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
                label: `${format(startH, startM)} - ${format(endH, endM)}`
            });
            minutes += 30;
        }
        return slots;
    }

    buildScheduleGrid(schedules, days, slots) {
        // Build a grid that merges consecutive slots into a single cell using rowspan
        // Prepare a map for each day with slot placeholders
        const slotCount = slots.length;
        const dayCells = {};
        days.forEach(day => {
            dayCells[day] = new Array(slotCount).fill(null);
        });

        // For each schedule, compute start index and span (number of slots)
        schedules.forEach(schedule => {
            const day = schedule.day;
            if (!dayCells[day]) return; // skip days not displayed
            const scheduleStart = this.timeToMinutes(schedule.startTime);
            const scheduleEnd = this.timeToMinutes(schedule.endTime);
            // find first slot index where slot.end > scheduleStart
            let startIdx = slots.findIndex(slot => this.timeToMinutes(slot.end) > scheduleStart);
            if (startIdx === -1) return;
            // find last slot index where slot.start < scheduleEnd
            let endIdx = -1;
            for (let i = startIdx; i < slots.length; i++) {
                if (this.timeToMinutes(slots[i].start) < scheduleEnd) endIdx = i;
                else break;
            }
            if (endIdx === -1) return;
            const span = endIdx - startIdx + 1;
            const content = `
                <div class="cell-content">
                    <div class="subject">${schedule.subject}</div>
                    <div class="section">${schedule.courseYear}</div>
                    <div class="room">${schedule.room}</div>
                </div>
            `;
            // Place content at startIdx and mark following indices as skipped
            dayCells[day][startIdx] = { content, span, id: schedule.id };
            for (let k = startIdx + 1; k <= endIdx; k++) {
                dayCells[day][k] = { skip: true };
            }
        });

        const headerRow = ['<tr><th>Time</th>' + days.map(day => `<th>${day}</th>`).join('') + '</tr>'];
        const rows = slots.map((slot, rowIdx) => {
            const cols = days.map(day => {
                const cell = dayCells[day][rowIdx];
                if (!cell) return '<td></td>';
                if (cell.skip) return '';
                const rowspanAttr = cell.span && cell.span > 1 ? ` rowspan="${cell.span}"` : '';
                return `<td${rowspanAttr}>${cell.content}</td>`;
            }).join('');
            return `<tr><td class="slot-label">${slot.label}</td>${cols}</tr>`;
        });

        return `
            <div class="schedule-grid-wrapper">
                <table class="schedule-grid">
                    ${headerRow.join('')}
                    ${rows.join('')}
                </table>
            </div>
        `;
    }

    // Create a jsPDF instance from the schedule HTML element
    createPdfFromElement(element) {
        return new Promise((resolve, reject) => {
            if (!element) return reject(new Error('No element to render'));
            if (typeof html2canvas === 'undefined') return reject(new Error('html2canvas is not loaded'));

            let jsPDFClass = null;
            if (window.jspdf && window.jspdf.jsPDF) jsPDFClass = window.jspdf.jsPDF;
            else if (window.jspdf && window.jspdf.default && window.jspdf.default.jsPDF) jsPDFClass = window.jspdf.default.jsPDF;
            else if (window.jsPDF) jsPDFClass = window.jsPDF;

            if (!jsPDFClass) return reject(new Error('jsPDF is not loaded'));

            html2canvas(element, { scale: 2 }).then(canvas => {
                try {
                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDFClass({ orientation: 'landscape', unit: 'pt', format: 'a4' });
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();

                    const imgWidth = canvas.width;
                    const imgHeight = canvas.height;
                    const ratio = Math.min((pageWidth - 40) / imgWidth, (pageHeight - 40) / imgHeight);
                    const renderWidth = imgWidth * ratio;
                    const renderHeight = imgHeight * ratio;
                    const x = (pageWidth - renderWidth) / 2;
                    const y = 20;

                    pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
                    resolve(pdf);
                } catch (err) {
                    reject(err);
                }
            }).catch(err => reject(err));
        });
    }

    // Open the plotted schedule as a PDF in a new tab/window
    viewSchedulePdf() {
        const container = document.getElementById('scheduleGridContainer');
        if (!container) return this.showNotification('Schedule not available to export.', 'error');
        this.createPdfFromElement(container).then(pdf => {
            try {
                const blob = pdf.output('blob');
                const url = URL.createObjectURL(blob);
                const win = window.open(url, '_blank');
                if (!win) {
                    this.showNotification('Popup blocked. Please allow popups or try printing instead.', 'error');
                }
            } catch (err) {
                this.showNotification('Failed to open PDF: ' + err.message, 'error');
            }
        }).catch(err => this.showNotification('Failed to generate PDF: ' + err.message, 'error'));
    }

    // Generate PDF and trigger print dialog
    printSchedule() {
        const container = document.getElementById('scheduleGridContainer');
        if (!container) return this.showNotification('Schedule not available to print.', 'error');
        this.createPdfFromElement(container).then(pdf => {
            try {
                const url = pdf.output('bloburl');
                const w = window.open(url);
                if (!w) return this.showNotification('Unable to open print window (popup blocked).', 'error');
                // give the window time to load before printing
                setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } }, 700);
            } catch (err) {
                this.showNotification('Failed to print PDF: ' + err.message, 'error');
            }
        }).catch(err => this.showNotification('Failed to generate PDF: ' + err.message, 'error'));
    }

    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(x => parseInt(x, 10));
        return hours * 60 + minutes;
    }

    showNotification(message, type) {
        const notification = document.getElementById('notification');
        notification.innerHTML = message;
        notification.className = `notification ${type}`;
        if (type === 'success') {
            setTimeout(() => { notification.className = 'notification'; notification.innerHTML = ''; }, 3500);
        }
    }

    saveSchedules() { localStorage.setItem('schedules', JSON.stringify(this.schedules)); }
    loadSchedules() { const data = localStorage.getItem('schedules'); return data ? JSON.parse(data) : []; }

    // Migrate older stored schedules using `sectionYear` to `courseYear`
    migrateSchedules() {
        let changed = false;
        this.schedules = this.schedules.map(s => {
            if (s && s.sectionYear && !s.courseYear) {
                s.courseYear = s.sectionYear;
                delete s.sectionYear;
                changed = true;
            }
            return s;
        });
        if (changed) this.saveSchedules();
    }

    // teachers & rooms
    saveTeachers() { localStorage.setItem('teachers', JSON.stringify(this.teachers)); }
    loadTeachers() { const d = localStorage.getItem('teachers'); return d ? JSON.parse(d) : []; }
    saveRooms() { localStorage.setItem('rooms', JSON.stringify(this.rooms)); }
    loadRooms() { const d = localStorage.getItem('rooms'); return d ? JSON.parse(d) : []; }

    renderTeacherOptions() {
        const sel = document.getElementById('teacherSelect');
        sel.innerHTML = '<option value="">-- Select Teacher --</option>' + this.teachers.map(t => `<option value="${t}">${t}</option>`).join('');
    }

    renderRoomOptions() {
        const sel = document.getElementById('roomSelect');
        sel.innerHTML = '<option value="">-- Select Room --</option>' + this.rooms.map(r => `<option value="${r}">${r}</option>`).join('');
    }

    // remove rooms that conflict with selected time/day
    updateRoomOptions() {
        const day = document.getElementById('day').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const sel = document.getElementById('roomSelect');

        // if no time/day selected, show all
        if (!day || !startTime || !endTime) {
            this.renderRoomOptions();
            return;
        }

        const available = this.rooms.filter(r => {
            // if any existing schedule uses room r at overlapping time on same day, exclude
            return !this.schedules.some(s => s.room.toLowerCase() === r.toLowerCase() && s.day === day && this.timesOverlap(s.startTime, s.endTime, startTime, endTime));
        });

        sel.innerHTML = '<option value="">-- Select Room --</option>' + available.map(r => `<option value="${r}">${r}</option>`).join('');
        const hint = document.getElementById('roomHint');
        hint.textContent = available.length === 0 ? 'No rooms available for this time.' : 'Room list updated for selected time.';
    }
}

// Initialize the application
let manager;
document.addEventListener('DOMContentLoaded', () => {
    manager = new ScheduleManager();
});
