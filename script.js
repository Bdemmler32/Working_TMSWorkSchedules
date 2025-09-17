function sortEmployees(employees) {
    return employees.sort((a, b) => {
        if (nameSortOrder === 'first') {
            return a.localeCompare(b);
        } else {
            // Sort by last name
            const lastNameA = a.split(' ').pop();
            const lastNameB = b.split(' ').pop();
            return lastNameA.localeCompare(lastNameB);
        }
    });
}

function toggleNameSort() {
    nameSortOrder = nameSortOrder === 'first' ? 'last' : 'first';
    updateDisplay();
}

function toggleOfficeHoursFilter() {
    officeHoursOnly = !officeHoursOnly;
    updateOfficeHoursFilterButton();
}

function updateOfficeHoursFilterButton() {
    const btn = document.getElementById('officeHoursFilterBtn');
    if (officeHoursOnly) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fas fa-building"></i> Clear Office Filter';
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fas fa-building"></i> Filter Office Hours';
    }
}

function hasOfficeHours(employee, weekData) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    return days.some(day => {
        const daySchedule = weekData[day] || [];
        return daySchedule.some(block => block.location.toLowerCase() === 'office');
    });
}

function filterOfficeHoursOnly(weekData) {
    const filteredData = {};
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    days.forEach(day => {
        const daySchedule = weekData[day] || [];
        const officeBlocks = daySchedule.filter(block => 
            block.location.toLowerCase() === 'office'
        );
        if (officeBlocks.length > 0) {
            filteredData[day] = officeBlocks;
        }
    });
    
    return filteredData;
}
    const today = new Date();
    const dayIndex = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Convert to our format (Monday = 0, Tuesday = 1, etc.)
    // Return -1 if today is weekend (not shown in schedule)
    if (dayIndex === 0 || dayIndex === 6) return -1; // Sunday or Saturday
    return dayIndex - 1; // Monday = 0, Tuesday = 1, etc.
}

function isCurrentWeek() {
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);
    
    return todayStart >= currentWeekStart && todayStart <= currentWeekEnd;
}// Global variables
let employeeData = {};
let currentWeekStart = null;
let currentWeekType = 1; // 1 or 2
let selectedEmployees = []; // For filtering
let isFilterActive = false;
let nameSortOrder = 'first'; // 'first' or 'last'
let officeHoursOnly = false;

// Week 1 starts on September 13, 2025
const WEEK_1_START = new Date('2025-09-13T00:00:00');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    loadScheduleData();
});

function initializeEventListeners() {
    // Navigation buttons
    document.getElementById('prevWeek').addEventListener('click', () => navigateWeek(-1));
    document.getElementById('nextWeek').addEventListener('click', () => navigateWeek(1));
    
    // Jump to Today button
    document.getElementById('jumpTodayBtn').addEventListener('click', jumpToToday);
    
    // Filter button
    document.getElementById('filterBtn').addEventListener('click', handleFilterBtn);
    
    // Week selector
    document.getElementById('weekSelector').addEventListener('change', (e) => {
        currentWeekType = parseInt(e.target.value);
        updateDisplay();
    });
    
    // Modal events
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('employeeModal').addEventListener('click', (e) => {
        if (e.target.id === 'employeeModal') closeModal();
    });
    
    // Filter modal events
    document.getElementById('closeFilterModal').addEventListener('click', closeFilterModal);
    document.getElementById('employeeFilterModal').addEventListener('click', (e) => {
        if (e.target.id === 'employeeFilterModal') closeFilterModal();
    });
    
    // Filter actions
    document.getElementById('selectAllBtn').addEventListener('click', selectAllEmployees);
    document.getElementById('deselectAllBtn').addEventListener('click', deselectAllEmployees);
    document.getElementById('applyFilterBtn').addEventListener('click', applyEmployeeFilter);
    document.getElementById('officeHoursFilterBtn').addEventListener('click', toggleOfficeHoursFilter);
    
    // Employee search
    document.getElementById('employeeSearch').addEventListener('input', filterEmployeeList);
}

async function loadScheduleData() {
    try {
        showLoading(true);
        
        const response = await fetch('TMS-WorkSchedules.xlsx');
        if (!response.ok) {
            throw new Error('Could not load Excel file');
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        processWorkbookData(workbook);
        
        // Set current week based on today's date
        setCurrentWeek();
        updateDisplay();
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error loading schedule:', error);
        showError();
    }
}

function processWorkbookData(workbook) {
    const validSheets = workbook.SheetNames.filter(name => 
        name !== 'NewEmployee' && name !== 'FormTools'
    );
    
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dayColumns = {
        'Monday': ['I', 'J', 'K'],
        'Tuesday': ['L', 'M', 'N'], 
        'Wednesday': ['O', 'P', 'Q'],
        'Thursday': ['R', 'S', 'T'],
        'Friday': ['U', 'V', 'W']
    };
    
    validSheets.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const employeeName = sheet['C1']?.v || sheetName;
        
        employeeData[employeeName] = {
            sheetName: sheetName,
            week1: {},
            week2: {}
        };
        
        // Process Week 1 (rows 9-13)
        for (let row = 9; row <= 13; row++) {
            processDayData(sheet, row, daysOfWeek, dayColumns, employeeName, 'week1');
        }
        
        // Process Week 2 (rows 24-28)
        for (let row = 24; row <= 28; row++) {
            processDayData(sheet, row, daysOfWeek, dayColumns, employeeName, 'week2');
        }
    });
}

function processDayData(sheet, row, daysOfWeek, dayColumns, employeeName, weekType) {
    daysOfWeek.forEach(day => {
        const [startCol, endCol, locationCol] = dayColumns[day];
        const startTime = sheet[`${startCol}${row}`]?.v;
        const endTime = sheet[`${endCol}${row}`]?.v;
        const location = sheet[`${locationCol}${row}`]?.v;
        
        if (startTime && endTime && location) {
            if (!employeeData[employeeName][weekType][day]) {
                employeeData[employeeName][weekType][day] = [];
            }
            
            const startTimeFormatted = excelDateToTime(startTime);
            const endTimeFormatted = excelDateToTime(endTime);
            
            // Ensure start time comes before end time
            const [finalStart, finalEnd] = orderTimes(startTimeFormatted, endTimeFormatted);
            
            employeeData[employeeName][weekType][day].push({
                startTime: finalStart,
                endTime: finalEnd,
                location: location.trim(),
                block: weekType === 'week1' ? row - 8 : row - 23
            });
        }
    });
}

function excelDateToTime(excelDate) {
    if (!excelDate) return null;
    
    // Handle both date objects and decimal time values
    let timeValue;
    if (excelDate instanceof Date) {
        timeValue = excelDate.getHours() + (excelDate.getMinutes() / 60);
    } else {
        // Excel decimal time (e.g., 0.5 = 12:00 PM)
        timeValue = excelDate * 24;
    }
    
    const hours = Math.floor(timeValue);
    const minutes = Math.round((timeValue - hours) * 60);
    
    // Convert to 12-hour format
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
    
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function orderTimes(startTime, endTime) {
    // Don't reorder times - keep them as they appear in the Excel file
    // The issue was that we were incorrectly reordering valid times
    return [startTime, endTime];
}

function timeToMinutes(timeStr) {
    const [time, period] = timeStr.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    let totalMinutes = (hours % 12) * 60 + minutes;
    if (period === 'PM' && hours !== 12) totalMinutes += 720;
    if (period === 'AM' && hours === 12) totalMinutes = minutes;
    return totalMinutes;
}

function setCurrentWeek() {
    const today = new Date();
    const daysSinceWeek1 = Math.floor((today - WEEK_1_START) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(daysSinceWeek1 / 7);
    
    currentWeekType = (weekNumber % 2) + 1;
    
    // Set current week start to the beginning of this week period
    const weeksFromStart = Math.floor(daysSinceWeek1 / 7);
    currentWeekStart = new Date(WEEK_1_START);
    currentWeekStart.setDate(currentWeekStart.getDate() + (weeksFromStart * 7));
    
    // Update week selector
    document.getElementById('weekSelector').value = currentWeekType.toString();
}

function navigateWeek(direction) {
    currentWeekStart.setDate(currentWeekStart.getDate() + (direction * 7));
    
    // Determine week type based on weeks from original start
    const daysSinceStart = Math.floor((currentWeekStart - WEEK_1_START) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(daysSinceStart / 7);
    currentWeekType = (weekNumber % 2) + 1;
    
    document.getElementById('weekSelector').value = currentWeekType.toString();
    updateDisplay();
}

function updateDisplay() {
    updateDateRange();
    renderScheduleGrid();
}

function updateDateRange() {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const startStr = currentWeekStart.toLocaleDateString('en-US', options);
    const endStr = weekEnd.toLocaleDateString('en-US', options);
    
    document.getElementById('dateRange').textContent = `${startStr} - ${endStr}`;
}

function renderScheduleGrid() {
    const scheduleGrid = document.getElementById('scheduleGrid');
    scheduleGrid.innerHTML = '';
    
    const employees = Object.keys(employeeData).sort();
    const colors = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5', 'color-6', 
                   'color-7', 'color-8', 'color-9', 'color-10', 'color-11', 'color-12'];
    
    // Filter employees based on selection and schedule data
    let filteredEmployees;
    if (isFilterActive && selectedEmployees.length > 0) {
        filteredEmployees = selectedEmployees.filter(employeeName => {
            const employee = employeeData[employeeName];
            if (!employee) return false;
            const weekData = currentWeekType === 1 ? employee.week1 : employee.week2;
            return hasScheduleData(weekData);
        });
    } else {
        filteredEmployees = employees.filter(employeeName => {
            const employee = employeeData[employeeName];
            const weekData = currentWeekType === 1 ? employee.week1 : employee.week2;
            return hasScheduleData(weekData);
        });
    }
    
    // Set grid rows: 1 header row + number of filtered employees
    scheduleGrid.style.gridTemplateRows = `auto repeat(${filteredEmployees.length}, auto)`;
    
    // Get current day info
    const currentDayIndex = getCurrentDayOfWeek();
    const isThisWeek = isCurrentWeek();
    
    // Create header cells
    const headers = ['Employee', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    headers.forEach((header, index) => {
        const headerCell = document.createElement('div');
        let className = `grid-cell header-cell ${index === 0 ? 'employee-header' : ''}`;
        
        // Highlight current day if this is the current week
        if (isThisWeek && index > 0 && index - 1 === currentDayIndex) {
            className += ' current-day';
        }
        
        headerCell.className = className;
        headerCell.textContent = header;
        scheduleGrid.appendChild(headerCell);
    });
    
    // Create employee rows
    filteredEmployees.forEach((employeeName, employeeIndex) => {
        const employee = employeeData[employeeName];
        const weekData = currentWeekType === 1 ? employee.week1 : employee.week2;
        const colorClass = colors[employees.indexOf(employeeName) % colors.length]; // Use original index for consistent colors
        
        // Store row cells for hover effect
        const rowCells = [];
        
        // Employee info cell
        const employeeCell = document.createElement('div');
        employeeCell.className = 'grid-cell employee-cell';
        employeeCell.onclick = () => openEmployeeModal(employeeName);
        
        const initials = getInitials(employeeName);
        employeeCell.innerHTML = `
            <div class="employee-initials ${colorClass}">${initials}</div>
            <div class="employee-name">${employeeName}</div>
        `;
        
        scheduleGrid.appendChild(employeeCell);
        rowCells.push(employeeCell);
        
        // Day cells
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        days.forEach((day, dayIndex) => {
            const dayCell = document.createElement('div');
            let className = 'grid-cell day-cell';
            
            // Highlight current day if this is the current week
            if (isThisWeek && dayIndex === currentDayIndex) {
                className += ' current-day';
            }
            
            dayCell.className = className;
            
            const daySchedule = weekData[day] || [];
            daySchedule.forEach(block => {
                const workBlock = document.createElement('div');
                workBlock.className = `work-block ${block.location.toLowerCase() === 'office' ? 'office' : 'remote'}`;
                
                const icon = block.location.toLowerCase() === 'office' ? '<i class="fas fa-building"></i>' : '<i class="fas fa-home"></i>';
                workBlock.innerHTML = `
                    <span class="work-block-icon">${icon}</span>
                    <span class="work-block-time">${block.startTime} - ${block.endTime}</span>
                `;
                
                dayCell.appendChild(workBlock);
            });
            
            scheduleGrid.appendChild(dayCell);
            rowCells.push(dayCell);
        });
        
        // Add hover effects to entire employee row
        rowCells.forEach(cell => {
            cell.addEventListener('mouseenter', () => {
                rowCells.forEach(rowCell => rowCell.classList.add('employee-row-hover'));
            });
            
            cell.addEventListener('mouseleave', () => {
                rowCells.forEach(rowCell => rowCell.classList.remove('employee-row-hover'));
            });
        });
    });
    
    updateFilterResults(filteredEmployees.length, employees.length);
}

// Filter functionality
function handleFilterBtn() {
    if (isFilterActive) {
        clearEmployeeFilter();
    } else {
        openEmployeeFilterModal();
    }
}

function openEmployeeFilterModal() {
    const modal = document.getElementById('employeeFilterModal');
    populateEmployeeFilterList();
    updateOfficeHoursFilterButton(); // Update button state when opening modal
    modal.style.display = 'flex';
}

function closeFilterModal() {
    document.getElementById('employeeFilterModal').style.display = 'none';
}

function populateEmployeeFilterList() {
    const employeeList = document.getElementById('employeeFilterList');
    let employees = Object.keys(employeeData);
    employees = sortEmployees(employees);
    
    const colors = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5', 'color-6', 
                   'color-7', 'color-8', 'color-9', 'color-10', 'color-11', 'color-12'];
    
    employeeList.innerHTML = '';
    
    employees.forEach((employeeName) => {
        const originalIndex = Object.keys(employeeData).sort().indexOf(employeeName);
        const colorClass = colors[originalIndex % colors.length];
        const initials = getInitials(employeeName);
        
        const item = document.createElement('div');
        item.className = 'employee-checkbox-item';
        item.dataset.employeeName = employeeName;
        
        const isChecked = selectedEmployees.includes(employeeName);
        
        item.innerHTML = `
            <input type="checkbox" id="emp-${originalIndex}" ${isChecked ? 'checked' : ''}>
            <div class="employee-checkbox-info">
                <div class="employee-checkbox-initials ${colorClass}">${initials}</div>
                <span>${employeeName}</span>
            </div>
        `;
        
        // Add click event to the entire item
        item.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                const checkbox = item.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
            }
        });
        
        employeeList.appendChild(item);
    });
}

function filterEmployeeList() {
    const searchTerm = document.getElementById('employeeSearch').value.toLowerCase();
    const items = document.querySelectorAll('.employee-checkbox-item');
    
    items.forEach(item => {
        const employeeName = item.dataset.employeeName.toLowerCase();
        const matches = employeeName.includes(searchTerm);
        item.style.display = matches ? 'flex' : 'none';
    });
}

function selectAllEmployees() {
    const visibleCheckboxes = document.querySelectorAll('.employee-checkbox-item:not([style*="display: none"]) input[type="checkbox"]');
    visibleCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
}

function deselectAllEmployees() {
    const visibleCheckboxes = document.querySelectorAll('.employee-checkbox-item:not([style*="display: none"]) input[type="checkbox"]');
    visibleCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
}

function applyEmployeeFilter() {
    const checkedBoxes = document.querySelectorAll('.employee-checkbox-item input[type="checkbox"]:checked');
    selectedEmployees = Array.from(checkedBoxes).map(checkbox => {
        return checkbox.closest('.employee-checkbox-item').dataset.employeeName;
    });
    
    isFilterActive = selectedEmployees.length > 0 || officeHoursOnly; // Consider office filter too
    updateFilterButton();
    closeFilterModal();
    updateDisplay();
}

function clearEmployeeFilter() {
    selectedEmployees = [];
    isFilterActive = false;
    officeHoursOnly = false; // Also clear office hours filter
    updateFilterButton();
    updateDisplay();
}

function updateFilterButton() {
    const filterBtn = document.getElementById('filterBtn');
    if (isFilterActive || officeHoursOnly) {
        filterBtn.innerHTML = '<i class="fas fa-times"></i> Clear Filter';
        filterBtn.className = 'filter-btn clear-mode';
    } else {
        filterBtn.innerHTML = 'Filter Employees';
        filterBtn.className = 'filter-btn';
    }
}

function updateFilterResults(displayedCount, totalCount) {
    const filterResultsText = document.getElementById('filterResultsText');
    if (isFilterActive || officeHoursOnly) {
        let filterDesc = '';
        if (selectedEmployees.length > 0 && officeHoursOnly) {
            filterDesc = ' (selected employees + office hours only)';
        } else if (selectedEmployees.length > 0) {
            filterDesc = ' (selected employees)';
        } else if (officeHoursOnly) {
            filterDesc = ' (office hours only)';
        }
        filterResultsText.textContent = `Showing ${displayedCount} of ${totalCount} employees${filterDesc}`;
    } else {
        filterResultsText.textContent = `Showing all ${displayedCount} employees`;
    }
}

function jumpToToday() {
    setCurrentWeek();
    updateDisplay();
}

function hasScheduleData(weekData) {
    return Object.keys(weekData).length > 0 && 
           Object.values(weekData).some(daySchedule => daySchedule && daySchedule.length > 0);
}

function getInitials(name) {
    return name.split(' ')
               .map(word => word.charAt(0).toUpperCase())
               .join('')
               .substring(0, 2);
}

function openEmployeeModal(employeeName) {
    const modal = document.getElementById('employeeModal');
    const employee = employeeData[employeeName];
    
    document.getElementById('modalEmployeeName').textContent = `${employeeName} - Schedule`;
    
    // Update week titles
    document.getElementById('currentWeekTitle').textContent = `Week ${currentWeekType} (Current)`;
    document.getElementById('otherWeekTitle').textContent = `Week ${currentWeekType === 1 ? 2 : 1}`;
    
    // Render current week
    const currentWeekData = currentWeekType === 1 ? employee.week1 : employee.week2;
    renderModalWeek('currentWeekGrid', currentWeekData);
    
    // Render other week
    const otherWeekData = currentWeekType === 1 ? employee.week2 : employee.week1;
    renderModalWeek('otherWeekGrid', otherWeekData);
    
    modal.style.display = 'flex';
}

function renderModalWeek(gridId, weekData) {
    const grid = document.getElementById(gridId);
    grid.innerHTML = '';
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    days.forEach(day => {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'modal-day';
        
        const header = document.createElement('div');
        header.className = 'modal-day-header';
        header.textContent = day;
        dayDiv.appendChild(header);
        
        const content = document.createElement('div');
        content.className = 'modal-day-content';
        
        const daySchedule = weekData[day] || [];
        
        if (daySchedule.length === 0) {
            const noWork = document.createElement('div');
            noWork.className = 'no-work';
            noWork.textContent = 'No scheduled work';
            content.appendChild(noWork);
        } else {
            daySchedule.forEach(block => {
                const workBlock = document.createElement('div');
                workBlock.className = `modal-work-block ${block.location.toLowerCase() === 'office' ? 'office' : 'remote'}`;
                
                const icon = block.location.toLowerCase() === 'office' ? '<i class="fas fa-building"></i>' : '<i class="fas fa-home"></i>';
                workBlock.innerHTML = `
                    <span class="work-block-icon">${icon}</span>
                    <span class="work-block-time">${block.startTime} - ${block.endTime}</span>
                `;
                
                content.appendChild(workBlock);
            });
        }
        
        dayDiv.appendChild(content);
        grid.appendChild(dayDiv);
    });
}

function closeModal() {
    document.getElementById('employeeModal').style.display = 'none';
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
    document.getElementById('scheduleBody').style.display = show ? 'none' : 'block';
    document.getElementById('filterResults').style.display = show ? 'none' : 'block';
}

function showError() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'flex';
    document.getElementById('scheduleBody').style.display = 'none';
    document.getElementById('filterResults').style.display = 'none';
}