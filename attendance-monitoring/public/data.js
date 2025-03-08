// Fetch and display attendance data when the page loads
window.onload = async function() {
    await loadAttendanceData();
    initializeCSVDownload();
    createAttendanceChart();
};

// Fetch attendance records from the server
async function loadAttendanceData() {
    try {
        const response = await fetch('/all-attendance-records');
        const records = await response.json();
        
        populateTable(records);
        return records;
    } catch (error) {
        console.error('Error fetching attendance records:', error);
        document.getElementById('attendance-table').innerHTML = 
            '<tr><td colspan="3">Failed to load attendance data</td></tr>';
    }
}

// Populate the table with attendance records
function populateTable(records) {
    const tableBody = document.getElementById('attendance-table');
    tableBody.innerHTML = '';
    
    if (records.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3">No attendance records found</td></tr>';
        return;
    }
    
    records.forEach(record => {
        const row = document.createElement('tr');
        
        const studentIdCell = document.createElement('td');
        studentIdCell.textContent = `Student ${record.studentId}`;
        
        const dateCell = document.createElement('td');
        dateCell.textContent = record.date;
        
        const statusCell = document.createElement('td');
        statusCell.textContent = record.status;
        statusCell.className = record.status.toLowerCase();
        
        row.appendChild(studentIdCell);
        row.appendChild(dateCell);
        row.appendChild(statusCell);
        
        tableBody.appendChild(row);
    });
}

// Initialize CSV download functionality
function initializeCSVDownload() {
    document.getElementById('download-csv').addEventListener('click', async () => {
        const records = await loadAttendanceData();
        if (!records || records.length === 0) {
            alert('No data to download');
            return;
        }
        
        const headers = ['Student Number', 'Date', 'Status'];
        const csvContent = [
            headers.join(','),
            ...records.map(record => 
                [`Student ${record.studentId}`, record.date, record.status].join(',')
            )
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'attendance_records.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

// Create attendance chart using Chart.js
async function createAttendanceChart() {
    try {
        const response = await fetch('/attendance-data');
        const data = await response.json();
        
        const ctx = document.getElementById('attendance-chart').getContext('2d');
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Present', 'Absent'],
                datasets: [{
                    data: [data.Present, data.Absent],
                    backgroundColor: ['green', 'red'],
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Attendance Distribution'
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating attendance chart:', error);
    }
}